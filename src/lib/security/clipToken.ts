// Cryptographic HMAC token generator & validator for authorized audio clip streaming
// Guarantees:
// 1. Bound to (sessionId, attemptIndex, expiresAt)
// 2. Strict 60-second expiration window
// 3. Constant-time verification using crypto.timingSafeEqual (immune to timing attacks)
// 4. Client cannot manipulate attempt index to unlock longer clips early

import crypto from 'crypto';

const DEFAULT_SERVER_SECRET = process.env.DHUN_SERVER_SECRET || 'dhun_super_secret_signing_key_2026';

export interface ClipTokenPayload {
  sessionId: string;
  attemptIndex: number;
  expiresAt: number;
}

export interface ClipTokenVerificationResult {
  isValid: boolean;
  sessionId?: string;
  attemptIndex?: number;
  reason?: 'expired' | 'invalid_signature' | 'malformed';
}

// Generates an HMAC-SHA256 signed clip token with 60-second expiration
export function generateClipStreamToken(
  sessionId: string,
  attemptIndex: number,
  ttlSeconds = 60,
  secret = DEFAULT_SERVER_SECRET
): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const rawPayload = `${sessionId}:${attemptIndex}:${expiresAt}`;
  const base64Payload = Buffer.from(rawPayload, 'utf-8').toString('base64url');

  const hmacSignature = crypto
    .createHmac('sha256', secret)
    .update(rawPayload)
    .digest('hex');

  return `${base64Payload}.${hmacSignature}`;
}

// Verifies the clip token signature in constant time and verifies expiration
export function verifyClipStreamToken(
  token: string,
  secret = DEFAULT_SERVER_SECRET
): ClipTokenVerificationResult {
  if (!token || typeof token !== 'string') {
    return { isValid: false, reason: 'malformed' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { isValid: false, reason: 'malformed' };
  }

  const [base64Payload, receivedSignatureHex] = parts;

  let rawPayload = '';
  try {
    rawPayload = Buffer.from(base64Payload, 'base64url').toString('utf-8');
  } catch {
    return { isValid: false, reason: 'malformed' };
  }

  const payloadParts = rawPayload.split(':');
  if (payloadParts.length !== 3) {
    return { isValid: false, reason: 'malformed' };
  }

  const [sessionId, attemptIndexStr, expiresAtStr] = payloadParts;
  const attemptIndex = parseInt(attemptIndexStr, 10);
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(attemptIndex) || isNaN(expiresAt)) {
    return { isValid: false, reason: 'malformed' };
  }

  // 1. Check expiration window
  if (Date.now() > expiresAt) {
    return { isValid: false, reason: 'expired' };
  }

  // 2. Recompute expected signature
  const expectedSignatureHex = crypto
    .createHmac('sha256', secret)
    .update(rawPayload)
    .digest('hex');

  // 3. Constant-time signature comparison to defeat timing attacks
  const receivedSigBuffer = Buffer.from(receivedSignatureHex, 'hex');
  const expectedSigBuffer = Buffer.from(expectedSignatureHex, 'hex');

  if (receivedSigBuffer.length !== expectedSigBuffer.length) {
    return { isValid: false, reason: 'invalid_signature' };
  }

  const signaturesMatch = crypto.timingSafeEqual(receivedSigBuffer, expectedSigBuffer);
  if (!signaturesMatch) {
    return { isValid: false, reason: 'invalid_signature' };
  }

  return {
    isValid: true,
    sessionId,
    attemptIndex,
  };
}

// Generates a cryptographically secure random session secret
export function generateSessionSecret(): string {
  return 'dhn_' + crypto.randomBytes(24).toString('hex');
}

// Hashes a session secret using SHA-256 for persistent database storage
export function hashSessionSecret(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
