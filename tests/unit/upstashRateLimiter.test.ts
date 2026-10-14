import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpstashRateLimiter } from '@/lib/security/UpstashRateLimiter';

describe('UpstashRateLimiter - Ultra-low command consumption rate limiter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends single pipeline call and permits request within limits', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ result: 1 }, { result: 1 }, { result: 60 }],
    });
    global.fetch = mockFetch;

    const limiter = new UpstashRateLimiter('https://mock-redis.upstash.io', 'mock-token', 15, 60);
    const res = await limiter.check('guest_123');

    expect(res.success).toBe(true);
    expect(res.limit).toBe(15);
    expect(res.remaining).toBe(14);
    expect(res.resetSeconds).toBe(60);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://mock-redis.upstash.io/pipeline');
    expect(options.headers.Authorization).toBe('Bearer mock-token');

    const commands = JSON.parse(options.body);
    expect(commands).toEqual([
      ['INCR', 'dhun:rl:guest_123'],
      ['EXPIRE', 'dhun:rl:guest_123', 60, 'NX'],
      ['TTL', 'dhun:rl:guest_123'],
    ]);
  });

  it('rejects with 429 semantics when count exceeds limit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ result: 16 }, { result: 0 }, { result: 42 }],
    });
    global.fetch = mockFetch;

    const limiter = new UpstashRateLimiter('https://mock-redis.upstash.io', 'mock-token', 15, 60);
    const res = await limiter.check('guest_123');

    expect(res.success).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.resetSeconds).toBe(42);
  });

  it('fails open to in-memory fallback when Upstash network request times out or errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    const limiter = new UpstashRateLimiter('https://mock-redis.upstash.io', 'mock-token', 3, 60);
    
    // First 3 requests should pass via in-memory fallback
    const res1 = await limiter.check('guest_fallback_1');
    expect(res1.success).toBe(true);

    const res2 = await limiter.check('guest_fallback_1');
    expect(res2.success).toBe(true);

    const res3 = await limiter.check('guest_fallback_1');
    expect(res3.success).toBe(true);

    // 4th request exceeds in-memory limit
    const res4 = await limiter.check('guest_fallback_1');
    expect(res4.success).toBe(false);
  });

  it('fails open to in-memory fallback when Upstash returns HTTP 429 quota exceeded', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests (Daily quota reached)',
    });

    const limiter = new UpstashRateLimiter('https://mock-redis.upstash.io', 'mock-token', 2, 60);

    const res1 = await limiter.check('guest_quota_1');
    expect(res1.success).toBe(true);

    const res2 = await limiter.check('guest_quota_1');
    expect(res2.success).toBe(true);

    const res3 = await limiter.check('guest_quota_1');
    expect(res3.success).toBe(false);
  });
});
