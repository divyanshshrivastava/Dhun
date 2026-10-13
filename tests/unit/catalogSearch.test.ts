import { describe, it, expect } from 'vitest';
import { searchSongCatalog, CatalogSongItem } from '../../src/lib/search/catalogSearch';
import seedCatalog from '../../src/db/seed/songs.json';

const catalogItems: CatalogSongItem[] = seedCatalog.songs.map(s => ({
  id: s.id,
  workId: s.work_id,
  title: s.title,
  aliases: s.aliases,
  artists: s.artists,
  movieOrAlbum: s.movie_or_album,
  language: s.language,
  era: s.era,
  genres: s.genres,
}));

describe('catalogSearch - Client-side in-memory autocomplete', () => {
  it('returns empty array for queries shorter than 2 characters', () => {
    expect(searchSongCatalog(catalogItems, '')).toEqual([]);
    expect(searchSongCatalog(catalogItems, 'a')).toEqual([]);
  });

  it('finds "Kal Ho Naa Ho" using the acronym "khnh"', () => {
    const results = searchSongCatalog(catalogItems, 'khnh');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Kal Ho Naa Ho');
  });

  it('finds "Channa Mereya" with alternate spelling "chana mereya"', () => {
    const results = searchSongCatalog(catalogItems, 'chana mereya');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Channa Mereya');
  });

  it('finds songs by movie name (e.g. "Rockstar")', () => {
    const results = searchSongCatalog(catalogItems, 'Rockstar');
    expect(results.length).toBeGreaterThan(0);
    const hasRockstarTrack = results.some(r => r.movieOrAlbum === 'Rockstar');
    expect(hasRockstarTrack).toBe(true);
  });

  it('finds songs by primary artist (e.g. "Diljit")', () => {
    const results = searchSongCatalog(catalogItems, 'Diljit');
    expect(results.length).toBeGreaterThan(0);
    const hasDiljitTrack = results.some(r => r.artists.includes('Diljit Dosanjh'));
    expect(hasDiljitTrack).toBe(true);
  });

  it('finds South Indian language songs (e.g. Tamil "Rowdy Baby", Telugu "Naatu Naatu")', () => {
    const tamilResult = searchSongCatalog(catalogItems, 'rowdy baby');
    expect(tamilResult.length).toBeGreaterThan(0);
    expect(tamilResult[0].title).toBe('Rowdy Baby');
    expect(tamilResult[0].language).toBe('tamil');

    const teluguResult = searchSongCatalog(catalogItems, 'naatu naatu');
    expect(teluguResult.length).toBeGreaterThan(0);
    expect(teluguResult[0].title).toBe('Naatu Naatu');
    expect(teluguResult[0].language).toBe('telugu');
  });

  it('executes in less than 5ms across the catalog', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      searchSongCatalog(catalogItems, 'kal ho na ho');
      searchSongCatalog(catalogItems, 'kesariya');
      searchSongCatalog(catalogItems, 'brown munde');
    }
    const end = performance.now();
    const avgTimePerQuery = (end - start) / 150;
    // Client-side in-memory search is blazing fast!
    expect(avgTimePerQuery).toBeLessThan(5);
  });
});
