// CLI tool to manually or scheduled run database cleanup for 30-day retention
import { cleanupOldSessions } from '../src/services/cleanupService';

async function main() {
  console.log('🧹 [Dhun] Running database 30-day retention session cleanup...');
  const result = await cleanupOldSessions(30);
  console.log(`✓ Deleted ${result.deletedSessionsCount} sessions older than ${result.retentionDays} days (cutoff: ${result.cutoffDate})`);
  process.exit(0);
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
