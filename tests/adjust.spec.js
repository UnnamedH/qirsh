import fs from 'node:fs';
import { test, expect, openApp, appState } from './helpers.js';

/** Starts empty on a fixed day, with $100 and 500,000 LL in the wallet and a $200 monthly cap. */
async function setUp(page) {
  await page.clock.install({ time: new Date('2026-11-20T12:00:00') });
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    s.opening.wallet = { USD: 100, LBP: 500000 };
    s.opening.savings = { USD: 300, LBP: 0 };
    s.budgets.push({ id: 'B', categoryId: null, period: 'month', amount: 200, currency: 'USD' });
  });
  await page.click('.tabs [data-act=nav][data-v=settings]');
}

/** Balances of every account, and what the overall budget has counted as spent. */
const money = (page) =>
  page.evaluate(() => {
    const q = window.__qirsh;
    return {
      wallet: q.balances().wallet,
      savings: q.balances().savings,
      spent: Math.round(q.budgetStatus(q.state.budgets[0]).spent * 100) / 100,
    };
  });

async function correct(page, account) {
  await page.click('.tabs [data-act=nav][data-v=home]');
  await page.click(`[data-act=accView][data-id=${account}]`);
  await page.click('#v-history .acct-head [data-act=newAdjust]');
}

test('“Just fix the balance” sets the balance without counting it as spending', async ({ page }) => {
  await setUp(page);
  await correct(page, 'wallet');
  await expect(page.locator('#a-USD')).toHaveValue('100');
  await expect(page.locator('#a-LBP'), 'LL shown in thousands').toHaveValue('500');
  await page.click('[data-act=acount][data-v="0"]');
  await page.fill('#a-USD', '88');
  await page.fill('#a-LBP', '650k');
  await expect(page.locator('#a-preview')).toHaveText('Wallet: −$12  +150,000 LL · balance only');
  await page.click('[data-act=asave]');

  expect(await money(page)).toMatchObject({ wallet: { USD: 88, LBP: 650000 }, spent: 0 });
  const tx = (await appState(page)).tx;
  expect(tx.map((t) => [t.type, t.currency, t.amount, t.target, t.account])).toEqual([
    ['adjust', 'USD', -12, 88, 'wallet'],
    ['adjust', 'LBP', 150000, 650000, 'wallet'],
  ]);

  // Saved, and listed under Moves in History.
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  expect((await money(page)).wallet).toEqual({ USD: 88, LBP: 650000 });
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.click('[data-act=hfilter][data-v=transfer]');
  await expect(page.locator('#histList .row')).toHaveCount(2);
  await expect(page.locator('#histList .row').first()).toContainText('Balance correction');

  // Deleting one puts that part of the balance back.
  await page.locator('#histList .row', { hasText: '$12' }).click();
  await expect(page.locator('#sheet h2')).toHaveText('Balance correction');
  await page.click('[data-act=adel]');
  await page.click('[data-act=adel]');
  expect((await money(page)).wallet).toEqual({ USD: 100, LBP: 650000 });
});

test('“Count it” adds missing money as an expense and extra money as income', async ({ page }) => {
  await setUp(page);
  await correct(page, 'wallet');
  await page.fill('#a-USD', '88');
  await expect(page.locator('#a-exp')).toBeVisible();
  await expect(page.locator('#a-inc')).toBeHidden();
  await page.click('[data-act=aexp][data-v=groceries]');
  await page.fill('#a-LBP', '600');
  await expect(page.locator('#a-inc')).toBeVisible();
  await expect(page.locator('#a-preview')).toHaveText(
    'Wallet: −$12  +100,000 LL · expense in Groceries, income in Other income',
  );
  await page.click('[data-act=asave]');

  expect(await money(page)).toMatchObject({ wallet: { USD: 88, LBP: 600000 }, spent: 12 });
  const tx = (await appState(page)).tx;
  expect(tx.map((t) => [t.type, t.categoryId, t.currency, t.amount, t.correction, t.account])).toEqual([
    ['expense', 'groceries', 'USD', 12, true, 'wallet'],
    ['income', 'other-in', 'LBP', 100000, true, 'wallet'],
  ]);

  // Undo removes both.
  await page.click('#toast [data-act=undo]');
  expect(await money(page)).toMatchObject({ wallet: { USD: 100, LBP: 500000 }, spent: 0 });
  expect((await appState(page)).tx).toEqual([]);
});

