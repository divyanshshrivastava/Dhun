// Server-Authoritative Game Engine for Dhun
// Guarantees:
// 1. Solution song ID and metadata NEVER leave the server before game end
// 2. Answers are evaluated with canonical work_id remake equivalence
// 3. Clip tokens are released attempt-by-attempt only after a guess or skip is recorded
// 4. Session tokens are hashed with SHA-256 before storage
// 5. Concurrency protection against race conditions on rapid guesses

import { CatalogSongItem, searchSongCatalog, checkIfRemakeOrExactMatchBhai } from '../lib/search/catalogSearch';
import { generateClipStreamToken, generateSessionSecret, hashSessionSecret } from '../lib/security/clipToken';
import { resolveDailySong, getTodayChallengeDate } from './dailyChallengeService';
import seedCatalog from '../db/seed/songs.json';

export interface GameSessionState {
  id: string;
  guestId: string;
  sessionTokenHash: string;
  mode: 'DAILY' | 'PRACTICE';
  challengeDate?: string;
  dailyChallengeId?: string;
  songId: string;
  attemptsUsed: number;
  maxAttempts: number;
  status: 'IN_PROGRESS' | 'WON' | 'LOST';
  filterLanguage?: string;
  filterEra?: string;
  filterGenre?: string;
  guesses: Array<{
    attemptIndex: number;
    action: 'GUESS' | 'SKIP';
    guessedSongId?: string;
    isCorrect: boolean;
    guessedSongTitle?: string;
    guessedSongArtists?: string[];
  }>;
  createdAt: number;
  completedAt?: number;
}

export interface ClientSessionResponse {
  sessionId: string;
  sessionToken?: string; // Only returned on session creation
  mode: 'DAILY' | 'PRACTICE';
  challengeDate?: string;
  status: 'IN_PROGRESS' | 'WON' | 'LOST';
  attemptsUsed: number;
  maxAttempts: number;
  clipLengthsMs: number[];
  currentClip?: {
    attemptIndex: number;
    durationMs: number;
    clipStreamUrl: string;
  };
  previousGuesses: Array<{
    attemptIndex: number;
    action: 'GUESS' | 'SKIP';
    isCorrect: boolean;
    guessedSongTitle?: string;
    guessedSongArtists?: string[];
  }>;
  answer?: {
    title: string;
    artists: string[];
    movieOrAlbum?: string;
    language: string;
    era: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
  };
  shareGrid?: string;
}

export interface SubmitGuessResponse {
  correct: boolean;
  gameOver: boolean;
  status: 'IN_PROGRESS' | 'WON' | 'LOST';
  attemptsUsed: number;
  guessResult: {
    attemptIndex: number;
    action: 'GUESS' | 'SKIP';
    isCorrect: boolean;
    guessedSongTitle?: string;
    guessedSongArtists?: string[];
  };
  nextClip?: {
    attemptIndex: number;
    durationMs: number;
    clipStreamUrl: string;
  };
  answer?: {
    title: string;
    artists: string[];
    movieOrAlbum?: string;
    language: string;
    era: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
  };
  shareGrid?: string;
}

export const CLIP_DURATIONS_MS = [100, 500, 1500, 4000, 8000, 15000];

// In-memory session store supporting fast concurrency and automated tests
export class GameEngine {
  private sessions: Map<string, GameSessionState> = new Map();
  private guestDailyIndex: Map<string, string> = new Map(); // `${guestId}:${challengeDate}` -> sessionId
  private catalog: CatalogSongItem[];

  constructor(customCatalog?: CatalogSongItem[]) {
    this.catalog = customCatalog || (seedCatalog.songs.map(s => ({
      id: s.id,
      workId: s.work_id,
      title: s.title,
      aliases: s.aliases,
      artists: s.artists,
      movieOrAlbum: s.movie_or_album,
      language: s.language,
      era: s.era,
      genres: s.genres,
    })));
  }

  // Generates Wordle-style shareable emoji grid
  generateShareGrid(session: GameSessionState): string {
    const totalAttempts = session.maxAttempts;
    let gridString = `Dhun ${session.mode === 'DAILY' ? '#' + session.challengeDate : 'Practice'}\n`;

    const row: string[] = [];
    for (let i = 0; i < totalAttempts; i++) {
      const g = session.guesses.find(guess => guess.attemptIndex === i);
      if (!g) {
        row.push('⬜'); // Unused attempt
      } else if (g.isCorrect) {
        row.push('🟩'); // Correct guess
      } else if (g.action === 'SKIP') {
        row.push('⬛'); // Skipped
      } else {
        row.push('🟥'); // Incorrect guess
      }
    }

    gridString += row.join('');
    gridString += `\nhttps://dhun.in`;
    return gridString;
  }

