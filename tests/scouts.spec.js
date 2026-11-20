import { test, expect } from './helpers.js';

/* Frata Scouts (scouts/). Each test serves it under its own prefix, /t/<id>/scouts/, so the test
   server's settings and the page's storage never leak between tests. */
const base = () => `t/${test.info().testId}/`;
const KEY = 'frata-scouts.v1';

async function openScouts(page, { storage = {} } = {}) {
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, storage);
  await page.goto(base() + 'scouts/');
  await page.waitForFunction(() => window.__scouts);
}

const st = (page) => page.evaluate(() => window.__scouts.state);
const bal = (page) => page.evaluate(() => window.__scouts.balances());

/** Opens the entry form of `type`, fills it in and saves. */
async function addEntry(page, { type = 'expense', amount, cur, to, toAmount, note }) {
  await page.click(`.btn[data-act=new][data-v=${type === 'exchange' ? 'transfer' : type}]`);
  if (type === 'exchange') await page.click('#sheet [data-act=ftype][data-v=exchange]');
  if (cur) await page.click(`#sheet [data-act=fcur][data-v=${cur}]`);
  await page.fill('#f-amount', String(amount));
  if (to) await page.selectOption('#sheet [data-f=to]', to);
  if (toAmount) await page.fill('#f-toamount', String(toAmount));
  if (note) await page.fill('#sheet [data-f=note]', note);
  await page.click('#sheet [data-act=fsave]');
}

test('opens with a cash box and a bank, both empty', async ({ page }) => {
  await openScouts(page);
  await expect(page).toHaveTitle('Frata Scouts');
  const s = await st(page);
  expect(s.app).toBe('frata-scouts');
  expect(s.accounts.map((a) => a.name)).toEqual(['Cash box', 'Bank']);
  expect(await bal(page)).toEqual({ wallet: { USD: 0, LBP: 0 }, bank: { USD: 0, LBP: 0 } });
  await expect(page.locator('.acc')).toHaveCount(2);
});

test('an expense lowers the fund and an income raises it', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'income', amount: 100, note: 'Dues' });
  await addEntry(page, { type: 'expense', amount: 25, note: 'Bus' });
  expect((await bal(page)).wallet).toEqual({ USD: 75, LBP: 0 });
  await expect(page.locator('#v-home .row')).toHaveCount(2);
});

test('LL is typed in thousands', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'income', amount: 385, cur: 'LBP' });
  expect((await bal(page)).wallet.LBP).toBe(385000);
});

test('a move between funds and an exchange', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'income', amount: 100 });
  await addEntry(page, { type: 'transfer', amount: 40, to: 'bank' });
  expect(await bal(page)).toEqual({ wallet: { USD: 60, LBP: 0 }, bank: { USD: 40, LBP: 0 } });
  await addEntry(page, { type: 'exchange', amount: 20, toAmount: 1790 });
  expect((await bal(page)).wallet).toEqual({ USD: 40, LBP: 1790000 });
});

test('moving money to the same fund is refused', async ({ page }) => {
  await openScouts(page);
  await page.click('.btn[data-act=new][data-v=transfer]');
  await page.fill('#f-amount', '5');
  await page.selectOption('#sheet [data-f=to]', 'wallet');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('two different funds');
  expect((await st(page)).tx).toHaveLength(0);
});

test('an empty amount is refused', async ({ page }) => {
  await openScouts(page);
  await page.click('.btn[data-act=new][data-v=expense]');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#f-err')).toBeVisible();
  expect((await st(page)).tx).toHaveLength(0);
});

test('changing the rate never changes past entries', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'expense', amount: 895, cur: 'LBP' }); // 895,000 LL at 89,500 = $10
  const usd = () =>
    page.evaluate(() => {
      const r = window.__scouts.range('month');
      return window.__scouts.sumIn(r, 'expense', null, 'USD');
    });
  expect(await usd()).toBeCloseTo(895000 / 89500, 5);
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('#rate', '100000');
  await page.locator('#rate').blur();
  expect((await st(page)).rate).toBe(100000);
  expect(await usd()).toBeCloseTo(895000 / 89500, 5);
});

test('an entry can be edited, deleted and the delete undone', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'expense', amount: 12, note: 'Rope' });
  await page.click('#v-home [data-act=editTx]');
  await page.fill('#f-amount', '15');
  await page.click('#sheet [data-act=fsave]');
  expect((await st(page)).tx.map((t) => t.amount)).toEqual([15]);
  await page.click('#v-home [data-act=editTx]');
  await page.click('#sheet [data-act=fdel]'); // first tap asks
  expect((await st(page)).tx).toHaveLength(1);
  await page.click('#sheet [data-act=fdel]');
  expect((await st(page)).tx).toHaveLength(0);
  await page.click('#toast [data-act=undo]');
  expect((await st(page)).tx.map((t) => t.amount)).toEqual([15]);
});

