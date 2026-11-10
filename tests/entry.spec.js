import { test, expect, openApp, appState } from './helpers.js';

/** A fresh start with $100 and no LL in the wallet, at the default rate of 89,500. */
async function freshWallet(page) {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => (window.__qirsh.state.opening.wallet = { USD: 100, LBP: 0 }));
}

const wallet = (page) => page.evaluate(() => window.__qirsh.balances().wallet);
const lastTx = async (page) => (await appState(page)).tx.at(-1);

async function startExpense(page, priceCur, price) {
  await page.click('#fab');
  await page.click(`#sheet [data-act=lcur][data-v=${priceCur}]`);
  await page.fill('#f-pay0', price);
}

test('price first: 385,000 LL paid with $10, with the change worked out', async ({ page }) => {
  await freshWallet(page);
  await startExpense(page, 'LBP', '385');
  await expect(page.locator('#sheet .k-suffix').first(), 'LL is typed in thousands').toHaveText(',000');

  await page.click('[data-act=paidAdd]');
  await expect(page.locator('#sheet [data-act=paidCur][aria-pressed=true]')).toHaveAttribute('data-v', 'USD');
  await page.fill('#f-paid', '10');
  await expect(page.locator('#f-adjlabel')).toHaveText('Change back');
  await expect(page.locator('#f-adj')).toHaveValue('510');
  await expect(page.locator('#f-adjhint')).toContainText('89,500');

  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');
  const t = await lastTx(page);
  expect(t).toMatchObject({ amount: 10, currency: 'USD', priceCur: 'LBP', back: { USD: 0, LBP: 510000 } });
  expect(await wallet(page)).toEqual({ USD: 90, LBP: 510000 });
});

test('the change the shop actually gave is kept, with the shop’s rate', async ({ page }) => {
  await freshWallet(page);
  await startExpense(page, 'LBP', '385');
  await page.click('[data-act=paidAdd]');
  await page.fill('#f-paid', '10');
  await page.fill('#f-adj', '500');
  await expect(page.locator('#f-adjhint')).toHaveText('That’s 88,500 LL per $1.');
  await page.fill('#f-note', 'Lunch');
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');

  const t = await lastTx(page);
  expect(t).toMatchObject({ amount: 10, currency: 'USD', priceCur: 'LBP', rate: 88500 });
  expect(t.back.LBP).toBe(500000);
  expect(await wallet(page)).toEqual({ USD: 90, LBP: 500000 });

  // The list shows the price, with how it was paid underneath
  await page.click('.tabs [data-act=nav][data-v=history]');
  const row = page.locator('#histList .row', { hasText: 'Lunch' });
  await expect(row).toContainText('385,000 LL');
  await expect(row).toContainText('paid $10 · 500,000 LL back');

  // Its cost stays 385,000 LL after the app's rate changes
  const valueLL = () =>
    page.evaluate(() => {
      const t = window.__qirsh.state.tx.at(-1);
      return Math.round(window.__qirsh.txCostUSD(t) * window.__qirsh.state.rate);
    });
  expect(await valueLL()).toBe(385000);
  await page.evaluate(() => (window.__qirsh.state.rate = 95000));
  expect(await valueLL()).toBe(385000);

  // Reopening shows it the way it was entered
  await page.evaluate(() => (window.__qirsh.state.rate = 89500));
  await row.click();
  await expect(page.locator('#f-pay0')).toHaveValue('385');
  await expect(page.locator('#f-paid')).toHaveValue('10');
  await expect(page.locator('#f-adj')).toHaveValue('500');
});

test('paying less than the price: the rest paid on top is worked out', async ({ page }) => {
  await freshWallet(page);
  await page.evaluate(() => (window.__qirsh.state.opening.wallet.LBP = 100000));
  await startExpense(page, 'LBP', '385');
  await page.click('[data-act=paidAdd]');
  await page.fill('#f-paid', '4');
  await expect(page.locator('#f-adjlabel')).toHaveText('You also paid');
  await expect(page.locator('#f-adj')).toHaveValue('27');
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');
  expect(await lastTx(page)).toMatchObject({ amount: 4, currency: 'USD', amount2: 27000, priceCur: 'LBP' });
  expect(await wallet(page)).toEqual({ USD: 96, LBP: 73000 });
});

test('change in the same currency: $7 paid with $10', async ({ page }) => {
  await freshWallet(page);
  await startExpense(page, 'USD', '7');
  await page.click('[data-act=paidAdd]');
  await page.click('#sheet [data-act=paidCur][data-v=USD]');
  await page.fill('#f-paid', '10');
  await expect(page.locator('#f-adj')).toHaveValue('3');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');
  const t = await lastTx(page);
  expect(t).toMatchObject({ amount: 10, currency: 'USD', back: { USD: 3 } });
  expect(t.rate, 'no rate needed when everything is in dollars').toBeUndefined();
  expect(await wallet(page)).toEqual({ USD: 93, LBP: 0 });
});

