import { test as base, expect } from '@playwright/test';

/** Fails any test in which the page throws an uncaught error. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(page);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});
export { expect };

/**
 * Opens the app. By default the "What's new" sheet is suppressed so it does not cover the page.
 * `storage` seeds localStorage once, before the first load.
 */
export async function openApp(page, { storage = {}, showNews = false } = {}) {
  const seed = showNews ? storage : { 'qirsh.seenVersion': '9999', ...storage };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/');
  await page.waitForFunction(() => window.__qirsh);
}

export const appState = (page) => page.evaluate(() => window.__qirsh.state);

/** The currency button that is pressed in the open sheet's first amount line. */
export const sheetCurrency = (page) =>
  page.locator('#sheet [data-act=lcur][aria-pressed=true]').first().getAttribute('data-v');

export const closeSheet = (page) => page.click('#sheet .sheet-head [data-act=close]');
