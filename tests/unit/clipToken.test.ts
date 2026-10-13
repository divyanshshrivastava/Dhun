import { describe, it, expect } from 'vitest';
import {
  generateClipStreamToken,
  verifyClipStreamToken,
  generateSessionSecret,
  hashSessionSecret,
} from '../../src/lib/security/clipToken';

describe('clipToken - Cryptographic HMAC token generator & validator', () => {
  const testSessionId = 'sess-1234-5678';
  const testAttempt = 2;
  const testSecret = 'unit-test-secret-salt-key';

  it('generates and successfully verifies valid token', () => {
    const token = generateClipStreamToken(testSessionId, testAttempt, 60, testSecret);
    const verification = verifyClipStreamToken(token, testSecret);

    expect(verification.isValid).toBe(true);
    expect(verification.sessionId).toBe(testSessionId);
    expect(verification.attemptIndex).toBe(testAttempt);
  });

  it('rejects expired tokens', async () => {
    // Generate token with negative TTL (already expired)
    const expiredToken = generateClipStreamToken(testSessionId, testAttempt, -1, testSecret);
    const verification = verifyClipStreamToken(expiredToken, testSecret);

    expect(verification.isValid).toBe(false);
    expect(verification.reason).toBe('expired');
  });

  it('rejects tokens signed with a different secret', () => {
    const token = generateClipStreamToken(testSessionId, testAttempt, 60, 'correct-secret');
    const verification = verifyClipStreamToken(token, 'wrong-secret');

    expect(verification.isValid).toBe(false);
    expect(verification.reason).toBe('invalid_signature');
  });

  it('rejects tokens tampered with to unlock a higher attempt', () => {
    const originalToken = generateClipStreamToken(testSessionId, 0, 60, testSecret);
    const [payloadB64, sig] = originalToken.split('.');

    // Tamper payload to attempt 5 (15 seconds)
    const tamperedPayload = Buffer.from(
      Buffer.from(payloadB64, 'base64url').toString('utf-8').replace(':0:', ':5:')
    ).toString('base64url');

    const tamperedToken = `${tamperedPayload}.${sig}`;
    const verification = verifyClipStreamToken(tamperedToken, testSecret);

    expect(verification.isValid).toBe(false);
    expect(verification.reason).toBe('invalid_signature');
  });

  it('generates random session secret and deterministic SHA-256 hash', () => {
    const secret1 = generateSessionSecret();
    const secret2 = generateSessionSecret();

    expect(secret1.startsWith('dhn_')).toBe(true);
    expect(secret1).not.toBe(secret2);

    const hash1a = hashSessionSecret(secret1);
    const hash1b = hashSessionSecret(secret1);
    expect(hash1a).toBe(hash1b);
    expect(hash1a).toMatch(/^[a-f0-9]{64}$/);
  });
});