test('a mistyped change is caught before saving', async ({ page }) => {
  await freshWallet(page);
  await startExpense(page, 'LBP', '385');
  await page.click('[data-act=paidAdd]');
  await page.fill('#f-paid', '10');
  await page.fill('#f-adj', '5000');
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('Check the amounts');
  expect((await appState(page)).tx).toHaveLength(0);
});

test('removing "Paid with" saves a plain expense', async ({ page }) => {
  await freshWallet(page);
  await startExpense(page, 'LBP', '385');
  await page.click('[data-act=paidAdd]');
  await page.fill('#f-paid', '10');
  await page.click('[data-act=paidRm]');
  await expect(page.locator('#f-paid')).toHaveCount(0);
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');
  const t = await lastTx(page);
  expect(t).toMatchObject({ amount: 385000, currency: 'LBP' });
  expect(t.back).toBeUndefined();
  expect(t.priceCur).toBeUndefined();
});

test('LL amounts are typed in thousands everywhere', async ({ page }) => {
  await freshWallet(page);
  const typed = async (value) => {
    await startExpense(page, 'LBP', value);
    await page.click('[data-act=fcat][data-v=food]');
    await page.click('[data-act=fsave]');
    return (await lastTx(page)).amount;
  };
  expect(await typed('385')).toBe(385000);
  expect(await typed('0.5')).toBe(500);
  expect(await typed('1.5m'), 'shortcuts stay literal').toBe(1500000);
  expect(await typed('250k')).toBe(250000);
  await expect(page.locator('[data-act=k000]'), 'no 000 button').toHaveCount(0);

  // Dollars have no ,000
  await page.click('#fab');
  await page.click('#sheet [data-act=lcur][data-v=USD]');
  await expect(page.locator('#sheet .k-suffix')).toHaveCount(0);
  await page.click('#sheet .sheet-head [data-act=close]');

  // A budget in LL
  await page.click('.tabs [data-act=nav][data-v=budgets]');
  await page.click('#v-budgets [data-act=newBudget]');
  await page.click('#sheet [data-act=bcur][data-v=LBP]');
  await page.fill('#b-amount', '2000');
  await page.click('[data-act=bsave]');
  expect((await appState(page)).budgets.at(-1)).toMatchObject({ amount: 2000000, currency: 'LBP' });

  // Exchange: $10 gives 895 (thousand) LL at the app's rate
  await page.click('.tabs [data-act=nav][data-v=home]');
  await page.click('[data-act=newMove][data-v=exchange]');
  await page.fill('#f-pay0', '10');
  await expect(page.locator('#f-toamount')).toHaveValue('895');
  await page.click('[data-act=fsave]');
  expect(await lastTx(page)).toMatchObject({ amount: 10, toAmount: 895000, toCurrency: 'LBP' });
});

test('an older "paid + change" entry opens price first, unchanged', async ({ page }) => {
  const old = JSON.stringify({
    rate: 89500,
    tx: [
      {
        id: 'old',
        type: 'expense',
        amount: 10,
        currency: 'USD',
        back: { USD: 0, LBP: 500000 },
        categoryId: 'food',
        date: new Date().toISOString().slice(0, 10),
        note: 'Old lunch',
        createdAt: 1,
      },
    ],
  });
  await openApp(page, { storage: { 'qirsh.v1': old } });
  expect((await appState(page)).tx[0].rate, 'rate kept from when it was saved').toBe(89500);
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.locator('#histList .row', { hasText: 'Old lunch' }).click();
  await expect(page.locator('#f-pay0')).toHaveValue('395');
  await expect(page.locator('#f-paid')).toHaveValue('10');
  await expect(page.locator('#f-adj')).toHaveValue('500');
  await page.click('[data-act=fsave]');
  const t = (await appState(page)).tx[0];
  expect(t).toMatchObject({ amount: 10, currency: 'USD', priceCur: 'LBP', back: { LBP: 500000 } });
});

