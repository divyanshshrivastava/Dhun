import { CatalogSongItem } from "./catalogSearch";
import seedCatalog from "../../db/seed/songs.json";

export let CLIENT_SONG_CATALOG: CatalogSongItem[] = seedCatalog.songs.map((s: any) => ({
  id: s.id,
  workId: s.work_id,
  title: s.title,
  aliases: s.aliases || [],
  artists: s.artists || [],
  movieOrAlbum: s.movie_or_album,
  language: s.language,
  era: s.era,
  genres: s.genres || [],
}));

// Asynchronously loads static CDN-cached /catalog.json without serverless function invocations
export async function loadStaticCatalog(): Promise<CatalogSongItem[]> {
  if (typeof window === 'undefined') return CLIENT_SONG_CATALOG;

  try {
    const res = await fetch('/catalog.json', { cache: 'default' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        CLIENT_SONG_CATALOG = data;
      }
    }
  } catch {
    // Fall back silently to pre-bundled catalog
  }

  return CLIENT_SONG_CATALOG;
}
