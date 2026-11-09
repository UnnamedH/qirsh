import { test, expect } from './helpers.js';

/* Each test gets its own copy of the app under /t/<id>/ so the test server's slow and release
   settings (see tests/server.mjs) only apply to it. */
const base = () => `t/${test.info().testId}/`;
const control = (page, query) => page.request.get(base() + '__ctl?' + query);
const cacheNames = (page) => page.evaluate(() => caches.keys());

/** Opens the app and waits until the service worker has stored it and controls the page. */
async function installApp(page) {
  await page.addInitScript(() => localStorage.setItem('qirsh.seenVersion', '9999'));
  await page.goto(base());
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.__qirsh);
}

const checkForUpdate = (page) =>
  page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));

test('opens instantly on a very slow connection', async ({ page }) => {
  await installApp(page);
  await control(page, 'delay=8000');
  const started = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.balance-total')).toBeVisible({ timeout: 3000 });
  expect(Date.now() - started).toBeLessThan(3000);
});

test('opens with no connection at all, in a fresh tab', async ({ page, context }) => {
  await installApp(page);
  await context.setOffline(true);
  const tab = await context.newPage();
  await tab.goto(base());
  await expect(tab.locator('.balance-total')).toBeVisible();
  await expect(tab.locator('[data-act=clearSample]')).toBeVisible();
});

test('a new release downloads in the background and offers a reload', async ({ page }) => {
  await installApp(page);
  const before = await cacheNames(page);
  await page.click('#fab');
  await page.click('#sheet [data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '6');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');

  await control(page, 'release=next1');
  await checkForUpdate(page);
  await expect(page.locator('#alerts')).toContainText('A new version of Qirsh is ready');
  await page.click('[data-act=reloadApp]');
  await page.waitForFunction(() => window.__qirsh);

  expect(await cacheNames(page)).toEqual(['qirsh-next1']);
  expect(before).not.toContain('qirsh-next1');
  const kept = await page.evaluate(() => window.__qirsh.state.tx.some((t) => t.amount === 6));
  expect(kept, 'data survives the update').toBe(true);
  await expect(page.locator('#alerts')).toBeHidden();
});

test('a release that fails to download leaves the working version in place', async ({ page, context }) => {
  await installApp(page);
  const before = await cacheNames(page);
  await control(page, 'release=next2&fail=js/money.js');
  await checkForUpdate(page).catch(() => {});
  // The failed download is cleaned up and the old version stays, with no update offered.
  await expect.poll(() => cacheNames(page), { timeout: 10000 }).toEqual(before);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !r.installing)))
    .toBe(true);
  await expect(page.locator('#alerts')).toBeHidden();

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.balance-total')).toBeVisible();
});
