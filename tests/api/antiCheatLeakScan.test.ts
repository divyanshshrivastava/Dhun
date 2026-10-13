import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleSessionPost } from '../../src/app/api/game/session/route';
import { POST as handleGuessPost } from '../../src/app/api/game/guess/route';
import { getGameEngine } from '../../src/services/gameEngine';
import seedCatalog from '../../src/db/seed/songs.json';

// Recursively inspects any object, array, or primitive for leaked forbidden strings
function assertNoLeak(target: unknown, forbiddenStrings: string[], path = 'root') {
  if (target === null || target === undefined) return;

  if (typeof target === 'string') {
    for (const forbidden of forbiddenStrings) {
      if (forbidden.length > 2 && target.toLowerCase().includes(forbidden.toLowerCase())) {
        throw new Error(
          `ANTI-CHEAT VIOLATION: Solution text "${forbidden}" leaked in response at path "${path}": ${target}`
        );
      }
    }
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

  it('verifies that title, songId, workId, and solution answer NEVER leak before game over', async () => {
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
    const rawSession = engine.getSessionById(sessionId)!;
    const solutionSong = seedCatalog.songs.find(s => s.id === rawSession.songId)!;

    const forbiddenStrings = [
      solutionSong.id,
      solutionSong.title,
      solutionSong.work_id,
      ...solutionSong.artists,
    ];

    // Assert session creation response is 100% leak-free
    assertNoLeak(sessionData, forbiddenStrings, 'sessionData');
    expect(sessionData.answer).toBeUndefined();

    // 2. Simulate 5 consecutive wrong guesses / skips
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

      // Deep scan the response JSON for leaks
      assertNoLeak(skipData, forbiddenStrings, `attempt_${attempt}_skipData`);
      expect(skipData.answer).toBeUndefined();
    }

    // 3. Final attempt (6th try): game over -> answer is now legitimately revealed
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
