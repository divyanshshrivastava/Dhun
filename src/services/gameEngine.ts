// Server-Authoritative Game Engine for Dhun
// 100% Backed by Drizzle ORM and PostgreSQL
// Guarantees:
// 1. Solution song ID and metadata NEVER leave the server before game end
// 2. Answers are evaluated with canonical work_id remake equivalence
// 3. Database-level concurrency protection via SELECT ... FOR UPDATE and atomic CAS update with row-count check
// 4. Session tokens are hashed with SHA-256 before database storage
// 5. Daily challenge songs stored permanently in daily_challenges table

import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { CatalogSongItem, checkIfRemakeOrExactMatchBhai } from '../lib/search/catalogSearch';
import { generateClipStreamToken, generateSessionSecret, hashSessionSecret } from '../lib/security/clipToken';
import { resolveDailySong, getTodayChallengeDate } from './dailyChallengeService';
import { getClipStorage } from './storage/LocalClipStorage';
import { checkSongHasAllClips } from './storage/ClipStorage';
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
  createdAt?: number;
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
  solution?: {
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
  currentClip?: {
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
  solution?: {
    title: string;
    artists: string[];
    movieOrAlbum?: string;
    language: string;
    era: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
  };
  allGuesses?: Array<{
    attemptIndex: number;
    action: 'GUESS' | 'SKIP';
    isCorrect: boolean;
    guessedSongTitle?: string;
  }>;
  shareGrid?: string;
}

export interface PlayerStats {
  guestId: string;
  gamesPlayed: number;
  gamesWon: number;
  winPercentage: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
    6: number;
  };
}

export const CLIP_DURATIONS_MS = [100, 500, 1500, 4000, 8000, 15000];

export class GameEngine {
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

  getCatalogSong(songId: string): CatalogSongItem | undefined {
    return this.catalog.find(s => s.id === songId);
  }

  // Retrieves playable candidate songs ensuring all 6 cumulative clips exist in storage
  async getPlayableSongPool(filters?: { language?: string; era?: string; genre?: string }): Promise<CatalogSongItem[]> {
    const db = await getDb();
    const clipStorage = getClipStorage();

    let pool = this.catalog;

    // 1. Query active songs from DB if accessible
    try {
      const activeDbSongs = await db
        .select({ id: schema.songs.id })
        .from(schema.songs)
        .where(eq(schema.songs.active, true));

      if (activeDbSongs && activeDbSongs.length > 0) {
        const activeIds = new Set(activeDbSongs.map((s: any) => s.id));
        const allDbSongs = await db.select({ id: schema.songs.id }).from(schema.songs);
        const allDbIds = new Set(allDbSongs.map((s: any) => s.id));

        pool = pool.filter(s => {
          if (allDbIds.has(s.id)) {
            return activeIds.has(s.id);
          }
          return true;
        });
      }
    } catch {
      // Standalone/in-memory mode fallback
    }

    // 2. Apply practice filters if provided
    if (filters?.language) {
      pool = pool.filter(s => s.language.toLowerCase() === filters.language!.toLowerCase());
    }
    if (filters?.era) {
      pool = pool.filter(s => s.era.toLowerCase() === filters.era!.toLowerCase());
    }
    if (filters?.genre) {
      pool = pool.filter(s => s.genres && s.genres.some(g => g.toLowerCase() === filters.genre!.toLowerCase()));
    }

    // 3. Filter only songs where all 6 clips exist in storage
    const songsWithAllClips: CatalogSongItem[] = [];
    for (const song of pool) {
      const hasClips = await checkSongHasAllClips(song.id, clipStorage);
      if (hasClips) {
        songsWithAllClips.push(song);
      }
    }

    if (songsWithAllClips.length > 0) {
      return songsWithAllClips;
    }

    // In production, strictly enforce that songs must have all 6 clips uploaded
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No songs with complete audio clips available in storage.');
    }

