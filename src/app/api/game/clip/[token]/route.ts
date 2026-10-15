import { NextRequest, NextResponse } from 'next/server';
import { verifyClipStreamToken } from '@/lib/security/clipToken';
import { getGameEngine } from '@/services/gameEngine';
import { getClipStorage } from '@/services/storage/LocalClipStorage';
import { generateOpaqueClipKey, AudioCutterService } from '@/services/audioCutter';
import { SyntheticToneProvider } from '@/services/audioSources/SyntheticToneProvider';
import { LocalFileProvider } from '@/services/audioSources/LocalFileProvider';

const audioCutter = new AudioCutterService();
const syntheticProvider = new SyntheticToneProvider();
const localProvider = new LocalFileProvider();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Verify token HMAC signature and 60-second expiration window
    const verification = verifyClipStreamToken(token);
    if (!verification.isValid) {
      if (verification.reason === 'expired') {
        return NextResponse.json(
          { error: 'Clip access token has expired (60s lifetime).' },
          { status: 410, headers: { 'Cache-Control': 'private, no-store' } }
        );
      }
      return NextResponse.json(
        { error: 'Invalid or forged clip token signature.' },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const { sessionId, attemptIndex } = verification;
    if (sessionId === undefined || attemptIndex === undefined) {
      return NextResponse.json(
        { error: 'Malformed clip token payload.' },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // 2. Fetch session from server state
    const engine = getGameEngine();
    const session = await engine.getSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Game session not found.' },
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // 3. Strict anti-cheat bound check: reject requests for an attempt the session has NOT reached
    // If the game is already finished (WON or LOST), all attempts including the 15s clip are unlocked
    const isGameOver = session.status === 'WON' || session.status === 'LOST';
    if (!isGameOver && attemptIndex > session.attemptsUsed) {
      return NextResponse.json(
        {
          error: `Forbidden: Attempt ${attemptIndex} has not yet been unlocked. Current attempt: ${session.attemptsUsed}.`,
        },
        { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // 4. Resolve audio storage key
    // Lossless WAV for 0.1s, 0.5s, 1.5s; AAC-LC (.m4a) for 4s, 8s, 15s
    const format = attemptIndex < 3 ? 'wav' : 'm4a';
    const storageKey = generateOpaqueClipKey(session.songId, attemptIndex, format);
    const clipStorage = getClipStorage();

    // Trigger background pre-warming of all clips for this song so subsequent attempts are instantaneous
    const { prewarmClipsForSong } = await import('@/services/storage/ClipStorage');
    prewarmClipsForSong(session.songId, clipStorage).catch(() => {});

    // 5. Try fetching directly (fast path, checks in-memory cache)
    let storedClip: import('@/services/storage/ClipStorage').StoredClipData;
    try {
      storedClip = await clipStorage.getClip(storageKey);
    } catch {
      // If missing from storage, generate on-demand as fallback
      let masterBuffer: Buffer | null = null;
      let inputExt = 'wav';

      try {
        const songItem = engine.getCatalogSong(session.songId);
        const localMaster = await localProvider.fetchTrack({
          id: session.songId,
          title: songItem?.title || session.songId,
        });
        masterBuffer = localMaster.audioBuffer;
        inputExt = localMaster.mimeType.includes('mpeg') ? 'mp3' : 'wav';
      } catch {
        const syntheticMaster = await syntheticProvider.fetchTrack({
          id: session.songId,
          title: session.songId,
        });
        masterBuffer = syntheticMaster.audioBuffer;
        inputExt = 'wav';
      }

      const slices = await audioCutter.sliceTrack(masterBuffer, inputExt, {
        songId: session.songId,
        fastNormalize: true,
      });

      for (const slice of slices) {
        const mime = slice.format === 'wav' ? 'audio/wav' : 'audio/mp4';
        await clipStorage.saveClip(slice.storageKey, slice.buffer, mime);
      }

      storedClip = await clipStorage.getClip(storageKey);
    }

    // 6. Return audio stream with strict private no-store headers
    return new Response(new Uint8Array(storedClip.buffer), {
      status: 200,
      headers: {
        'Content-Type': storedClip.mimeType,
        'Content-Length': storedClip.sizeBytes.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept-Ranges': 'none',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Audio streaming failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
