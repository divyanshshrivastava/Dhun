// Database Data Retention & Session Pruning Service for Dhun
// Preserves Neon Free Tier (0.5 GB storage ceiling) by pruning completed or abandoned
// game sessions and cascade-deleting associated guesses older than 30 days.
// Lifetime player stats in `player_stats` are preserved.

import { lt } from 'drizzle-orm';
import { getDb } from '@/db';
import * as schema from '@/db/schema';

export interface CleanupResult {
  deletedSessionsCount: number;
  retentionDays: number;
  cutoffDate: string;
}

export async function cleanupOldSessions(retentionDays = 30): Promise<CleanupResult> {
  const db = await getDb();
  const cutoffTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Deletes game sessions started before the cutoff time.
  // Foreign key cascade automatically cleans up associated rows in the `guesses` table.
  const deleted = await db
    .delete(schema.gameSessions)
    .where(lt(schema.gameSessions.started_at, cutoffTime))
    .returning({ id: schema.gameSessions.id });

  return {
    deletedSessionsCount: deleted.length,
    retentionDays,
    cutoffDate: cutoffTime.toISOString(),
  };
}
