import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleSessionPost } from '../../src/app/api/game/session/route';
import { POST as handleGuessPost } from '../../src/app/api/game/guess/route';
import { GET as handleClipGet } from '../../src/app/api/game/clip/[token]/route';
import { getGameEngine } from '../../src/services/gameEngine';
import seedCatalog from '../../src/db/seed/songs.json';

// Recursively inspects any object, array, string, or header collection for leaked forbidden strings
function assertNoLeak(target: unknown, forbiddenStrings: string[], path = 'root') {
  if (target === null || target === undefined) return;

  if (typeof target === 'string') {
    for (const forbidden of forbiddenStrings) {
      if (forbidden && forbidden.length > 2 && target.toLowerCase().includes(forbidden.toLowerCase())) {
        throw new Error(
          `ANTI-CHEAT VIOLATION: Solution text "${forbidden}" leaked in string at path "${path}": ${target}`
        );
      }
    }
    return;
  }

  if (target instanceof Headers) {
    target.forEach((val, key) => {
      assertNoLeak(key, forbiddenStrings, `${path}.headerKey[${key}]`);
      assertNoLeak(val, forbiddenStrings, `${path}.headerValue[${key}]`);
    });
    return;
  }

  if (Array.isArray(target)) {
    target.forEach((item, index) => {
      assertNoLeak(item, forbiddenStrings, `${path}[${index}]`);
    });
    return;
  }

  if (typeof target === 'object') {
    for (const [key, value] of Object.entries(target)) {
      // Forbidden keys that must never appear in active game state
      if (key === 'answer' && value !== undefined && value !== null) {
        throw new Error(`ANTI-CHEAT VIOLATION: Answer object present before game end at path "${path}.${key}"`);
      }
      if (key === 'songId') {
        throw new Error(`ANTI-CHEAT VIOLATION: songId field exposed in client payload at path "${path}.${key}"`);
      }
      assertNoLeak(value, forbiddenStrings, `${path}.${key}`);
    }
  }
}

describe('Anti-Cheat API Leak Scanner', () => {
  const guestId = crypto.randomUUID();

  it('verifies that title, songId, workId, and solution answer NEVER leak into response JSON, headers, URLs, or token payloads', async () => {
    const engine = getGameEngine();

    // 1. Start a Practice Session
    const startReq = new NextRequest('http://localhost:3000/api/game/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId,
        mode: 'PRACTICE',
      }),
    });

    const startRes = await handleSessionPost(startReq);
    expect(startRes.status).toBe(200);

    const sessionData = await startRes.json();
    const sessionId = sessionData.sessionId;
    const sessionToken = sessionData.sessionToken;
    expect(sessionId).toBeDefined();
    expect(sessionToken).toBeDefined();

    // Look up the underlying secret solution song directly from the server engine
    const rawSession = (await engine.getSessionById(sessionId))!;
    const solutionSong = seedCatalog.songs.find(s => s.id === rawSession.songId)!;

    const forbiddenStrings = [
      solutionSong.id,
      solutionSong.title,
      solutionSong.work_id,
      solutionSong.movie_or_album || '',
      ...solutionSong.artists,
    ].filter(s => s.length > 2);

    // Deep scan response headers, body JSON, and clip stream URL
    assertNoLeak(startRes.headers, forbiddenStrings, 'session.headers');
    assertNoLeak(sessionData, forbiddenStrings, 'session.body');
    assertNoLeak(sessionData.currentClip?.clipStreamUrl, forbiddenStrings, 'session.clipStreamUrl');
    expect(sessionData.answer).toBeUndefined();

    // 2. Strict inspection of the clip token payload
    const initialToken = sessionData.currentClip?.clipStreamUrl.replace('/api/game/clip/', '')!;
    const [base64Payload, signature] = initialToken.split('.');
    expect(base64Payload).toBeDefined();
    expect(signature).toBeDefined();

    const decodedPayload = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    assertNoLeak(decodedPayload, forbiddenStrings, 'token.decodedPayload');

    // Confirm token payload contains ONLY (sessionId, attemptIndex, expiresAt)
    const tokenParts = decodedPayload.split(':');
    expect(tokenParts).toHaveLength(3);
    const [tokenSessionId, tokenAttemptIndex, tokenExpiresAt] = tokenParts;
    expect(tokenSessionId).toBe(sessionId);
    expect(parseInt(tokenAttemptIndex, 10)).toBe(0);
    expect(parseInt(tokenExpiresAt, 10)).toBeGreaterThan(Date.now());

    // 3. Test clip streaming headers
    const clipReq = new NextRequest(`http://localhost:3000${sessionData.currentClip?.clipStreamUrl}`);
    const clipRes = await handleClipGet(clipReq, { params: Promise.resolve({ token: initialToken }) });
    expect(clipRes.status).toBe(200);
    assertNoLeak(clipRes.headers, forbiddenStrings, 'clip.headers');

    // 4. Simulate 5 consecutive wrong guesses / skips
    // None of these intermediate responses may leak the secret solution!
    for (let attempt = 0; attempt < 5; attempt++) {
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
      expect(skipData.status).toBe('IN_PROGRESS');
      expect(skipData.gameOver).toBe(false);

      // Deep scan headers, response data, and next clip stream URL
      assertNoLeak(skipRes.headers, forbiddenStrings, `attempt_${attempt}_skipRes.headers`);
      assertNoLeak(skipData, forbiddenStrings, `attempt_${attempt}_skipData`);
      assertNoLeak(skipData.nextClip?.clipStreamUrl, forbiddenStrings, `attempt_${attempt}_nextClipUrl`);
      expect(skipData.answer).toBeUndefined();
    }

    // 5. Final attempt (6th try): game over -> answer is now legitimately revealed
    const finalReq = new NextRequest('http://localhost:3000/api/game/guess', {
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

    const finalRes = await handleGuessPost(finalReq);
    expect(finalRes.status).toBe(200);
    const finalData = await finalRes.json();

    expect(finalData.status).toBe('LOST');
    expect(finalData.gameOver).toBe(true);
    expect(finalData.answer).toBeDefined();
    expect(finalData.answer.title).toBe(solutionSong.title);
  });
});
