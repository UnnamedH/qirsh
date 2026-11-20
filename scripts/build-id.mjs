/* The fingerprint of an app's files that its sw.js uses as BUILD. Shared by stamp-sw.mjs and the tests.
   Frata's service worker is sw.js; the scouts app has its own at scouts/sw.js, whose file paths are
   relative to its own folder (so it can list the shared files in ../js and ../css). */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const SW_FILES = ['sw.js', 'scouts/sw.js'];

export const readSw = (swPath = 'sw.js') => fs.readFileSync(swPath, 'utf8');

/** The paths in the APP list of a sw.js, as written in it. */
export const listedFiles = (sw = readSw()) =>
  [...sw.match(/const APP = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** The same paths relative to the repo root, so they can be read from disk. './' stands for the page. */
export const appFiles = (sw = readSw(), swPath = 'sw.js') =>
  listedFiles(sw).map((f) => (f === './' ? f : path.posix.join(path.posix.dirname(swPath), f)));

/** First 12 hex characters of a SHA-256 over every listed file's path and contents. */
export function buildId(sw = readSw(), swPath = 'sw.js') {
  const hash = crypto.createHash('sha256');
  for (const f of appFiles(sw, swPath)
    .filter((f) => f !== './')
    .sort()) {
    hash.update(f + '\0');
    hash.update(fs.readFileSync(f));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

export const currentBuild = (sw = readSw()) => sw.match(/const BUILD = '([^']*)';/)[1];