test('change in both currencies: $5 back and the rest in LL', async ({ page }) => {
  await freshWallet(page);
  await startExpense(page, 'LBP', '385');
  await page.click('[data-act=paidAdd]');
  await page.fill('#f-paid', '10');
  await expect(page.locator('#f-adj')).toHaveValue('510');

  await page.click('[data-act=adj2Add]');
  await page.fill('#f-adj2', '5');
  // $5 is 447,500 LL, so 62,500 LL is left, rounded to 63,000
  await expect(page.locator('#f-adj')).toHaveValue('63');
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');
  expect(await lastTx(page)).toMatchObject({ amount: 10, currency: 'USD', back: { USD: 5, LBP: 63000 } });
  expect(await wallet(page)).toEqual({ USD: 95, LBP: 63000 });

  // Reopens with both change lines; the shop's actual LL keeps the price exact
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.locator('#histList .row').first().click();
  await expect(page.locator('#f-adj2')).toHaveValue('5');
  await page.fill('#f-adj', '60');
  await expect(page.locator('#f-adjhint')).toHaveText('That’s 89,000 LL per $1.');
  await page.click('[data-act=fsave]');
  const t = await lastTx(page);
  expect(t).toMatchObject({ back: { USD: 5, LBP: 60000 }, rate: 89000 });
  expect(
    Math.round(
      await page.evaluate(
        () => window.__qirsh.txCostUSD(window.__qirsh.state.tx.at(-1)) * window.__qirsh.state.rate,
      ),
    ),
  ).toBe(385000);
});

test('removing the extra change goes back to all change in LL', async ({ page }) => {
  await freshWallet(page);
  await startExpense(page, 'LBP', '385');
  await page.click('[data-act=paidAdd]');
  await page.fill('#f-paid', '10');
  await page.click('[data-act=adj2Add]');
  await page.fill('#f-adj2', '5');
  await page.click('[data-act=adj2Rm]');
  await expect(page.locator('#f-adj')).toHaveValue('510');
});

test('price first is the default; Settings can switch to paid + change', async ({ page }) => {
  await freshWallet(page);
  expect((await appState(page)).settings.entryStyle).toBe('price');
  await page.click('#fab');
  await expect(page.locator('[data-act=paidAdd]')).toHaveCount(1);
  await expect(page.locator('[data-act=ladd][data-k=back]')).toHaveCount(0);
  await page.click('#sheet .sheet-head [data-act=close]');

  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=setEntryStyle][data-v=paid]');
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  expect((await appState(page)).settings.entryStyle, 'saved').toBe('paid');
});

test('paid + change: $10 paid, 500,000 LL back, the way it was before', async ({ page }) => {
  await freshWallet(page);
  await page.evaluate(() => (window.__qirsh.state.settings.entryStyle = 'paid'));
  await page.click('#fab');
  await expect(page.locator('[data-act=paidAdd]')).toHaveCount(0);
  await page.click('#sheet [data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '10');
  await page.click('[data-act=ladd][data-k=back]');
  await expect(page.locator('#sheet [data-act=lcur][data-k=back][aria-pressed=true]')).toHaveAttribute(
    'data-v',
    'LBP',
  );
  await page.fill('#f-back0', '500');
  await expect(page.locator('#f-preview')).toContainText('Costs $4.41');
  // And $2 back as well
  await page.click('[data-act=ladd][data-k=back]');
  await page.fill('#f-back1', '2');
  await page.click('[data-act=fcat][data-v=food]');
  await page.fill('#f-note', 'Lunch');
  await page.click('[data-act=fsave]');
  const t = await lastTx(page);
  expect(t).toMatchObject({ amount: 10, currency: 'USD', back: { USD: 2, LBP: 500000 }, rate: 89500 });
  expect(t.priceCur).toBeUndefined();
  expect(await wallet(page)).toEqual({ USD: 92, LBP: 500000 });

  // Reopens with the same paid and change lines
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.locator('#histList .row', { hasText: 'Lunch' }).click();
  await expect(page.locator('#f-pay0')).toHaveValue('10');
  await expect(page.locator('#f-back0')).toHaveValue('500');
  await expect(page.locator('#f-back1')).toHaveValue('2');
});

test('an entry made price first keeps its price when edited as paid + change', async ({ page }) => {
  await freshWallet(page);
  await startExpense(page, 'LBP', '385');
  await page.click('[data-act=paidAdd]');
  await page.fill('#f-paid', '10');
  await page.fill('#f-adj', '500');
  await page.fill('#f-note', 'Lunch');
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');

  await page.evaluate(() => (window.__qirsh.state.settings.entryStyle = 'paid'));
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.locator('#histList .row', { hasText: 'Lunch' }).click();
  await expect(page.locator('#f-pay0')).toHaveValue('10');
  await expect(page.locator('#f-back0')).toHaveValue('500');
  await page.click('[data-act=fsave]');
  const valueLL = await page.evaluate(() =>
    Math.round(window.__qirsh.txCostUSD(window.__qirsh.state.tx.at(-1)) * window.__qirsh.state.rate),
  );
  expect(valueLL).toBe(385000);
});

test('an unknown entry style in a backup falls back to price first', async ({ page }) => {
  await openApp(page, {
    storage: { 'qirsh.v1': JSON.stringify({ tx: [], settings: { entryStyle: 'weird' } }) },
  });
  expect((await appState(page)).settings.entryStyle).toBe('price');
});
