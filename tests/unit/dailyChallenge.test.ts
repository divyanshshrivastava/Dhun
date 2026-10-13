import { describe, it, expect } from 'vitest';
import { getCurrentIstDateString, getMsUntilNextMidnightIst } from '../../src/lib/istDate';
import { resolveDailySong, computeDailyFallbackIndex } from '../../src/services/dailyChallengeService';
import seedCatalog from '../../src/db/seed/songs.json';

const catalogItems = seedCatalog.songs.map(s => ({
  id: s.id,
  workId: s.work_id,
  title: s.title,
  aliases: s.aliases,
  artists: s.artists,
  movieOrAlbum: s.movie_or_album,
  language: s.language,
  era: s.era,
}));

describe('dailyChallenge & IST Calendar Transitions', () => {
  it('formats dates according to Asia/Kolkata timezone', () => {
    // 2026-10-14 06:00:00 UTC = 2026-10-14 11:30:00 IST
    const dateUtc = new Date('2026-10-14T06:00:00Z');
    expect(getCurrentIstDateString(dateUtc)).toBe('2026-10-14');
  });

  it('handles midnight IST transition boundary with precision', () => {
    // 18:29:59 UTC = 23:59:59 IST (1 second before midnight in India)
    const justBeforeMidnightUtc = new Date('2026-10-14T18:29:59.000Z');
    expect(getCurrentIstDateString(justBeforeMidnightUtc)).toBe('2026-10-14');

    // 18:30:00 UTC = 00:00:00 IST (exact midnight in India)
    const exactMidnightUtc = new Date('2026-10-14T18:30:00.000Z');
    expect(getCurrentIstDateString(exactMidnightUtc)).toBe('2026-10-15');
  });

  it('calculates countdown milliseconds until next midnight IST', () => {
    // 1 second before midnight
    const justBefore = new Date('2026-10-14T18:29:59.000Z');
    const remainingMs = getMsUntilNextMidnightIst(justBefore);
    expect(remainingMs).toBe(1000); // exactly 1 second!
  });

  it('deterministically selects daily song with fallback index', () => {
    const idx1 = computeDailyFallbackIndex('2026-10-14', catalogItems.length);
    const idx2 = computeDailyFallbackIndex('2026-10-14', catalogItems.length);
    const idxNextDay = computeDailyFallbackIndex('2026-10-15', catalogItems.length);

    expect(idx1).toBe(idx2);
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx1).toBeLessThan(catalogItems.length);

    // Next day gets a different song
    expect(idx1).not.toBe(idxNextDay);

    const songToday = resolveDailySong('2026-10-14', catalogItems);
    expect(songToday).toBeDefined();
    expect(songToday.id).toBe(catalogItems[idx1].id);
  });
});
