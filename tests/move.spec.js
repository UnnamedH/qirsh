/* Moving data to Frata with a link from the old address. */
import { test, expect, openApp, appState } from './helpers.js';

const entry = (id, amount, note = '') => ({
  id,
  type: 'expense',
  amount,
  currency: 'USD',
  categoryId: 'coffee',
  account: 'wallet',
  date: '2026-11-01',
  createdAt: 1,
  note,
});

const mine = {
  rate: 90000,
  tx: [entry('a1', 4, 'Flat white'), entry('a2', 6, '<b>not bold</b>')],
  budgets: [{ id: 'b1', categoryId: 'coffee', amount: 50, currency: 'USD', period: 'month' }],
};

/** Builds a move link in the app for `data`, pointing at this test server instead of frata.cc. */
async function linkFor(page, data) {
  await openApp(page);
  return page.evaluate((d) => window.__qirsh.moveLink(d, location.origin + '/'), data);
}

const banner = (page) => page.locator('#alerts .banner:has([data-act^=move])');

test('a move link brings the data across after asking', async ({ page }) => {
  const link = await linkFor(page, mine);
  expect(link).toContain('/#move=z.');

  // Start over with nothing saved, as on the new address: the example data shows.
  await page.evaluate(() => localStorage.clear());
  // A different path makes this a full page load, as when arriving from the old address.
  await page.goto(link.replace('/#', '/index.html#'));
  await page.waitForFunction(() => window.__qirsh);

  await expect(banner(page)).toContainText('2 entries and 1 budget. It replaces the example data.');
  expect(new URL(page.url()).hash).toBe('');
  expect((await appState(page)).sample).toBe(true);

  await page.click('[data-act=moveConfirm]');
  await expect(page.locator('#toast')).toContainText('Your data is here: 2 entries');
  const s = await appState(page);
  expect(s.sample).toBe(false);
  expect(s.rate).toBe(90000);
  expect(s.tx.map((t) => t.note)).toEqual(['Flat white', '<b>not bold</b>']);
  expect(s.budgets).toHaveLength(1);
  await expect(banner(page)).toHaveCount(0);

  // It was saved, and reloading doesn't bring the banner back.
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  expect((await appState(page)).tx).toHaveLength(2);
  await expect(banner(page)).toHaveCount(0);
});

test('Undo puts back what was there before the move', async ({ page }) => {
  const link = await linkFor(page, mine);
  await page.goto(link);
  await page.waitForFunction(() => window.__qirsh);
  await page.click('[data-act=moveConfirm]');
  await page.click('#toast [data-act=undo]');
  expect((await appState(page)).sample).toBe(true);
});

test('a move asks before replacing data already here, and "Not now" keeps it', async ({ page }) => {
  const here = JSON.stringify({ tx: [entry('h1', 1), entry('h2', 2), entry('h3', 3)], budgets: [] });
  await openApp(page, { storage: { 'qirsh.v1': here } });
  const link = await page.evaluate((d) => window.__qirsh.moveLink(d, location.origin + '/'), mine);
  await page.goto(link);
  await page.waitForFunction(() => window.__qirsh);

  await expect(banner(page)).toContainText('It replaces the 3 entries already here.');
  await page.click('[data-act=moveCancel]');
  await expect(banner(page)).toHaveCount(0);
  expect((await appState(page)).tx.map((t) => t.id)).toEqual(['h1', 'h2', 'h3']);
});

test('a link that cannot be read changes nothing', async ({ page }) => {
  await openApp(page);
  for (const bad of ['z.not-gzip', 't.bm90IGpzb24', 'x.abc', 't.' + 'e30']) {
    await page.goto('/#move=' + bad);
    await page.waitForFunction(() => window.__qirsh);
    await expect(banner(page)).toContainText('couldn’t be read, so nothing was changed');
    expect((await appState(page)).sample).toBe(true);
    await page.click('[data-act=moveCancel]');
    await expect(banner(page)).toHaveCount(0);
  }
});

test('a link without compression still works', async ({ page }) => {
  await openApp(page);
  const payload = await page.evaluate((d) => {
    const b = new TextEncoder().encode(JSON.stringify(d));
    return btoa(String.fromCharCode(...b))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }, mine);
  await page.goto('/#move=t.' + payload);
  await page.waitForFunction(() => window.__qirsh);
  await page.click('[data-act=moveConfirm]');
  expect((await appState(page)).tx).toHaveLength(2);
});

test('data too big for a link is refused, so a backup file is used instead', async ({ page }) => {
  await openApp(page);
  const link = await page.evaluate(() => {
    // Random notes barely compress, so this stays far over the limit after gzip.
    const rnd = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(150))));
    const tx = Array.from({ length: 20000 }, (_, i) => ({
      id: 'r' + i,
      type: 'expense',
      amount: 1,
      currency: 'USD',
      date: '2026-11-01',
      note: rnd(),
    }));
    return window.__qirsh.moveLink({ tx, budgets: [] });
  });
  expect(link).toBeNull();
});
