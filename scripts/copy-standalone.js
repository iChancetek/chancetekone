import fs from 'fs';
import path from 'path';

const standaloneDir = path.join(process.cwd(), '.next', 'standalone');

if (fs.existsSync(standaloneDir)) {
  const publicSrc = path.join(process.cwd(), 'public');
  const publicDest = path.join(standaloneDir, 'public');
  const staticSrc = path.join(process.cwd(), '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');

  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
    console.log('[build] Successfully copied public/ to .next/standalone/public/');
  }

  if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
    console.log('[build] Successfully copied .next/static/ to .next/standalone/.next/static/');
  }
}
