import { drizzle as drizzleNodePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import * as schema from './schema';
import seedCatalog from './seed/songs.json';

export type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let cachedDb: any = null;
let initPromise: Promise<any> | null = null;

export function isExternalPostgres(): boolean {
  const url = process.env.DATABASE_URL;
  return !!url && !url.includes('localhost:5432/dhun_db');
}

export async function getDb(): Promise<any> {
  if (cachedDb) return cachedDb;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. If explicit DATABASE_URL is configured (e.g. AWS RDS / Supabase / local Docker Postgres)
    if (isExternalPostgres()) {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      pool.on('error', (err) => {
        console.error('Postgres pool idle client error:', err.message);
      });

      cachedDb = drizzleNodePg(pool, { schema });
      return cachedDb;
    }

    // 2. Default in-process PostgreSQL 18.6 engine
    const pglite = new PGlite();

    // Apply migration SQL DDL
    const migrationPath = path.join(process.cwd(), 'drizzle', '0000_nappy_vapor.sql');
    if (fs.existsSync(migrationPath)) {
      const rawSql = fs.readFileSync(migrationPath, 'utf-8');
      const statements = rawSql
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        await pglite.query(stmt);
      }
    }

    const dbInstance = drizzlePglite(pglite, { schema });

    // Seed works and songs from seed catalog in high-performance batches
    const existingWorks = await dbInstance.select().from(schema.musicalWorks).limit(1);
    if (existingWorks.length === 0) {
      const workBatch = seedCatalog.works.map(w => ({
        id: w.id,
        canonical_title: w.canonical_title,
      }));
      await dbInstance.insert(schema.musicalWorks).values(workBatch);

      const songBatch = seedCatalog.songs.map(s => ({
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
      }));
      await dbInstance.insert(schema.songs).values(songBatch);
    }

    cachedDb = dbInstance;
    return cachedDb;
  })();

  return initPromise;
}

export { schema };
export const db = getDb;
export type DatabaseInstance = any;
