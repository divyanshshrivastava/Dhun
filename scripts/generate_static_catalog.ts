// Generates a static public/catalog.json file from the seed database
// Served directly by Vercel Global Edge Network with CDN caching (0 serverless invocations)

import fs from 'fs';
import path from 'path';
import seedCatalog from '../src/db/seed/songs.json';

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const clientCatalog = seedCatalog.songs.map((s: any) => ({
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

const targetPath = path.join(publicDir, 'catalog.json');
fs.writeFileSync(targetPath, JSON.stringify(clientCatalog, null, 2), 'utf-8');

console.log(`✓ Generated static catalog at ${targetPath} (${clientCatalog.length} songs, ${(fs.statSync(targetPath).size / 1024).toFixed(1)} KB)`);
