import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleSessionPost } from '../../src/app/api/game/session/route';
import { POST as handleGuessPost } from '../../src/app/api/game/guess/route';
import { GET as handleClipGet } from '../../src/app/api/game/clip/[token]/route';
import { generateClipStreamToken } from '../../src/lib/security/clipToken';
import { getRateLimiter, InMemoryRateLimiter } from '../../src/lib/security/RateLimiter';

describe('Rate Limiter Protection Across All Game API Endpoints', () => {
  beforeEach(() => {
    const limiter = getRateLimiter() as InMemoryRateLimiter;
    limiter.reset();
  });

  it('enforces 429 Too Many Requests on excessive /session calls', async () => {
    const guestId = crypto.randomUUID();

    // Max limit is 15 requests per minute
    let lastStatus = 200;
    for (let i = 0; i < 16; i++) {
      const req = new NextRequest('http://localhost:3000/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, mode: 'PRACTICE' }),
      });
      const res = await handleSessionPost(req);
      lastStatus = res.status;
      if (lastStatus === 429) {
        expect(res.headers.get('retry-after')).toBeDefined();
        const json = await res.json();
        expect(json.error).toContain('Too many session creation requests');
        break;
      }
    }

    expect(lastStatus).toBe(429);
  });

  it('enforces 429 Too Many Requests on excessive /guess calls', async () => {
    const guestId = crypto.randomUUID();
    const sessionReq = new NextRequest('http://localhost:3000/api/game/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, mode: 'PRACTICE' }),
    });
    const sessionRes = await handleSessionPost(sessionReq);
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.sessionId;
    const sessionToken = sessionData.sessionToken;

    let lastStatus = 200;
    for (let i = 0; i < 16; i++) {
      const req = new NextRequest('http://localhost:3000/api/game/guess', {
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
      const res = await handleGuessPost(req);
      lastStatus = res.status;
      if (lastStatus === 429) {
        expect(res.headers.get('retry-after')).toBeDefined();
        break;
      }
    }

    expect(lastStatus).toBe(429);
  });

  it('enforces 429 Too Many Requests on excessive /clip calls', async () => {
    const guestId = crypto.randomUUID();
    const sessionReq = new NextRequest('http://localhost:3000/api/game/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, mode: 'PRACTICE' }),
    });
    const sessionRes = await handleSessionPost(sessionReq);
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.sessionId;
    const token = generateClipStreamToken(sessionId, 0, 60);

    let lastStatus = 200;
    for (let i = 0; i < 16; i++) {
      const req = new NextRequest(`http://localhost:3000/api/game/clip/${token}`);
      const res = await handleClipGet(req, { params: Promise.resolve({ token }) });
      lastStatus = res.status;
      if (lastStatus === 429) {
        expect(res.headers.get('retry-after')).toBeDefined();
        break;
      }
    }

    expect(lastStatus).toBe(429);
  });
});
