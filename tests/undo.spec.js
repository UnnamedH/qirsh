import { test, expect, openApp, appState } from './helpers.js';

const undo = (page) => page.click('#toast [data-act=undo]');

test('Start fresh removes only the examples, keeping entries added on top of them', async ({ page }) => {
  await openApp(page);
  const before = (await appState(page)).tx.length;
  await page.click('#fab');
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '7');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');
  await page.click('[data-act=clearSample]');
  await expect(page.locator('#toast')).toContainText('Your 1 entry was kept');

  const s = await appState(page);
  expect(s.sample).toBe(false);
  expect(s.tx.map((t) => t.amount)).toEqual([7]);
  expect(s.budgets).toEqual([]);
  expect(s.opening.wallet).toEqual({ USD: 0, LBP: 0 });

  await undo(page);
  expect((await appState(page)).tx.length).toBe(before + 1);
});

test('a big change to the exchange rate asks first, and any change can be undone', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  const rate = page.locator('#rate');

  // 895 instead of 89,500: not applied until confirmed.
  await rate.fill('895');
  await rate.blur();
  await expect(page.locator('[data-act=rateConfirm]')).toHaveText('Use 895 LL');
  expect((await appState(page)).rate).toBe(89500);
  await page.click('[data-act=rateCancel]');
  await expect(page.locator('[data-act=rateConfirm]')).toHaveCount(0);
  await expect(page.locator('#rate')).toHaveValue('89,500');
  expect((await appState(page)).rate).toBe(89500);

  // Confirming applies it, and Undo puts the old rate back.
  await page.locator('#rate').fill('895');
  await page.locator('#rate').blur();
  await page.click('[data-act=rateConfirm]');
  expect((await appState(page)).rate).toBe(895);
  await undo(page);
  expect((await appState(page)).rate).toBe(89500);

  // A normal change goes straight through.
  await page.locator('#rate').fill('90,000');
  await page.locator('#rate').blur();
  expect((await appState(page)).rate).toBe(90000);
});

test('importing a backup and clearing all data can both be undone', async ({ page }) => {
  await openApp(page);
  const before = (await appState(page)).tx.length;
  await page.click('.tabs [data-act=nav][data-v=settings]');

  await page.click('[data-act=importPaste]');
  await page.fill('#importTxt', JSON.stringify({ tx: [] }));
  await page.click('[data-act=importLoad]');
  await page.click('[data-act=importConfirm]');
  expect((await appState(page)).tx.length).toBe(0);
  await undo(page);
  expect((await appState(page)).tx.length).toBe(before);

  await page.click('[data-act=wipe]');
  await page.click('[data-act=wipe]');
  expect((await appState(page)).tx.length).toBe(0);
  await undo(page);
  expect((await appState(page)).tx.length).toBe(before);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  expect((await appState(page)).tx.length).toBe(before);
});
