/* Writes the current fingerprint of each app's files into its sw.js as BUILD. Run with `npm run stamp`. */
import fs from 'node:fs';
import { SW_FILES, buildId, currentBuild, readSw } from './build-id.mjs';

for (const swPath of SW_FILES) {
  if (!fs.existsSync(swPath)) continue;
  const sw = readSw(swPath);
  const next = buildId(sw, swPath);
  if (currentBuild(sw) === next) {
    console.log(swPath + ' is up to date: BUILD', next);
  } else {
    fs.writeFileSync(swPath, sw.replace(/const BUILD = '[^']*';/, `const BUILD = '${next}';`));
    console.log(swPath + ' BUILD set to', next);
  }
}
