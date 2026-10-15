// Supabase Storage Clip Storage Provider for Dhun (Documented Fallback)
// Free Tier: 1 GB storage, 2 GB bandwidth/month
// Used as a drop-in fallback if Cloudflare R2 card requirement is avoided

import { ClipStorage, StoredClipData } from './ClipStorage';

export interface SupabaseStorageConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucketName: string;
}

// Fast in-memory cache to make repeated audio chunk queries sub-millisecond
const supabaseClipCache = new Map<string, StoredClipData>();

export class SupabaseClipStorage implements ClipStorage {
  readonly storageName = 'supabase_storage';
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;

  constructor(config?: Partial<SupabaseStorageConfig>) {
    this.supabaseUrl = (config?.supabaseUrl || process.env.SUPABASE_STORAGE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceRoleKey = config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    this.bucket = config?.bucketName || process.env.SUPABASE_BUCKET_NAME || 'dhun-audio-clips';
  }

  async saveClip(storageKey: string, buffer: Buffer, mimeType: string): Promise<string> {
    const sanitizedKey = storageKey.replace(/^[/\\]+/, '');
    supabaseClipCache.set(sanitizedKey, {
      buffer,
      sizeBytes: buffer.byteLength,
      mimeType,
    });

    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${sanitizedKey}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase Storage upload failed (${res.status}): ${errText}`);
    }

    return sanitizedKey;
  }

  async getClip(storageKey: string): Promise<StoredClipData> {
    const sanitizedKey = storageKey.replace(/^[/\\]+/, '');

    if (supabaseClipCache.has(sanitizedKey)) {
      return supabaseClipCache.get(sanitizedKey)!;
    }

    const downloadUrl = `${this.supabaseUrl}/storage/v1/object/authenticated/${this.bucket}/${sanitizedKey}`;

    const res = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Audio clip not found in Supabase Storage (${res.status}): ${sanitizedKey}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get('content-type') || 'audio/wav';

    const result: StoredClipData = {
      buffer,
      sizeBytes: buffer.byteLength,
      mimeType,
    };
    supabaseClipCache.set(sanitizedKey, result);

    return result;
  }

  async hasClip(storageKey: string): Promise<boolean> {
    const sanitizedKey = storageKey.replace(/^[/\\]+/, '');
    if (supabaseClipCache.has(sanitizedKey)) {
      return true;
    }

    try {
      const downloadUrl = `${this.supabaseUrl}/storage/v1/object/authenticated/${this.bucket}/${sanitizedKey}`;

      const res = await fetch(downloadUrl, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          apikey: this.serviceRoleKey,
        },
      });

      return res.ok;
    } catch {
      return false;
    }
  }
}
