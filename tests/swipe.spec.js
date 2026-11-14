/* Swiping between tabs and pulling sheets down to close them, with real touch input. */
import { test, expect, openApp } from './helpers.js';

/** Drags a finger from one point to another in small steps, as a person would. */
async function drag(page, from, to, { steps = 8, ms = 120 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const point = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y) });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps,
      y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) });
    await page.waitForTimeout(ms / steps);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const swipe = (page, dx, y = 400, x = 206) => drag(page, { x, y }, { x: x + dx, y });
const current = (page) => page.locator('.tabs [aria-current=page]').getAttribute('data-v');

test('swiping sideways moves between tabs in the tab bar’s order', async ({ page }) => {
  await openApp(page);
  await swipe(page, -160);
  expect(await current(page)).toBe('history');
  await expect(page.locator('#v-history')).toBeVisible();
  await swipe(page, -160);
  expect(await current(page)).toBe('budgets');
  await swipe(page, -160);
  expect(await current(page)).toBe('settings');
  // There is nothing after Settings, so it stays.
  await swipe(page, -160);
  expect(await current(page)).toBe('settings');
  await swipe(page, 160);
  expect(await current(page)).toBe('budgets');
});

test('small, vertical and edge swipes don’t change tab', async ({ page }) => {
  await openApp(page);
  await swipe(page, -40); // too short
  await drag(page, { x: 206, y: 500 }, { x: 150, y: 300 }); // mostly a scroll
  await expect.poll(() => page.evaluate(() => scrollY), 'the page still scrolls').toBeGreaterThan(0);
  await drag(page, { x: 8, y: 400 }, { x: 200, y: 400 }); // from the edge: the phone's Back gesture
  await drag(page, { x: 404, y: 400 }, { x: 200, y: 400 });
  expect(await current(page)).toBe('home');
});

test('swiping from an account’s page leaves it for the next tab', async ({ page }) => {
  await openApp(page);
  await page.click('.acc[data-id=whish]');
  await expect(page.locator('#v-history .acct-head')).toBeVisible();
  await swipe(page, 160);
  expect(await current(page)).toBe('home');
  await page.click('.tabs [data-act=nav][data-v=history]');
  await expect(page.locator('#v-history .acct-head')).toHaveCount(0);
});

test('pulling a sheet down closes it; a short pull springs back', async ({ page }) => {
  await openApp(page);
  await page.click('#fab');
  const sheet = page.locator('#sheet');
  const top = () => sheet.evaluate((el) => Math.round(el.getBoundingClientRect().top));
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(300); // the opening animation
  const box = await sheet.boundingBox();
  const grab = { x: box.x + box.width / 2, y: box.y + 12 };

  await drag(page, grab, { x: grab.x, y: grab.y + 30 }, { ms: 400 });
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheet.evaluate((el) => el.style.transform)).toBe('');
  await expect.poll(top).toBe(Math.round(box.y));

  await drag(page, grab, { x: grab.x, y: grab.y + 260 });
  await expect(sheet).toBeHidden();
  await expect(page.locator('#scrim')).toBeHidden();

  // It opens normally again afterwards, in place.
  await page.click('#fab');
  await expect(sheet).toBeVisible();
  await expect.poll(top).toBe(Math.round(box.y));
});

test('sideways swipes inside a sheet don’t change tab', async ({ page }) => {
  await openApp(page);
  await page.click('#fab');
  await swipe(page, -160, 600);
  await expect(page.locator('#sheet')).toBeVisible();
  expect(await current(page)).toBe('home');
});

test('a sheet scrolled down scrolls back up first instead of closing', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=showNews]'); // "What's new": long enough to scroll
  const sheet = page.locator('#sheet');
  await page.waitForTimeout(300);
  await sheet.evaluate((el) => (el.scrollTop = 200));
  const box = await sheet.boundingBox();
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await drag(page, mid, { x: mid.x, y: mid.y + 150 });
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((el) => el.scrollTop)).toBeLessThan(200);
});
