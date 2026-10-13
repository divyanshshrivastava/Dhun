import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGameEngine } from '@/services/gameEngine';
import { getRateLimiter } from '@/lib/security/RateLimiter';

const GuestIdSchema = z.string().uuid({ message: 'guestId must be a valid UUID' });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ guestId: string }> }
) {
  try {
    const { guestId } = await params;
    const parseResult = GuestIdSchema.safeParse(guestId);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid guestId parameter. Must be a valid UUID.' },
        { status: 400 }
      );
    }

    const validGuestId = parseResult.data;

    // Rate limiting
    const limiter = getRateLimiter();
    const rateCheck = await limiter.check(`stats:${validGuestId}`);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many stats requests. Please slow down.' },
        { status: 429 }
      );
    }

    const engine = getGameEngine();
    const stats = engine.getPlayerStats(validGuestId);

    return NextResponse.json(stats, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve stats';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
