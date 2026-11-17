/* The bottom of the screen on phones with a home bar or gesture bar, following Chrome's edge-to-edge
   guide: bottom-pinned things are sized with the largest inset and moved with the live one. Chromium
   can pretend to have those insets (Emulation.setSafeAreaInsetsOverride), so each case is a real phone
   situation. */
import fs from 'node:fs';
import { test, expect, openApp } from './helpers.js';

const CASES = [
  { name: 'no home bar (desktop, button navigation)', inset: 0, max: 0 },
  { name: 'iPhone home bar', inset: 34, max: 34 },
  { name: 'Android gesture bar, Chrome bottom strip showing', inset: 0, max: 24 },
  { name: 'Android gesture bar, Chrome bottom strip hidden', inset: 24, max: 24 },
];

async function setInsets(page, inset, max) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom: inset, bottomMax: max } });
  // Let the new insets reach the layout.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const box = (page, sel) =>
  page
    .locator(sel)
    .first()
    .evaluate((e) => e.getBoundingClientRect().toJSON());

for (const c of CASES) {
  test(`bottom of the screen: ${c.name}`, async ({ page }) => {
    await openApp(page);
    await setInsets(page, c.inset, c.max);
    const h = await page.evaluate(() => innerHeight);
    // The page itself no longer reserves the home bar (the tab bar covers it).
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).paddingBottom)).toBe('0px');

    // The tab bar's buttons sit right above the home bar; its background runs to the screen edge.
    const tabs = await box(page, '.tabs'),
      row = await box(page, '.tabs .wrap');
    expect(Math.abs(row.bottom - (h - c.inset)), 'buttons just above the home bar').toBeLessThanOrEqual(0.5);
    expect(tabs.bottom, 'background reaches the screen edge').toBeGreaterThanOrEqual(h - 0.5);

    // The + button keeps the same distance from the tab bar as before.
    const fab = await box(page, '#fab');
    expect(Math.abs(fab.bottom - (h - c.inset - 76))).toBeLessThanOrEqual(0.5);

    // The end of a long page can be scrolled clear of the tab bar.
    await page.click('.tabs [data-act=nav][data-v=settings]');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const last = await page
      .locator('#v-settings > :last-child')
      .evaluate((e) => e.getBoundingClientRect().bottom);
    expect(last, 'last line not hidden behind the tab bar').toBeLessThanOrEqual(row.top);

    // A sheet: its last button clears the home bar by 20px, and its background reaches the edge.
    await page.click('#fab');
    // Measured once the sheet has finished sliding up.
    await page.locator('#sheet').evaluate((s) => Promise.all(s.getAnimations().map((a) => a.finished)));
    await page.locator('#sheet').evaluate((s) => (s.scrollTop = s.scrollHeight));
    const sheet = await box(page, '#sheet'),
      save = await box(page, '#sheet [data-act=fsave]');
    expect(sheet.bottom, 'sheet reaches the screen edge').toBeGreaterThanOrEqual(h - 0.5);
    expect(save.bottom, 'last button clear of the home bar').toBeLessThanOrEqual(h - c.inset - 20 + 0.5);
    expect(sheet.top, 'sheet still fits the screen').toBeGreaterThanOrEqual(0);
  });
}

test('when Chrome’s bottom strip hides, the tab bar only moves up; its size stays the same', async ({
  page,
}) => {
  await openApp(page);
  await setInsets(page, 0, 24);
  const before = await box(page, '.tabs');
  await setInsets(page, 24, 24);
  const after = await box(page, '.tabs');
  // Moving is Chrome's fast path; a new size would mean laying the page out again on every frame.
  expect(after.height).toBe(before.height);
  expect(after.top).toBeCloseTo(before.top - 24, 1);
});

test('nothing is sized with the live bottom inset, as Chrome’s edge-to-edge guide asks', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const uses = [...css.matchAll(/([\w-]+)\s*:[^;{}]*env\(safe-area-inset-bottom/g)].map((m) => m[1]);
  // Only positions may use it, written as calc(env(safe-area-inset-bottom, …) ± …) for Chrome's fast path.
  expect(uses.filter((p) => p !== 'bottom')).toEqual([]);
  for (const m of css.matchAll(/bottom:\s*([^;]*env\(safe-area-inset-bottom[^;]*);/g))
    expect(m[1]).toMatch(/^calc\(env\(safe-area-inset-bottom, 0px\) [+-] /);
});
