// Client-side instant catalog search for Dhun
// Operates on the lightweight in-memory catalog with Hinglish transliteration support

import {
  cleanIndianString,
  phoneticHinglish,
  extractInitialsAcronym,
  quickLevenshtein,
} from '../transliteration/hinglishMatcher';

export interface CatalogSongItem {
  id: string;
  workId: string;
  title: string;
  aliases: string[];
  artists: string[];
  movieOrAlbum?: string;
  language: string;
  era: string;
  genres?: string[];
}

export interface SearchResultItem extends CatalogSongItem {
  matchScore: number;
}

// Precomputed cache so we don't re-run regexes 10,000 times per second during keystrokes
interface PrecomputedSong {
  item: CatalogSongItem;
  titleClean: string;
  titlePhonetic: string;
  acronym: string;
  aliasesClean: string[];
  aliasesPhonetic: string[];
  movieClean?: string;
  moviePhonetic?: string;
  artistsClean: string[];
  artistsPhonetic: string[];
}

// Global WeakMap cache for catalog indexing
const precomputedCache = new WeakMap<CatalogSongItem[], PrecomputedSong[]>();

function getOrBuildIndex(catalog: CatalogSongItem[]): PrecomputedSong[] {
  let indexed = precomputedCache.get(catalog);
  if (!indexed) {
    indexed = catalog.map((item) => {
      const titleClean = cleanIndianString(item.title);
      const titlePhonetic = phoneticHinglish(item.title);
      const acronym = extractInitialsAcronym(item.title);

      const aliasesClean = (item.aliases || []).map((a) => cleanIndianString(a));
      const aliasesPhonetic = (item.aliases || []).map((a) => phoneticHinglish(a));

      const movieClean = item.movieOrAlbum ? cleanIndianString(item.movieOrAlbum) : undefined;
      const moviePhonetic = item.movieOrAlbum ? phoneticHinglish(item.movieOrAlbum) : undefined;

      const artistsClean = (item.artists || []).map((art) => cleanIndianString(art));
      const artistsPhonetic = (item.artists || []).map((art) => phoneticHinglish(art));

      return {
        item,
        titleClean,
        titlePhonetic,
        acronym,
        aliasesClean,
        aliasesPhonetic,
        movieClean,
        moviePhonetic,
        artistsClean,
        artistsPhonetic,
      };
    });
    precomputedCache.set(catalog, indexed);
  }
  return indexed;
}

// Quick scoring using already pre-cleaned and pre-phonetic strings
function scorePrecomputed(
  qClean: string,
  qPhonetic: string,
  tClean: string,
  tPhonetic: string,
  tAcronym?: string
): number {
  if (qClean === tClean) return 1.0;
  if (tAcronym && qClean === tAcronym) return 0.95;
  if (tClean.startsWith(qClean)) return 0.9;
  if (tClean.includes(qClean)) return 0.8;

  if (qPhonetic === tPhonetic) return 0.92;
  if (tPhonetic.startsWith(qPhonetic)) return 0.85;
  if (tPhonetic.includes(qPhonetic)) return 0.75;

  if (tClean.split(' ').some((w) => w.startsWith(qClean))) return 0.7;

  // Length difference guard before Levenshtein
  if (Math.abs(qPhonetic.length - tPhonetic.length) <= 2) {
    const dist = quickLevenshtein(qPhonetic, tPhonetic);
    const maxLen = Math.max(qPhonetic.length, tPhonetic.length);
    if (maxLen > 3 && dist <= 2) {
      return Math.max(0, 1 - dist / maxLen);
    }
  }

  return 0;
}

// Check if a guess matches the solution - accounts for work_id so remakes and reprises count!
export function checkIfRemakeOrExactMatchBhai(
  guessedSong: { id: string; workId?: string },
  solutionSong: { id: string; workId: string }
): boolean {
  if (!guessedSong || !solutionSong) return false;

  // Direct match on identical recording
  if (guessedSong.id === solutionSong.id) return true;

  // Remake / reprise / female version match via shared musical work ID
  if (guessedSong.workId && solutionSong.workId && guessedSong.workId === solutionSong.workId) {
    return true;
  }

  return false;
}

// In-memory catalog search with scoring
export function searchSongCatalog(
  allTheSongs: CatalogSongItem[],
  userQuery: string,
  maxResults = 10
): SearchResultItem[] {
  const theQueryCleanedUp = cleanIndianString(userQuery);
  if (!theQueryCleanedUp || theQueryCleanedUp.length < 2) {
    return [];
  }

  const theQueryPhonetic = phoneticHinglish(userQuery);
  const indexedCatalog = getOrBuildIndex(allTheSongs);
  const scoredResults: SearchResultItem[] = [];

  for (let idx = 0; idx < indexedCatalog.length; idx++) {
    const entry = indexedCatalog[idx];
    let topScoreForThisTrack = 0;

    // 1. Check title
    const titleScore = scorePrecomputed(
      theQueryCleanedUp,
      theQueryPhonetic,
      entry.titleClean,
      entry.titlePhonetic,
      entry.acronym
    );
    if (titleScore > topScoreForThisTrack) topScoreForThisTrack = titleScore;

    // 2. Check aliases
    for (let aIdx = 0; aIdx < entry.aliasesClean.length; aIdx++) {
      const aliasScore = scorePrecomputed(
        theQueryCleanedUp,
        theQueryPhonetic,
        entry.aliasesClean[aIdx],
        entry.aliasesPhonetic[aIdx]
      );
      if (aliasScore > topScoreForThisTrack) topScoreForThisTrack = aliasScore;
    }

    // 3. Check movie / album name
    if (entry.movieClean && entry.moviePhonetic) {
      const albumScore =
        scorePrecomputed(
          theQueryCleanedUp,
          theQueryPhonetic,
          entry.movieClean,
          entry.moviePhonetic
        ) * 0.85;
      if (albumScore > topScoreForThisTrack) topScoreForThisTrack = albumScore;
    }

    // 4. Check primary artists
    for (let artIdx = 0; artIdx < entry.artistsClean.length; artIdx++) {
      const artistScore =
        scorePrecomputed(
          theQueryCleanedUp,
          theQueryPhonetic,
          entry.artistsClean[artIdx],
          entry.artistsPhonetic[artIdx]
        ) * 0.75;
      if (artistScore > topScoreForThisTrack) topScoreForThisTrack = artistScore;
    }

    // Filter out low scores
    if (topScoreForThisTrack >= 0.45) {
      scoredResults.push({
        ...entry.item,
        matchScore: topScoreForThisTrack,
      });
    }
  }

  // Sort descending by score, tiebreak on shorter title (more exact match)
  scoredResults.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return a.title.length - b.title.length;
  });

  return scoredResults.slice(0, maxResults);
}
