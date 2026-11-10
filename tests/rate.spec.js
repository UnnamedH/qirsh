import { test, expect, openApp, appState } from './helpers.js';

/* Every entry keeps the rate of the day it was saved, so changing the app's rate doesn't change past months. */

const NOW = new Date('2026-11-20T12:00:00');

/** Starts empty on a fixed day, showing totals in `display`. */
async function setUp(page, display = 'USD') {
  await page.clock.install({ time: NOW });
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate((d) => (window.__qirsh.state.settings.display = d), display);
}

const addLL = async (page, thousands, cat = 'food') => {
  await page.click('#fab');
  await page.click('#sheet [data-act=lcur][data-v=LBP]');
  await page.fill('#f-pay0', thousands);
  await page.click(`[data-act=fcat][data-v=${cat}]`);
  await page.click('[data-act=fsave]');
};

const setRate = async (page, rate) => {
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.locator('#rate').fill(rate.toLocaleString('en-US'));
  await page.locator('#rate').blur();
  const confirm = page.locator('[data-act=rateConfirm]');
  if (await confirm.count()) await confirm.click();
};

test('a new entry keeps the rate of its day, and a rate change leaves its value alone', async ({ page }) => {
  await setUp(page);
  await addLL(page, '895');
  expect((await appState(page)).tx[0]).toMatchObject({ amount: 895000, currency: 'LBP', rate: 89500 });

  const spentUSD = () =>
    page.evaluate(() => {
      const q = window.__qirsh;
      return Math.round(q.sumIn(q.range('month'), 'expense', null, 'USD') * 100) / 100;
    });
  expect(await spentUSD()).toBe(10);
  await setRate(page, 100000);
  expect(await spentUSD()).toBe(10);
  await page.click('.tabs [data-act=nav][data-v=home]');
  await expect(page.locator('#v-home .stats')).toContainText('$10');

  // Added after the change, at the new rate.
  await addLL(page, '500');
  expect((await appState(page)).tx[1].rate).toBe(100000);
  expect(await spentUSD()).toBe(15);
});

test('totals shown in LL stay exact for LL spending', async ({ page }) => {
  await setUp(page, 'LBP');
  await addLL(page, '385');
  await setRate(page, 95000);
  await page.click('.tabs [data-act=nav][data-v=history]');
  await expect(page.locator('#v-history .stats')).toContainText('385,000 LL');
});

test('an LL budget counts LL spending exactly, whatever the rate', async ({ page }) => {
  await setUp(page);
  await page.evaluate(() =>
    window.__qirsh.state.budgets.push({
      id: 'x',
      categoryId: 'food',
      period: 'month',
      amount: 2000000,
      currency: 'LBP',
    }),
  );
  await addLL(page, '600');
  const spent = () => page.evaluate(() => window.__qirsh.budgetStatus(window.__qirsh.state.budgets[0]).spent);
  expect(await spent()).toBe(600000);
  await setRate(page, 120000);
  expect(await spent()).toBe(600000);
  await page.click('.tabs [data-act=nav][data-v=budgets]');
  await expect(page.locator('#v-budgets .budget')).toContainText('600,000 LL');
  await expect(page.locator('#v-budgets .budget')).toContainText('1,400,000 LL left');
});

test('editing an entry keeps the rate it was saved with', async ({ page }) => {
  await setUp(page);
  await addLL(page, '895');
  await setRate(page, 100000);
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.click('#histList .row');
  await page.fill('#f-note', 'Lunch');
  await page.click('[data-act=fsave]');
  expect((await appState(page)).tx[0]).toMatchObject({ note: 'Lunch', rate: 89500 });
});

test('older entries without a rate get the saved rate once, and keep it', async ({ page }) => {
  await page.clock.install({ time: NOW });
  const old = {
    rate: 90000,
    tx: [
      { id: 'o1', type: 'expense', amount: 900000, currency: 'LBP', categoryId: 'food', date: '2026-11-02' },
      { id: 'o2', type: 'income', amount: 100, currency: 'USD', categoryId: 'salary', date: '2026-11-01' },
      {
        id: 'o3',
        type: 'transfer',
        amount: 50,
        currency: 'USD',
        from: 'wallet',
        to: 'savings',
        date: '2026-11-03',
      },
    ],
  };
  await openApp(page, { storage: { 'qirsh.v1': JSON.stringify(old) } });
  const tx = (await appState(page)).tx;
  expect(tx.map((t) => t.rate)).toEqual([90000, 90000, undefined]);

  await setRate(page, 100000);
  const spent = await page.evaluate(() =>
    window.__qirsh.sumIn(window.__qirsh.range('month'), 'expense', null, 'USD'),
  );
  expect(spent).toBe(10);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  expect((await appState(page)).tx[0].rate).toBe(90000);
});

test('Quick add repeats an entry at today’s rate', async ({ page }) => {
  await setUp(page);
  await addLL(page, '895', 'coffee');
  await setRate(page, 100000);
  await page.click('.tabs [data-act=nav][data-v=home]');
  await page.click('[data-act=quickTab][data-v=recent]');
  await page.click('[data-act=repeat]');
  expect((await appState(page)).tx.map((t) => t.rate)).toEqual([89500, 100000]);
});
