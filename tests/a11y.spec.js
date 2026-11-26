/* Screen readers and touch: every control has a name, icons stay silent, and sheets say what they are. */
import { test, expect, openApp } from './helpers.js';

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
      if (shown(e) && e.getAttribute('aria-hidden') !== 'true')
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
