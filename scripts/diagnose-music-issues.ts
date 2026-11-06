import fs from 'fs';
import path from 'path';
import { MOCK_TRACKS, MOCK_ALBUMS } from '../src/lib/mockData';
import { PLATFORM_CANONICAL_TRACKS, MICHAEL_JACKSON_TRACKS, VAULT_CLASSIC_TRACKS, getAuthenticCoverForTrack, KNOWN_ALBUM_COVERS } from '../src/lib/music/MusicCatalogService';
import { getAuthenticAudioUrl } from '../src/lib/music/authenticAudioMap';

console.log('--- DIAGNOSTIC SCAN OF MUSIC CATALOG ---');

const publicDir = path.join(process.cwd(), 'public');

function checkFile(relUrl?: string): boolean {
  if (!relUrl) return false;
  if (relUrl.startsWith('http://') || relUrl.startsWith('https://')) return true; // external
  const clean = relUrl.replace(/^\//, '').split('?')[0];
  const full = path.join(publicDir, decodeURIComponent(clean));
  return fs.existsSync(full);
}

const allTracks = [...PLATFORM_CANONICAL_TRACKS, ...MOCK_TRACKS];
console.log(`Total tracks to examine: ${allTracks.length}`);

const brokenAudio: any[] = [];
const brokenCovers: any[] = [];
const genericCovers: any[] = [];
const nameIssues: any[] = [];

allTracks.forEach((t) => {
  // 1. Audio Check
  const authenticAudio = getAuthenticAudioUrl(t);
  const rawAudio = t.audioUrl;
  const effectiveAudio = authenticAudio || rawAudio;

  const rawAudioExists = checkFile(rawAudio);
  const effectiveAudioExists = checkFile(effectiveAudio);

  if (!effectiveAudioExists) {
    brokenAudio.push({
      id: t.id,
      title: t.title,
      artist: t.artistName,
      rawAudio,
      authenticAudio,
      effectiveAudio,
    });
  }

  // 2. Cover Check
  const authenticCover = getAuthenticCoverForTrack(t.artistName, t.albumTitle, t.title);
  const rawCover = t.coverUrl;
  const effectiveCover = authenticCover || rawCover;

  const rawCoverExists = checkFile(rawCover);
  const effectiveCoverExists = checkFile(effectiveCover);

  if (!effectiveCoverExists) {
    brokenCovers.push({
      id: t.id,
      title: t.title,
      artist: t.artistName,
      rawCover,
      authenticCover,
      effectiveCover,
    });
  }

  if (
    !effectiveCover ||
    effectiveCover.includes('images.unsplash.com') ||
    effectiveCover.endsWith('Folder.jpg') ||
    effectiveCover.includes('logo.png')
  ) {
    genericCovers.push({
      id: t.id,
      title: t.title,
      artist: t.artistName,
      album: t.albumTitle,
      effectiveCover,
      authenticCover,
    });
  }

  // 3. Name issues
  const isNumbered = /^\d{1,2}$/.test(t.title.trim());
  const hasRawFileName = t.title.includes('.mp3') || t.title.includes('Michael_Jackson_-_') || t.title.includes('OneDrive');
  const isUnknownArtist = !t.artistName || t.artistName.toLowerCase().includes('unknown');
  const isGenericAlbum = t.albumTitle === 'Single Release' || t.albumTitle === 'Vault Cuts' || !t.albumTitle;

  if (isNumbered || hasRawFileName || isUnknownArtist || isGenericAlbum) {
    nameIssues.push({
      id: t.id,
      title: t.title,
      artist: t.artistName,
      album: t.albumTitle,
      isNumbered,
      hasRawFileName,
      isUnknownArtist,
      isGenericAlbum,
    });
  }
});

console.log(`\nBROKEN AUDIO COUNT: ${brokenAudio.length}`);
brokenAudio.forEach((b) => console.log(' Audio Failure:', b));

console.log(`\nBROKEN COVERS COUNT: ${brokenCovers.length}`);
brokenCovers.forEach((b) => console.log(' Cover Missing:', b));

console.log(`\nGENERIC / PLACEHOLDER COVERS COUNT: ${genericCovers.length}`);
genericCovers.forEach((g) => console.log(' Generic Cover:', g.id, g.title, '| Artist:', g.artist, '| Cover:', g.effectiveCover, '| Authentic:', g.authenticCover));

console.log(`\nNAME ISSUES COUNT: ${nameIssues.length}`);
nameIssues.forEach((n) => console.log(' Name Issue:', n.id, '| Title:', n.title, '| Artist:', n.artist, '| Album:', n.album));
