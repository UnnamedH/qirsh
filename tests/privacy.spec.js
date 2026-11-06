import { test, expect, openApp } from './helpers.js';

/** Uses most of the app: every tab, the entry and budget sheets, What's new and the monthly report. */
async function useTheApp(page) {
  for (const v of ['home', 'history', 'budgets', 'settings'])
    await page.click(`.tabs [data-act=nav][data-v=${v}]`);
  await page.click('#fab');
  await page.fill('#f-pay0', '3');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');
  await page.click('.tabs [data-act=nav][data-v=budgets]');
  await page.click('#v-budgets [data-act=newBudget]');
  await page.click('#sheet .sheet-head [data-act=close]');
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=showNews]');
  await page.click('#sheet .sheet-actions [data-act=close]');
  await page.click('.tabs [data-act=nav][data-v=history]');
  const download = page.waitForEvent('download');
  await page.click('[data-act=reportXlsx]');
  await download;
}

test('the app never contacts any other website', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const elsewhere = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['http:', 'https:'].includes(u.protocol)) return; // blob: and data: never leave the phone
    if (u.origin !== origin) elsewhere.push(r.url());
  });
  await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await useTheApp(page);
  expect(elsewhere).toEqual([]);
});

test('the fonts come from the app itself', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
  );
  expect(new Set(loaded)).toEqual(new Set(['Geist', 'Geist Mono']));
});
