/* Screen readers and touch: every control has a name, icons stay silent, and sheets say what they are. */
import { test, expect, openApp, unlockPlus } from './helpers.js';

/** Problems on the screen as it is now: unnamed controls, unlabelled fields and icons read aloud. */
const problems = (page) =>
  page.evaluate(() => {
    const out = [];
    const shown = (e) => e.getClientRects().length > 0;
    const tag = (e) =>
      e.tagName.toLowerCase() + (e.dataset.act ? `[${e.dataset.act}]` : e.id ? '#' + e.id : '');
    for (const e of document.querySelectorAll('button, a[href]'))
      if (shown(e) && !(e.getAttribute('aria-label') || e.textContent.trim())) out.push('unnamed ' + tag(e));
    for (const e of document.querySelectorAll(
      'input:not([type=hidden]):not([type=file]), select, textarea',
    )) {
      const named =
        e.getAttribute('aria-label') || e.closest('label') || document.querySelector(`label[for="${e.id}"]`);
      if (!named) out.push('unlabelled ' + tag(e));
    }
    for (const e of document.querySelectorAll('svg'))
      if (
        shown(e) &&
        e.getAttribute('aria-hidden') !== 'true' &&
        !(e.getAttribute('role') === 'img' && e.getAttribute('aria-label'))
      )
        out.push('icon read aloud in ' + tag(e.parentElement));
    return [...new Set(out)];
  });

test('every tab: controls are named, fields labelled and icons silent', async ({ page }) => {
  await openApp(page);
  for (const v of ['home', 'history', 'budgets', 'settings']) {
    await page.click(`.tabs [data-act=nav][data-v=${v}]`);
    expect(await problems(page), v).toEqual([]);
  }
  for (const sub of ['accounts', 'categories']) {
    await page.click(`[data-act=setPage][data-v=${sub}]`);
    if (sub === 'categories') await page.click('[data-act=catEdit]');
    expect(await problems(page), sub).toEqual([]);
    await page.click('#v-settings .back-link');
  }
});

test('a sheet is a dialog named after its title', async ({ page }) => {
  await openApp(page);
  await page.click('#fab');
  const sheet = page.locator('#sheet');
  await expect(sheet).toHaveAttribute('role', 'dialog');
  await expect(sheet).toHaveAccessibleName('New entry');
  expect(await problems(page)).toEqual([]);
  await page.click('#sheet [data-act=close]');
  await page.click('[data-act=feedbackOpen]');
  await expect(sheet).toHaveAccessibleName('Feedback & bugs');
});

test('controls never wait for a double tap to zoom', async ({ page }) => {
  await openApp(page);
  const actions = await page.evaluate(() =>
    ['#fab', '.tabs [data-act=nav]', '#v-home .btn'].map(
      (s) => getComputedStyle(document.querySelector(s)).touchAction,
    ),
  );
  for (const a of actions) expect(a).not.toBe('auto');
});

test('the chart and Trends are as accessible as the list: the bars are a picture, the numbers are text', async ({
  page,
}) => {
  await openApp(page);
  await unlockPlus(page);
  await page.click('.tabs [data-act=nav][data-v=history]');
  for (const mode of ['chart', 'trends']) {
    await page.click(`[data-act=hmode][data-v=${mode}]`);
    expect(await problems(page), mode).toEqual([]);
  }
  await expect(page.locator('.trend-bars')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.trends select')).toHaveAccessibleName('Category');
});

test('the Due card, the Recurring page and its sheet have named controls and labelled fields', async ({
  page,
}) => {
  await openApp(page);
  await unlockPlus(page);
  await page.evaluate(() => {
    window.__qirsh.state.recurring = [
      {
        id: 'r',
        type: 'expense',
        amount: 300,
        currency: 'USD',
        categoryId: 'bills',
        account: 'wallet',
        note: 'Rent',
        every: 'month',
        day: 1,
        next: '2020-01-01',
      },
    ];
  });
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('.tabs [data-act=nav][data-v=home]');
  await expect(page.locator('#dueSec')).toBeVisible();
  expect(await problems(page), 'home').toEqual([]);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=setPage][data-v=recurring]');
  expect(await problems(page), 'page').toEqual([]);
  await page.click('[data-act=recNew]');
  await expect(page.locator('#sheet')).toHaveAccessibleName('New recurring entry');
  expect(await problems(page), 'sheet').toEqual([]);
});
