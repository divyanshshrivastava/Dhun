import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cleanupOldSessions } from '@/services/cleanupService';

function timingSafeCheck(incoming: string, expected: string): boolean {
  const incBuf = Buffer.from(incoming, 'utf-8');
  const expBuf = Buffer.from(expected, 'utf-8');
  if (incBuf.length !== expBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(incBuf, expBuf);
}

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const incomingBearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    // In production or when CRON_SECRET is configured, strictly enforce Bearer authorization
    if (process.env.NODE_ENV === 'production' || cronSecret) {
      if (!cronSecret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: CRON_SECRET is required in production' },
          { status: 500 }
        );
      }

      if (!incomingBearer || !timingSafeCheck(incomingBearer, cronSecret)) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid or missing Authorization Bearer token' },
          { status: 401 }
        );
      }
    }

    // Execute 30-day session retention cleanup
    const result = await cleanupOldSessions(30);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.deletedSessionsCount} old sessions older than ${result.retentionDays} days`,
      ...result,
    });
  } catch (err: any) {
    console.error('Database cleanup cron failed:', err);
    return NextResponse.json({ error: err.message || 'Cleanup job failed' }, { status: 500 });
  }
}
