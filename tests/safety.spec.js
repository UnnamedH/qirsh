import { test, expect, openApp, appState } from './helpers.js';

const alerts = (page) => page.locator('#alerts');

test('unreadable saved data is kept, not overwritten by example data', async ({ page }) => {
  const broken = '{"tx": [{"type":"expense", "amount": 5'; // cut off mid-write
  await openApp(page, { storage: { 'qirsh.v1': broken } });

  await expect(alerts(page)).toContainText('couldn’t be read');
  await expect(page.locator('[data-act=clearSample]'), 'no example data').toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('qirsh.v1.unreadable'))).toBe(broken);

  // Adding an entry saves fresh data but leaves the copy alone
  await page.click('#fab');
  await page.fill('#f-pay0', '3');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');
  expect(await page.evaluate(() => localStorage.getItem('qirsh.v1.unreadable'))).toBe(broken);

  // Settings offers to download or discard it
  await alerts(page).locator('[data-act=nav][data-v=settings]').click();
  const download = page.waitForEvent('download');
  await page.click('[data-act=exportRescued]');
  expect((await download).suggestedFilename()).toMatch(/^qirsh-unreadable-\d{4}-\d\d-\d\d\.txt$/);
  await page.click('[data-act=discardRescued]');
  await page.click('[data-act=discardRescued]');
  expect(await page.evaluate(() => localStorage.getItem('qirsh.v1.unreadable'))).toBeNull();
  await page.click('.tabs [data-act=nav][data-v=home]');
  await expect(alerts(page)).toBeHidden();
});

test('a failed save shows a warning until saving works again', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__blockSaves = true;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'qirsh.v1' && window.__blockSaves) throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, k, v);
    };
  });
  await page.click('#fab');
  await page.fill('#f-pay0', '4');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');
  await expect(alerts(page)).toContainText('wasn’t saved');

  await page.evaluate(() => (window.__blockSaves = false));
  await page.click('[data-act=toggleDisplay]');
  await expect(alerts(page)).toBeHidden();
});

test('two open copies of the app keep each other’s changes', async ({ context }) => {
  const a = await context.newPage();
  await openApp(a);
  await a.click('[data-act=clearSample]');
  const b = await context.newPage();
  await b.goto('/');
  await b.waitForFunction(() => window.__qirsh);

  const add = async (page, amount) => {
    await page.click('#fab');
    await page.fill('#f-pay0', String(amount));
    await page.click('[data-act=fcat][data-v=coffee]');
    await page.click('[data-act=fsave]');
  };
  await add(a, 11);
  await expect.poll(() => b.evaluate(() => window.__qirsh.state.tx.length)).toBe(1);
  await add(b, 22);
  await expect.poll(() => a.evaluate(() => window.__qirsh.state.tx.length)).toBe(2);

  await a.reload();
  await a.waitForFunction(() => window.__qirsh);
  const amounts = (await appState(a)).tx.map((t) => t.amount).sort((x, y) => x - y);
  expect(amounts).toEqual([11, 22]);
});

test('changing the rate does not reopen an entry paid back in the other currency', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.click('#fab');
  await page.fill('#f-pay0', '100');
  await page.click('[data-act=fadv]');
  await page.fill('#f-who', 'Scouts');
  await page.click('[data-act=fsave]');

  // Paid back in full in LL at the default 89,500
  await page.click('#v-home [data-act=newRepay]');
  await page.click('#sheet [data-act=lcur][data-v=LBP]');
  await page.fill('#f-pay0', '8950');
  await page.click('[data-act=rsave]');
  const owedShown = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#v-home h2')].some((h) => h.textContent === 'Owed to you'),
    );
  expect(await owedShown()).toBe(false);

  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.fill('#rate', '90000');
  await page.locator('#rate').dispatchEvent('change');
  await page.click('.tabs [data-act=nav][data-v=home]');
  expect(await owedShown(), 'still settled after the rate change').toBe(false);
});

test('entries saved before rates were stored get the saved rate on load', async ({ page }) => {
  const old = JSON.stringify({
    rate: 89500,
    tx: [
      { id: 'a', type: 'advance', amount: 100, currency: 'USD', who: 'X', date: '2026-11-01', createdAt: 1 },
      {
        id: 'r',
        type: 'repay',
        advanceId: 'a',
        amount: 8950000,
        currency: 'LBP',
        date: '2026-11-02',
        createdAt: 2,
      },
    ],
  });
  await openApp(page, { storage: { 'qirsh.v1': old } });
  const tx = (await appState(page)).tx;
  expect(tx.map((t) => t.rate)).toEqual([89500, 89500]);
});

test('a category name is shown as text in the delete prompt', async ({ page }) => {
  const evil = '<img src=x onerror="window.__xss=1">';
  await openApp(page);
  await page.evaluate((name) => {
    const s = window.__qirsh.state;
    s.categories.find((c) => c.id === 'other').name = name;
  }, evil);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=delCat][data-id=coffee]');
  await expect(page.locator('#v-settings')).toContainText(evil);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('a malformed backup imports without breaking the app', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=importPaste]');
  await page.fill(
    '#importTxt',
    JSON.stringify({
      rate: 'lots',
      settings: { accent: 123, theme: 'neon', display: 'EUR', weekStart: 'x' },
      categories: [null, { id: 'food', name: 'Food', type: 'expense', icon: 7 }],
      budgets: [{ id: 'b', amount: -5, period: 'year', currency: 'USD' }],
      tx: [
        { id: 'ok', type: 'expense', amount: 5, currency: 'USD', categoryId: 'food', date: '2026-11-01' },
        { id: 'bad', type: 'expense', amount: 5, currency: 'EUR', date: '2026-11-01' },
        null,
      ],
    }),
  );
  await page.click('[data-act=importLoad]');
  await page.click('[data-act=importConfirm]');
  const s = await appState(page);
  expect(s.settings).toEqual({
    display: 'USD',
    weekStart: 1,
    accent: null,
    theme: 'system',
    entryStyle: 'paid',
    hide: false,
  });
  expect(s.rate).toBe(89500);
  expect(s.tx.map((t) => t.id)).toEqual(['ok']);
  expect(s.budgets).toEqual([]);
  expect(s.categories.find((c) => c.id === 'food')).toEqual({ id: 'food', name: 'Food', type: 'expense' });

  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(page.locator('.balance-total')).toBeVisible();
});

test('History search uses the same filter as the list it starts from', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    const today = new Date().toISOString().slice(0, 10);
    const base = { currency: 'USD', date: today, account: 'wallet', createdAt: Date.now() };
    s.tx.push({ ...base, id: 'o', type: 'expense', amount: 9, categoryId: 'food', note: 'Lunch' });
    s.tx.push({ ...base, id: 'i', type: 'income', amount: 20, categoryId: 'gift-in', note: 'Lunch money' });
    s.tx.push({ ...base, id: 'x', type: 'expense', amount: 2, categoryId: 'coffee', note: 'Espresso' });
  });
  await page.click('.tabs [data-act=nav][data-v=history]');
  const rows = () => page.locator('#histList .row .row-title').allInnerTexts();

  await page.click('[data-act=hfilter][data-v=expense]');
  await page.fill('#hq', 'lunch');
  await expect.poll(rows).toEqual(['Lunch']);

  await page.click('[data-act=hfilter][data-v=income]');
  await expect.poll(rows).toEqual(['Lunch money']);
  await page.fill('#hq', 'lun');
  await expect.poll(rows, 'typing keeps the In filter').toEqual(['Lunch money']);
});
