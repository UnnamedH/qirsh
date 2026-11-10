import { test, expect, openApp, appState } from './helpers.js';

const tip = (page) => page.locator('#v-home .banner.tip');
const tipSeen = (page) => page.evaluate(() => localStorage.getItem('qirsh.tipPriceFirst'));
/** Someone's own (empty) data, with the default entry style. The tip is not shown over example data. */
const ownData = { storage: { 'qirsh.v1': JSON.stringify({ tx: [] }) } };

test('Home shows the price-first tip once; dismissing it hides it for good', async ({ page }) => {
  await openApp(page, ownData);
  await expect(tip(page)).toContainText('works out your change');
  await page.click('[data-act=tipClose]');
  await expect(tip(page)).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(tip(page)).toHaveCount(0);
  expect((await appState(page)).settings.entryStyle, 'still the default').toBe('paid');
});

test('"Show me" plays the short demo, and "Use price first" turns it on', async ({ page }) => {
  await openApp(page, ownData);
  await page.click('[data-act=tipShow]');
  const steps = page.locator('#sheet .demo-step');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText('385,000 LL');
  await expect(steps.nth(1)).toContainText('$10');
  await expect(steps.nth(2)).toContainText('510,000 LL back');
  await expect(steps.nth(2)).toHaveCSS('opacity', '1', { timeout: 4000 });

  await page.click('[data-act=tipUse]');
  expect((await appState(page)).settings.entryStyle).toBe('price');
  await expect(page.locator('#toast')).toContainText('Price first is on');
  await expect(tip(page)).toHaveCount(0);
  await page.click('#fab');
  await expect(page.locator('[data-act=paidAdd]')).toHaveCount(1);
});

test('closing the demo by tapping outside also counts as seen', async ({ page }) => {
  await openApp(page, ownData);
  await page.click('[data-act=tipShow]');
  await page.mouse.click(195, 30);
  await expect(page.locator('#sheet')).toBeHidden();
  expect(await tipSeen(page)).toBe('done');
  await expect(tip(page)).toHaveCount(0);
  expect((await appState(page)).settings.entryStyle).toBe('paid');
});

test('people already using price first never see the tip', async ({ page }) => {
  await openApp(page, {
    storage: { 'qirsh.v1': JSON.stringify({ tx: [], settings: { entryStyle: 'price' } }) },
  });
  await expect(tip(page)).toHaveCount(0);
});

test('the tip waits until the example data is cleared', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('[data-act=clearSample]')).toBeVisible();
  await expect(tip(page)).toHaveCount(0);
  await page.click('[data-act=clearSample]');
  await expect(tip(page)).toHaveCount(1);
});
