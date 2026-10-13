import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, CLIP_DURATIONS_MS } from '../../src/services/gameEngine';
import { CatalogSongItem } from '../../src/lib/search/catalogSearch';
import { verifyClipStreamToken } from '../../src/lib/security/clipToken';

const testCatalog: CatalogSongItem[] = [
  {
    id: 'song-dilbar-1999',
    workId: 'work-dilbar',
    title: 'Dilbar Dilbar (1999)',
    aliases: ['dilbar sirf tum'],
    artists: ['Alka Yagnik'],
    movieOrAlbum: 'Sirf Tum',
    language: 'hindi',
    era: '90s',
    genres: ['bollywood', 'romantic'],
  },
  {
    id: 'song-dilbar-2018',
    workId: 'work-dilbar',
    title: 'Dilbar (2018 Remake)',
    aliases: ['dilbar satyameva jayate'],
    artists: ['Neha Kakkar', 'Dhvani Bhanushali'],
    movieOrAlbum: 'Satyameva Jayate',
    language: 'hindi',
    era: '2010s',
    genres: ['bollywood', 'dance'],
  },
  {
    id: 'song-chaiyya-1998',
    workId: 'work-chaiyya',
    title: 'Chaiyya Chaiyya',
    aliases: ['chal chaiyya chaiyya'],
    artists: ['Sukhwinder Singh', 'Sapna Awasthi'],
    movieOrAlbum: 'Dil Se',
    language: 'hindi',
    era: '90s',
    genres: ['bollywood', 'folk'],
  },
  {
    id: 'song-kal-ho-naa-ho',
    workId: 'work-khnh',
    title: 'Kal Ho Naa Ho',
    aliases: ['har ghadi badal rahi hai'],
    artists: ['Sonu Nigam'],
    movieOrAlbum: 'Kal Ho Naa Ho',
    language: 'hindi',
    era: '2000s',
    genres: ['bollywood', 'sad'],
  },
];

