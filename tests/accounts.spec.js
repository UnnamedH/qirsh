/* Hiding balances on Home, and spending or earning straight from Savings or Whish. */
import { test, expect, openApp, appState } from './helpers.js';

/** Starts empty, with $100 in the wallet and $50 on Whish. */
async function setUp(page) {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    s.opening.wallet = { USD: 100, LBP: 0 };
    s.opening.whish = { USD: 50, LBP: 0 };
  });
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.click('.tabs [data-act=nav][data-v=home]');
}

const balances = (page) => page.evaluate(() => window.__qirsh.balances());

test('the eye blurs balances on Home, and it is remembered', async ({ page }) => {
  await setUp(page);
  const total = page.locator('.balance-total');
  await expect(total).toHaveCSS('filter', 'none');
  await page.click('[data-act=toggleHide]');
  await expect(total).toHaveCSS('filter', /blur/);
  await expect(page.locator('.acc .amt').first()).toHaveCSS('filter', /blur/);
  await expect(page.locator('[data-act=toggleHide]')).toHaveAttribute('aria-label', 'Show amounts');

  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(page.locator('.balance-total')).toHaveCSS('filter', /blur/);
  await page.click('[data-act=toggleHide]');
  await expect(page.locator('.balance-total')).toHaveCSS('filter', 'none');
  expect((await appState(page)).settings.hide).toBe(false);
});

test('an expense can be paid straight from Whish', async ({ page }) => {
  await setUp(page);
  await page.click('[data-act=accMenu][data-id=whish]');
  await expect(page.locator('#sheet h2')).toHaveText('Whish');
  await page.click('[data-act=accTx][data-v=expense]');
  await expect(page.locator('#sheet')).toContainText('Paid from Whish');
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '12');
  await page.click('[data-act=fcat][data-v=groceries]');
  await page.click('[data-act=fsave]');

  const b = await balances(page);
  expect(b.whish.USD).toBe(38);
  expect(b.wallet.USD).toBe(100);
  expect((await appState(page)).tx[0]).toMatchObject({ type: 'expense', account: 'whish', amount: 12 });

  // History says where it was paid from, and Quick add repeats it from Whish.
  await page.click('[data-act=quickTab][data-v=recent]');
  await page.click('[data-act=repeat]');
  expect((await balances(page)).whish.USD).toBe(26);
  await page.click('.tabs [data-act=nav][data-v=history]');
  await expect(page.locator('#histList .row').first()).toContainText('Whish');
});

test('income can land in Savings, and "Use Wallet" switches back', async ({ page }) => {
  await setUp(page);
  await page.click('[data-act=accMenu][data-id=savings]');
  await page.click('[data-act=accTx][data-v=income]');
  await expect(page.locator('#sheet')).toContainText('Into Savings');
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '30');
  await page.click('[data-act=fwallet]');
  await expect(page.locator('#sheet')).not.toContainText('Into Savings');
  await expect(page.locator('#f-pay0')).toHaveValue('30');
  await page.click('#sheet [data-act=fcat]');
  await page.click('[data-act=fsave]');
  expect((await balances(page)).wallet.USD).toBe(130);
});

test('the account sheet still moves money and corrects the balance', async ({ page }) => {
  await setUp(page);
  await page.click('[data-act=accMenu][data-id=whish]');
  await page.click('[data-act=transferTo]');
  await expect(page.locator('#f-to')).toHaveValue('whish');
  await page.click('#sheet [data-act=close]');
  await page.click('[data-act=accMenu][data-id=whish]');
  await page.click('#sheet [data-act=newAdjust]');
  await expect(page.locator('#a-acct')).toHaveValue('whish');
});

test('the hide setting is checked when data is loaded', async ({ page }) => {
  await openApp(page);
  const out = await page.evaluate(() => [
    window.__qirsh.normalize({ tx: [], settings: { hide: 'yes' } }).settings.hide,
    window.__qirsh.normalize({ tx: [], settings: { hide: true } }).settings.hide,
  ]);
  expect(out).toEqual([false, true]);
});
