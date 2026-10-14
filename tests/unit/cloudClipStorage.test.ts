import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseClipStorage } from '@/services/storage/SupabaseClipStorage';
import { R2ClipStorage } from '@/services/storage/R2ClipStorage';

describe('Cloud ClipStorage Implementations (R2 & Supabase)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('SupabaseClipStorage saves, retrieves, and checks existence of clips via REST', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'OK' }) // saveClip
      .mockResolvedValueOnce({ ok: true, status: 200 }) // hasClip
      .mockResolvedValueOnce({ // getClip
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'audio/wav' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      });

    global.fetch = mockFetch;

    const storage = new SupabaseClipStorage({
      supabaseUrl: 'https://test.supabase.co',
      serviceRoleKey: 'secret_key_123',
      bucketName: 'dhun-audio',
    });

    expect(storage.storageName).toBe('supabase_storage');

    // 1. Save clip
    const key = await storage.saveClip('clips/sample.wav', Buffer.from([1, 2, 3, 4]), 'audio/wav');
    expect(key).toBe('clips/sample.wav');

    // 2. Has clip
    const exists = await storage.hasClip('clips/sample.wav');
    expect(exists).toBe(true);

    // 3. Get clip
    const clip = await storage.getClip('clips/sample.wav');
    expect(clip.sizeBytes).toBe(4);
    expect(clip.mimeType).toBe('audio/wav');
  });

  it('R2ClipStorage initializes with custom S3 credentials', () => {
    const storage = new R2ClipStorage({
      accountId: 'test-account-id',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      bucketName: 'dhun-clips',
    });

    expect(storage.storageName).toBe('cloudflare_r2');
  });
});
