import { drizzle as drizzleNodePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import * as schema from './schema';
import seedCatalog from './seed/songs.json';

export type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// Attach to globalThis so all Next.js route bundles in dev server share the same database instance
declare global {
  // eslint-disable-next-line no-var
  var __dhun_cached_db: any | undefined;
  // eslint-disable-next-line no-var
  var __dhun_init_promise: Promise<any> | null | undefined;
}

let cachedDb: any = null;
let initPromise: Promise<any> | null = null;

export function isExternalPostgres(): boolean {
  const url = process.env.DATABASE_URL;
  return !!url;
}

// Retries a database query once to gracefully absorb Neon cold-starts (compute wake-up from sleep)
export async function executeWithRetry<T>(queryFn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await queryFn();
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) throw err;
      console.warn(`[Neon / Postgres] Connection error on attempt ${attempt}, retrying after compute cold-start...`, err.message);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

export async function getDb(): Promise<any> {
  if (globalThis.__dhun_cached_db) return globalThis.__dhun_cached_db;
  if (cachedDb) return cachedDb;
  if (globalThis.__dhun_init_promise) return globalThis.__dhun_init_promise;
  if (initPromise) return initPromise;

  const promise = (async () => {
    // In production, strictly enforce external PostgreSQL via DATABASE_URL
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
      throw new Error(
        '[FATAL] Missing required environment variable: DATABASE_URL in production. PGlite in-memory fallback is disabled outside development/test.'
      );
    }

    // 1. If explicit DATABASE_URL is configured (e.g. Neon pooled, Supabase, local Docker Postgres)
    if (isExternalPostgres()) {
      const isNeon = (process.env.DATABASE_URL || '').includes('neon.tech');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: isNeon ? 15000 : 10000, // Generous 15s timeout for Neon cold-starts
        ssl: (process.env.DATABASE_URL || '').includes('sslmode=require') || isNeon
          ? { rejectUnauthorized: false }
          : undefined,
      });

      pool.on('error', (err) => {
        console.error('Postgres pool idle client error:', err.message);
      });

      cachedDb = drizzleNodePg(pool, { schema });
      globalThis.__dhun_cached_db = cachedDb;
      return cachedDb;
    }

    // 2. Default in-process PostgreSQL 18.6 engine (dev & test only)
    // In unit/integration tests, use ephemeral in-memory to keep test suites isolated
    // In dev server, persist to .pglite directory so all route chunks share the exact same database
    const isTest = process.env.NODE_ENV === 'test';
    const dataDir = isTest ? undefined : path.join(process.cwd(), '.pglite');
    const pglite = new PGlite(dataDir);

    // Apply migration SQL DDL only if tables do not already exist
    const migrationPath = path.join(process.cwd(), 'drizzle', '0000_nappy_vapor.sql');
    if (fs.existsSync(migrationPath)) {
      let tablesExist = false;
      try {
        const check = await pglite.query(
          "SELECT 1 FROM information_schema.tables WHERE table_name = 'game_sessions' LIMIT 1;"
        );
        tablesExist = check.rows.length > 0;
      } catch {
        tablesExist = false;
      }

      if (!tablesExist) {
        const rawSql = fs.readFileSync(migrationPath, 'utf-8');
        const statements = rawSql
          .split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const stmt of statements) {
          await pglite.query(stmt);
        }
      }
    }

    const dbInstance = drizzlePglite(pglite, { schema });

    // Seed works and songs from seed catalog in high-performance batches if not already populated
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
        clip_start_seconds: (s as unknown as { clip_start_seconds?: number }).clip_start_seconds ?? 0,
      }));
      await dbInstance.insert(schema.songs).values(songBatch);
    }

    cachedDb = dbInstance;
    globalThis.__dhun_cached_db = dbInstance;
    return cachedDb;
  })();

  initPromise = promise;
  globalThis.__dhun_init_promise = promise;
  return promise;
}

export { schema };
export const db = getDb;
export type DatabaseInstance = any;