describe('GameEngine - Server-Authoritative State Machine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(testCatalog);
  });

  it('creates a daily challenge session without leaking solution or songId', async () => {
    const guestId = '11111111-2222-3333-4444-555555555555';
    const session = await engine.getOrCreateDailySession(guestId, '2026-10-14');

    expect(session.sessionId).toBeDefined();
    expect(session.sessionToken).toBeDefined();
    expect(session.status).toBe('IN_PROGRESS');
    expect(session.attemptsUsed).toBe(0);
    expect(session.maxAttempts).toBe(6);

    // ANTI-CHEAT: ensure song title, solution, and answer payload are NOT leaked
    expect(session.answer).toBeUndefined();
    expect((session as any).songId).toBeUndefined();

    // First clip token (0.1s)
    expect(session.currentClip).toBeDefined();
    expect(session.currentClip?.attemptIndex).toBe(0);
    expect(session.currentClip?.durationMs).toBe(100);

    const tokenPart = session.currentClip?.clipStreamUrl.replace('/api/game/clip/', '')!;
    const verification = verifyClipStreamToken(tokenPart);
    expect(verification.isValid).toBe(true);
    expect(verification.attemptIndex).toBe(0);
  });

  it('resumes existing daily challenge session for the same guest and date without reissuing secret', async () => {
    const guestId = 'guest-resume-test';
    const firstCall = await engine.getOrCreateDailySession(guestId, '2026-10-14');
    expect(firstCall.sessionToken).toBeDefined();

    const secondCall = await engine.getOrCreateDailySession(guestId, '2026-10-14');
    expect(secondCall.sessionId).toBe(firstCall.sessionId);
    // Secret is not exposed again on resume for security
    expect(secondCall.sessionToken).toBeUndefined();
    expect(secondCall.attemptsUsed).toBe(0);
  });

  it('evaluates correct guess on first attempt and reveals answer + shareGrid', async () => {
    const guestId = 'guest-win-test';
    const sessionRes = await engine.getOrCreateDailySession(guestId, '2026-10-14');
    const rawSession = engine.getSessionById(sessionRes.sessionId)!;

    // Guess the exact solution song
    const guessRes = await engine.submitGuess(
      sessionRes.sessionId,
      sessionRes.sessionToken!,
      'GUESS',
      rawSession.songId
    );

    expect(guessRes.correct).toBe(true);
    expect(guessRes.gameOver).toBe(true);
    expect(guessRes.status).toBe('WON');
    expect(guessRes.attemptsUsed).toBe(1);
    expect(guessRes.guessResult.isCorrect).toBe(true);
    expect(guessRes.answer).toBeDefined();
    expect(guessRes.shareGrid).toContain('🟩');
  });

  it('accepts remake as correct answer via canonical work_id equivalence', async () => {
    // If solution is Dilbar 1999, guessing Dilbar 2018 remake MUST count as correct!
    const session = await engine.createPracticeSession('guest-remake-test');
    const rawSession = engine.getSessionById(session.sessionId)!;
    // Force target song to be Dilbar 1999
    rawSession.songId = 'song-dilbar-1999';

    const guessRes = await engine.submitGuess(
      session.sessionId,
      session.sessionToken!,
      'GUESS',
      'song-dilbar-2018' // Guess the remake!
    );

    expect(guessRes.correct).toBe(true);
    expect(guessRes.gameOver).toBe(true);
    expect(guessRes.status).toBe('WON');
    expect(guessRes.answer?.title).toBe('Dilbar Dilbar (1999)');
  });

  it('advances through 6 attempts on skips and transitions to LOST with answer revealed', async () => {
    const session = await engine.createPracticeSession('guest-lost-test');
    const token = session.sessionToken!;

    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await engine.submitGuess(session.sessionId, token, 'SKIP');
      expect(res.correct).toBe(false);
      expect(res.gameOver).toBe(false);
      expect(res.status).toBe('IN_PROGRESS');
      expect(res.attemptsUsed).toBe(attempt + 1);
      expect(res.nextClip?.attemptIndex).toBe(attempt + 1);
      expect(res.nextClip?.durationMs).toBe(CLIP_DURATIONS_MS[attempt + 1]);
      expect(res.answer).toBeUndefined(); // Still hidden!
    }

    // 6th attempt (final skip) -> game over LOST
    const finalRes = await engine.submitGuess(session.sessionId, token, 'SKIP');
    expect(finalRes.correct).toBe(false);
    expect(finalRes.gameOver).toBe(true);
    expect(finalRes.status).toBe('LOST');
    expect(finalRes.attemptsUsed).toBe(6);
    expect(finalRes.nextClip).toBeUndefined();
    expect(finalRes.answer).toBeDefined();
    expect(finalRes.shareGrid).toContain('⬛⬛⬛⬛⬛⬛');
  });

  it('handles give-up and immediately marks session as LOST and reveals answer', async () => {
    const session = await engine.createPracticeSession('guest-giveup-test');
    const giveUpRes = await engine.giveUp(session.sessionId, session.sessionToken!);

    expect(giveUpRes.gameOver).toBe(true);
    expect(giveUpRes.status).toBe('LOST');
    expect(giveUpRes.answer).toBeDefined();

    // Subsequent guess must be rejected
    await expect(
      engine.submitGuess(session.sessionId, session.sessionToken!, 'SKIP')
    ).rejects.toThrow(/already finished/);
  });

  it('serializes concurrent rapid guesses without race conditions or skipping attempts', async () => {
    const session = await engine.createPracticeSession('guest-race-test');
    const token = session.sessionToken!;

    // Send 3 skips concurrently at the exact same millisecond
    const results = await Promise.all([
      engine.submitGuess(session.sessionId, token, 'SKIP'),
      engine.submitGuess(session.sessionId, token, 'SKIP'),
      engine.submitGuess(session.sessionId, token, 'SKIP'),
    ]);

    expect(results).toHaveLength(3);
    const attempts = results.map(r => r.attemptsUsed).sort((a, b) => a - b);
    expect(attempts).toEqual([1, 2, 3]);

    const rawSession = engine.getSessionById(session.sessionId)!;
    expect(rawSession.attemptsUsed).toBe(3);
    expect(rawSession.guesses).toHaveLength(3);
  });
});
