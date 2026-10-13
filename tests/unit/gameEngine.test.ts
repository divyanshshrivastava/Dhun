import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { GameEngine, CLIP_DURATIONS_MS } from '../../src/services/gameEngine';
import { verifyClipStreamToken } from '../../src/lib/security/clipToken';
import { getDb, schema } from '../../src/db';
import { eq } from 'drizzle-orm';
import seedCatalog from '../../src/db/seed/songs.json';

describe('GameEngine - Server-Authoritative State Machine Backed by Drizzle PostgreSQL', () => {
  let engine: GameEngine;

  beforeAll(async () => {
    await getDb();
  }, 15000);

  beforeEach(() => {
    engine = new GameEngine();
  });

  it('creates a daily challenge session without leaking solution or songId', async () => {
    const guestId = crypto.randomUUID();
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
    const guestId = crypto.randomUUID();
    const firstCall = await engine.getOrCreateDailySession(guestId, '2026-10-14');
    expect(firstCall.sessionToken).toBeDefined();

    const secondCall = await engine.getOrCreateDailySession(guestId, '2026-10-14');
    expect(secondCall.sessionId).toBe(firstCall.sessionId);
    // Secret is not exposed again on resume for security
    expect(secondCall.sessionToken).toBeUndefined();
    expect(secondCall.attemptsUsed).toBe(0);
  });

  it('evaluates correct guess on first attempt and reveals answer + shareGrid', async () => {
    const guestId = crypto.randomUUID();
    const sessionRes = await engine.getOrCreateDailySession(guestId, '2026-10-14');
    const rawSession = (await engine.getSessionById(sessionRes.sessionId))!;

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

  it('accepts remake as correct answer via canonical work_id equivalence in PostgreSQL', async () => {
    const guestId = crypto.randomUUID();
    const session = await engine.createPracticeSession(guestId);

    // Locate Dilbar 1999 and Dilbar 2018 remake in catalog (they share the same canonical work_id)
    const dilbar1999 = seedCatalog.songs.find(s => s.title.includes('1999') || s.work_id === '69acc111-e99d-4bba-8b93-2b462a3edd29')!;
    const dilbarRemake = seedCatalog.songs.find(s => s.work_id === dilbar1999.work_id && s.id !== dilbar1999.id)!;

    // Set the game session's target song in the database to Dilbar 1999
    const db = await getDb();
    await db
      .update(schema.gameSessions)
      .set({ song_id: dilbar1999.id })
      .where(eq(schema.gameSessions.id, session.sessionId));

    // Guess the remake recording!
    const guessRes = await engine.submitGuess(
      session.sessionId,
      session.sessionToken!,
      'GUESS',
      dilbarRemake.id
    );

    expect(guessRes.correct).toBe(true);
    expect(guessRes.gameOver).toBe(true);
    expect(guessRes.status).toBe('WON');
    expect(guessRes.answer?.title).toBe(dilbar1999.title);
  });

  it('advances through 6 attempts on skips and transitions to LOST with answer revealed', async () => {
    const guestId = crypto.randomUUID();
    const session = await engine.createPracticeSession(guestId);
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
    const guestId = crypto.randomUUID();
    const session = await engine.createPracticeSession(guestId);
    const giveUpRes = await engine.giveUp(session.sessionId, session.sessionToken!);

    expect(giveUpRes.gameOver).toBe(true);
    expect(giveUpRes.status).toBe('LOST');
    expect(giveUpRes.answer).toBeDefined();

    // Subsequent guess must be rejected
    await expect(
      engine.submitGuess(session.sessionId, session.sessionToken!, 'SKIP')
    ).rejects.toThrow(/already finished/);
  });

  it('serializes concurrent guesses at the database level using transactions and row locks', async () => {
    const guestId = crypto.randomUUID();
    const session = await engine.createPracticeSession(guestId);
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

    const rawSession = (await engine.getSessionById(session.sessionId))!;
    expect(rawSession.attemptsUsed).toBe(3);
    expect(rawSession.guesses).toHaveLength(3);
  });
});
