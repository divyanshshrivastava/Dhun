// Cloudflare R2 Clip Storage Provider for Dhun
// 100% S3-compatible, zero-egress fee audio storage
// Free Tier: 10 GB storage, 1M Class A operations/month, 10M Class B operations/month

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { ClipStorage, StoredClipData } from './ClipStorage';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export class R2ClipStorage implements ClipStorage {
  readonly storageName = 'cloudflare_r2';
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config?: Partial<R2Config>) {
    const accountId = config?.accountId || process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = config?.accessKeyId || process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = config?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || '';
    this.bucket = config?.bucketName || process.env.R2_BUCKET_NAME || 'dhun-audio-clips';

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async saveClip(storageKey: string, buffer: Buffer, mimeType: string): Promise<string> {
    const sanitizedKey = storageKey.replace(/^[/\\]+/, '');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: sanitizedKey,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'private, no-cache, no-store',
      })
    );
    return sanitizedKey;
  }

  async getClip(storageKey: string): Promise<StoredClipData> {
    const sanitizedKey = storageKey.replace(/^[/\\]+/, '');
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: sanitizedKey,
      })
    );

    if (!res.Body) {
      throw new Error(`Audio clip payload empty for storage key: ${sanitizedKey}`);
    }

    const byteArray = await res.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);
    const mimeType = res.ContentType || 'audio/wav';

    return {
      buffer,
      sizeBytes: buffer.byteLength,
      mimeType,
    };
  }

  async hasClip(storageKey: string): Promise<boolean> {
    try {
      const sanitizedKey = storageKey.replace(/^[/\\]+/, '');
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: sanitizedKey,
        })
      );
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      return false;
    }
  }
}
