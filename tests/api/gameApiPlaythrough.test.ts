import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleSessionPost } from '../../src/app/api/game/session/route';
import { POST as handleGuessPost } from '../../src/app/api/game/guess/route';
import { GET as handleClipGet } from '../../src/app/api/game/clip/[token]/route';
import { GET as handleStatsGet } from '../../src/app/api/stats/[guestId]/route';
import { generateClipStreamToken } from '../../src/lib/security/clipToken';
import { getGameEngine } from '../../src/services/gameEngine';
import seedCatalog from '../../src/db/seed/songs.json';

describe('Dhun Game API - Full End-to-End Integration Playthrough', () => {
  const guestId = crypto.randomUUID();

  it('runs complete lifecycle: session creation, clip streaming, bounds check, guess progression, remake win, and stats verification', async () => {
    // -------------------------------------------------------------
    // Step 1: Initialize Daily Challenge Session
    // -------------------------------------------------------------
    const startReq = new NextRequest('http://localhost:3000/api/game/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId,
        mode: 'DAILY',
        challengeDate: '2026-10-14',
      }),
    });

    const startRes = await handleSessionPost(startReq);
    expect(startRes.status).toBe(200);

    const sessionData = await startRes.json();
    expect(sessionData.sessionId).toBeDefined();
    expect(sessionData.sessionToken).toBeDefined();
    expect(sessionData.status).toBe('IN_PROGRESS');
    expect(sessionData.attemptsUsed).toBe(0);

    const sessionId = sessionData.sessionId;
    const sessionToken = sessionData.sessionToken;

    // -------------------------------------------------------------
    // Step 2: Stream Attempt-0 Clip (0.1s WAV)
    // -------------------------------------------------------------
    const initialClipUrl = sessionData.currentClip?.clipStreamUrl!;
    const initialToken = initialClipUrl.replace('/api/game/clip/', '');

    const clip0Req = new NextRequest(`http://localhost:3000${initialClipUrl}`);
    const clip0Res = await handleClipGet(clip0Req, { params: Promise.resolve({ token: initialToken }) });

    expect(clip0Res.status).toBe(200);
    expect(clip0Res.headers.get('content-type')).toBe('audio/wav');
    expect(clip0Res.headers.get('cache-control')).toContain('no-store');

    const clip0Bytes = await clip0Res.arrayBuffer();
    expect(clip0Bytes.byteLength).toBeGreaterThan(100);

    // -------------------------------------------------------------
    // Step 3: Security Boundary Check: Attempt-3 token before reaching attempt 3
    // -------------------------------------------------------------
    const prematureToken = generateClipStreamToken(sessionId, 3, 60);
    const prematureReq = new NextRequest(`http://localhost:3000/api/game/clip/${prematureToken}`);
    const prematureRes = await handleClipGet(prematureReq, { params: Promise.resolve({ token: prematureToken }) });

    expect(prematureRes.status).toBe(403);
    const prematureJson = await prematureRes.json();
    expect(prematureJson.error).toContain('Forbidden');

    // -------------------------------------------------------------
    // Step 4: Security Boundary Check: Expired clip token
    // -------------------------------------------------------------
    const expiredToken = generateClipStreamToken(sessionId, 0, -10);
    const expiredReq = new NextRequest(`http://localhost:3000/api/game/clip/${expiredToken}`);
    const expiredRes = await handleClipGet(expiredReq, { params: Promise.resolve({ token: expiredToken }) });

    expect(expiredRes.status).toBe(410);

    // -------------------------------------------------------------
    // Step 5: Submit Incorrect Guess on Attempt 0
    // -------------------------------------------------------------
    const engine = getGameEngine();
    const rawSession = (await engine.getSessionById(sessionId))!;
    const solutionSong = seedCatalog.songs.find(s => s.id === rawSession.songId)!;

    // Pick a deliberately wrong song from the catalog
    const wrongSong = seedCatalog.songs.find(s => s.work_id !== solutionSong.work_id)!;

    const wrongGuessReq = new NextRequest('http://localhost:3000/api/game/guess', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        sessionId,
        action: 'GUESS',
        guessedSongId: wrongSong.id,
      }),
    });

    const wrongGuessRes = await handleGuessPost(wrongGuessReq);
    expect(wrongGuessRes.status).toBe(200);

    const wrongGuessData = await wrongGuessRes.json();
    expect(wrongGuessData.correct).toBe(false);
    expect(wrongGuessData.gameOver).toBe(false);
    expect(wrongGuessData.attemptsUsed).toBe(1);
    expect(wrongGuessData.nextClip?.attemptIndex).toBe(1);
    expect(wrongGuessData.nextClip?.durationMs).toBe(500);

    // -------------------------------------------------------------
    // Step 6: Submit a Skip on Attempt 1 -> Advances to Attempt 2
    // -------------------------------------------------------------
    const skipReq = new NextRequest('http://localhost:3000/api/game/guess', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        sessionId,
        action: 'SKIP',
      }),
    });

    const skipRes = await handleGuessPost(skipReq);
    expect(skipRes.status).toBe(200);

    const skipData = await skipRes.json();
    expect(skipData.correct).toBe(false);
    expect(skipData.gameOver).toBe(false);
    expect(skipData.attemptsUsed).toBe(2);
    expect(skipData.nextClip?.attemptIndex).toBe(2);
    expect(skipData.nextClip?.durationMs).toBe(1500);

    // -------------------------------------------------------------
    // Step 7: Guess Solution Song or Canonical Remake Equivalent -> WIN
    // -------------------------------------------------------------
    // Find a recording matching the same musical work (e.g. remake or exact song)
    const matchingSong = seedCatalog.songs.find(s => s.work_id === solutionSong.work_id)!;

    const winningGuessReq = new NextRequest('http://localhost:3000/api/game/guess', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        sessionId,
        action: 'GUESS',
        guessedSongId: matchingSong.id,
      }),
    });

    const winningGuessRes = await handleGuessPost(winningGuessReq);
    expect(winningGuessRes.status).toBe(200);

    const winData = await winningGuessRes.json();
    expect(winData.correct).toBe(true);
    expect(winData.gameOver).toBe(true);
    expect(winData.status).toBe('WON');
    expect(winData.attemptsUsed).toBe(3);
    expect(winData.answer).toBeDefined();
    expect(winData.answer.title).toBe(solutionSong.title);
    expect(winData.shareGrid).toContain('🟩');

    // -------------------------------------------------------------
    // Step 8: Verify Player Stats Endpoint
    // -------------------------------------------------------------
    const statsReq = new NextRequest(`http://localhost:3000/api/stats/${guestId}`);
    const statsRes = await handleStatsGet(statsReq, { params: Promise.resolve({ guestId }) });

    expect(statsRes.status).toBe(200);
    const statsData = await statsRes.json();

    expect(statsData.guestId).toBe(guestId);
    expect(statsData.gamesPlayed).toBe(1);
    expect(statsData.gamesWon).toBe(1);
    expect(statsData.winPercentage).toBe(100);
    expect(statsData.currentStreak).toBe(1);
    expect(statsData.maxStreak).toBe(1);
    expect(statsData.guessDistribution['3']).toBe(1);
  });
});
