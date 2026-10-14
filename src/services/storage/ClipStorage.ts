// ClipStorage interface for Dhun
// Abstract storage layer supporting local disk (dev/testing) and Cloudflare R2 (production)
// NOTE: Storage is kept strictly outside the 'public/' directory to prevent unauthenticated static asset access.

export interface StoredClipData {
  buffer: Buffer;
  sizeBytes: number;
  mimeType: string;
}

export interface ClipStorage {
  readonly storageName: string;
  saveClip(storageKey: string, buffer: Buffer, mimeType: string): Promise<string>;
  getClip(storageKey: string): Promise<StoredClipData>;
  hasClip(storageKey: string): Promise<boolean>;
}

// Verifies that all 6 cumulative clips exist for a given song in storage
export async function checkSongHasAllClips(songId: string, storage: ClipStorage): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const format = attempt < 3 ? 'wav' : 'm4a';
    const key = `clips/${songId}/attempt_${attempt}.${format}`;
    const exists = await storage.hasClip(key);
    if (!exists) return false;
  }
  return true;
}
