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

test('backup offers share, save and copy', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=nav][data-v=settings]');
  for (const act of ['exportShare', 'exportSave', 'exportCopy', 'importPick', 'importPaste']) {
    await expect(page.locator(`[data-act=${act}]`)).toBeVisible();
  }
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

  test('shows the Add to Home Screen tip until dismissed', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('[data-act=hideInstallHint]')).toHaveCount(1);
    await page.click('[data-act=hideInstallHint]');
    await page.reload();
    await page.waitForFunction(() => window.__qirsh);
    await expect(page.locator('[data-act=hideInstallHint]')).toHaveCount(0);
  });
});

test('the install tip is not shown on Android', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('[data-act=hideInstallHint]')).toHaveCount(0);
});
