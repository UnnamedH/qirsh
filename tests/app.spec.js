import { test, expect, openApp, appState } from './helpers.js';

test('opens with example data and the main sections', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.balance-total')).toBeVisible();
  await expect(page.locator('[data-act=clearSample]')).toBeVisible();
  for (const v of ['home', 'history', 'budgets', 'settings']) {
    await page.click(`.tabs [data-act=nav][data-v=${v}]`);
    await expect(page.locator(`#v-${v}`)).toBeVisible();
  }
});

test('an added expense is saved and survives a reload', async ({ page }) => {
  await openApp(page);
  await page.click('#fab');
  await page.click('#sheet [data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '7');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  const saved = await appState(page);
  expect(saved.tx.some((t) => t.amount === 7 && t.categoryId === 'coffee')).toBe(true);
});

test('built-in categories come with emojis', async ({ page }) => {
  await openApp(page);
  await page.click('#fab');
  await expect(page.locator('[data-act=fcat][data-v=coffee]')).toHaveText('☕ Coffee');
  await expect(page.locator('[data-act=fcat][data-v=transport]')).toHaveText('🚌 Transport');
});

test('Back up offers share, save and copy, and Restore offers a file or pasted text', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=nav][data-v=settings]');
  const shown = (acts) => Promise.all(acts.map((a) => page.locator(`[data-act=${a}]`).count()));
  // Only the two choices at first.
  expect(await shown(['exportShare', 'exportSave', 'exportCopy', 'importPick', 'importPaste'])).toEqual([
    0, 0, 0, 0, 0,
  ]);
  await page.click('[data-act=backupMode][data-v=out]');
  expect(await shown(['exportShare', 'exportSave', 'exportCopy', 'importPick', 'importPaste'])).toEqual([
    1, 1, 1, 0, 0,
  ]);
  await page.click('[data-act=backupMode][data-v=in]');
  expect(await shown(['exportShare', 'exportSave', 'exportCopy', 'importPick', 'importPaste'])).toEqual([
    0, 0, 0, 1, 1,
  ]);
  await page.click('[data-act=backupMode][data-v=in]');
  expect(await shown(['importPick', 'importPaste'])).toEqual([0, 0]);
});

test('categories show their move and delete buttons only while editing', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=nav][data-v=settings]');
  await page.click('[data-act=setPage][data-v=categories]');
  await expect(page.locator('[data-act=catMove]')).toHaveCount(0);
  await expect(page.locator('[data-act=delCat]')).toHaveCount(0);
  await page.click('[data-act=catEdit]');
  await expect(page.locator('[data-act=catEdit]')).toHaveText('Done');
  await expect(page.locator('[data-act=delCat][data-id=coffee]')).toBeVisible();
  await page.click('[data-act=catEdit]');
  await expect(page.locator('[data-act=delCat]')).toHaveCount(0);
});

test('service worker caches the app and it opens offline', async ({ page, context }) => {
  await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const app = names.find((n) => n.startsWith('qirsh-'));
    return (await (await caches.open(app)).keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain('/index.html');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.balance-total')).toBeVisible();
  await context.setOffline(false);
});

test.describe('on iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  const note = (page) => page.locator('#v-home .banner', { has: page.locator('[data-act=safariTipDone]') });

  test('asks to add Frata to the Home Screen before starting, and not again once dismissed', async ({
    page,
  }) => {
    await openApp(page);
    await expect(note(page)).toContainText('Add Frata to your Home Screen');
    await page.click('[data-act=safariTipDone]');
    await page.reload();
    await page.waitForFunction(() => window.__qirsh);
    await expect(note(page)).toHaveCount(0);
  });

  test('once there are entries, explains how to bring them to the Home Screen app', async ({ page }) => {
    await openApp(page);
    await page.click('[data-act=safariTipDone]'); // the "before you start" note, dismissed early
    await page.click('[data-act=clearSample]');
    await expect(note(page)).toHaveCount(0);
    await page.click('#fab');
    await page.click('[data-act=lcur][data-v=USD]');
    await page.fill('#f-pay0', '4');
    await page.click('[data-act=fcat][data-v=coffee]');
    await page.click('[data-act=fsave]');

    // Entries of their own now: the note comes back, with the way to keep them.
    await expect(note(page)).toContainText('Keep your entries safe');
    await note(page).locator('[data-act=backupNow]').click();
    await expect(page.locator('#backupSec')).toBeInViewport();
    await expect(page.locator('#backupSec [data-act=exportSave]')).toBeVisible();
    await page.click('.tabs [data-act=nav][data-v=home]');
    await page.click('[data-act=safariTipDone]');
    await page.reload();
    await page.waitForFunction(() => window.__qirsh);
    await expect(note(page)).toHaveCount(0);
  });
});

test('the Home Screen note is not shown on Android', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('[data-act=safariTipDone]')).toHaveCount(0);
});

test('Accounts and Categories have their own pages in Settings, and the tab bar leads back', async ({
  page,
}) => {
  await openApp(page);
  await page.click('[data-act=nav][data-v=settings]');
  // Settings itself has a row for each, with a summary, and not the lists.
  await expect(page.locator('[data-act=setPage][data-v=accounts]')).toContainText('Wallet, Savings, Whish');
  await expect(page.locator('[data-act=setPage][data-v=categories]')).toContainText('12 spending · 4 income');
  await expect(page.locator('#accountsSec')).toHaveCount(0);
  await expect(page.locator('[data-cat]')).toHaveCount(0);

  await page.click('[data-act=setPage][data-v=accounts]');
  await expect(page.locator('#accountsSec')).toBeVisible();
  await expect(page.locator('#rate')).toHaveCount(0);
  await page.click('#v-settings .back-link');
  await expect(page.locator('#rate')).toBeVisible();

  await page.click('[data-act=setPage][data-v=categories]');
  await expect(page.locator('[data-cat=coffee]')).toBeVisible();
  // Leaving through the tab bar and coming back shows Settings itself.
  await page.click('[data-act=nav][data-v=home]');
  await page.click('[data-act=nav][data-v=settings]');
  await expect(page.locator('#rate')).toBeVisible();
  await expect(page.locator('[data-cat]')).toHaveCount(0);
});
