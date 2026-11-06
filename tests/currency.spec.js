import { test, expect, openApp, sheetCurrency, closeSheet } from './helpers.js';

test('new entries start in the last used currency', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');

  await page.click('#fab');
  expect(await sheetCurrency(page)).toBe('USD');
  await page.click('#sheet [data-act=lcur][data-v=LBP]');
  await page.fill('#f-pay0', '150000');
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');

  await page.click('#fab');
  expect(await sheetCurrency(page)).toBe('LBP');
  await page.click('#sheet [data-act=lcur][data-v=USD]');
  await closeSheet(page);
  await page.click('#fab');
  expect(await sheetCurrency(page), 'cancelled change is ignored').toBe('LBP');
  await page.click('[data-act=ftype][data-v=income]');
  expect(await sheetCurrency(page)).toBe('LBP');
  await page.click('#sheet [data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '650');
  await page.click('[data-act=fcat][data-v=salary]');
  await page.click('[data-act=fsave]');
  await page.click('#fab');
  expect(await sheetCurrency(page)).toBe('USD');
  await closeSheet(page);

  // Transfers follow; Exchange always starts at give $, get LL
  await page.evaluate(() =>
    window.__qirsh.state.tx.push({
      id: 'z',
      type: 'expense',
      amount: 300000,
      currency: 'LBP',
      categoryId: 'transport',
      date: '2026-11-06',
      account: 'wallet',
      createdAt: Date.now() + 1000,
    }),
  );
  await page.click('[data-act=newMove][data-v=transfer]');
  expect(await sheetCurrency(page)).toBe('LBP');
  await closeSheet(page);
  await page.click('[data-act=newMove][data-v=exchange]');
  expect(await sheetCurrency(page)).toBe('USD');
  await expect(page.locator('#sheet .cur-tag').first()).toHaveText('LL');
  await closeSheet(page);

  // Paybacks use the currency of their entry
  await page.evaluate(() =>
    window.__qirsh.state.tx.push({
      id: 'adv',
      type: 'advance',
      amount: 100,
      currency: 'USD',
      who: 'Scouts',
      date: '2026-11-06',
      account: 'wallet',
      createdAt: 1,
    }),
  );
  await page.click('[data-act=nav][data-v=settings]');
  await page.click('[data-act=nav][data-v=home]');
  await page.click('#v-home [data-act=newRepay]');
  expect(await sheetCurrency(page)).toBe('USD');
});

for (const time of ['00:20', '09:00', '13:00', '23:30']) {
  test(`at ${time}, example entries are never in the future`, async ({ page }) => {
    await page.clock.install({ time: new Date(`2026-11-06T${time}:00`) });
    await openApp(page);
    const future = await page.evaluate(
      () => window.__qirsh.state.tx.filter((t) => t.createdAt > Date.now()).length,
    );
    expect(future).toBe(0);

    await page.click('#fab');
    await page.click('#sheet [data-act=lcur][data-v=USD]');
    await page.fill('#f-pay0', '5');
    await page.click('[data-act=fcat][data-v=coffee]');
    await page.fill('#f-note', 'Test latte');
    await page.click('[data-act=fsave]');

    await page.click('[data-act=nav][data-v=history]');
    await expect(page.locator('#histList .row .row-title').first()).toHaveText('Test latte');
    await page.click('[data-act=nav][data-v=home]');
    await page.click('[data-act=quickTab][data-v=recent]');
    const quickAdd = page.locator('#v-home .sec', { has: page.locator('h2', { hasText: 'Quick add' }) });
    await expect(quickAdd.locator('.row-title').first()).toHaveText('Test latte');
    await page.click('#fab');
    expect(await sheetCurrency(page)).toBe('USD');
  });
}
