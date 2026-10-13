import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGameEngine, CLIP_DURATIONS_MS } from '@/services/gameEngine';
import { generateClipStreamToken, hashSessionSecret } from '@/lib/security/clipToken';
import { getRateLimiter } from '@/lib/security/RateLimiter';

const RefreshTokenSchema = z.object({
  sessionId: z.string().uuid({ message: 'sessionId must be a valid UUID' }),
  sessionToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = RefreshTokenSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid token refresh request',
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

    // Rate limiting check
    const limiter = getRateLimiter();
    const rateCheck = await limiter.check(`refresh:${sessionId}`);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many token refresh requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': rateCheck.resetSeconds.toString() } }
      );
    }

    const engine = getGameEngine();
    const session = await engine.getSessionById(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Game session not found' }, { status: 404 });
    }

    const incomingHash = hashSessionSecret(sessionToken);
    if (incomingHash !== session.sessionTokenHash) {
      return NextResponse.json({ error: 'Unauthorized session token' }, { status: 401 });
    }

    if (session.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `Game session is already finished with status: ${session.status}` },
        { status: 400 }
      );
    }

    const activeAttempt = session.attemptsUsed;
    if (activeAttempt >= session.maxAttempts) {
      return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 400 });
    }

    const durationMs = CLIP_DURATIONS_MS[activeAttempt];
    const freshToken = generateClipStreamToken(session.id, activeAttempt, 60);

    return NextResponse.json(
      {
        attemptIndex: activeAttempt,
        durationMs,
        clipStreamUrl: `/api/game/clip/${freshToken}`,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Token refresh failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
