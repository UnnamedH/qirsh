import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

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
 * Opens the app. By default the "What's new" sheet and the one-time feedback tip are suppressed so
 * they don't cover the page or fill the alerts. `storage` seeds localStorage once, before the first load.
 */
export async function openApp(page, { storage = {}, showNews = false, showTips = false } = {}) {
  const quiet = {
    ...(showNews ? {} : { 'qirsh.seenVersion': '9999' }),
    ...(showTips ? {} : { 'qirsh.feedbackTip': 'seen' }),
  };
  const seed = { ...quiet, ...storage };
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

/* Frata Plus codes signed with the test key, which the test server puts in js/config.js. */
const TEST_KEY = JSON.parse(
  fs.readFileSync(new URL('./fixtures/plus-test-key.json', import.meta.url), 'utf8'),
);

/** A genuine unlock code for `name`, or one signed with `privateKey` instead. */
export async function plusCode(name = 'Test buyer', privateKey = TEST_KEY.private) {
  const { subtle } = webcrypto;
  const key = await subtle.importKey('jwk', privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
  const payload = Buffer.from(JSON.stringify({ n: name, d: '2026-11-25' })).toString('base64url');
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload));
  return 'FRATA1-' + payload + '.' + Buffer.from(sig).toString('base64url');
}

/** Unlocks Frata Plus through Settings, like a buyer would, and comes back to Home. */
export async function unlockPlus(page, name) {
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('#plusSec [data-act=plusOpen]');
  await page.fill('#plus-code', await plusCode(name));
  await page.click('#sheet [data-act=plusUnlock]');
  await expect(page.locator('#sheet .plus-ok')).toBeVisible();
  await page.click('#sheet .sheet-head [data-act=close]');
  await page.click('.tabs [data-act=nav][data-v=home]');
}
