// Rate limiter interface for Dhun
// Protects guess submissions and clip streaming from automated scraping and brute force

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export interface RateLimiter {
  readonly limiterType: string;
  check(identifierKey: string): Promise<RateLimitResult>;
}

// In-memory sliding-window token limiter for dev, tests, and standalone runs
export class InMemoryRateLimiter implements RateLimiter {
  readonly limiterType = 'in_memory_sliding_window';
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private requestBuckets: Map<string, number[]> = new Map();
  private lastChaiBreakCleanup: number = Date.now();

  constructor(maxRequests = 15, windowSeconds = 60) {
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;
  }

  async check(identifierKey: string): Promise<RateLimitResult> {
    const now = Date.now();
    this.maybeTakeChaiBreakCleanup(now);

    let timestamps = this.requestBuckets.get(identifierKey);
    if (!timestamps) {
      timestamps = [];
      this.requestBuckets.set(identifierKey, timestamps);
    }

    // Filter out timestamps outside the sliding window
    const windowStart = now - this.windowMs;
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    this.requestBuckets.set(identifierKey, validTimestamps);

    if (validTimestamps.length >= this.maxRequests) {
      const oldestValid = validTimestamps[0];
      const resetMs = Math.max(0, (oldestValid + this.windowMs) - now);
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        resetSeconds: Math.ceil(resetMs / 1000),
      };
    }

    // Record this request
    validTimestamps.push(now);
    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - validTimestamps.length,
      resetSeconds: Math.ceil(this.windowMs / 1000),
    };
  }

  // Periodic cleanup so idle IPs don't indefinitely leak memory
  private maybeTakeChaiBreakCleanup(now: number): void {
    if (now - this.lastChaiBreakCleanup > 60000) {
      const threshold = now - this.windowMs;
      for (const [key, timestamps] of this.requestBuckets.entries()) {
        const remaining = timestamps.filter(ts => ts > threshold);
        if (remaining.length === 0) {
          this.requestBuckets.delete(key);
        } else {
          this.requestBuckets.set(key, remaining);
        }
      }
      this.lastChaiBreakCleanup = now;
    }
  }

  // Useful for resetting state in unit tests
  reset(): void {
    this.requestBuckets.clear();
  }
}

// Global singleton rate limiter
let globalRateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new InMemoryRateLimiter(15, 60);
  }
  return globalRateLimiter;
}
