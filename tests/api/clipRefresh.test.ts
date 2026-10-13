import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleSessionPost } from '../../src/app/api/game/session/route';
import { POST as handleRefreshPost } from '../../src/app/api/game/clip/refresh/route';
import { GET as handleClipGet } from '../../src/app/api/game/clip/[token]/route';
import { verifyClipStreamToken } from '../../src/lib/security/clipToken';

describe('POST /api/game/clip/refresh - Clip Token Refresh', () => {
  const guestId = crypto.randomUUID();

  it('issues a fresh 60s stream token for the active attempt when requested', async () => {
    // 1. Start session
    const startReq = new NextRequest('http://localhost:3000/api/game/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, mode: 'PRACTICE' }),
    });

    const startRes = await handleSessionPost(startReq);
    expect(startRes.status).toBe(200);
    const startData = await startRes.json();
    const sessionId = startData.sessionId;
    const sessionToken = startData.sessionToken;

    // 2. Request token refresh
    const refreshReq = new NextRequest('http://localhost:3000/api/game/clip/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ sessionId }),
    });

    const refreshRes = await handleRefreshPost(refreshReq);
    expect(refreshRes.status).toBe(200);

    const refreshData = await refreshRes.json();
    expect(refreshData.attemptIndex).toBe(0);
    expect(refreshData.durationMs).toBe(100);
    expect(refreshData.clipStreamUrl).toContain('/api/game/clip/');

    // 3. Verify refreshed token is valid
    const tokenPart = refreshData.clipStreamUrl.replace('/api/game/clip/', '');
    const verification = verifyClipStreamToken(tokenPart);
    expect(verification.isValid).toBe(true);
    expect(verification.sessionId).toBe(sessionId);
    expect(verification.attemptIndex).toBe(0);

    // 4. Stream audio using the fresh token
    const clipReq = new NextRequest(`http://localhost:3000${refreshData.clipStreamUrl}`);
    const clipRes = await handleClipGet(clipReq, { params: Promise.resolve({ token: tokenPart }) });
    expect(clipRes.status).toBe(200);
    expect(clipRes.headers.get('content-type')).toBe('audio/wav');
  });

  it('rejects unauthorized or missing session tokens', async () => {
    const refreshReq = new NextRequest('http://localhost:3000/api/game/clip/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: crypto.randomUUID() }),
    });

    const refreshRes = await handleRefreshPost(refreshReq);
    expect(refreshRes.status).toBe(401);
  });
});
