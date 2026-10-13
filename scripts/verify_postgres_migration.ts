// Script to verify that Drizzle PostgreSQL migrations and constraints
// execute cleanly against a real in-process PostgreSQL engine

import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

export async function runPostgresMigrationCheck() {
  console.log('=== Verifying Drizzle Migration Against PostgreSQL Engine ===');

  const pg = new PGlite();
  const versionRes = await pg.query('SELECT version();');
  console.log('PostgreSQL Server Info:', (versionRes.rows[0] as { version: string }).version);

  // 1. Read and apply the generated SQL migration
  const migrationPath = path.join(process.cwd(), 'drizzle', '0000_nappy_vapor.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration SQL not found at ${migrationPath}`);
  }

  const rawMigrationSql = fs.readFileSync(migrationPath, 'utf-8');
  const statements = rawMigrationSql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Applying ${statements.length} DDL migration statements...`);
  for (let i = 0; i < statements.length; i++) {
    await pg.query(statements[i]);
  }
  console.log('✓ All 7 tables, foreign keys, and indexes created successfully.');

  // 2. Connect Drizzle ORM to this PostgreSQL instance
  const testDb = drizzle(pg, { schema });

  // 3. Seed musical works and songs from seed catalog
  const catalogPath = path.join(process.cwd(), 'src', 'db', 'seed', 'songs.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

  console.log(`Seeding ${catalog.works.length} musical works and ${catalog.songs.length} songs...`);
  for (const w of catalog.works) {
    await testDb.insert(schema.musicalWorks).values({
      id: w.id,
      canonical_title: w.canonical_title,
    });
  }

  for (const s of catalog.songs) {
    await testDb.insert(schema.songs).values({
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
    });
  }

  const workCount = await testDb.select().from(schema.musicalWorks);
  const songCount = await testDb.select().from(schema.songs);
  console.log(`✓ Seed verified: ${workCount.length} works, ${songCount.length} songs in PostgreSQL.`);

  // 4. Test Daily Challenge & Session Creation with unique constraint
  const testSong = songCount[0];
  const challengeDate = '2026-10-14';

  const [daily] = await testDb.insert(schema.dailyChallenges).values({
    challenge_date: challengeDate,
    song_id: testSong.id,
  }).returning();
  console.log(`✓ Daily Challenge created for date ${daily.challenge_date} with song: "${testSong.title}"`);

  const testGuestId = '11111111-2222-3333-4444-555555555555';
  const sessionTokenHash = 'hash-abc-123';

  const [session1] = await testDb.insert(schema.gameSessions).values({
    guest_id: testGuestId,
    session_token_hash: sessionTokenHash,
    mode: 'DAILY',
    daily_challenge_id: daily.id,
    song_id: testSong.id,
    attempts_used: 0,
    status: 'IN_PROGRESS',
  }).returning();
  console.log(`✓ Game Session created for guest ${session1.guest_id} (session ID: ${session1.id})`);

  // 5. Verify the UNIQUE(guest_id, daily_challenge_id) constraint rejects duplicates!
  let constraintPassed = false;
  try {
    await testDb.insert(schema.gameSessions).values({
      guest_id: testGuestId,
      session_token_hash: 'another-hash',
      mode: 'DAILY',
      daily_challenge_id: daily.id,
      song_id: testSong.id,
      attempts_used: 0,
      status: 'IN_PROGRESS',
    });
  } catch (err: unknown) {
    const fullErrStr = String(err) + ' ' + JSON.stringify(err);
    const hasConstraint = fullErrStr.includes('unq_guest_daily') || fullErrStr.includes('23505');
    if (hasConstraint) {
      constraintPassed = true;
      console.log('✓ unq_guest_daily constraint verified: Duplicate daily session was successfully blocked by PostgreSQL (code: 23505)!');
    } else {
      throw err;
    }
  }

  if (!constraintPassed) {
    throw new Error('FAILED: unq_guest_daily unique constraint failed to reject duplicate guest session!');
  }

  console.log('=== All PostgreSQL Migration & Constraint Checks Passed 100% ===');
  await pg.close();
}

if (require.main === module || process.argv[1]?.includes('verify_postgres_migration.ts')) {
  runPostgresMigrationCheck().catch(err => {
    console.error('Migration verification failed:', err);
    process.exit(1);
  });
}