test('a fund can be added, renamed and removed, keeping its money', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'income', amount: 30 });
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('#newAcc', 'Camp savings');
  await page.click('[data-act=accAdd]');
  const s = await st(page);
  expect(s.accounts.map((a) => a.name)).toEqual(['Cash box', 'Bank', 'Camp savings']);
  const camp = s.accounts[2].id;
  await page.click('[data-act=nav][data-v=home]');
  await addEntry(page, { type: 'transfer', amount: 10, to: camp });
  await page.click('[data-act=nav][data-v=settings]');
  await page.click(`[data-act=accRemove][data-id="${camp}"]`);
  await page.click(`[data-act=accRemove][data-id="${camp}"]`);
  expect((await bal(page)).wallet.USD).toBe(30);
  expect((await st(page)).accounts.find((a) => a.id === camp).hidden).toBe(true);
});

test('correcting a balance sets the fund to what it really holds', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'income', amount: 50 });
  await page.click('#v-home [data-act=accView][data-id=wallet]');
  await page.click('[data-act=newAdjust]');
  await page.fill('#f-amount', '45');
  await page.click('#sheet [data-act=fsave]');
  expect((await bal(page)).wallet.USD).toBe(45);
  expect((await st(page)).tx.at(-1).type).toBe('adjust');
});

test('the data is saved and survives a reload', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'income', amount: 7 });
  await page.reload();
  await page.waitForFunction(() => window.__scouts);
  expect((await bal(page)).wallet.USD).toBe(7);
});

test('the scouts and the personal app keep separate data', async ({ page }) => {
  const frata = JSON.stringify({ app: 'qirsh', version: 1, rate: 89500, tx: [], accounts: [] });
  await openScouts(page, { storage: { 'qirsh.v1': frata } });
  await addEntry(page, { type: 'income', amount: 9 });
  const keys = await page.evaluate(() => ({
    frata: localStorage.getItem('qirsh.v1'),
    scouts: JSON.parse(localStorage.getItem('frata-scouts.v1')),
  }));
  expect(keys.frata).toBe(frata);
  expect(keys.scouts.tx).toHaveLength(1);
});

test('a personal Frata backup is refused, a scouts backup asks before replacing', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'income', amount: 5 });
  await page.click('[data-act=nav][data-v=settings]');
  const pick = (name, obj) =>
    page.setInputFiles('#importFile', {
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(obj)),
    });
  await pick('frata.json', { app: 'qirsh', version: 1, tx: [] });
  await expect(page.locator('#alerts')).toContainText('isn’t a Frata Scouts backup');
  expect((await st(page)).tx).toHaveLength(1);
  await page.click('[data-act=importCancel]');
  await pick('scouts.json', {
    app: 'frata-scouts',
    group: { name: 'Group 12' },
    tx: [{ id: 'a', type: 'income', date: '2026-03-01', currency: 'USD', amount: 80, categoryId: 'dues' }],
  });
  await expect(page.locator('#alerts')).toContainText('Replace everything here?');
  expect((await st(page)).tx).toHaveLength(1);
  await page.click('[data-act=importConfirm]');
  const s = await st(page);
  expect(s.group.name).toBe('Group 12');
  expect(s.tx.map((t) => t.amount)).toEqual([80]);
  expect(s.tx[0].rate).toBe(89500); // an entry without a rate gets one
});

test('unreadable saved data is kept aside and the app starts empty', async ({ page }) => {
  await openScouts(page, { storage: { [KEY]: '{not json' } });
  expect((await st(page)).tx).toEqual([]);
  expect(await page.evaluate((k) => localStorage.getItem(k + '.unreadable'), KEY)).toBe('{not json');
});

test('it never contacts another website and trips no Content Security Policy rule', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL).origin;
  const elsewhere = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (['http:', 'https:'].includes(u.protocol) && u.origin !== origin) elsewhere.push(r.url());
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push(e.violatedDirective + ' ' + e.blockedURI),
    );
  });
  await openScouts(page);
  await addEntry(page, { type: 'expense', amount: 3 });
  await page.click('[data-act=nav][data-v=history]');
  await page.click('[data-act=nav][data-v=settings]');
  expect(elsewhere).toEqual([]);
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).not.toMatch(/unsafe-inline.*script|script-src[^;]*unsafe/);
});

test('it opens with no connection once installed', async ({ page, context }) => {
  await openScouts(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.__scouts);
  await context.setOffline(true);
  const tab = await context.newPage();
  await tab.goto(base() + 'scouts/');
  await expect(tab.locator('.balance-total')).toBeVisible();
  await expect(tab.locator('.acc')).toHaveCount(2);
});

test('the personal app’s service worker leaves the scouts app alone', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('qirsh.seenVersion', '9999'));
  await page.goto(base());
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.goto(base() + 'scouts/');
  await page.waitForFunction(() => window.__scouts);
  await expect(page).toHaveTitle('Frata Scouts');
});

test('the layout fits a narrow phone with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openScouts(page);
  for (const v of ['home', 'history', 'settings']) {
    await page.click(`[data-act=nav][data-v=${v}]`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over, v).toBeLessThanOrEqual(0);
  }
});
