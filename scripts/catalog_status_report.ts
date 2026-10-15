// CLI reporting tool for Dhun catalog audio status
// Usage: npx tsx scripts/catalog_status_report.ts
// Lists which catalog songs have audio masters, which have all 6 clips sliced, and which need attention.

import path from 'path';
import fs from 'fs';
import { getClipStorage } from '../src/services/storage/LocalClipStorage';
import { checkSongHasAllClips } from '../src/services/storage/ClipStorage';

interface CatalogSong {
  id: string;
  title: string;
  artists: string[];
  movie_or_album?: string;
  language: string;
  era: string;
}

function findLocalMasterFile(song: CatalogSong, audioMastersDir: string): string | null {
  if (!fs.existsSync(audioMastersDir)) return null;

  const candidateExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg'];
  const searchKeys = [
    song.id,
    song.title.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    song.title,
  ];

  for (const key of searchKeys) {
    for (const ext of candidateExtensions) {
      const candidatePath = path.join(audioMastersDir, `${key}${ext}`);
      if (fs.existsSync(candidatePath)) {
        return path.basename(candidatePath);
      }
    }
  }

  return null;
}

async function generateCatalogReport() {
  console.log('═══════════════════════════════════════════════════════════════════════════════════════');
  console.log('                 DHUN (धुन) — CATALOG AUDIO & CLIP STATUS REPORT                       ');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════\n');

  // Auto-load environment variables from .env.local and .env if present
  for (const envFile of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(fullPath) && typeof (process as any).loadEnvFile === 'function') {
      try {
        (process as any).loadEnvFile(fullPath);
      } catch {
        // Continue if already set
      }
    }
  }

  const catalogPath = path.join(process.cwd(), 'src', 'db', 'seed', 'songs.json');
  if (!fs.existsSync(catalogPath)) {
    console.error(`Catalog seed not found at ${catalogPath}`);
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  const songs: CatalogSong[] = catalog.songs;
  const audioMastersDir = path.join(process.cwd(), 'audio-masters');
  const clipStorage = getClipStorage();

  console.log(`Active Storage Provider: [${clipStorage.storageName}]`);
  console.log(`Audio Masters Directory: [${audioMastersDir}] (gitignored)`);
  console.log(`Total Catalog Tracks:    ${songs.length}\n`);

  let countReady = 0;
  let countMasterAvailableNeedsIngest = 0;
  let countMissingMaster = 0;

  const rows: Array<{
    title: string;
    id: string;
    masterFile: string;
    clipsStatus: string;
    overall: string;
  }> = [];

  for (const song of songs) {
    const masterFileName = findLocalMasterFile(song, audioMastersDir);
    const hasAll6Clips = await checkSongHasAllClips(song.id, clipStorage);

    let clipsStatus = '0/6 missing';
    let overall = 'MISSING AUDIO';

    if (hasAll6Clips) {
      clipsStatus = '6/6 complete';
      overall = 'READY';
      countReady++;
    } else if (masterFileName) {
      overall = 'NEEDS INGEST';
      countMasterAvailableNeedsIngest++;
    } else {
      countMissingMaster++;
    }

    rows.push({
      title: song.title.length > 30 ? song.title.slice(0, 27) + '...' : song.title,
      id: song.id.slice(0, 8) + '...',
      masterFile: masterFileName || '—',
      clipsStatus,
      overall,
    });
  }

  // Print table header
  console.log(
    'Song Title'.padEnd(32) + ' | ' +
    'Song ID'.padEnd(12) + ' | ' +
    'Master in audio-masters/'.padEnd(36) + ' | ' +
    'Storage Clips'.padEnd(14) + ' | ' +
    'Status'
  );
  console.log('─'.repeat(110));

  for (const row of rows) {
    const statusFormatted =
      row.overall === 'READY'
        ? '\x1b[32mREADY\x1b[0m'
        : row.overall === 'NEEDS INGEST'
        ? '\x1b[33mNEEDS INGEST\x1b[0m'
        : '\x1b[31mMISSING AUDIO\x1b[0m';

    console.log(
      row.title.padEnd(32) + ' | ' +
      row.id.padEnd(12) + ' | ' +
      row.masterFile.padEnd(36) + ' | ' +
      row.clipsStatus.padEnd(14) + ' | ' +
      statusFormatted
    );
  }

  console.log('\n───────────────────────────────────────────────────────────────────────────────────────');
  console.log('SUMMARY:');
  console.log(`  ✓ Ready for Gameplay (6/6 clips present):   ${countReady} / ${songs.length}`);
  console.log(`  ⚡ Master audio available (run ingestion):  ${countMasterAvailableNeedsIngest} / ${songs.length}`);
  console.log(`  ✗ Missing master audio file:                ${countMissingMaster} / ${songs.length}`);
  console.log('───────────────────────────────────────────────────────────────────────────────────────');

  if (countMasterAvailableNeedsIngest > 0) {
    console.log(`\nTip: Run "npm run ingest:masters" to slice and upload all ready master files.`);
  }
}

generateCatalogReport().catch(err => {
  console.error('Report generation failed:', err);
  process.exit(1);
});
