/* Hiding balances on Home, choosing an entry's account, and each account's own page. */
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

test('an expense can be paid straight from Whish, chosen in the entry form', async ({ page }) => {
  await setUp(page);
  await page.click('#fab');
  await expect(page.locator('#sheet [data-act=facct][data-v=wallet]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '12');
  await page.click('[data-act=facct][data-v=whish]');
  await expect(page.locator('#f-pay0'), 'typed amount kept').toHaveValue('12');
  await page.click('[data-act=fcat][data-v=groceries]');
  await page.click('[data-act=fsave]');

  const b = await balances(page);
  expect(b.whish.USD).toBe(38);
  expect(b.wallet.USD).toBe(100);
  expect((await appState(page)).tx[0]).toMatchObject({ type: 'expense', account: 'whish', amount: 12 });

  // Quick add repeats it from Whish, and the next new entry starts on Wallet again.
  await page.click('[data-act=quickTab][data-v=recent]');
  await page.click('[data-act=repeat]');
  expect((await balances(page)).whish.USD).toBe(26);
  await page.click('#fab');
  await expect(page.locator('#sheet [data-act=facct][data-v=wallet]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('income asks which account it goes into', async ({ page }) => {
  await setUp(page);
  await page.click('#fab');
  await page.click('[data-act=ftype][data-v=income]');
  await expect(page.locator('#sheet .acct-pick')).toContainText('Into');
  await page.click('[data-act=facct][data-v=savings]');
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '30');
  await page.click('#sheet [data-act=fcat]');
  await page.click('[data-act=fsave]');
  expect((await balances(page)).savings.USD).toBe(30);

  // Transfers and exchanges have their own From and To, so no account choice is shown.
  await page.click('#fab');
  await page.click('[data-act=ftype][data-v=transfer]');
  await expect(page.locator('#sheet .acct-pick')).toHaveCount(0);
});

test('tapping an account shows its entries, balance and Correct balance', async ({ page }) => {
  await setUp(page);
  await page.click('#fab');
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '5');
  await page.click('[data-act=facct][data-v=whish]');
  await page.fill('#f-note', 'Phone top-up');
  await page.click('[data-act=fcat][data-v=phone]');
  await page.click('[data-act=fsave]');
  await page.click('#fab');
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '3');
  await page.fill('#f-note', 'Coffee from wallet');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');

  await page.click('.acc[data-id=whish]');
  const head = page.locator('#v-history .acct-head');
  await expect(head).toContainText('Whish');
  await expect(head).toContainText('$45');
  await expect(page.locator('#histList .row')).toHaveCount(1);
  await expect(page.locator('#histList')).toContainText('Phone top-up');
  await expect(page.locator('#v-history [data-act=reportXlsx]')).toHaveCount(0);

  // + on an account's page starts in that account.
  await page.click('#fab');
  await expect(page.locator('#sheet [data-act=facct][data-v=whish]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#sheet [data-act=close]');

  await head.locator('[data-act=newAdjust]').click();
  await expect(page.locator('#a-acct')).toHaveValue('whish');
  await page.click('#sheet [data-act=close]');

  // Back goes Home; the History tab shows every account again.
  await page.click('[data-act=accAll]');
  await expect(page.locator('#v-home')).toBeVisible();
  await page.click('.tabs [data-act=nav][data-v=history]');
  await expect(page.locator('#v-history .acct-head')).toHaveCount(0);
  await expect(page.locator('#histList .row')).toHaveCount(2);
});

test('Home has one way to each task: + for entries, Exchange as the only shortcut', async ({ page }) => {
  await setUp(page);
  await expect(page.locator('#v-home [data-act=newMove][data-v=exchange]')).toHaveCount(1);
  await expect(page.locator('#v-home [data-act=newMove][data-v=transfer]')).toHaveCount(0);
  await page.click('[data-act=accView][data-id=wallet]');
  await expect(page.locator('#v-history .acct-head')).toContainText('Wallet');
  // Settings no longer has its own Correct buttons.
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await expect(page.locator('#v-settings [data-act=newAdjust]')).toHaveCount(0);
});

test('the hide setting is checked when data is loaded', async ({ page }) => {
  await openApp(page);
  const out = await page.evaluate(() => [
    window.__qirsh.normalize({ tx: [], settings: { hide: 'yes' } }).settings.hide,
    window.__qirsh.normalize({ tx: [], settings: { hide: true } }).settings.hide,
  ]);
  expect(out).toEqual([false, true]);
});
