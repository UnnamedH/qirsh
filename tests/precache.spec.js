import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

/** Every file the app needs offline must be listed in sw.js. */
test('service worker precaches every app file', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  const listed = [...sw.match(/const APP = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.posix.join(dir, d.name);
      return d.isDirectory() ? walk(p) : [p];
    });
  const needed = ['index.html', 'manifest.webmanifest', ...walk('css'), ...walk('js'), ...walk('icons')];
  expect(
    needed.filter((f) => !listed.includes(f)),
    'missing from APP in sw.js',
  ).toEqual([]);
  expect(
    listed.filter((f) => f !== './' && !fs.existsSync(f)),
    'listed but not on disk',
  ).toEqual([]);
});
