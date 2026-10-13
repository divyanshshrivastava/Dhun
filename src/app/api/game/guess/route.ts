import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGameEngine } from '@/services/gameEngine';
import { getRateLimiter } from '@/lib/security/RateLimiter';

const SubmitGuessSchema = z.object({
  sessionId: z.string().uuid({ message: 'sessionId must be a valid UUID' }),
  sessionToken: z.string().optional(),
  action: z.enum(['GUESS', 'SKIP']),
  guessedSongId: z.string().optional(),
}).refine(data => {
  if (data.action === 'GUESS' && !data.guessedSongId) {
    return false;
  }
  return true;
}, {
  message: 'guessedSongId is required when action is GUESS',
  path: ['guessedSongId'],
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = SubmitGuessSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid guess submission payload',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { sessionId, action, guessedSongId } = parseResult.data;

    // Extract session token from Authorization header or body
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

    // Rate limiting per session
    const limiter = getRateLimiter();
    const rateCheck = await limiter.check(`guess:${sessionId}`);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: 'Slow down! Too many guesses in a short time.',
          resetSeconds: rateCheck.resetSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateCheck.resetSeconds.toString(),
            'Cache-Control': 'private, no-store',
          },
        }
      );
    }

    const engine = getGameEngine();
    const guessResult = await engine.submitGuess(
      sessionId,
      sessionToken,
      action,
      guessedSongId
    );

    return NextResponse.json(guessResult, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown guess evaluation error';

    if (errorMsg.includes('Unauthorized')) {
      return NextResponse.json({ error: errorMsg }, { status: 401 });
    }
    if (errorMsg.includes('not found')) {
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }
    if (errorMsg.includes('already finished')) {
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
