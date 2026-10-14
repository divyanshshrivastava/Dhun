// Provider that reads raw audio master tracks from local filesystem
// Used for local development and private studio master ingestion

import fs from 'fs';
import path from 'path';
import { AudioSourceProvider, AudioSourceMetadata, AudioSourceResult } from './AudioSourceProvider';

export class LocalFileProvider implements AudioSourceProvider {
  readonly providerName = 'local_file';
  private searchDirectories: string[];

  constructor(customDirs?: string[]) {
    this.searchDirectories = customDirs && customDirs.length > 0
      ? customDirs
      : [
          path.join(process.cwd(), 'audio-masters'),
          path.join(process.cwd(), 'raw-audio'),
        ];
  }

  async isAvailable(): Promise<boolean> {
    return this.searchDirectories.some(dir => fs.existsSync(dir));
  }

  async fetchTrack(meta: AudioSourceMetadata): Promise<AudioSourceResult> {
    // 1. Direct path override
    if (meta.customFilePath && fs.existsSync(meta.customFilePath)) {
      const buffer = fs.readFileSync(meta.customFilePath);
      return {
        audioBuffer: buffer,
        mimeType: this.determineMimeType(meta.customFilePath),
        attribution: `Local Master: ${path.basename(meta.customFilePath)}`,
        sourceType: 'local_file',
      };
    }

    // 2. Search by song ID or clean filename in registered directories
    const candidateExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg'];
    const searchKeys: string[] = [];

    if (meta.id) searchKeys.push(meta.id);
    if (meta.title) {
      searchKeys.push(meta.title.toLowerCase().replace(/[^a-z0-9]/g, '_'));
      searchKeys.push(meta.title);
    }

    for (const searchDir of this.searchDirectories) {
      if (!fs.existsSync(searchDir)) continue;

      for (const candidateKey of searchKeys) {
        for (const ext of candidateExtensions) {
          const filePath = path.join(/*turbopackIgnore: true*/ searchDir, `${candidateKey}${ext}`);
          if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
            const buffer = fs.readFileSync(/*turbopackIgnore: true*/ filePath);
            return {
              audioBuffer: buffer,
              mimeType: this.determineMimeType(filePath),
              attribution: `Local file: ${path.basename(filePath)}`,
              sourceType: 'local_file',
            };
          }
        }
      }
    }

    throw new Error(
      `Local audio master not found for "${meta.title}" in directories: ${this.searchDirectories.join(', ')}`
    );
  }

  private determineMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.wav': return 'audio/wav';
      case '.mp3': return 'audio/mpeg';
      case '.m4a': return 'audio/mp4';
      case '.flac': return 'audio/flac';
      case '.ogg': return 'audio/ogg';
      default: return 'application/octet-stream';
    }
  }
}
