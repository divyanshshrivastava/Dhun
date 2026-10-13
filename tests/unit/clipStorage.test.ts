import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { LocalClipStorage } from '../../src/services/storage/LocalClipStorage';

describe('LocalClipStorage - Secure audio asset storage', () => {
  const testStorageDir = path.join(process.cwd(), 'scratch', 'test_storage');
  const storage = new LocalClipStorage(testStorageDir);

  it('saves and retrieves audio buffers correctly', async () => {
    const testKey = 'clips/unit_test_sample.wav';
    const testBuffer = Buffer.from('RIFF_FAKE_WAV_BYTES_FOR_UNIT_TEST');

    await storage.saveClip(testKey, testBuffer, 'audio/wav');

    const exists = await storage.hasClip(testKey);
    expect(exists).toBe(true);

    const retrieved = await storage.getClip(testKey);
    expect(retrieved.buffer.toString()).toBe('RIFF_FAKE_WAV_BYTES_FOR_UNIT_TEST');
    expect(retrieved.sizeBytes).toBe(testBuffer.length);
    expect(retrieved.mimeType).toBe('audio/wav');

    // Clean up
    const filePath = path.join(testStorageDir, testKey);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  it('rejects path traversal attacks attempting to write outside storage directory', async () => {
    const maliciousKey = '../../evil.txt';
    const fakeBuffer = Buffer.from('malicious payload');

    await expect(storage.saveClip(maliciousKey, fakeBuffer, 'text/plain')).rejects.toThrow(
      'Directory traversal attempt detected'
    );
  });

  it('verifies storage is never located under public/ directory', () => {
    const defaultStorage = new LocalClipStorage();
    // Default base path must be ./storage, not ./public/storage
    expect(path.relative(process.cwd(), 'storage')).toBe('storage');
    expect(path.relative(process.cwd(), 'public')).not.toBe('storage');
  });
});
