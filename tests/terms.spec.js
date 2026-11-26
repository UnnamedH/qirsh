/* Privacy & terms: reachable from Settings, the Frata Plus sheet and a #terms link, and sends nothing. */
import { test, expect, openApp } from './helpers.js';

const sheetTitle = (page) => page.locator('#sheet .sheet-head h2');

test('Settings → Privacy opens Privacy & terms, with a date and a way to get in touch', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('#v-settings [data-act=termsOpen]');
  await expect(sheetTitle(page)).toHaveText('Privacy & terms');
  const sheet = page.locator('#sheet .terms');
  await expect(sheet).toContainText('Last updated');
  await expect(sheet).toContainText('within 7 days');
  await expect(sheet).toContainText('one-off payment of $5');
  await expect(sheet).toContainText('provided as is');
  // Its only links are emails: reading the terms never leaves the app.
  const hrefs = await sheet.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h).toBe('mailto:support@frata.cc');
});

test('the Frata Plus sheet links to the terms and refunds', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('#plusSec [data-act=plusOpen]');
  await page.click('#sheet [data-act=termsOpen]');
  await expect(sheetTitle(page)).toHaveText('Privacy & terms');
});

test('frata.cc/#terms opens the terms straight away', async ({ page }) => {
  await openApp(page);
  await page.goto('/#terms');
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(sheetTitle(page)).toHaveText('Privacy & terms');
  await page.click('#sheet [data-act=close]');
  await expect(page.locator('#sheet')).toBeHidden();
});
