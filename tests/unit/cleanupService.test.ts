import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { cleanupOldSessions } from '@/services/cleanupService';
import { getDb } from '@/db';
import * as schema from '@/db/schema';

describe('Data Retention & Cleanup Service', () => {
  it('executes 30-day session pruning and returns deletion metrics', async () => {
    const db = await getDb();

    // Fetch existing song to satisfy foreign key
    const [song] = await db.select().from(schema.songs).limit(1);

    // Insert an old completed session (45 days ago)
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const [oldSession] = await db
      .insert(schema.gameSessions)
      .values({
        guest_id: crypto.randomUUID(),
        session_token_hash: 'old_session_hash_123',
        mode: 'PRACTICE',
        song_id: song.id,
        attempts_used: 6,
        status: 'LOST',
        started_at: oldDate,
        completed_at: oldDate,
      })
      .returning();

    // Insert guess linked to that old session
    await db.insert(schema.guesses).values({
      session_id: oldSession.id,
      attempt_index: 0,
      guess_type: 'SKIPPED',
      is_correct: false,
      submitted_at: oldDate,
    });

    // Run cleanup
    const result = await cleanupOldSessions(30);

    expect(result.retentionDays).toBe(30);
    expect(result.deletedSessionsCount).toBeGreaterThanOrEqual(1);

    // Verify session was removed
    const remaining = await db
      .select()
      .from(schema.gameSessions)
      .where(eq(schema.gameSessions.id, oldSession.id));
    expect(remaining.length).toBe(0);
  });
});
