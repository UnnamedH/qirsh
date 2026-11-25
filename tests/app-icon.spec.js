/* The home-screen icon follows the preset accent colours; custom colours keep the original green. */
import fs from 'node:fs';
import { test, expect, openApp } from './helpers.js';

const links = (page) =>
  page.evaluate(() => ({
    manifest: document.querySelector('link[rel=manifest]').getAttribute('href'),
    touch: document.querySelector('link[rel=apple-touch-icon]').getAttribute('href'),
  }));

test('choosing a preset colour points the install links at that colour’s icons', async ({ page }) => {
  await openApp(page);
  expect(await links(page)).toEqual({
    manifest: 'manifest.webmanifest',
    touch: 'icons/apple-touch-icon.png',
  });

  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=setAccent][aria-label=Amber]');
  expect(await links(page)).toEqual({
    manifest: 'manifest-amber.webmanifest',
    touch: 'icons/amber/apple-touch-icon.png',
  });
  // The files are really there, and the manifest names the same app with amber icons.
  const m = await (await page.request.get('manifest-amber.webmanifest')).json();
  expect(m.id).toBe('./');
  expect(m.icons[0].src).toBe('icons/amber/icon-192.png');
  expect((await page.request.get(m.icons[0].src)).ok()).toBe(true);

  // It's kept after a reload, before anything is installed.
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  expect((await links(page)).manifest).toBe('manifest-amber.webmanifest');
});

test('a custom colour, or the default green, uses the original icons', async ({ page }) => {
  await openApp(page);
  const sets = await page.evaluate(async () => {
    const { iconSet } = await import('/js/theme.js');
    return [iconSet(null), iconSet('#1D6A50'), iconSet('#b85410'), iconSet('#123456')];
  });
  expect(sets).toEqual([null, null, 'amber', null]);
});

test('each preset’s icon is drawn in the same colour as its tab icon', async ({ page }) => {
  await openApp(page);
  const out = await page.evaluate(async () => {
    const { ACCENTS, iconColour, iconSet } = await import('/js/theme.js');
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true });
    const pixel = (fill) => {
      x.clearRect(0, 0, 1, 1);
      x.fillStyle = fill;
      x.fillRect(0, 0, 1, 1);
      return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const sample = async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      x.clearRect(0, 0, 1, 1);
      // A point of plain background, clear of the f, the coin and the rounded corners.
      x.drawImage(img, 96, 20, 1, 1, 0, 0, 1, 1);
      return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const res = [];
    for (const [hex] of ACCENTS) {
      const set = iconSet(hex);
      if (set) res.push([set, await sample(`icons/${set}/icon-192.png`), pixel(iconColour(hex))]);
    }
    return res;
  });
  expect(out).toHaveLength(6);
  for (const [set, got, want] of out)
    for (let i = 0; i < 3; i++) expect(Math.abs(got[i] - want[i]), set).toBeLessThanOrEqual(2);
});

test('no manifest sets theme_color, so Android colours the installed app’s gesture bar to match the phone', () => {
  const files = fs.readdirSync('.').filter((f) => /^manifest(-[a-z]+)?\.webmanifest$/.test(f));
  expect(files).toHaveLength(7);
  for (const f of files) {
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    expect(m, f).not.toHaveProperty('theme_color');
    // The launch colour stays; only the bar's colour is left to Android.
    expect(m.background_color, f).toMatch(/^#[0-9A-Fa-f]{6}$/);
  }
});
