/* Budgets that cover any number of categories: picking them, counting them, and keeping them tidy. */
import { test, expect, openApp, appState, unlockPlus } from './helpers.js';

const toBudgets = (page) => page.click('.tabs [data-act=nav][data-v=budgets]');

async function newBudget(page, cats, amount) {
  await page.click('#v-budgets [data-act=newBudget]');
  for (const c of cats) await page.click(`#sheet [data-act=bcat][data-v=${c}]`);
  await page.click('#sheet [data-act=bcur][data-v=USD]');
  await page.fill('#b-amount', String(amount));
  await page.click('#sheet [data-act=bsave]');
}

test('a budget can cover several categories, and counts the spending in all of them', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    const day = new Date().toISOString().slice(0, 10);
    const e = (id, amount, categoryId) => ({
      id,
      type: 'expense',
      date: day,
      createdAt: Date.now(),
      amount,
      currency: 'USD',
      categoryId,
      account: 'wallet',
      rate: s.rate,
    });
    s.tx.push(e('e1', 10, 'food'), e('e2', 4, 'coffee'), e('e3', 7, 'transport'));
  });
  await unlockPlus(page);
  await toBudgets(page);
  await newBudget(page, ['food', 'coffee'], 50);

  const b = (await appState(page)).budgets.at(-1);
  expect(b.categoryIds).toEqual(['food', 'coffee']);
  expect(b.categoryId).toBeUndefined();
  const row = page.locator('#v-budgets .budget', { hasText: 'Food and Coffee' });
  await expect(row).toContainText('$14');
  expect(await page.evaluate((x) => window.__qirsh.budgetStatus(x).spent, b)).toBe(14);
});

test('All spending clears the picked categories, and the same set can’t be budgeted twice', async ({
  page,
}) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await unlockPlus(page);
  await toBudgets(page);
  await page.click('#v-budgets [data-act=newBudget]');
  const all = page.locator('#sheet [data-act=bcatAll]');
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await page.click('#sheet [data-act=bcat][data-v=food]');
  await expect(all).toHaveAttribute('aria-pressed', 'false');
  await page.fill('#b-amount', '40');
  await page.click('#sheet [data-act=bcatAll]');
  await expect(page.locator('#sheet [data-act=bcat][aria-pressed=true]')).toHaveCount(0);
  await expect(page.locator('#b-amount'), 'the typed limit is kept').toHaveValue('40');
  await page.click('#sheet [data-act=close]');

  await newBudget(page, ['coffee', 'food'], 30);
  await newBudget(page, ['food', 'coffee'], 30);
  await expect(page.locator('#b-err')).toContainText('already exists');
});

test('deleting a category takes it out of budgets, and drops a budget left with none', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    s.budgets.push(
      { id: 'two', categoryIds: ['food', 'coffee'], period: 'month', amount: 50, currency: 'USD' },
      { id: 'one', categoryIds: ['coffee'], period: 'week', amount: 10, currency: 'USD' },
    );
  });
  await page.click('.tabs [data-act=nav][data-v=settings]');
  const del = page.locator('[data-act=delCat][data-id=coffee]');
  await del.click();
  await del.click();
  const budgets = (await appState(page)).budgets;
  expect(budgets.map((b) => [b.id, b.categoryIds])).toEqual([['two', ['food']]]);
});

test('budgets saved with one category, or none, load as lists', async ({ page }) => {
  const old = JSON.stringify({
    tx: [],
    budgets: [
      { id: 'a', categoryId: 'food', period: 'month', amount: 20, currency: 'USD' },
      { id: 'b', categoryId: null, period: 'month', amount: 600, currency: 'USD' },
      { id: 'c', categoryIds: ['food', 'food', 7, ''], period: 'week', amount: 5, currency: 'USD' },
    ],
  });
  await openApp(page, { storage: { 'qirsh.v1': old } });
  const b = (await appState(page)).budgets;
  expect(b.map((x) => [x.id, x.categoryIds, 'categoryId' in x])).toEqual([
    ['a', ['food'], false],
    ['b', [], false],
    ['c', ['food'], false],
  ]);
});
