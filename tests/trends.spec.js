/* History → Trends (Frata Plus): spending month by month, this month against last, and what changed. */
import { test, expect, openApp, unlockPlus } from './helpers.js';

const toTrends = async (page) => {
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.click('[data-act=hmode][data-v=trends]');
};

/* Today is 12 November 2026. Aug and Sep were 100 each, Oct 120 (30 of it after the 12th), and Nov so far 70. */
async function setUp(page) {
  await page.clock.install({ time: new Date('2026-11-12T12:00:00') });
  await openApp(page);
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    const e = (date, amount, categoryId) => ({
      id: 'x' + date + categoryId,
      type: 'expense',
      date,
      createdAt: 1,
      amount,
      currency: 'USD',
      categoryId,
      account: 'wallet',
      rate: s.rate,
    });
    s.tx = [
      e('2026-08-05', 100, 'food'),
      e('2026-09-05', 60, 'food'),
      e('2026-09-20', 40, 'transport'),
      e('2026-10-03', 90, 'food'),
      e('2026-10-20', 30, 'transport'),
      e('2026-11-02', 30, 'food'),
      e('2026-11-10', 40, 'transport'),
    ];
  });
}

test('while locked, Trends shows what Plus adds instead', async ({ page }) => {
  await openApp(page);
  await toTrends(page);
  await expect(page.locator('.plus-teaser')).toContainText('Trends');
  await expect(page.locator('.trends')).toHaveCount(0);
  await page.click('.plus-teaser [data-act=plusOpen]');
  await expect(page.locator('#sheet')).toContainText('Trends: your spending month by month');
});

test('six months of bars, the latest still going on, and months before the first entry left out', async ({
  page,
}) => {
  await setUp(page);
  await unlockPlus(page);
  await toTrends(page);
  const cols = page.locator('.trend-col');
  await expect(cols).toHaveCount(6);
  await expect(page.locator('.trend-col.partial')).toHaveCount(1);
  await expect(cols.last()).toHaveClass(/partial/);
  await expect(page.locator('.trend-col.none')).toHaveCount(2); // June and July: before the first entry
  await expect(cols.nth(4).locator('.trend-bar')).toHaveAttribute('style', /height:100%/); // October, the biggest
  // The numbers as text, newest first, with no empty months.
  const rows = page.locator('.trend-list .row');
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText('Nov (so far)');
  await expect(rows.first()).toContainText('$70');
  await expect(rows.nth(1)).toContainText('$120');
  // The average counts finished months only: (100 + 100 + 120) / 3.
  await expect(page.locator('.trend-facts')).toContainText('Average a month$106.67');
  await page.click('[data-act=tspan][data-v="12"]');
  await expect(cols).toHaveCount(12);
  await expect(rows).toHaveCount(4);
});

test('this month is set against the same days of last month, and the biggest changes are listed', async ({
  page,
}) => {
  await setUp(page);
  await unlockPlus(page);
  await toTrends(page);
  // 70 by the 12th against 90 by the 12th of October (the 30 on the 20th isn't counted yet).
  await expect(page.locator('.trend-facts')).toContainText('So far this month$70');
  await expect(page.locator('.trend-facts')).toContainText('$20 less than the same days of October');
  const changes = page.locator('.sec', { hasText: 'Biggest changes so far' }).locator('.row');
  await expect(changes).toHaveCount(2);
  await expect(changes.first()).toContainText('Food');
  await expect(changes.first()).toContainText('$90 → $30');
  await expect(changes.first()).toContainText('−$60');
  await expect(changes.nth(1)).toContainText('+$40');
});

test('one category: its own bars and average, and no list of changes', async ({ page }) => {
  await setUp(page);
  await unlockPlus(page);
  await toTrends(page);
  await page.selectOption('#tcat', 'transport');
  await expect(page.locator('#tcat')).toHaveValue('transport');
  await expect(page.locator('.trend-facts')).toContainText('Average a month$23.33'); // (0 + 40 + 30) / 3
  await expect(page.locator('.trend-facts')).toContainText('$40 more than the same days of October');
  await expect(page.locator('.trend-list .row .amt.in')).toHaveCount(0); // income says nothing here
  await expect(page.getByText('Biggest changes')).toHaveCount(0);
  // The choice stays across the month arrows.
  await page.click('[data-act=month][data-v="-1"]');
  await expect(page.locator('#tcat')).toHaveValue('transport');
});

test('the month arrows move the end of the chart, and a finished month is set against the whole month before', async ({
  page,
}) => {
  await setUp(page);
  await unlockPlus(page);
  await toTrends(page);
  await page.click('[data-act=month][data-v="-1"]');
  await expect(page.locator('.trend-col.partial')).toHaveCount(0);
  await expect(page.locator('.trend-facts')).toContainText('October$120');
  await expect(page.locator('.trend-facts')).toContainText('$20 more than September');
  await expect(page.locator('.trend-col').last().locator('span')).toHaveText('Oct');
});

test('a stretch with nothing spent says so', async ({ page }) => {
  await setUp(page);
  await page.evaluate(() => (window.__qirsh.state.tx = []));
  await unlockPlus(page);
  await toTrends(page);
  await expect(page.locator('.trends .empty')).toHaveText('Nothing spent in these months.');
});

test('amounts blur with the eye', async ({ page }) => {
  await setUp(page);
  await unlockPlus(page);
  await page.click('[data-act=toggleHide]');
  await toTrends(page);
  await expect(page.locator('.trend-facts .amt').first()).toHaveCSS('filter', /blur/);
  await expect(page.locator('.trend-list .amt').first()).toHaveCSS('filter', /blur/);
});
