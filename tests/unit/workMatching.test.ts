import { describe, it, expect } from 'vitest';
import { checkIfRemakeOrExactMatchBhai } from '../../src/lib/search/catalogSearch';
import seedCatalog from '../../src/db/seed/songs.json';

describe('workMatching - Remakes, Reprises and Canonical Work Equivalence', () => {
  it('recognizes exact recording match', () => {
    const song = { id: 's-123', workId: 'w-456' };
    expect(checkIfRemakeOrExactMatchBhai(song, song)).toBe(true);
  });

  it('recognizes 1999 Dilbar and 2018 Dilbar Remake as the SAME answer', () => {
    // Find both Dilbar tracks from the seed catalog
    const dilbar1999 = seedCatalog.songs.find(s => s.title.includes('1999') && s.title.includes('Dilbar'));
    const dilbar2018 = seedCatalog.songs.find(s => s.title.includes('2018') && s.title.includes('Dilbar'));

    expect(dilbar1999).toBeDefined();
    expect(dilbar2018).toBeDefined();

    // They must have DIFFERENT recording IDs
    expect(dilbar1999!.id).not.toBe(dilbar2018!.id);

    // But they must share the SAME work_id
    expect(dilbar1999!.work_id).toBe(dilbar2018!.work_id);

    // The game engine must accept either one as correct!
    const guessIs2018WhenAnswerIs1999 = checkIfRemakeOrExactMatchBhai(
      { id: dilbar2018!.id, workId: dilbar2018!.work_id },
      { id: dilbar1999!.id, workId: dilbar1999!.work_id }
    );
    expect(guessIs2018WhenAnswerIs1999).toBe(true);
  });

  it('recognizes 1996 Aankh Marey and 2018 Simmba Remake as the SAME answer', () => {
    const original = seedCatalog.songs.find(s => s.title.includes('1996') && s.title.includes('Aankh Marey'));
    const remake = seedCatalog.songs.find(s => s.title.includes('Simmba') && s.title.includes('Aankh Marey'));

    expect(original).toBeDefined();
    expect(remake).toBeDefined();
    expect(original!.work_id).toBe(remake!.work_id);

    expect(
      checkIfRemakeOrExactMatchBhai(
        { id: remake!.id, workId: remake!.work_id },
        { id: original!.id, workId: original!.work_id }
      )
    ).toBe(true);
  });

  it('recognizes 1995 Humma Humma and 2017 OK Jaanu Humma Song as the SAME answer', () => {
    const original = seedCatalog.songs.find(s => s.title.includes('1995') && s.title.includes('Humma'));
    const remake = seedCatalog.songs.find(s => s.title.includes('OK Jaanu') && s.title.includes('Humma'));

    expect(original).toBeDefined();
    expect(remake).toBeDefined();
    expect(original!.work_id).toBe(remake!.work_id);

    expect(
      checkIfRemakeOrExactMatchBhai(
        { id: remake!.id, workId: remake!.work_id },
        { id: original!.id, workId: original!.work_id }
      )
    ).toBe(true);
  });

  it('recognizes Kabira and Kabira (Encore) as the SAME answer', () => {
    const kabira = seedCatalog.songs.find(s => s.title === 'Kabira');
    const encore = seedCatalog.songs.find(s => s.title === 'Kabira (Encore)');

    expect(kabira).toBeDefined();
    expect(encore).toBeDefined();
    expect(kabira!.work_id).toBe(encore!.work_id);

    expect(
      checkIfRemakeOrExactMatchBhai(
        { id: encore!.id, workId: encore!.work_id },
        { id: kabira!.id, workId: kabira!.work_id }
      )
    ).toBe(true);
  });

  it('rejects unrelated songs even if they share an artist or genre', () => {
    const kesariya = seedCatalog.songs.find(s => s.title === 'Kesariya');
    const channaMereya = seedCatalog.songs.find(s => s.title === 'Channa Mereya');

    expect(kesariya).toBeDefined();
    expect(channaMereya).toBeDefined();
    expect(kesariya!.work_id).not.toBe(channaMereya!.work_id);

    const isMatch = checkIfRemakeOrExactMatchBhai(
      { id: kesariya!.id, workId: kesariya!.work_id },
      { id: channaMereya!.id, workId: channaMereya!.work_id }
    );
    expect(isMatch).toBe(false);
  });
});
