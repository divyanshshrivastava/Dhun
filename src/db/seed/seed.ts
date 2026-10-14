// Database seeder script for Dhun
// Reads the generated seed catalog and populates musical_works and songs

import fs from 'fs';
import path from 'path';
import { getDb } from '../index';
import { musicalWorks, songs } from '../schema';
import { sql } from 'drizzle-orm';

interface SeedCatalogData {
  works: Array<{ id: string; canonical_title: string }>;
  songs: Array<{
    id: string;
    work_id: string;
    title: string;
    normalized_title: string;
    aliases: string[];
    artists: string[];
    movie_or_album?: string;
    language: string;
    era: string;
    genres: string[];
    difficulty: string;
  }>;
}

export async function runDatabaseSeed() {
  console.log('Bhai starting seed script for Dhun...');
  const db = await getDb();
  const jsonPath = path.join(__dirname, 'songs.json');

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Seed catalog file not found at: ${jsonPath}. Run "npx tsx scripts/build_seed_catalog.ts" first.`);
  }

  const rawJson = fs.readFileSync(jsonPath, 'utf-8');
  const catalog: SeedCatalogData = JSON.parse(rawJson);

  console.log(`Found ${catalog.works.length} musical works and ${catalog.songs.length} song tracks to seed.`);

  // 1. Seed musical works
  for (const w of catalog.works) {
    await db
      .insert(musicalWorks)
      .values({
        id: w.id,
        canonical_title: w.canonical_title,
      })
      .onConflictDoNothing();
  }
  console.log('✓ Musical works seeded successfully.');

  // 2. Seed songs
  for (const s of catalog.songs) {
    await db
      .insert(songs)
      .values({
        id: s.id,
        work_id: s.work_id,
        title: s.title,
        normalized_title: s.normalized_title,
        aliases: s.aliases,
        artists: s.artists,
        movie_or_album: s.movie_or_album,
        language: s.language,
        era: s.era,
        genres: s.genres,
        difficulty: s.difficulty,
        audio_source_type: 'local_upload',
        active: true,
        clip_start_seconds: (s as unknown as { clip_start_seconds?: number }).clip_start_seconds ?? 0,
      })
      .onConflictDoNothing();
  }
  console.log('✓ Songs seeded successfully.');
  console.log('All set! Database seeding completed without a hitch.');
}

// Execute if run directly from CLI
if (require.main === module || process.argv[1]?.includes('seed.ts')) {
  runDatabaseSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
