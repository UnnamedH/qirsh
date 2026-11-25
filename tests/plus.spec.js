/* Frata Plus: the paid features stay closed until a genuine code is typed, and stay open after that. */
import { webcrypto } from 'node:crypto';
import { test, expect, openApp, appState, plusCode, unlockPlus } from './helpers.js';

const toHistory = (page) => page.click('.tabs [data-act=nav][data-v=history]');
const toSettings = (page) => page.click('.tabs [data-act=nav][data-v=settings]');

async function tryCode(page, code) {
  await toSettings(page);
  await page.click('#plusSec [data-act=plusOpen]');
  await page.fill('#plus-code', code);
  await page.click('#sheet [data-act=plusUnlock]');
}

test('while locked, By category shows what Plus adds instead of the chart', async ({ page }) => {
  await openApp(page);
  await toHistory(page);
  await page.click('[data-act=hmode][data-v=chart]');
  await expect(page.locator('.plus-teaser')).toBeVisible();
  await expect(page.locator('.pie')).toHaveCount(0);
  await page.click('.plus-teaser [data-act=plusOpen]');
  await expect(page.locator('#sheet h2')).toHaveText('Frata Plus');
  await expect(page.locator('#plus-code')).toBeVisible();
});

test('while locked, a budget covers one category: picking another replaces it', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.click('.tabs [data-act=nav][data-v=budgets]');
  await page.click('#v-budgets [data-act=newBudget]');
  await expect(page.locator('#sheet [data-act=plusOpen]')).toBeVisible();
  await page.click('#sheet [data-act=bcat][data-v=food]');
  await page.click('#sheet [data-act=bcat][data-v=coffee]');
  const picked = page.locator('#sheet [data-act=bcat][aria-pressed=true]');
  await expect(picked).toHaveCount(1);
  await expect(picked).toHaveAttribute('data-v', 'coffee');
});

test('codes that are mistyped, tampered with or signed by anyone else are refused', async ({ page }) => {
  await openApp(page);
  const good = await plusCode('Rita');
  // Someone else's key, a changed name, a cut-off code and plain nonsense.
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const forged = await plusCode('Rita', await webcrypto.subtle.exportKey('jwk', pair.privateKey));
  const [payload, sig] = good.slice('FRATA1-'.length).split('.');
  const renamed =
    'FRATA1-' + Buffer.from(JSON.stringify({ n: 'Sam', d: '2026-11-25' })).toString('base64url') + '.' + sig;
  for (const code of [forged, renamed, good.slice(0, -4), 'FRATA1-' + payload, 'hello']) {
    await tryCode(page, code);
    await expect(page.locator('#plus-err')).toContainText('doesn’t work');
    await page.click('#sheet .sheet-head [data-act=close]');
  }
  await tryCode(page, '');
  await expect(page.locator('#plus-err')).toContainText('Paste the code');
  expect((await appState(page)).unlock).toBeUndefined();
});

test('a genuine code unlocks Plus, says who for, and survives a reload and starting over', async ({
  page,
}) => {
  await openApp(page);
  // Pasted from a chat, with a line break in the middle.
  const code = await plusCode('Rita K.');
  await tryCode(page, code.slice(0, 30) + '\n ' + code.slice(30));
  await expect(page.locator('#sheet .plus-ok')).toContainText('Unlocked for Rita K.');
  expect((await appState(page)).unlock).toEqual({ code });
  await page.click('#sheet .sheet-head [data-act=close]');
  await expect(page.locator('#plusSec')).toContainText('Unlocked for Rita K.');

  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await toHistory(page);
  await page.click('[data-act=hmode][data-v=chart]');
  await expect(page.locator('.pie')).toBeVisible();

  await toSettings(page);
  await page.click('[data-act=wipe]');
  await page.click('[data-act=wipe]');
  expect((await appState(page)).unlock).toEqual({ code });
  await expect(page.locator('#plusSec')).toContainText('Unlocked for Rita K.');
});

test('with Plus, a budget can pick several categories again', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await unlockPlus(page);
  await page.click('.tabs [data-act=nav][data-v=budgets]');
  await page.click('#v-budgets [data-act=newBudget]');
  await expect(page.locator('#sheet [data-act=plusOpen]')).toHaveCount(0);
  await page.click('#sheet [data-act=bcat][data-v=food]');
  await page.click('#sheet [data-act=bcat][data-v=coffee]');
  await expect(page.locator('#sheet [data-act=bcat][aria-pressed=true]')).toHaveCount(2);
});

test('a saved code that isn’t genuine, or isn’t a code at all, leaves Plus locked', async ({ page }) => {
  const data = (unlock) => JSON.stringify({ tx: [], unlock });
  await openApp(page, { storage: { 'qirsh.v1': data({ code: 'FRATA1-abc.def' }) } });
  expect((await appState(page)).unlock).toEqual({ code: 'FRATA1-abc.def' });
  await toSettings(page);
  await expect(page.locator('#plusSec [data-act=plusOpen]')).toBeVisible();
  const kept = await page.evaluate(() => [
    window.__qirsh.normalize({ tx: [], unlock: 'x' }).unlock,
    window.__qirsh.normalize({ tx: [], unlock: { code: 5 } }).unlock,
    window.__qirsh.normalize({ tx: [], unlock: { code: 'x'.repeat(5000) } }).unlock,
  ]);
  expect(kept).toEqual([undefined, undefined, undefined]);
});
