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
    // Each preset colour's icons (icons/<colour>/) are only read when the app is installed, which
    // needs a connection anyway, so phones don't store them.
    ...walk('icons').filter((f) => f.split('/').length === 2),
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

/** frata.cc publishes only what .assetsignore lets back in, so every app file must be on that list. */
test('every app file is published to frata.cc', () => {
  const allowed = fs
    .readFileSync('.assetsignore', 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('!/'))
    .map((l) => l.slice(2));
  const published = (f) => allowed.some((a) => (a.endsWith('/') ? f.startsWith(a) : f === a));
  const files = ['sw.js', ...appFiles().filter((f) => f !== './')];
  expect(
    files.filter((f) => !published(f)),
    'missing from .assetsignore',
  ).toEqual([]);
});

/** The home-screen icons for each preset colour exist, and frata.cc publishes them. */
test('every preset colour has its manifest and icons, published to frata.cc', () => {
  const sets = fs
    .readdirSync('.')
    .filter((f) => /^manifest-[a-z]+\.webmanifest$/.test(f))
    .map((f) => f.slice(9, -12));
  expect(sets.sort()).toEqual(['amber', 'blue', 'graphite', 'rose', 'teal', 'violet']);
  const base = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  const ignore = fs.readFileSync('.assetsignore', 'utf8');
  expect(ignore).toContain('!/manifest-*.webmanifest');
  for (const set of sets) {
    const m = JSON.parse(fs.readFileSync(`manifest-${set}.webmanifest`, 'utf8'));
    // The same app, only with this colour's icons (`npm run icons` writes these).
    expect({ ...m, icons: [] }).toEqual({ ...base, icons: [] });
    expect(m.icons.map((i) => i.src)).toEqual(
      base.icons.map((i) => i.src.replace('icons/', `icons/${set}/`)),
    );
    for (const i of m.icons) expect(fs.existsSync(i.src), i.src).toBe(true);
    expect(fs.existsSync(`icons/${set}/apple-touch-icon.png`)).toBe(true);
  }
});

/* ---------- the scouts app (scouts/sw.js) ---------- */

const SCOUTS_SW = 'scouts/sw.js';

/** Every file the scouts page loads by import, found by following the imports from its entry point. */
function importedFrom(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const src = fs.readFileSync(entry, 'utf8');
  const found = [
    ...src.matchAll(/^import\s+['"]([^'"]+)['"]/gm),
    ...src.matchAll(/^(?:import|export)\b[^;'"]*?\bfrom\s+['"]([^'"]+)['"]/gm),
  ];
  for (const m of found) {
    if (m[1].startsWith('.')) importedFrom(path.posix.join(path.posix.dirname(entry), m[1]), seen);
  }
  return seen;
}

test('the scouts service worker precaches everything the scouts app loads', () => {
  const sw = fs.readFileSync(SCOUTS_SW, 'utf8');
  const listed = appFiles(sw, SCOUTS_SW);
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.posix.join(dir, d.name);
      return d.isDirectory() ? walk(p) : [p];
    });
  const needed = [
    'scouts/index.html',
    'scouts/manifest.webmanifest',
    ...walk('scouts/css'),
    ...walk('scouts/js'),
    ...importedFrom('scouts/js/main.js'),
    'css/styles.css',
    ...walk('fonts').filter((f) => f.endsWith('.woff2')),
  ];
  expect(
    [...new Set(needed)].filter((f) => !listed.includes(f)),
    'missing from APP in scouts/sw.js',
  ).toEqual([]);
  expect(
    listed.filter((f) => f !== './' && !fs.existsSync(f)),
    'listed but not on disk',
  ).toEqual([]);
});

test('scouts/sw.js BUILD matches the scouts files (run `npm run stamp` if this fails)', () => {
  const sw = fs.readFileSync(SCOUTS_SW, 'utf8');
  expect(currentBuild(sw)).toBe(buildId(sw, SCOUTS_SW));
});

test('the scouts app and its shared files are published', () => {
  const allowed = fs
    .readFileSync('.assetsignore', 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('!/'))
    .map((l) => l.slice(2));
  const published = (f) => allowed.some((a) => (a.endsWith('/') ? f.startsWith(a) : f === a));
  const files = [SCOUTS_SW, ...appFiles(fs.readFileSync(SCOUTS_SW, 'utf8'), SCOUTS_SW)].filter(
    (f) => f !== './',
  );
  expect(
    files.filter((f) => !published(f)),
    'missing from .assetsignore',
  ).toEqual([]);
});

test('the scouts manifest points at icons that exist', () => {
  const m = JSON.parse(fs.readFileSync('scouts/manifest.webmanifest', 'utf8'));
  for (const i of m.icons) expect(fs.existsSync(path.posix.join('scouts', i.src)), i.src).toBe(true);
});
