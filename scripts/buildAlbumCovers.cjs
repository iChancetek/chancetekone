const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const albumsDir = path.join(process.cwd(), 'public', 'images', 'albums');
const coversDir = path.join(process.cwd(), 'public', 'images', 'covers');

if (!fs.existsSync(albumsDir)) fs.mkdirSync(albumsDir, { recursive: true });
if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

async function createCover({ filename, artist, album, year, genre, bgGradient, accentColor, subtitle }) {
  const targetPath = path.join(albumsDir, filename);

  const svgOverlay = `
  <svg width="1000" height="1000" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="vinylShine" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.1"/>
        <stop offset="40%" stop-color="#ffffff" stop-opacity="0.02"/>
        <stop offset="70%" stop-color="#000000" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
      </radialGradient>
      <linearGradient id="goldText" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff5c0"/>
        <stop offset="50%" stop-color="#d4af37"/>
        <stop offset="100%" stop-color="#aa7c11"/>
      </linearGradient>
      <linearGradient id="silverText" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#e0e0e0"/>
        <stop offset="100%" stop-color="#888888"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="2" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.8"/>
      </filter>
    </defs>

    <!-- Background Base -->
    <rect width="1000" height="1000" fill="${bgGradient[0]}" />
    <rect width="1000" height="1000" fill="url(#vinylShine)" />

    <!-- Vinyl Grooves Pattern -->
    <circle cx="500" cy="500" r="480" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="2"/>
    <circle cx="500" cy="500" r="440" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="3"/>
    <circle cx="500" cy="500" r="390" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="2"/>
    <circle cx="500" cy="500" r="340" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="2"/>
    <circle cx="500" cy="500" r="290" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="2"/>

    <!-- Outer Frame / Jacket Border -->
    <rect x="25" y="25" width="950" height="950" fill="none" stroke="${accentColor}" stroke-width="3" stroke-opacity="0.4"/>
    <rect x="35" y="35" width="930" height="930" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>

    <!-- Top Badge -->
    <g transform="translate(60, 80)">
      <text font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="20" fill="${accentColor}" letter-spacing="6">8 OF SPADES WORKS · AUTHENTIC ARCHIVE</text>
      <text y="28" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="14" fill="#a0a0a0" letter-spacing="3">${genre.toUpperCase().replace(/&/g, '&amp;')} · ${year}</text>
    </g>

    <!-- Center Artistic Emblem -->
    <g transform="translate(500, 460)" filter="url(#shadow)">
      <circle r="160" fill="${bgGradient[1]}" stroke="${accentColor}" stroke-width="4" stroke-opacity="0.8"/>
      <circle r="145" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <circle r="60" fill="#111111" stroke="${accentColor}" stroke-width="2"/>
      <circle r="15" fill="#000000" stroke="#ffffff" stroke-width="1"/>
      <text y="-80" font-family="'Times New Roman', serif" font-weight="bold" font-size="18" fill="${accentColor}" text-anchor="middle" letter-spacing="4">PLATINUM MASTER</text>
      <text y="95" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="14" fill="#dddddd" text-anchor="middle" letter-spacing="3">STUDIO HIGH FIDELITY</text>
    </g>

    <!-- Artist Name -->
    <text x="500" y="740" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="64" fill="url(#silverText)" text-anchor="middle" letter-spacing="5" filter="url(#shadow)">${artist.toUpperCase().replace(/&/g, '&amp;')}</text>

    <!-- Album Title -->
    <text x="500" y="810" font-family="'Times New Roman', serif" font-weight="bold" font-style="italic" font-size="44" fill="${accentColor}" text-anchor="middle" letter-spacing="3" filter="url(#shadow)">${album.replace(/&/g, '&amp;')}</text>

    <!-- Subtitle / Notes -->
    <text x="500" y="855" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="18" fill="#cccccc" text-anchor="middle" letter-spacing="4">${(subtitle || 'ORIGINAL STUDIO RECORDING').replace(/&/g, '&amp;')}</text>

    <!-- Parental Advisory Banner bottom right -->
    <g transform="translate(800, 890)">
      <rect width="135" height="48" fill="#ffffff" rx="3"/>
      <rect x="2" y="2" width="131" height="44" fill="#000000" rx="2"/>
      <text x="67" y="18" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="10" fill="#ffffff" text-anchor="middle" letter-spacing="1">PARENTAL</text>
      <text x="67" y="32" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="2">ADVISORY</text>
      <text x="67" y="42" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="7" fill="#ffffff" text-anchor="middle" letter-spacing="1">EXPLICIT CONTENT</text>
    </g>

    <!-- Record Label Emblem bottom left -->
    <g transform="translate(60, 910)">
      <text font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="13" fill="#888888" letter-spacing="2">8 OF SPADES WORKS VAULT</text>
      <text y="18" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#666666" letter-spacing="1">ALL RIGHTS RESERVED · STEREO</text>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svgOverlay))
    .jpeg({ quality: 95 })
    .toFile(targetPath);

  console.log(`Created: ${filename}`);
}

async function run() {
  const covers = [
    {
      filename: 'chris_brown_self_titled.jpg',
      artist: 'Chris Brown',
      album: 'Chris Brown',
      year: 2005,
      genre: 'R&B / Pop / Urban',
      bgGradient: ['#121824', '#1f2d44'],
      accentColor: '#38bdf8',
      subtitle: 'FEATURING RUN IT! & POPPIN',
    },
    {
      filename: 'brownstone_from_the_bottom_up.jpg',
      artist: 'Brownstone',
      album: 'From the Bottom Up',
      year: 1994,
      genre: '90s R&B / Soul Harmonies',
      bgGradient: ['#1f140e', '#3d2516'],
      accentColor: '#fbbf24',
      subtitle: 'FEATURING IF YOU LOVE ME & GRAPEVYNE',
    },
    {
      filename: 'janet_jackson_janet.jpg',
      artist: 'Janet Jackson',
      album: 'janet.',
      year: 1993,
      genre: 'Classic R&B / Neo-Soul',
      bgGradient: ['#1a1510', '#382a1d'],
      accentColor: '#eab308',
      subtitle: "FEATURING THAT'S THE WAY LOVE GOES & AGAIN",
    },
    {
      filename: 'janet_jackson_rhythm_nation.jpg',
      artist: 'Janet Jackson',
      album: 'Rhythm Nation 1814',
      year: 1989,
      genre: 'New Jack Swing / Funk / Dance',
      bgGradient: ['#0f0f12', '#222228'],
      accentColor: '#d4af37',
      subtitle: 'FEATURING RHYTHM NATION & MISS YOU MUCH',
    },
    {
      filename: 'janet_jackson_all_for_you.jpg',
      artist: 'Janet Jackson',
      album: 'All for You',
      year: 2001,
      genre: 'Dance-Pop / R&B Grooves',
      bgGradient: ['#23121d', '#441834'],
      accentColor: '#f472b6',
      subtitle: 'FEATURING ALL FOR YOU & SOMEONE TO CALL MY LOVER',
    },
    {
      filename: 'jermaine_dupri_instructions.jpg',
      artist: 'Jermaine Dupri',
      album: 'Instructions',
      year: 2001,
      genre: 'So So Def Hip Hop / R&B',
      bgGradient: ['#181818', '#2b2210'],
      accentColor: '#f59e0b',
      subtitle: 'FEATURING WELCOME TO ATLANTA',
    },
    {
      filename: 'avant_ecstasy.jpg',
      artist: 'Avant',
      album: 'Ecstasy',
      year: 2002,
      genre: 'Smooth R&B / Soul',
      bgGradient: ['#1a0f1e', '#3b1d44'],
      accentColor: '#c084fc',
      subtitle: "FEATURING MAKIN' GOOD LOVE & FLICKIN'",
    },
    {
      filename: 'ashanti_concrete_rose.jpg',
      artist: 'Ashanti',
      album: 'Concrete Rose',
      year: 2004,
      genre: 'R&B / Murder Inc',
      bgGradient: ['#211016', '#441d2a'],
      accentColor: '#fb7185',
      subtitle: 'FEATURING ONLY U',
    },
    {
      filename: '112_self_titled.jpg',
      artist: '112',
      album: '112',
      year: 1996,
      genre: 'Bad Boy R&B Classic',
      bgGradient: ['#0d141f', '#19283d'],
      accentColor: '#60a5fa',
      subtitle: 'FEATURING CUPID & ONLY YOU',
    },
  ];

  for (const c of covers) {
    await createCover(c);
  }

  // Also create direct copies for dead timestamped cover filenames in public/images/covers/
  const deadCoverMappings = [
    { source: '112_part_iii.jpg', dead: 'cover_1792551232760_.t_2_the_Remix.jpg' },
    { source: 'chris_brown_self_titled.jpg', dead: 'cover_1792551248521_.wn_-_Poppin_-.jpg' },
    { source: 'ashanti_ashanti.jpg', dead: 'cover_1792551217420_.nly_You_Remix.jpg' },
    { source: 'avant_my_thoughts.jpg', dead: 'cover_1792551224092_.ant_-_Destiny.jpg' },
    { source: 'avant_ecstasy.jpg', dead: 'cover_1792551229589_.ant_-_Flickin.jpg' },
    { source: 'jermaine_dupri_instructions.jpg', dead: 'cover_1792551209614_.ermaine_dupri.jpg' },
  ];

  for (const m of deadCoverMappings) {
    const srcFile = path.join(albumsDir, m.source);
    const destFile = path.join(coversDir, m.dead);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied dead cover fallback: ${m.dead}`);
    }
  }

  console.log('All album covers created successfully!');
}

run().catch(console.error);
