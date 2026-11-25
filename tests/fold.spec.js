/* Home sections fold down to a one-line summary, and stay folded. */
import { test, expect, openApp, appState } from './helpers.js';

const section = (page, key) => page.locator('.fold', { has: page.locator(`[data-act=fold][data-v=${key}]`) });

test('each Home section folds to a summary of what’s inside, and is remembered', async ({ page }) => {
  await openApp(page);
  // Open to start with, as before.
  await expect(section(page, 'quick').locator('.list')).toBeVisible();
  await expect(section(page, 'quick').locator('.fold-sum')).toHaveCount(0);

  for (const k of ['owed', 'quick', 'month', 'budgets']) await page.click(`[data-act=fold][data-v=${k}]`);
  expect((await appState(page)).settings.homeFold).toEqual({
    owed: true,
    quick: true,
    month: true,
    budgets: true,
  });

  // Owed: the total. Quick add: a few icons, each once. Month: three numbers. Budgets: up to five rings.
  await expect(section(page, 'owed').locator('.list')).toHaveCount(0);
  await expect(section(page, 'owed').locator('.fold-sum')).toHaveText('$40');
  const icons = await section(page, 'quick').locator('.fold-sum .glyph').allInnerTexts();
  expect(icons.length).toBeGreaterThan(0);
  expect(icons.length).toBeLessThanOrEqual(5);
  expect(new Set(icons).size).toBe(icons.length);
  await expect(section(page, 'quick').locator('[data-act=quickTab]')).toHaveCount(0);
  const month = section(page, 'month').locator('.mini-stats');
  await expect(month.locator('span')).toHaveCount(3);
  await expect(month).toHaveAttribute('aria-label', /^Spent \$.+, earned \$.+, net .+\$/);
  await expect(section(page, 'month').locator('.stats')).toHaveCount(0);
  const rings = section(page, 'budgets').locator('.fold-sum .ring');
  await expect(rings).toHaveCount(5);
  await expect(rings.first()).toHaveAttribute('aria-label', /^All spending \d+%$/);

  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(section(page, 'budgets').locator('.list')).toHaveCount(0);
  await page.click('[data-act=fold][data-v=budgets]');
  await expect(section(page, 'budgets').locator('.list')).toBeVisible();
  expect((await appState(page)).settings.homeFold).toEqual({ owed: true, quick: true, month: true });
});

test('folded summaries are blurred with the other amounts', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=fold][data-v=month]');
  await page.click('[data-act=toggleHide]');
  await expect(section(page, 'month').locator('.mini-stats')).toHaveCSS('filter', /blur/);
});

test('the folded sections are checked when data is loaded', async ({ page }) => {
  await openApp(page);
  const out = await page.evaluate(
    () =>
      window.__qirsh.normalize({ tx: [], settings: { homeFold: { quick: true, month: 'yes', nope: true } } })
        .settings.homeFold,
  );
  expect(out).toEqual({ quick: true });
});
