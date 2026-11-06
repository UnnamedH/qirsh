/* Writes the current fingerprint of the app's files into sw.js as BUILD. Run with `npm run stamp`. */
import fs from 'node:fs';
import { buildId, currentBuild, readSw } from './build-id.mjs';

const sw = readSw();
const next = buildId(sw);
if (currentBuild(sw) === next) {
  console.log('sw.js is up to date: BUILD', next);
} else {
  fs.writeFileSync('sw.js', sw.replace(/const BUILD = '[^']*';/, `const BUILD = '${next}';`));
  console.log('sw.js BUILD set to', next);
}
