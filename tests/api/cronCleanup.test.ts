import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/cleanup/route';

vi.mock('@/services/cleanupService', () => ({
  cleanupOldSessions: vi.fn().mockResolvedValue({
    deletedSessionsCount: 5,
    deletedGuessesCount: 18,
    retentionDays: 30,
    cutoffTimestamp: new Date().toISOString(),
  }),
}));

describe('GET /api/cron/cleanup - Automated Database Pruning Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('rejects unauthorized requests with 401 when CRON_SECRET is configured', async () => {
    process.env.CRON_SECRET = 'super-secret-cron-key-123';

    const req = new NextRequest('http://localhost:3000/api/cron/cleanup');
    const res = await GET(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Unauthorized');
  });

  it('rejects invalid secret tokens with 401', async () => {
    process.env.CRON_SECRET = 'super-secret-cron-key-123';

    const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('authorizes requests with correct Bearer header and executes cleanup', async () => {
    process.env.CRON_SECRET = 'super-secret-cron-key-123';

    const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
      headers: { Authorization: 'Bearer super-secret-cron-key-123' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.deletedSessionsCount).toBe(5);
  });

  it('authorizes requests with matching ?key= query parameter', async () => {
    process.env.CRON_SECRET = 'super-secret-cron-key-123';

    const req = new NextRequest('http://localhost:3000/api/cron/cleanup?key=super-secret-cron-key-123');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 500 in production when CRON_SECRET is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CRON_SECRET;

    const req = new NextRequest('http://localhost:3000/api/cron/cleanup');
    const res = await GET(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toContain('CRON_SECRET is required');
  });
});
