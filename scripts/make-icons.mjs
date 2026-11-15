/* Makes the app's PNG icons from scripts/icon.svg, plus a set and a manifest for each preset accent colour.
   Run with `npm run icons` after changing the icon, the preset colours or manifest.webmanifest. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const svg = fs.readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
// Home-screen icons keep the rounded corners. iOS and Android's maskable icons are cut to shape by the
// phone, so those fill the whole square; the f and the coin sit well inside Android's safe zone.
const square = (s) => s.replace(/ rx="28"/, '');
const iconsIn = (dir, src) => [
  [dir + 'icon-192.png', 192, src],
  [dir + 'icon-512.png', 512, src],
  [dir + 'apple-touch-icon.png', 180, square(src)],
  [dir + 'icon-maskable-512.png', 512, square(src)],
];
const ICONS = [['icons/favicon.png', 64, svg], ...iconsIn('icons/', svg)];

// Locally, use the Edge that ships with Windows, like the tests; in a cloud session the pre-installed
// Chromium (PW_CHROMIUM_PATH); elsewhere Playwright's own.
const browser = await chromium
  .launch(
    process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : process.env.CI
        ? {}
        : { channel: 'msedge' },
  )
  .catch(() => chromium.launch());
const page = await browser.newPage();

// Each preset's icon is the same drawing on that colour's background, worked out by the app itself
// (iconColour in js/theme.js) so it matches the tab icon. The app is served from disk to read it.
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webmanifest': 'application/json',
};
await page.route('http://frata.local/**', (route) => {
  const file = path.join('.', new URL(route.request().url()).pathname);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
  return route.fulfill({ path: file, contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
});
await page.goto('http://frata.local/index.html');
const presets = await page.evaluate(async () => {
  const t = await import('/js/theme.js');
  return t.ACCENTS.map(([hex]) => [t.iconSet(hex), t.iconColour(hex)]).filter(([set]) => set);
});

const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
for (const [set, colour] of presets) {
  const dir = 'icons/' + set + '/';
  fs.mkdirSync(dir, { recursive: true });
  ICONS.push(...iconsIn(dir, svg.replace(/(<rect id="bg"[^>]*fill=")[^"]*/, '$1' + colour)));
  // The same app (same id and start), only with this colour's icons.
  const m = { ...manifest, icons: manifest.icons.map((i) => ({ ...i, src: i.src.replace('icons/', dir) })) };
  fs.writeFileSync('manifest-' + set + '.webmanifest', JSON.stringify(m, null, 2) + '\n');
  console.log('Wrote', 'manifest-' + set + '.webmanifest', colour);
}

for (const [file, size, src] of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    '<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>' +
      src,
  );
  await page.locator('svg').screenshot({ path: file, omitBackground: true });
  console.log('Wrote', file, size + 'px');
}
await browser.close();
