import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGameEngine } from '@/services/gameEngine';
import { getRateLimiter } from '@/lib/security/RateLimiter';

const GiveUpSchema = z.object({
  sessionId: z.string().uuid({ message: 'sessionId must be a valid UUID' }),
  sessionToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = GiveUpSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid give-up payload',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { sessionId } = parseResult.data;

    let sessionToken = parseResult.data.sessionToken;
    const authHeader = req.headers.get('authorization');
    if (!sessionToken && authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7).trim();
    }

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Missing session authorization token' },
        { status: 401 }
      );
    }

    const limiter = getRateLimiter();
    const rateCheck = await limiter.check(`giveup:${sessionId}`);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: 'Please wait before giving up.',
          resetSeconds: rateCheck.resetSeconds,
        },
        { status: 429 }
      );
    }

    const engine = getGameEngine();
    const result = await engine.giveUp(sessionId, sessionToken);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown give-up error';

    if (errorMsg.includes('Unauthorized')) {
      return NextResponse.json({ error: errorMsg }, { status: 401 });
    }
    if (errorMsg.includes('not found')) {
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