    // In dev & test (before master audio files are sliced), fall back to filtered pool for synthetic tones
    return pool;
  }

  // Starts or resumes a Daily Challenge session backed by PostgreSQL
  async getOrCreateDailySession(guestId: string, customDate?: string): Promise<ClientSessionResponse> {
    const db = await getDb();
    const challengeDate = customDate || getTodayChallengeDate();

    // 1. Resolve or permanently store today's daily challenge in daily_challenges table
    let [dailyRecord] = await db
      .select()
      .from(schema.dailyChallenges)
      .where(eq(schema.dailyChallenges.challenge_date, challengeDate));

    const overrideId = process.env.DHUN_DAILY_OVERRIDE_SONG_ID;
    if (overrideId) {
      const targetSong = this.catalog.find(
        s => s.id === overrideId || s.title.toLowerCase() === overrideId.toLowerCase()
      );
      if (targetSong) {
        if (!dailyRecord) {
          const inserted = await db
            .insert(schema.dailyChallenges)
            .values({
              challenge_date: challengeDate,
              song_id: targetSong.id,
              published: true,
            })
            .returning();
          dailyRecord = inserted[0];
        } else if (dailyRecord.song_id !== targetSong.id) {
          await db
            .update(schema.dailyChallenges)
            .set({ song_id: targetSong.id })
            .where(eq(schema.dailyChallenges.id, dailyRecord.id));
          dailyRecord.song_id = targetSong.id;
        }
      }
    } else if (!dailyRecord) {
      const candidateSongs = await this.getPlayableSongPool();
      const dailySong = resolveDailySong(challengeDate, candidateSongs);
      const inserted = await db
        .insert(schema.dailyChallenges)
        .values({
          challenge_date: challengeDate,
          song_id: dailySong.id,
          published: true,
        })
        .onConflictDoNothing()
        .returning();

      if (inserted && inserted.length > 0) {
        dailyRecord = inserted[0];
      } else {
        [dailyRecord] = await db
          .select()
          .from(schema.dailyChallenges)
          .where(eq(schema.dailyChallenges.challenge_date, challengeDate));
      }
    }

    // 2. Session Resume Check via UNIQUE(guest_id, daily_challenge_id)
    const [existingSession] = await db
      .select()
      .from(schema.gameSessions)
      .where(
        and(
          eq(schema.gameSessions.guest_id, guestId),
          eq(schema.gameSessions.daily_challenge_id, dailyRecord.id)
        )
      );

    if (existingSession) {
      if (existingSession.song_id !== dailyRecord.song_id) {
        // Daily challenge song was updated (e.g. custom test song override) -> start fresh session
        await db.delete(schema.guesses).where(eq(schema.guesses.session_id, existingSession.id));
        await db.delete(schema.gameSessions).where(eq(schema.gameSessions.id, existingSession.id));
      } else {
        const previousGuesses = await db
          .select()
          .from(schema.guesses)
          .where(eq(schema.guesses.session_id, existingSession.id))
          .orderBy(schema.guesses.attempt_index);

        return this.formatSessionResponse(existingSession, previousGuesses, challengeDate);
      }
    }

    // 3. Create fresh session in PostgreSQL
    const sessionId = crypto.randomUUID();
    const rawSecret = generateSessionSecret();
    const secretHash = hashSessionSecret(rawSecret);

    const [newSession] = await db
      .insert(schema.gameSessions)
      .values({
        id: sessionId,
        guest_id: guestId,
        session_token_hash: secretHash,
        mode: 'DAILY',
        daily_challenge_id: dailyRecord.id,
        song_id: dailyRecord.song_id,
        attempts_used: 0,
        max_attempts: 6,
        status: 'IN_PROGRESS',
      })
      .returning();

    const clientRes = this.formatSessionResponse(newSession, [], challengeDate);
    clientRes.sessionToken = rawSecret; // Secret returned only once upon creation
    return clientRes;
  }

  // Starts a Practice Session with optional language/era filters
  async createPracticeSession(
    guestId: string,
    filters?: { language?: string; era?: string; genre?: string }
  ): Promise<ClientSessionResponse> {
    const db = await getDb();
    const pool = await this.getPlayableSongPool(filters);

    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosenSong = pool[randomIndex];

    const sessionId = crypto.randomUUID();
    const rawSecret = generateSessionSecret();
    const secretHash = hashSessionSecret(rawSecret);

    const [newSession] = await db
      .insert(schema.gameSessions)
      .values({
        id: sessionId,
        guest_id: guestId,
        session_token_hash: secretHash,
        mode: 'PRACTICE',
        song_id: chosenSong.id,
        attempts_used: 0,
        max_attempts: 6,
        status: 'IN_PROGRESS',
        filter_language: filters?.language,
        filter_era: filters?.era,
        filter_genre: filters?.genre,
      })
      .returning();

    const clientRes = this.formatSessionResponse(newSession, []);
    clientRes.sessionToken = rawSecret;
    return clientRes;
  }

  // Evaluates a guess or skip with database-level row lock and atomic CAS update
  async submitGuess(
    sessionId: string,
    sessionToken: string,
    action: 'GUESS' | 'SKIP',
    guessedSongId?: string
  ): Promise<SubmitGuessResponse> {
    const db = await getDb();

    return await db.transaction(async (tx: any) => {
      // 1. Database-level row lock (SELECT ... FOR UPDATE)
      await tx.execute(sql`SELECT id FROM game_sessions WHERE id = ${sessionId} FOR UPDATE`);

      // 2. Fetch current locked session state
      const [session] = await tx
        .select()
        .from(schema.gameSessions)
        .where(eq(schema.gameSessions.id, sessionId));

      if (!session) {
        throw new Error('Game session not found');
      }

      // 3. Authenticate session token
      const incomingHash = hashSessionSecret(sessionToken);
      if (incomingHash !== session.session_token_hash) {
        throw new Error('Unauthorized session token');
      }

      if (session.status !== 'IN_PROGRESS') {
        throw new Error(`Game session is already finished with status: ${session.status}`);
      }

      // 4. Locate solution track
      const solutionTrack = this.catalog.find(s => s.id === session.song_id);
      if (!solutionTrack) {
        throw new Error('Solution song missing from catalog');
      }

      const currentAttempt = session.attempts_used;
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

      const nextAttempt = currentAttempt + 1;
      let newStatus: 'IN_PROGRESS' | 'WON' | 'LOST' = 'IN_PROGRESS';
      if (isCorrect) {
        newStatus = 'WON';
      } else if (nextAttempt >= session.max_attempts) {
        newStatus = 'LOST';
      }

      // 5. Atomic compare-and-swap update with row-count check
      const updated = await tx
        .update(schema.gameSessions)
        .set({
          attempts_used: nextAttempt,
          status: newStatus,
          completed_at: newStatus !== 'IN_PROGRESS' ? new Date() : null,
        })
        .where(
          and(
            eq(schema.gameSessions.id, sessionId),
            eq(schema.gameSessions.attempts_used, currentAttempt),
            eq(schema.gameSessions.status, 'IN_PROGRESS')
          )
        )
        .returning();

      if (updated.length === 0) {
        throw new Error('Concurrent request conflict: attempt already progressed or game finished');
      }

      // 6. Record guess into guesses table
      await tx.insert(schema.guesses).values({
        session_id: sessionId,
        attempt_index: currentAttempt,
        guess_type: action === 'GUESS' ? 'SONG_GUESS' : 'SKIPPED',
        guessed_song_id: action === 'GUESS' ? guessedSongId : null,
        raw_guess_text: action === 'GUESS' ? guessedTrack?.title : 'Skipped',
        is_correct: isCorrect,
      });

      // 7. Update player stats in PostgreSQL if game finished
      if (newStatus !== 'IN_PROGRESS') {
        await this.recordStatsInDb(tx, session.guest_id, newStatus === 'WON', nextAttempt);
      }

      // 8. Prepare next clip or answer payload
      let nextClip: SubmitGuessResponse['nextClip'];
      let answerPayload: SubmitGuessResponse['answer'];

      if (newStatus === 'IN_PROGRESS') {
        const nextDuration = CLIP_DURATIONS_MS[nextAttempt];
        const token = generateClipStreamToken(sessionId, nextAttempt, 60);
        nextClip = {
          attemptIndex: nextAttempt,
          durationMs: nextDuration,
          clipStreamUrl: `/api/game/clip/${token}`,
        };
      } else {
        answerPayload = this.buildAnswerPayload(solutionTrack);
      }

      const allGuesses = await tx
        .select()
        .from(schema.guesses)
        .where(eq(schema.guesses.session_id, sessionId))
        .orderBy(schema.guesses.attempt_index);

      return {
        correct: isCorrect,
        gameOver: newStatus !== 'IN_PROGRESS',
        status: newStatus,
        attemptsUsed: nextAttempt,
        guessResult: {
          attemptIndex: currentAttempt,
          action,
          isCorrect,
          guessedSongTitle: guessedTrack?.title,
          guessedSongArtists: guessedTrack?.artists,
        },
        nextClip,
        currentClip: nextClip,
        answer: answerPayload,
        solution: answerPayload,
        allGuesses: allGuesses.map((g: any) => ({
          attemptIndex: g.attempt_index,
          action: g.guess_type === 'SONG_GUESS' ? 'GUESS' : 'SKIP',
          isCorrect: g.is_correct,
          guessedSongTitle: g.raw_guess_text,
        })),
        shareGrid: newStatus !== 'IN_PROGRESS' ? this.buildShareGrid(session.mode, allGuesses, session.max_attempts) : undefined,
      };
    });
  }

  // Player gives up
  async giveUp(sessionId: string, sessionToken: string): Promise<SubmitGuessResponse> {
    const db = await getDb();

    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT id FROM game_sessions WHERE id = ${sessionId} FOR UPDATE`);

      const [session] = await tx
        .select()
        .from(schema.gameSessions)
        .where(eq(schema.gameSessions.id, sessionId));

      if (!session) throw new Error('Game session not found');

      const incomingHash = hashSessionSecret(sessionToken);
      if (incomingHash !== session.session_token_hash) throw new Error('Unauthorized session token');

      if (session.status !== 'IN_PROGRESS') {
        throw new Error('Session is already completed');
      }

      await tx
        .update(schema.gameSessions)
        .set({
          status: 'LOST',
          completed_at: new Date(),
        })
        .where(eq(schema.gameSessions.id, sessionId));

      await this.recordStatsInDb(tx, session.guest_id, false, session.attempts_used);

      const solutionTrack = this.catalog.find(s => s.id === session.song_id)!;
      const allGuesses = await tx
        .select()
        .from(schema.guesses)
        .where(eq(schema.guesses.session_id, sessionId))
        .orderBy(schema.guesses.attempt_index);

      const answerPayload = this.buildAnswerPayload(solutionTrack);

      return {
        correct: false,
        gameOver: true,
        status: 'LOST',
        attemptsUsed: session.attempts_used,
        guessResult: {
          attemptIndex: session.attempts_used,
          action: 'SKIP',
          isCorrect: false,
        },
        answer: answerPayload,
        solution: answerPayload,
        allGuesses: allGuesses.map((g: any) => ({
          attemptIndex: g.attempt_index,
          action: g.guess_type === 'SONG_GUESS' ? 'GUESS' : 'SKIP',
          isCorrect: g.is_correct,
          guessedSongTitle: g.raw_guess_text,
        })),
        shareGrid: this.buildShareGrid(session.mode, allGuesses, session.max_attempts),
      };
    });
  }

  // Look up session state by ID from PostgreSQL
  async getSessionById(sessionId: string): Promise<GameSessionState | undefined> {
    const db = await getDb();
    const [session] = await db
      .select()
      .from(schema.gameSessions)
      .where(eq(schema.gameSessions.id, sessionId));

    if (!session) return undefined;

    const sessionGuesses = await db
      .select()
      .from(schema.guesses)
      .where(eq(schema.guesses.session_id, sessionId))
      .orderBy(schema.guesses.attempt_index);

    return {
      id: session.id,
      guestId: session.guest_id,
      sessionTokenHash: session.session_token_hash,
      mode: session.mode as 'DAILY' | 'PRACTICE',
      songId: session.song_id,
      attemptsUsed: session.attempts_used,
      maxAttempts: session.max_attempts,
      status: session.status as 'IN_PROGRESS' | 'WON' | 'LOST',
      guesses: sessionGuesses.map((g: any) => ({
        attemptIndex: g.attempt_index,
        action: g.guess_type === 'SONG_GUESS' ? 'GUESS' : 'SKIP',
        guessedSongId: g.guessed_song_id,
        isCorrect: g.is_correct,
        guessedSongTitle: g.raw_guess_text,
      })),
    };
  }

  // Look up player stats from PostgreSQL
  async getPlayerStats(guestId: string): Promise<PlayerStats> {
    const db = await getDb();
    const [stats] = await db
      .select()
      .from(schema.playerStats)
      .where(eq(schema.playerStats.guest_id, guestId));

    if (stats) {
      return {
        guestId: stats.guest_id,
        gamesPlayed: stats.games_played,
        gamesWon: stats.games_won,
        winPercentage: stats.games_played > 0 ? Math.round((stats.games_won / stats.games_played) * 100) : 0,
        currentStreak: stats.current_streak,
        maxStreak: stats.max_streak,
        guessDistribution: (stats.guess_distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }) as any,
      };
    }

    return {
      guestId,
      gamesPlayed: 0,
      gamesWon: 0,
      winPercentage: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    };
  }

  // Updates player stats record in PostgreSQL
  private async recordStatsInDb(tx: any, guestId: string, won: boolean, attempts: number): Promise<void> {
    const [existing] = await tx
      .select()
      .from(schema.playerStats)
      .where(eq(schema.playerStats.guest_id, guestId));

    const safeAttempts = Math.min(6, Math.max(1, attempts)).toString();

    if (existing) {
      const gamesPlayed = existing.games_played + 1;
      const gamesWon = won ? existing.games_won + 1 : existing.games_won;
      const currentStreak = won ? existing.current_streak + 1 : 0;
      const maxStreak = Math.max(existing.max_streak, currentStreak);
      const dist = (existing.guess_distribution || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 }) as Record<string, number>;
      if (won) {
        dist[safeAttempts] = (dist[safeAttempts] || 0) + 1;
      }

      await tx
        .update(schema.playerStats)
        .set({
          games_played: gamesPlayed,
          games_won: gamesWon,
          current_streak: currentStreak,
          max_streak: maxStreak,
          guess_distribution: dist,
          updated_at: new Date(),
        })
        .where(eq(schema.playerStats.guest_id, guestId));
    } else {
      const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
      if (won) {
        dist[safeAttempts] = 1;
      }

      await tx.insert(schema.playerStats).values({
        guest_id: guestId,
        games_played: 1,
        games_won: won ? 1 : 0,
        current_streak: won ? 1 : 0,
        max_streak: won ? 1 : 0,
        guess_distribution: dist,
      });
    }
  }

  private buildShareGrid(mode: string, allGuesses: any[], maxAttempts: number): string {
    let gridString = `Dhun ${mode === 'DAILY' ? '#Daily' : 'Practice'}\n`;
    const row: string[] = [];
    for (let i = 0; i < maxAttempts; i++) {
      const g = allGuesses.find((guess: any) => guess.attempt_index === i);
      if (!g) {
        row.push('⬜');
      } else if (g.is_correct) {
        row.push('🟩');
      } else if (g.guess_type === 'SKIPPED') {
        row.push('⬛');
      } else {
        row.push('🟥');
      }
    }
    gridString += row.join('');
    gridString += `\nhttps://dhun.in`;
    return gridString;
  }

  private formatSessionResponse(
    session: any,
    previousGuesses: any[] = [],
    challengeDate?: string
  ): ClientSessionResponse {
    let currentClip: ClientSessionResponse['currentClip'];
    let answerPayload: ClientSessionResponse['answer'];

    if (session.status === 'IN_PROGRESS') {
      const activeAttempt = session.attempts_used;
      if (activeAttempt < session.max_attempts) {
        const duration = CLIP_DURATIONS_MS[activeAttempt];
        const clipToken = generateClipStreamToken(session.id, activeAttempt, 60);
        currentClip = {
          attemptIndex: activeAttempt,
          durationMs: duration,
          clipStreamUrl: `/api/game/clip/${clipToken}`,
        };
      }
    } else {
      const solutionTrack = this.catalog.find(s => s.id === session.song_id)!;
      answerPayload = this.buildAnswerPayload(solutionTrack);
    }

    return {
      sessionId: session.id,
      mode: session.mode,
      challengeDate,
      status: session.status,
      attemptsUsed: session.attempts_used,
      maxAttempts: session.max_attempts,
      clipLengthsMs: CLIP_DURATIONS_MS,
      currentClip,
      previousGuesses: previousGuesses.map((g: any) => ({
        attemptIndex: g.attempt_index,
        action: g.guess_type === 'SONG_GUESS' ? 'GUESS' : 'SKIP',
        isCorrect: g.is_correct,
        guessedSongTitle: g.raw_guess_text,
      })),
      answer: answerPayload,
      solution: answerPayload,
      shareGrid: session.status !== 'IN_PROGRESS' ? this.buildShareGrid(session.mode, previousGuesses, session.max_attempts) : undefined,
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

// Global engine singleton attached to globalThis to survive Next.js per-route module bundling
declare global {
  // eslint-disable-next-line no-var
  var __dhun_game_engine: GameEngine | undefined;
}

let globalGameEngine: GameEngine | null = null;

export function getGameEngine(): GameEngine {
  if (process.env.NODE_ENV === 'production' && globalThis.__dhun_game_engine) {
    return globalThis.__dhun_game_engine;
  }
  const engine = new GameEngine();
  if (process.env.NODE_ENV === 'production') {
    globalThis.__dhun_game_engine = engine;
  }
  return engine;
}
