/* The banner on the old address that sends people and their data to frata.cc. */
import { test, expect, openApp, appState } from './helpers.js';

const banner = (page) => page.locator('#alerts .banner:has([data-act=moveLater])');

/** Opens the app as if on the old GitHub Pages address, with frata.cc answered by a stub page. */
async function openOld(page) {
  await page.addInitScript(() => (window.__frataOldAddress = true));
  await page.route('https://frata.cc/**', (r) => r.fulfill({ contentType: 'text/html', body: 'frata' }));
  await openApp(page);
}

test('the new address shows no move banner', async ({ page }) => {
  await openApp(page);
  await expect(banner(page)).toHaveCount(0);
});

test('the old address moves the data to frata.cc in a link', async ({ page }) => {
  await openOld(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    s.tx.push({
      id: 'x1',
      type: 'expense',
      amount: 4,
      currency: 'USD',
      categoryId: 'coffee',
      account: 'wallet',
      date: '2026-11-01',
      createdAt: 1,
      rate: 89500,
    });
  });
  await expect(banner(page)).toContainText('Frata has a new home: frata.cc.');
  await page.click('[data-act=moveGo]');
  await page.waitForURL(/^https:\/\/frata\.cc\/#move=/);
});

test('with only example data it just opens frata.cc', async ({ page }) => {
  await openOld(page);
  await expect(banner(page)).toContainText('Open it there from now on.');
  await page.click('[data-act=moveGo]');
  await page.waitForURL('https://frata.cc/');
});

test('Later hides the banner until tomorrow', async ({ page }) => {
  await openOld(page);
  await page.click('[data-act=moveLater]');
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(banner(page)).toHaveCount(0);
  expect((await appState(page)).sample).toBe(true);
});
