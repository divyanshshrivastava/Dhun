// Pluggable audio source interface for Dhun
// Allows swapping between local master tracks, synthetic test ragas,
// and third-party promotional preview APIs

export interface AudioSourceResult {
  audioBuffer: Buffer;
  mimeType: string;
  attribution?: string;
  sourceType: 'local_file' | 'synthetic_tone' | 'apple_preview' | 'licensed_stream';
}

export interface AudioSourceMetadata {
  id?: string;
  title: string;
  artists?: string[];
  movieOrAlbum?: string;
  isrc?: string;
  language?: string;
  customFilePath?: string;
}

export interface AudioSourceProvider {
  readonly providerName: string;
  fetchTrack(meta: AudioSourceMetadata): Promise<AudioSourceResult>;
  isAvailable(): Promise<boolean>;
}
