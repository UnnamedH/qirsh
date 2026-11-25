/* History: spending by category as a ring chart, and each expense's price shown above how it was paid. */
import { test, expect, openApp, appState } from './helpers.js';

const toHistory = (page) => page.click('.tabs [data-act=nav][data-v=history]');

test('By category shows the month’s spending as slices that add up to what was spent', async ({ page }) => {
  await openApp(page);
  await toHistory(page);
  const spent = await page.locator('#v-history .stats .stat').first().locator('.amt').innerText();
  await page.click('[data-act=hmode][data-v=chart]');

  await expect(page.locator('.pie-total .amt')).toHaveText(spent);
  const rows = page.locator('.pie-legend .pie-row');
  const n = await rows.count();
  expect(n).toBeGreaterThan(1);
  expect(n).toBeLessThanOrEqual(7);
  // One slice per legend row, and the shares add up to the whole ring.
  await expect(page.locator('.pie circle')).toHaveCount(n);
  const share = await page.evaluate(() =>
    [...document.querySelectorAll('.pie circle')].reduce(
      (s, c) => s + parseFloat(c.getAttribute('stroke-dasharray')),
      0,
    ),
  );
  expect(share).toBeCloseTo(100, 1);
  // Biggest first.
  const amounts = await page.evaluate(() =>
    [...document.querySelectorAll('.pie-legend .amt')].map((e) => +e.textContent.replace(/[^\d.]/g, '')),
  );
  const named = amounts.slice(0, amounts.length - (n === 7 ? 1 : 0));
  expect([...named].sort((a, b) => b - a)).toEqual(named);

  // The list comes back with its filters.
  await page.click('[data-act=hmode][data-v=list]');
  await expect(page.locator('#histList')).toBeVisible();
  await expect(page.locator('#hq')).toBeVisible();
});

test('the chart follows the month shown, and says so when nothing was spent', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await toHistory(page);
  await page.click('[data-act=hmode][data-v=chart]');
  await expect(page.locator('#v-history .empty')).toHaveText('No spending this month.');
  // The choice stays while moving between months.
  await page.click('[data-act=month][data-v="-1"]');
  await expect(page.locator('[data-act=hmode][data-v=chart]')).toHaveAttribute('aria-pressed', 'true');
});

test('the chart’s amounts are hidden with the eye, like the rest', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=toggleHide]');
  await toHistory(page);
  await page.click('[data-act=hmode][data-v=chart]');
  await expect(page.locator('.pie-total .amt')).toHaveCSS('filter', /blur/);
  await expect(page.locator('.pie-legend .amt').first()).toHaveCSS('filter', /blur/);
});

test('an expense typed as paid + change shows its price, with what was paid and the change under it', async ({
  page,
}) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => (window.__qirsh.state.settings.entryStyle = 'paid'));
  await page.click('#fab');
  await page.click('#sheet [data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '10');
  await page.click('#sheet [data-act=ladd][data-k=back]');
  await page.fill('#f-back0', '447.5');
  await page.fill('#f-note', 'Lunch');
  await page.click('[data-act=fcat][data-v=food]');
  await page.click('[data-act=fsave]');
  const t = (await appState(page)).tx.at(-1);
  expect(t.priceCur).toBeUndefined();

  await toHistory(page);
  const amt = page.locator('#histList .row', { hasText: 'Lunch' }).locator('.amt');
  // $10 paid, 447,500 LL back at 89,500: it cost $5.
  await expect(amt.locator('span').first()).toHaveText('$5');
  await expect(amt.locator('.chg')).toHaveText('paid $10 · 447,500 LL back');
});

test('a plain expense still shows just its amount', async ({ page }) => {
  await openApp(page);
  await toHistory(page);
  const amt = page.locator('#histList .row', { hasText: 'Espresso' }).first().locator('.amt');
  await expect(amt).toHaveText('$2');
  await expect(amt.locator('.chg')).toHaveCount(0);
});
