import crypto from 'crypto';
import { getServerSecret } from '@/config/env';

// Generates an unguessable opaque filename so users cannot inspect network requests
export function generateOpaqueClipKey(
  songId: string,
  attemptIndex: number,
  format: string,
  secret = getServerSecret()
): string {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(`${songId}_attempt_${attemptIndex}_dhun_audio`)
    .digest('hex');
  return `clips/${hash}.${format}`;
}
