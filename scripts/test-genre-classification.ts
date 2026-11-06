import { classifyGenre, isTrackMatchingGenre, normalizeRawGenreString } from '../src/lib/music/genreClassifier';
import { MusicCatalogService } from '../src/lib/music/MusicCatalogService';

console.log('Testing Platform Catalog Genre Distribution...');
const allTracks = MusicCatalogService.getAllTracks();
console.log(`Total tracks in MusicCatalogService.getAllTracks(): ${allTracks.length}`);

const targetGenres = [
  'Jazz & Blues',
  'Reggae-Dancehall',
  'Reggaeton',
  'Latin-Freestyle',
  'House-Club',
  'Hip Hop',
  'R&B/Neo-Soul',
  'Country-Soul',
  'Afro-House & Beats',
];

for (const g of targetGenres) {
  const matches = allTracks.filter((t) =>
    isTrackMatchingGenre(t.genre, g, t.crateId, t.artistName, t.title)
  );
  console.log(`\n=== "${g}": ${matches.length} tracks found ===`);
  matches.forEach((m) => {
    console.log(`  - ${m.artistName} - "${m.title}" (Genre: "${m.genre}", Crate: "${m.crateId}")`);
  });
}