  // Starts or resumes a Daily Challenge session
  async getOrCreateDailySession(guestId: string, customDate?: string): Promise<ClientSessionResponse> {
    const challengeDate = customDate || getTodayChallengeDate();
    const guestDailyKey = `${guestId}:${challengeDate}`;

    // 1. Session Resume Check
    const existingSessionId = this.guestDailyIndex.get(guestDailyKey);
    if (existingSessionId && this.sessions.has(existingSessionId)) {
      const existing = this.sessions.get(existingSessionId)!;
      return this.formatSessionResponse(existing);
    }

    // 2. Select today's song via calendar resolver
    const dailySong = resolveDailySong(challengeDate, this.catalog);

    // 3. Create fresh session
    const sessionId = crypto.randomUUID();
    const rawSecret = generateSessionSecret();
    const secretHash = hashSessionSecret(rawSecret);

    const newSession: GameSessionState = {
      id: sessionId,
      guestId,
      sessionTokenHash: secretHash,
      mode: 'DAILY',
      challengeDate,
      songId: dailySong.id,
      attemptsUsed: 0,
      maxAttempts: 6,
      status: 'IN_PROGRESS',
      guesses: [],
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, newSession);
    this.guestDailyIndex.set(guestDailyKey, sessionId);

    const clientRes = this.formatSessionResponse(newSession);
    clientRes.sessionToken = rawSecret; // Secret returned only once upon creation
    return clientRes;
  }

  // Starts a Practice Session with optional language/era filters
  async createPracticeSession(
    guestId: string,
    filters?: { language?: string; era?: string; genre?: string }
  ): Promise<ClientSessionResponse> {
    let pool = this.catalog;

    if (filters?.language) {
      pool = pool.filter(s => s.language.toLowerCase() === filters.language!.toLowerCase());
    }
    if (filters?.era) {
      pool = pool.filter(s => s.era.toLowerCase() === filters.era!.toLowerCase());
    }

    if (pool.length === 0) {
      pool = this.catalog; // Fallback to full catalog if filters too restrictive
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosenSong = pool[randomIndex];

    const sessionId = crypto.randomUUID();
    const rawSecret = generateSessionSecret();
    const secretHash = hashSessionSecret(rawSecret);

    const newSession: GameSessionState = {
      id: sessionId,
      guestId,
      sessionTokenHash: secretHash,
      mode: 'PRACTICE',
      songId: chosenSong.id,
      attemptsUsed: 0,
      maxAttempts: 6,
      status: 'IN_PROGRESS',
      filterLanguage: filters?.language,
      filterEra: filters?.era,
      filterGenre: filters?.genre,
      guesses: [],
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, newSession);

    const clientRes = this.formatSessionResponse(newSession);
    clientRes.sessionToken = rawSecret;
    return clientRes;
  }

  private sessionLocks: Map<string, Promise<void>> = new Map();

  // Ensures concurrent requests for the same session are strictly serialized
  private async withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.sessionLocks.get(sessionId) || Promise.resolve();
    let releaseLock: () => void;
    const newLock = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    this.sessionLocks.set(sessionId, currentLock.then(() => newLock));

    await currentLock;
    try {
      return await fn();
    } finally {
      releaseLock!();
      if (this.sessionLocks.get(sessionId) === newLock) {
        this.sessionLocks.delete(sessionId);
      }
    }
  }

