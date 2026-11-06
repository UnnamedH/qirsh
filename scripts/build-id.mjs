/* The fingerprint of the app's files that sw.js uses as its BUILD. Shared by stamp-sw.mjs and the tests. */
import crypto from 'node:crypto';
import fs from 'node:fs';

export const readSw = () => fs.readFileSync('sw.js', 'utf8');

/** The paths in the APP list of sw.js. */
export const appFiles = (sw = readSw()) =>
  [...sw.match(/const APP = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** First 12 hex characters of a SHA-256 over every listed file's path and contents. */
export function buildId(sw = readSw()) {
  const hash = crypto.createHash('sha256');
  for (const f of appFiles(sw)
    .filter((f) => f !== './')
    .sort()) {
    hash.update(f + '\0');
    hash.update(fs.readFileSync(f));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

export const currentBuild = (sw = readSw()) => sw.match(/const BUILD = '([^']*)';/)[1];
