import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRateLimiter } from '../../src/lib/security/RateLimiter';

describe('InMemoryRateLimiter - Sliding window rate limiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(3, 10); // 3 requests per 10 seconds
  });

  it('allows requests within limit', async () => {
    const res1 = await limiter.check('test-ip-1');
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await limiter.check('test-ip-1');
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await limiter.check('test-ip-1');
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('rejects requests exceeding limit', async () => {
    await limiter.check('test-ip-2');
    await limiter.check('test-ip-2');
    await limiter.check('test-ip-2');

    const blocked = await limiter.check('test-ip-2');
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetSeconds).toBeGreaterThan(0);
  });

  it('tracks different keys independently', async () => {
    await limiter.check('user-A');
    await limiter.check('user-A');
    await limiter.check('user-A');

    const userABlocked = await limiter.check('user-A');
    expect(userABlocked.success).toBe(false);

    // user-B is not affected by user-A
    const userAAllowed = await limiter.check('user-B');
    expect(userAAllowed.success).toBe(true);
  });
});
