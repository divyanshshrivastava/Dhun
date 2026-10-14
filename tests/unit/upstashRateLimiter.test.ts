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

  it('fails open when Upstash network request times out or errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    const limiter = new UpstashRateLimiter('https://mock-redis.upstash.io', 'mock-token', 15, 60);
    const res = await limiter.check('guest_123');

    // Fail open protects players from game disruption
    expect(res.success).toBe(true);
  });
});