test('a counted correction stays in its account when edited', async ({ page }) => {
  await setUp(page);
  await correct(page, 'savings');
  await page.fill('#a-USD', '250');
  await page.click('[data-act=asave]');
  expect(await money(page)).toMatchObject({ savings: { USD: 250, LBP: 0 }, spent: 50 });
  expect((await money(page)).wallet).toEqual({ USD: 100, LBP: 500000 });

  await page.click('.tabs [data-act=nav][data-v=history]');
  await expect(page.locator('#histList .row')).toContainText('Balance correction · Savings');
  await page.click('#histList .row');
  await expect(page.locator('#sheet')).toContainText('A balance correction for Savings.');
  await page.fill('#f-pay0', '40');
  await page.click('[data-act=fsave]');
  const t = (await appState(page)).tx[0];
  expect(t).toMatchObject({ type: 'expense', amount: 40, account: 'savings', correction: true });
  expect((await money(page)).savings).toEqual({ USD: 260, LBP: 0 });
});

test('the account can be switched, and an unchanged balance is not saved', async ({ page }) => {
  await setUp(page);
  await correct(page, 'wallet');
  await page.selectOption('#a-acct', 'savings');
  await expect(page.locator('#a-USD')).toHaveValue('300');
  await expect(page.locator('#a-preview')).toHaveText('This matches what Frata has. Nothing to correct.');
  await page.click('[data-act=asave]');
  await expect(page.locator('#a-err')).toHaveText('This already matches what Frata has.');
  await page.fill('#a-USD', 'lots');
  await page.click('[data-act=asave]');
  await expect(page.locator('#a-err')).toHaveText('Enter amounts as numbers.');
  expect((await appState(page)).tx).toEqual([]);
});

test('starting balances are hidden until asked for', async ({ page }) => {
  await setUp(page);
  await expect(page.locator('[data-open]')).toHaveCount(0);
  await page.click('[data-act=toggleOpening]');
  await expect(page.locator('[data-open]')).toHaveCount(6);
  await page.fill('[data-open=wallet][data-cur=USD]', '120');
  await page.locator('[data-open=wallet][data-cur=USD]').blur();
  expect((await money(page)).wallet.USD).toBe(120);
  // Still open after the change re-draws Settings.
  await expect(page.locator('[data-open]')).toHaveCount(6);
  await page.click('[data-act=toggleOpening]');
  await expect(page.locator('[data-open]')).toHaveCount(0);
});

test('corrections stay out of Quick add, and old or imported ones are repaired', async ({ page }) => {
  await setUp(page);
  await correct(page, 'wallet');
  await page.fill('#a-USD', '90');
  await page.click('[data-act=asave]');
  await correct(page, 'wallet');
  await page.click('[data-act=acount][data-v="0"]');
  await page.fill('#a-USD', '80');
  await page.click('[data-act=asave]');
  const out = await page.evaluate(() => {
    const q = window.__qirsh;
    const fixed = q.normalize({
      tx: [
        { type: 'adjust', amount: '-5', currency: 'USD', date: '2026-11-01', account: 'bogus', target: '7' },
        {
          type: 'adjust',
          amount: 3,
          currency: 'LBP',
          date: '2026-11-01',
          account: 'whish',
          correction: 'yes',
        },
      ],
    }).tx;
    return { recent: q.templates().recent.length, fixed };
  });
  expect(out.recent).toBe(0);
  expect(out.fixed[0]).toMatchObject({ amount: -5, account: 'wallet', target: 7 });
  expect(out.fixed[1]).toMatchObject({ account: 'whish', correction: true });
  expect(out.fixed[1]).not.toHaveProperty('target');
});

test('the CSV labels corrections', async ({ page }) => {
  await setUp(page);
  await correct(page, 'wallet');
  await page.fill('#a-USD', '90');
  await page.click('[data-act=asave]');
  await correct(page, 'wallet');
  await page.click('[data-act=acount][data-v="0"]');
  await page.fill('#a-USD', '95');
  await page.click('[data-act=asave]');
  await page.click('.tabs [data-act=nav][data-v=history]');
  const wait = page.waitForEvent('download');
  await page.click('[data-act=reportCsv]');
  const d = await wait;
  const path = test.info().outputPath(d.suggestedFilename());
  await d.saveAs(path);
  const lines = fs.readFileSync(path, 'utf8').slice(1).trim().split('\r\n');
  expect(lines[1]).toMatch(/^2026-11-20,Expense \(correction\),Other,,10,USD,/);
  expect(lines[2]).toMatch(/^2026-11-20,Balance correction,Balance correction,,5,USD,.*,5,Wallet$/);
});
