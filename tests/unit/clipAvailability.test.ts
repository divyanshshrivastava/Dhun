import { describe, it, expect, beforeEach } from 'vitest';
import { checkSongHasAllClips, ClipStorage } from '@/services/storage/ClipStorage';
import { GameEngine } from '@/services/gameEngine';

class MockClipStorage implements ClipStorage {
  readonly storageName = 'mock_memory';
  private files = new Set<string>();

  async saveClip(storageKey: string, buffer: Buffer): Promise<string> {
    this.files.add(storageKey);
    return storageKey;
  }

  async getClip(storageKey: string) {
    if (!this.files.has(storageKey)) throw new Error('Not found');
    return { buffer: Buffer.from('test'), sizeBytes: 4, mimeType: 'audio/wav' };
  }

  async hasClip(storageKey: string): Promise<boolean> {
    return this.files.has(storageKey);
  }

  addClip(storageKey: string) {
    this.files.add(storageKey);
  }

  clear() {
    this.files.clear();
  }
}

describe('Clip Availability & Active Song Enforcement', () => {
  let mockStorage: MockClipStorage;

  beforeEach(() => {
    mockStorage = new MockClipStorage();
  });

  it('checkSongHasAllClips returns false when any of the 6 clips is missing', async () => {
    const songId = 'test-song-uuid-1';

    // Only add 5 clips (missing attempt 5)
    mockStorage.addClip(`clips/${songId}/attempt_0.wav`);
    mockStorage.addClip(`clips/${songId}/attempt_1.wav`);
    mockStorage.addClip(`clips/${songId}/attempt_2.wav`);
    mockStorage.addClip(`clips/${songId}/attempt_3.m4a`);
    mockStorage.addClip(`clips/${songId}/attempt_4.m4a`);

    const hasAll = await checkSongHasAllClips(songId, mockStorage);
    expect(hasAll).toBe(false);
  });

  it('checkSongHasAllClips returns true when all 6 cumulative clips exist', async () => {
    const songId = 'test-song-uuid-2';

    mockStorage.addClip(`clips/${songId}/attempt_0.wav`);
    mockStorage.addClip(`clips/${songId}/attempt_1.wav`);
    mockStorage.addClip(`clips/${songId}/attempt_2.wav`);
    mockStorage.addClip(`clips/${songId}/attempt_3.m4a`);
    mockStorage.addClip(`clips/${songId}/attempt_4.m4a`);
    mockStorage.addClip(`clips/${songId}/attempt_5.m4a`);

    const hasAll = await checkSongHasAllClips(songId, mockStorage);
    expect(hasAll).toBe(true);
  });

  it('gameEngine pool resolution restricts candidate songs to those with all 6 clips in storage', async () => {
    const customCatalog = [
      {
        id: 'song-with-clips',
        workId: 'work-1',
        title: 'Song With Clips',
        aliases: [],
        artists: ['Artist A'],
        language: 'hindi',
        era: '90s',
        genres: ['Bollywood'],
      },
      {
        id: 'song-without-clips',
        workId: 'work-2',
        title: 'Song Without Clips',
        aliases: [],
        artists: ['Artist B'],
        language: 'hindi',
        era: '90s',
        genres: ['Bollywood'],
      },
    ];

    // Seed local disk storage for 'song-with-clips'
    const { getClipStorage } = await import('@/services/storage/LocalClipStorage');
    const storage = getClipStorage();
    for (let i = 0; i < 6; i++) {
      const format = i < 3 ? 'wav' : 'm4a';
      await storage.saveClip(`clips/song-with-clips/attempt_${i}.${format}`, Buffer.from('test audio'), 'audio/wav');
    }

    const engine = new GameEngine(customCatalog);
    const playablePool = await engine.getPlayableSongPool();

    expect(playablePool.some(s => s.id === 'song-with-clips')).toBe(true);
    expect(playablePool.every(s => s.id !== 'song-without-clips')).toBe(true);
  });
});
