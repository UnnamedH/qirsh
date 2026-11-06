import { test, expect, openApp } from './helpers.js';

/** Wallet total in USD, overall budget spent, and whether Home shows "Owed to you". */
const money = (page) =>
  page.evaluate(() => {
    const q = window.__qirsh;
    const s = q.state;
    const overall = s.budgets.find((b) => !b.categoryId);
    return {
      wallet: Math.round(q.combinedUSD(q.balances().wallet) * 100) / 100,
      walletLBP: q.balances().wallet.LBP,
      spent: overall ? Math.round(q.budgetStatus(overall).spent * 100) / 100 : 0,
      owedShown: [...document.querySelectorAll('#v-home h2')].some((h) => h.textContent === 'Owed to you'),
    };
  });
const owedList = (page) =>
  page.locator('#v-home .sec', { has: page.locator('h2', { hasText: 'Owed to you' }) }).locator('.list');
const monthStats = (page) => page.locator('#v-home .stats').innerText();

test('example data shows the scouts entry with $40 still owed', async ({ page }) => {
  await openApp(page);
  await expect(owedList(page)).toContainText('Scouts');
  await expect(owedList(page)).toContainText('$40');
});

test('paying for others stays out of budgets; paybacks are not income', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    s.opening.wallet = { USD: 500, LBP: 0 };
    s.budgets.push({ id: 'B', categoryId: null, period: 'month', amount: 200, currency: 'USD' });
  });
  await page.click('[data-act=nav][data-v=settings]');
  await page.click('[data-act=nav][data-v=home]');
  expect(await money(page)).toMatchObject({ wallet: 500, spent: 0, owedShown: false });

  // Add the entry
  await page.click('#fab');
  await page.fill('#f-pay0', '100');
  await page.click('[data-act=fadv]');
  await expect(page.locator('#f-who')).toHaveCount(1);
  await expect(page.locator('[data-act=fcat]')).toHaveCount(0);
  await page.click('[data-act=fsave]');
  await expect(page.locator('#f-err')).toHaveText('Who will pay you back?');
  await page.fill('#f-who', 'Scouts');
  await page.fill('#f-note', 'Camp supplies');
  await page.click('[data-act=fsave]');
  expect(await money(page)).toMatchObject({ wallet: 400, spent: 0, owedShown: true });
  expect(await monthStats(page)).toMatch(/SPENT\s*\$0\s*EARNED\s*\$0/i);

  // $60 back, prefilled with the full amount first
  await page.click('#v-home [data-act=newRepay]');
  await expect(page.locator('#f-pay0')).toHaveValue('100');
  await page.fill('#f-pay0', '60');
  await page.click('[data-act=rsave]');
  expect(await money(page)).toMatchObject({ wallet: 460, spent: 0 });
  await expect(owedList(page)).toContainText('$40');
  expect(await monthStats(page)).toMatch(/EARNED\s*\$0/i);

  // 1,790,000 LL back ($20 at the default rate)
  await page.click('#v-home [data-act=newRepay]');
  await page.click('#sheet [data-act=lcur][data-v=LBP]');
  await page.fill('#f-pay0', '1790');
  await page.click('#sheet [data-act=k000]');
  await page.click('[data-act=rsave]');
  expect((await money(page)).walletLBP).toBe(1790000);
  await expect(owedList(page)).toContainText('$20');

  // The entry sheet lists the paybacks; closing keeps the rest as Gifts spending
  await page.click('#v-home .row-btn[data-act=editTx]');
  const block = page.locator('#sheet .card');
  await expect(block).toContainText('$80');
  await expect(block).toContainText('$20 still owed');
  await page.click('[data-act=keepRest]');
  await page.click('#sheet [data-act=closeAdv][data-v=gifts]');
  expect(await money(page)).toMatchObject({ spent: 20, owedShown: false });
  const gifts = await page.evaluate(
    () =>
      window.__qirsh.budgetStatus({ categoryId: 'gifts', period: 'month', amount: 100, currency: 'USD' })
        .spent,
  );
  expect(Math.round(gifts)).toBe(20);
  await page.click('[data-act=reopenAdv]');
  expect(await money(page)).toMatchObject({ spent: 0, owedShown: true });

  // Cannot turn the switch off while paybacks exist
  await page.click('[data-act=fadv]');
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('paybacks recorded');
  await page.click('#sheet .sheet-head [data-act=close]');

  // History: not under Out, both kinds under Moves; a payback opens its own sheet
  await page.click('[data-act=nav][data-v=history]');
  await page.click('[data-act=hfilter][data-v=expense]');
  await expect(page.locator('#histList .row')).toHaveCount(0);
  await page.click('[data-act=hfilter][data-v=transfer]');
  await expect(page.locator('#histList')).toContainText('Camp supplies');
  await expect(page.locator('#histList')).toContainText('Paid back by Scouts');
  await page.click('[data-act=hfilter][data-v=all]');
  await page.locator('#histList .row', { hasText: '+$60' }).click();
  await expect(page.locator('#sheet h2')).toHaveText('Edit payback');
  await page.click('#sheet .sheet-head [data-act=close]');

  // Deleting the entry removes its paybacks; undo restores all three
  await page.click('[data-act=nav][data-v=home]');
  await page.click('#v-home .row-btn[data-act=editTx]');
  await page.click('[data-act=fdel]');
  await page.click('[data-act=fdel]');
  expect(await page.evaluate(() => window.__qirsh.state.tx.length)).toBe(0);
  expect((await money(page)).wallet).toBe(500);
  await expect(page.locator('#toast')).toContainText('with 2 paybacks');
  await page.click('#toast [data-act=undo]');
  expect(await page.evaluate(() => window.__qirsh.state.tx.length)).toBe(3);
});
