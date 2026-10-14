// Standalone CLI ingestion tool for Dhun
// Usage:
//   npx tsx scripts/ingest.ts --synthetic --all
//   npx tsx scripts/ingest.ts --title "Kal Ho Naa Ho" --provider synthetic
//   npx tsx scripts/ingest.ts --id "song-uuid" --provider local

import path from 'path';
import fs from 'fs';
import { AudioCutterService } from '../src/services/audioCutter';
import { SyntheticToneProvider } from '../src/services/audioSources/SyntheticToneProvider';
import { LocalFileProvider } from '../src/services/audioSources/LocalFileProvider';
import { AppleMusicPreviewProvider } from '../src/services/audioSources/AppleMusicPreviewProvider';
import { AudioSourceProvider } from '../src/services/audioSources/AudioSourceProvider';
import { getClipStorage } from '../src/services/storage/LocalClipStorage';

interface SongCatalogItem {
  id: string;
  work_id: string;
  title: string;
  artists: string[];
  movie_or_album?: string;
  language: string;
}

async function runCliIngestion() {
  const args = process.argv.slice(2);
  console.log('--- Dhun Audio Ingestion Engine ---');

  const cutter = new AudioCutterService();
  const outputStorageDir = path.join(process.cwd(), 'storage');

  // Load catalog
  const catalogPath = path.join(process.cwd(), 'src', 'db', 'seed', 'songs.json');
  if (!fs.existsSync(catalogPath)) {
    console.error(`Catalog file not found at ${catalogPath}. Run scripts/build_seed_catalog.ts first.`);
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  const allSongs: SongCatalogItem[] = catalog.songs;

  // Determine provider
  let provider: AudioSourceProvider = new SyntheticToneProvider();
  if (args.includes('--apple')) {
    provider = new AppleMusicPreviewProvider();
  } else if (args.includes('--local')) {
    provider = new LocalFileProvider();
  }

  console.log(`Using audio provider: [${provider.providerName}]`);

  // Target selection
  let songsToProcess: SongCatalogItem[] = [];

  const titleFlagIndex = args.indexOf('--title');
  const idFlagIndex = args.indexOf('--id');
  const limitFlagIndex = args.indexOf('--limit');

  if (titleFlagIndex !== -1 && args[titleFlagIndex + 1]) {
    const searchTitle = args[titleFlagIndex + 1].toLowerCase();
    songsToProcess = allSongs.filter(s => s.title.toLowerCase().includes(searchTitle));
  } else if (idFlagIndex !== -1 && args[idFlagIndex + 1]) {
    const targetId = args[idFlagIndex + 1];
    songsToProcess = allSongs.filter(s => s.id === targetId);
  } else if (args.includes('--all') || args.includes('--batch')) {
    let limit = 5; // Default batch limit for safety
    if (limitFlagIndex !== -1 && args[limitFlagIndex + 1]) {
      limit = parseInt(args[limitFlagIndex + 1], 10);
    }
    songsToProcess = allSongs.slice(0, limit);
  } else {
    // Default to the first test song
    songsToProcess = [allSongs[0]];
    console.log('No specific song specified. Defaulting to first track in catalog.');
  }

  console.log(`Processing ${songsToProcess.length} track(s)...`);

  const manifestRecords: Array<{
    songId: string;
    title: string;
    clips: Array<{ attemptIndex: number; durationMs: number; format: string; storageKey: string; sizeBytes: number }>;
  }> = [];

  for (let i = 0; i < songsToProcess.length; i++) {
    const track = songsToProcess[i];
    console.log(`\n[${i + 1}/${songsToProcess.length}] Ingesting: "${track.title}" (${track.id})`);

    try {
      const sourceResult = await provider.fetchTrack({
        id: track.id,
        title: track.title,
        artists: track.artists,
        movieOrAlbum: track.movie_or_album,
      });

      console.log(`  Source fetched: ${sourceResult.mimeType} (${Math.round(sourceResult.audioBuffer.length / 1024)} KB)`);

      let ext = 'wav';
      if (sourceResult.mimeType.includes('mpeg')) {
        ext = 'mp3';
      } else if (sourceResult.mimeType.includes('mp4') || sourceResult.mimeType.includes('m4a')) {
        ext = 'm4a';
      } else if (sourceResult.mimeType.includes('flac')) {
        ext = 'flac';
      }

      const slicedClips = await cutter.sliceTrack(sourceResult.audioBuffer, ext, {
        songId: track.id,
        outputDirectory: outputStorageDir,
      });

      // Save clips into active ClipStorage (R2, Supabase, or Local Disk)
      const clipStorage = getClipStorage();
      console.log(`  Uploading clips to storage provider: [${clipStorage.storageName}]`);
      for (const clip of slicedClips) {
        const mime = clip.format === 'wav' ? 'audio/wav' : 'audio/mp4';
        await clipStorage.saveClip(clip.storageKey, clip.buffer, mime);
      }

      console.log(`  Successfully sliced & saved 6 cumulative clips (-16 LUFS):`);
      for (const clip of slicedClips) {
        console.log(`    - Attempt ${clip.attemptIndex} (${clip.durationMs}ms, ${clip.format}): ${clip.storageKey} [${clip.fileSizeBytes} bytes]`);
      }

      manifestRecords.push({
        songId: track.id,
        title: track.title,
        clips: slicedClips.map(c => ({
          attemptIndex: c.attemptIndex,
          durationMs: c.durationMs,
          format: c.format,
          storageKey: c.storageKey,
          sizeBytes: c.fileSizeBytes,
        })),
      });
    } catch (err) {
      console.error(`  Failed to process "${track.title}":`, (err as Error).message);
    }
  }

  // Save an ingestion manifest in storage for reference
  const manifestPath = path.join(outputStorageDir, 'ingestion_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifestRecords, null, 2), 'utf-8');
  console.log(`\n✓ Ingestion complete! Manifest saved to: ${manifestPath}`);
}

runCliIngestion().catch(err => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
