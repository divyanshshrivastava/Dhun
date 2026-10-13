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
