import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { appFiles, buildId, currentBuild } from '../scripts/build-id.mjs';

/** Every file the app needs offline must be listed in sw.js. */
test('service worker precaches every app file', () => {
  const listed = appFiles();
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.posix.join(dir, d.name);
      return d.isDirectory() ? walk(p) : [p];
    });
  const needed = [
    'index.html',
    'manifest.webmanifest',
    ...walk('css'),
    ...walk('js'),
    ...walk('icons'),
    ...walk('fonts').filter((f) => f.endsWith('.woff2')),
  ];
  expect(
    needed.filter((f) => !listed.includes(f)),
    'missing from APP in sw.js',
  ).toEqual([]);
  expect(
    listed.filter((f) => f !== './' && !fs.existsSync(f)),
    'listed but not on disk',
  ).toEqual([]);
});

/** Phones only download a new version when BUILD changes, so it must match the files. */
test('sw.js BUILD matches the app files (run `npm run stamp` if this fails)', () => {
  expect(currentBuild()).toBe(buildId());
});
