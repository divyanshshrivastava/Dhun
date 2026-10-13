import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Lazy pool initialization so scripts or tests running purely in-memory
// don't blow up if DATABASE_URL isn't configured yet
let pgPoolInstance: Pool | null = null;

function getPgPool(): Pool {
  if (!pgPoolInstance) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dhun_db';
    pgPoolInstance = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Don't let an unexpected idle client error crash the process
    pgPoolInstance.on('error', (err) => {
      console.error('Bhai DB pool threw an unexpected error on idle client:', err.message);
    });
  }
  return pgPoolInstance;
}

export const db = drizzle(getPgPool(), { schema });

export { schema };
export type DatabaseInstance = typeof db;
