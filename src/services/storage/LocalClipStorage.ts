// Local disk storage provider for audio clips
// Strictly stores audio in the server root './storage/' (never in 'public/')

import fs from 'fs';
import path from 'path';
import { ClipStorage, StoredClipData } from './ClipStorage';

export class LocalClipStorage implements ClipStorage {
  readonly storageName = 'local_disk';
  private readonly basePath: string;

  constructor(customBasePath?: string) {
    this.basePath = customBasePath || path.join(process.cwd(), 'storage');
    // Ensure base directory exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  // Prevent directory traversal attacks like "../../etc/passwd"
  private resolveSafePath(storageKey: string): string {
    const sanitizedKey = storageKey.replace(/^[/\\]+/, '');
    const fullPath = path.resolve(this.basePath, sanitizedKey);

    if (!fullPath.startsWith(this.basePath)) {
      throw new Error(`Directory traversal attempt detected: ${storageKey}`);
    }

    return fullPath;
  }

  async saveClip(storageKey: string, buffer: Buffer, mimeType: string): Promise<string> {
    const targetFile = this.resolveSafePath(storageKey);
    const parentDir = path.dirname(targetFile);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(targetFile, buffer);
    return storageKey;
  }

  async getClip(storageKey: string): Promise<StoredClipData> {
    const targetFile = this.resolveSafePath(storageKey);

    if (!fs.existsSync(targetFile)) {
      throw new Error(`Audio clip not found at storage key: ${storageKey}`);
    }

    const buffer = fs.readFileSync(targetFile);
    const ext = path.extname(targetFile).toLowerCase();

    let mimeType = 'audio/wav';
    if (ext === '.m4a' || ext === '.aac') {
      mimeType = 'audio/mp4';
    } else if (ext === '.opus') {
      mimeType = 'audio/opus';
    }

    return {
      buffer,
      sizeBytes: buffer.byteLength,
      mimeType,
    };
  }

  async hasClip(storageKey: string): Promise<boolean> {
    try {
      const targetFile = this.resolveSafePath(storageKey);
      return fs.existsSync(targetFile);
    } catch {
      return false;
    }
  }
}

// Singleton instance helper
let globalClipStorage: ClipStorage | null = null;

export function getClipStorage(): ClipStorage {
  if (!globalClipStorage) {
    if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { R2ClipStorage } = require('./R2ClipStorage');
      globalClipStorage = new R2ClipStorage();
    } else if (process.env.SUPABASE_STORAGE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SupabaseClipStorage } = require('./SupabaseClipStorage');
      globalClipStorage = new SupabaseClipStorage();
    } else {
      globalClipStorage = new LocalClipStorage();
    }
  }
  return globalClipStorage!;
}
