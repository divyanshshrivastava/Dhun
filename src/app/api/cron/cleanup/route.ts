import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldSessions } from '@/services/cleanupService';

export async function GET(req: NextRequest) {
  try {
    // 1. Authorize cron trigger via CRON_SECRET header or query param
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` ||
        req.nextUrl.searchParams.get('key') === cronSecret;

      if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
      }
    }

    // 2. Execute 30-day session retention cleanup
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
