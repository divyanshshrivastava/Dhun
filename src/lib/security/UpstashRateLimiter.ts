// Upstash Redis HTTP REST Rate Limiter for Dhun (Production Free-Tier Optimized)
// Uses atomic Redis pipelines to minimize command consumption (< 500k free tier limit)
// Only 1 REST request per rate-limit check

import { RateLimiter, RateLimitResult } from './RateLimiter';

export class UpstashRateLimiter implements RateLimiter {
  readonly limiterType = 'upstash_redis_rest';
  private readonly restUrl: string;
  private readonly restToken: string;
  private readonly maxRequests: number;
  private readonly windowSeconds: number;

  constructor(
    restUrl: string = process.env.UPSTASH_REDIS_REST_URL || '',
    restToken: string = process.env.UPSTASH_REDIS_REST_TOKEN || '',
    maxRequests = 15,
    windowSeconds = 60
  ) {
    this.restUrl = restUrl.replace(/\/$/, '');
    this.restToken = restToken;
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  async check(identifierKey: string): Promise<RateLimitResult> {
    const key = `dhun:rl:${identifierKey}`;

    try {
      // Pipeline: 1) INCR key, 2) EXPIRE key windowSeconds NX (only set on initial creation)
      const pipelineBody = [
        ['INCR', key],
        ['EXPIRE', key, this.windowSeconds, 'NX'],
        ['TTL', key],
      ];

      const res = await fetch(`${this.restUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipelineBody),
        // Timeout within 3s so rate limiter never blocks players if Upstash has high latency
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        console.warn(`[Upstash] Rate limiter HTTP error ${res.status}, failing open to protect player experience.`);
        return { success: true, limit: this.maxRequests, remaining: 1, resetSeconds: 0 };
      }

      const results = await res.json();
      const currentCount = results[0]?.result ?? 1;
      const ttl = results[2]?.result ?? this.windowSeconds;
      const effectiveTtl = ttl > 0 ? ttl : this.windowSeconds;

      if (currentCount > this.maxRequests) {
        return {
          success: false,
          limit: this.maxRequests,
          remaining: 0,
          resetSeconds: effectiveTtl,
        };
      }

      return {
        success: true,
        limit: this.maxRequests,
        remaining: Math.max(0, this.maxRequests - currentCount),
        resetSeconds: effectiveTtl,
      };
    } catch (err: any) {
      // Fail-open strategy: if Upstash has network glitch, don't break the user's game
      console.warn('[Upstash] Rate limiter connection failure (failing open):', err.message);
      return {
        success: true,
        limit: this.maxRequests,
        remaining: 1,
        resetSeconds: 0,
      };
    }
  }
}
