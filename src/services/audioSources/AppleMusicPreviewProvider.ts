// Apple Music / iTunes Store 30-Second Preview Provider
// NOTE: iTunes/Apple Music 30s preview clips typically begin mid-song (at the hook or chorus),
// NOT at t = 0.0s of the song's actual intro. Useful for promotional discovery / testing,
// but for precise intro guessing games, local master tracks provide accurate intro slicing.

import { AudioSourceProvider, AudioSourceMetadata, AudioSourceResult } from './AudioSourceProvider';

interface ITunesTrackResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  previewUrl?: string;
  country: string;
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesTrackResult[];
}

export class AppleMusicPreviewProvider implements AudioSourceProvider {
  readonly providerName = 'apple_preview';

  async isAvailable(): Promise<boolean> {
    try {
      const ping = await fetch('https://itunes.apple.com/search?term=test&limit=1', { method: 'HEAD' });
      return ping.ok;
    } catch {
      return false;
    }
  }

  async fetchTrack(meta: AudioSourceMetadata): Promise<AudioSourceResult> {
    const searchQuery = [meta.title, ...(meta.artists || []).slice(0, 1)].join(' ');
    const searchUrl = `https://itunes.apple.com/search?country=IN&media=music&entity=song&limit=5&term=${encodeURIComponent(searchQuery)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Dhun-AudioPipeline/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`iTunes Search API error: HTTP ${response.status} for query "${searchQuery}"`);
    }

    const data: ITunesSearchResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`No iTunes track matches found for "${searchQuery}" in country IN`);
    }

    // Find the first result with a valid previewUrl
    const matchedTrack = data.results.find(t => Boolean(t.previewUrl));

    if (!matchedTrack || !matchedTrack.previewUrl) {
      throw new Error(`Track found on iTunes for "${meta.title}", but no 30s previewUrl was returned.`);
    }

    // Fetch the raw audio stream (usually 256kbps AAC / m4a)
    const audioRes = await fetch(matchedTrack.previewUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download preview audio stream from: ${matchedTrack.previewUrl}`);
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audioBuffer,
      mimeType: 'audio/mp4',
      attribution: `30-second promotional preview for "${matchedTrack.trackName}" by ${matchedTrack.artistName} via Apple Music`,
      sourceType: 'apple_preview',
    };
  }
}
