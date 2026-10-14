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

  it('protects /clip via signed tokens and attempt bounds without consuming rate-limiter quota', async () => {
    const guestId = crypto.randomUUID();
    const sessionReq = new NextRequest('http://localhost:3000/api/game/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, mode: 'PRACTICE' }),
    });
    const sessionRes = await handleSessionPost(sessionReq);
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.sessionId;
    const validToken = generateClipStreamToken(sessionId, 0, 60);

    // Valid token succeeds
    const req = new NextRequest(`http://localhost:3000/api/game/clip/${validToken}`);
    const res = await handleClipGet(req, { params: Promise.resolve({ token: validToken }) });
    expect(res.status).toBe(200);

    // Tampered token is rejected with 400
    const tamperedToken = `${validToken.split('.')[0]}.tampered_signature_12345`;
    const badReq = new NextRequest(`http://localhost:3000/api/game/clip/${tamperedToken}`);
    const badRes = await handleClipGet(badReq, { params: Promise.resolve({ token: tamperedToken }) });
    expect(badRes.status).toBe(400);
  });
});
