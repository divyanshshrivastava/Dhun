import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGameEngine } from '@/services/gameEngine';
import { getRateLimiter } from '@/lib/security/RateLimiter';

const StartSessionSchema = z.object({
  guestId: z.string().uuid({ message: 'guestId must be a valid UUID' }),
  mode: z.enum(['DAILY', 'PRACTICE']).default('DAILY'),
  challengeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'challengeDate must be in YYYY-MM-DD format' }).optional(),
  filters: z.object({
    language: z.string().optional(),
    era: z.string().optional(),
    genre: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = StartSessionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { guestId, mode, challengeDate, filters } = parseResult.data;

    // 1. Rate limiting check per guest
    const limiter = getRateLimiter();
    const rateCheck = await limiter.check(`session:${guestId}`);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: 'Thoda aaram karo bhai! Too many session creation requests.',
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

    // 2. Start or resume game session via server-authoritative GameEngine
    const engine = getGameEngine();
    let sessionPayload;

    if (mode === 'DAILY') {
      sessionPayload = await engine.getOrCreateDailySession(guestId, challengeDate);
    } else {
      sessionPayload = await engine.createPracticeSession(guestId, filters);
    }

    // Background pre-warm all 6 audio clips into server cache for instant playback
    engine.getSessionById(sessionPayload.sessionId).then((s) => {
      if (s?.songId) {
        import('@/services/storage/LocalClipStorage').then(({ getClipStorage }) => {
          import('@/services/storage/ClipStorage').then(({ prewarmClipsForSong }) => {
            prewarmClipsForSong(s.songId, getClipStorage()).catch(() => {});
          });
        });
      }
    }).catch(() => {});

    return NextResponse.json(sessionPayload, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
