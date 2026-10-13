import { CatalogSongItem } from "./catalogSearch";
import seedCatalog from "../../db/seed/songs.json";

export const CLIENT_SONG_CATALOG: CatalogSongItem[] = seedCatalog.songs.map((s: any) => ({
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