  // Evaluates a guess or skip with atomic attempt progression
  async submitGuess(
    sessionId: string,
    sessionToken: string,
    action: 'GUESS' | 'SKIP',
    guessedSongId?: string
  ): Promise<SubmitGuessResponse> {
    return this.withSessionLock(sessionId, async () => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Game session not found');
      }

    // Authenticate session token
    const incomingHash = hashSessionSecret(sessionToken);
    if (incomingHash !== session.sessionTokenHash) {
      throw new Error('Unauthorized session token');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new Error(`Game session is already finished with status: ${session.status}`);
    }

    // Locate the secret solution track
    const solutionTrack = this.catalog.find(s => s.id === session.songId);
    if (!solutionTrack) {
      throw new Error('Solution song missing from catalog');
    }

    const currentAttemptIndex = session.attemptsUsed;
    let isCorrect = false;
    let guessedTrack: CatalogSongItem | undefined;

    if (action === 'GUESS') {
      if (!guessedSongId) {
        throw new Error('guessedSongId is required when action is GUESS');
      }
      guessedTrack = this.catalog.find(s => s.id === guessedSongId);
      if (!guessedTrack) {
        throw new Error('Guessed song not found in catalog');
      }

      // Check match using canonical work_id equivalence!
      isCorrect = checkIfRemakeOrExactMatchBhai(guessedTrack, solutionTrack);
    }

    // Atomic update
    session.attemptsUsed += 1;
    const guessRecord = {
      attemptIndex: currentAttemptIndex,
      action,
      guessedSongId,
      isCorrect,
      guessedSongTitle: guessedTrack?.title,
      guessedSongArtists: guessedTrack?.artists,
    };
    session.guesses.push(guessRecord);

    let nextClip: { attemptIndex: number; durationMs: number; clipStreamUrl: string } | undefined;
    let answerPayload: ClientSessionResponse['answer'];

    if (isCorrect) {
      session.status = 'WON';
      session.completedAt = Date.now();
      answerPayload = this.buildAnswerPayload(solutionTrack);
    } else if (session.attemptsUsed >= session.maxAttempts) {
      session.status = 'LOST';
      session.completedAt = Date.now();
      answerPayload = this.buildAnswerPayload(solutionTrack);
    } else {
      // Game continues: unlock next longer clip
      const nextAttemptIndex = session.attemptsUsed;
      const nextDuration = CLIP_DURATIONS_MS[nextAttemptIndex];
      const token = generateClipStreamToken(session.id, nextAttemptIndex, 60);
      nextClip = {
        attemptIndex: nextAttemptIndex,
        durationMs: nextDuration,
        clipStreamUrl: `/api/game/clip/${token}`,
      };
    }

      return {
        correct: isCorrect,
        gameOver: session.status !== 'IN_PROGRESS',
        status: session.status,
        attemptsUsed: session.attemptsUsed,
        guessResult: {
          attemptIndex: currentAttemptIndex,
          action,
          isCorrect,
          guessedSongTitle: guessedTrack?.title,
          guessedSongArtists: guessedTrack?.artists,
        },
        nextClip,
        answer: answerPayload,
        shareGrid: session.status !== 'IN_PROGRESS' ? this.generateShareGrid(session) : undefined,
      };
    });
  }

  // Player gives up
  async giveUp(sessionId: string, sessionToken: string): Promise<SubmitGuessResponse> {
    return this.withSessionLock(sessionId, async () => {
      const session = this.sessions.get(sessionId);
      if (!session) throw new Error('Game session not found');

      const incomingHash = hashSessionSecret(sessionToken);
      if (incomingHash !== session.sessionTokenHash) throw new Error('Unauthorized session token');

      if (session.status !== 'IN_PROGRESS') {
        throw new Error('Session is already completed');
      }

      session.status = 'LOST';
      session.completedAt = Date.now();

      const solutionTrack = this.catalog.find(s => s.id === session.songId)!;
      return {
        correct: false,
        gameOver: true,
        status: 'LOST',
        attemptsUsed: session.attemptsUsed,
        guessResult: {
          attemptIndex: session.attemptsUsed,
          action: 'SKIP',
          isCorrect: false,
        },
        answer: this.buildAnswerPayload(solutionTrack),
        shareGrid: this.generateShareGrid(session),
      };
    });
  }

  // Look up raw session state by ID
  getSessionById(sessionId: string): GameSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  // Formats safe client payload — NEVER includes song ID or answer before game over
  private formatSessionResponse(session: GameSessionState): ClientSessionResponse {
    let currentClip: ClientSessionResponse['currentClip'];
    let answerPayload: ClientSessionResponse['answer'];

    if (session.status === 'IN_PROGRESS') {
      const activeAttempt = session.attemptsUsed;
      if (activeAttempt < session.maxAttempts) {
        const duration = CLIP_DURATIONS_MS[activeAttempt];
        const clipToken = generateClipStreamToken(session.id, activeAttempt, 60);
        currentClip = {
          attemptIndex: activeAttempt,
          durationMs: duration,
          clipStreamUrl: `/api/game/clip/${clipToken}`,
        };
      }
    } else {
      // Game ended: reveal answer
      const solutionTrack = this.catalog.find(s => s.id === session.songId)!;
      answerPayload = this.buildAnswerPayload(solutionTrack);
    }

    return {
      sessionId: session.id,
      mode: session.mode,
      challengeDate: session.challengeDate,
      status: session.status,
      attemptsUsed: session.attemptsUsed,
      maxAttempts: session.maxAttempts,
      clipLengthsMs: CLIP_DURATIONS_MS,
      currentClip,
      previousGuesses: session.guesses.map(g => ({
        attemptIndex: g.attemptIndex,
        action: g.action,
        isCorrect: g.isCorrect,
        guessedSongTitle: g.guessedSongTitle,
        guessedSongArtists: g.guessedSongArtists,
      })),
      answer: answerPayload,
      shareGrid: session.status !== 'IN_PROGRESS' ? this.generateShareGrid(session) : undefined,
    };
  }

  private buildAnswerPayload(track: CatalogSongItem): ClientSessionResponse['answer'] {
    return {
      title: track.title,
      artists: track.artists,
      movieOrAlbum: track.movieOrAlbum,
      language: track.language,
      era: track.era,
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(track.title)}`,
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(track.title + ' song')}`,
    };
  }
}

// Global engine singleton
let globalGameEngine: GameEngine | null = null;

export function getGameEngine(): GameEngine {
  if (!globalGameEngine) {
    globalGameEngine = new GameEngine();
  }
  return globalGameEngine;
}
