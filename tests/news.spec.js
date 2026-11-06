import { test, expect, openApp } from './helpers.js';

const existingUser = JSON.stringify({ app: 'qirsh', version: 1, tx: [] });
const latest = (page) => page.evaluate(() => window.__qirsh.APP_VERSION);
const versions = (page) => page.locator('.news .label').allInnerTexts();
const seen = (page) => page.evaluate(() => localStorage.getItem('qirsh.seenVersion'));

test('brand-new users do not see the What’s new sheet', async ({ page }) => {
  await openApp(page, { showNews: true });
  await expect(page.locator('.news')).toHaveCount(0);
  expect(await seen(page)).toBe(String(await latest(page)));
});

test('existing users from before the notes see versions 3 and up, once', async ({ page }) => {
  await openApp(page, { showNews: true, storage: { 'qirsh.v1': existingUser } });
  const v = await latest(page);
  const expected = [];
  for (let i = v; i >= 3; i--) expected.push(`VERSION ${i}`);
  expect((await versions(page)).map((t) => t.split(' · ')[0])).toEqual(expected);
  await page.click('#sheet .sheet-actions [data-act=close]');
  expect(await seen(page)).toBe(String(v));
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(page.locator('.news')).toHaveCount(0);
});

test('someone one version behind sees only the latest; Escape marks it seen', async ({ page }) => {
  await openApp(page, { showNews: true, storage: { 'qirsh.v1': existingUser, 'qirsh.seenVersion': '4' } });
  const v = await latest(page);
  expect((await versions(page)).length).toBe(v - 4);
  await page.keyboard.press('Escape');
  expect(await seen(page)).toBe(String(v));
});

test('Settings shows the version and can reopen every note', async ({ page }) => {
  await openApp(page);
  const v = await latest(page);
  await page.click('[data-act=nav][data-v=settings]');
  await expect(page.locator('#v-settings > .note').last()).toContainText(`version ${v}`);
  await page.click('[data-act=showNews]');
  expect((await versions(page)).length).toBe(v);
});
