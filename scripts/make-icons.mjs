/* Makes the app's PNG icons from scripts/icon.svg. Run with `npm run icons` after changing the icon. */
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const svg = fs.readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
// Home-screen icons keep the rounded corners. iOS and Android's maskable icons are cut to shape by the
// phone, so those fill the whole square; the f and the coin sit well inside Android's safe zone.
const square = svg.replace(/ rx="28"/, '');
const ICONS = [
  ['icons/favicon.png', 64, svg],
  ['icons/icon-192.png', 192, svg],
  ['icons/icon-512.png', 512, svg],
  ['icons/apple-touch-icon.png', 180, square],
  ['icons/icon-maskable-512.png', 512, square],
];

// Locally, use the Edge that ships with Windows, like the tests; elsewhere Playwright's Chromium.
const browser = await chromium
  .launch(process.env.CI ? {} : { channel: 'msedge' })
  .catch(() => chromium.launch());
const page = await browser.newPage();
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
