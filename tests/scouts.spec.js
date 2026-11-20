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

test('a big change to the rate asks first, and any change can be undone', async ({ page }) => {
  await openScouts(page);
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('#rate', '895'); // a slip for 89,500
  await page.locator('#rate').blur();
  await expect(page.locator('[data-act=rateConfirm]')).toBeVisible();
  expect((await st(page)).rate).toBe(89500);
  await page.click('[data-act=rateCancel]');
  expect((await st(page)).rate).toBe(89500);
  await expect(page.locator('#rate')).toHaveValue('89,500');

  await page.fill('#rate', '90000'); // a small change goes through at once
  await page.locator('#rate').blur();
  expect((await st(page)).rate).toBe(90000);
  await page.click('#toast [data-act=undo]');
  expect((await st(page)).rate).toBe(89500);

  await page.fill('#rate', '200000');
  await page.locator('#rate').blur();
  await page.click('[data-act=rateConfirm]');
  expect((await st(page)).rate).toBe(200000);
});

test('renaming a fund doesn’t swallow the next tap', async ({ page }) => {
  await openScouts(page);
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('[data-accname=bank]', 'Bank Audi');
  // Tapping straight from the field to another button: the rename saves and the tap still works.
  await page.click('[data-act=setTheme][data-v=dark]');
  const s = await st(page);
  expect(s.accounts.find((a) => a.id === 'bank').name).toBe('Bank Audi');
  expect(s.settings.theme).toBe('dark');
  await page.reload();
  await page.waitForFunction(() => window.__scouts);
  expect((await st(page)).accounts.find((a) => a.id === 'bank').name).toBe('Bank Audi');
});

test('the totals say which currency without repeating it', async ({ page }) => {
  await openScouts(page);
  await expect(page.locator('.balance-split')).not.toContainText('LL LL');
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
  for (const v of ['home', 'events', 'members', 'history', 'settings']) {
    await page.click(`[data-act=nav][data-v=${v}]`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over, v).toBeLessThanOrEqual(0);
  }
});

/* ---------- events and camps ---------- */

/** Creates an event through its form and returns its id. Leaves the event's page open. */
async function addEvent(page, { name, start, end, budget, cur }) {
  await page.click('[data-act=nav][data-v=events]');
  await page.click('[data-act=newEvent]');
  await page.fill('#sheet [data-f=name]', name);
  if (start != null) await page.fill('#sheet [data-f=start]', start);
  if (end != null) await page.fill('#sheet [data-f=end]', end);
  if (cur) await page.click(`#sheet [data-act=fcur][data-v=${cur}]`);
  if (budget != null) await page.fill('#f-amount', String(budget));
  await page.click('#sheet [data-act=fsave]');
  return page.evaluate(() => window.__scouts.state.events.at(-1).id);
}

test('an event with a budget tracks what was spent and brought in for it', async ({ page }) => {
  await openScouts(page);
  const camp = await addEvent(page, {
    name: 'Summer camp',
    start: '2026-07-01',
    end: '2026-07-08',
    budget: 200,
  });
  await expect(page.locator('#v-events .acct-name h2')).toHaveText('Summer camp');
  // Added from the event's page, the entries belong to it.
  await page.click('#v-events [data-act=new][data-v=expense]');
  await page.fill('#f-amount', '170');
  await page.click('#sheet [data-act=fsave]');
  await page.click('#v-events [data-act=new][data-v=income]');
  await page.fill('#f-amount', '250');
  await page.click('#sheet [data-act=fsave]');
  const t = await page.evaluate((id) => window.__scouts.eventTotals(id, 'USD'), camp);
  expect([t.spent, t.earned, t.net]).toEqual([170, 250, 80]);
  await expect(page.locator('#v-events .row')).toHaveCount(3); // one category, two entries
  await page.click('[data-act=eventsAll]');
  await expect(page.locator('#v-events .budget .pill.warn')).toHaveText('85%');
  await expect(page.locator('#v-events .budget .b-foot')).toContainText('Net +$80');
});

test('an entry can be put in an event from the entry form, and taken out again', async ({ page }) => {
  await openScouts(page);
  const hike = await addEvent(page, { name: 'Hike' });
  await page.click('[data-act=nav][data-v=home]');
  await page.click('.btn[data-act=new][data-v=expense]');
  await page.fill('#f-amount', '12');
  await page.selectOption('#sheet [data-f=eventId]', hike);
  await page.click('#sheet [data-act=fsave]');
  expect((await st(page)).tx[0].eventId).toBe(hike);
  await expect(page.locator('#v-home .row-sub')).toContainText('Hike');
  // A second entry in the event is labelled too, in History, but not on the event's own page.
  await page.click('.btn[data-act=new][data-v=expense]');
  await page.fill('#f-amount', '3');
  await page.selectOption('#sheet [data-f=eventId]', hike);
  await page.click('#sheet [data-act=fsave]');
  await page.click('[data-act=nav][data-v=history]');
  await expect(page.locator('#v-history .row-sub').nth(0)).toContainText('Hike');
  await expect(page.locator('#v-history .row-sub').nth(1)).toContainText('Hike');
  await page.click('[data-act=nav][data-v=events]');
  await page.click(`[data-act=eventView][data-id="${hike}"]`);
  await expect(page.locator('#v-events .row-sub').first()).not.toContainText('Hike');
  await page.click('[data-act=nav][data-v=home]');
  await page.locator('#v-home [data-act=editTx]').last().click();
  await page.selectOption('#sheet [data-f=eventId]', '');
  await page.click('#sheet [data-act=fsave]');
  expect((await st(page)).tx[0].eventId).toBeUndefined();
});

test('a move between funds never belongs to an event', async ({ page }) => {
  await openScouts(page);
  await addEvent(page, { name: 'Camp' });
  await page.click('#v-events [data-act=new][data-v=expense]');
  await page.click('#sheet [data-act=ftype][data-v=transfer]');
  await page.fill('#f-amount', '20');
  await page.click('#sheet [data-act=fsave]');
  const t = (await st(page)).tx[0];
  expect(t.type).toBe('transfer');
  expect(t.eventId).toBeUndefined();
});

test('an LL budget counts LL spending exactly, and a new rate moves nothing', async ({ page }) => {
  await openScouts(page);
  const camp = await addEvent(page, { name: 'Camp', budget: 9000, cur: 'LBP' }); // 9,000,000 LL
  await page.click('#v-events [data-act=new][data-v=expense]');
  await page.click('#sheet [data-act=fcur][data-v=LBP]');
  await page.fill('#f-amount', '4500');
  await page.click('#sheet [data-act=fsave]');
  const budget = () =>
    page.evaluate((id) => {
      const e = window.__scouts.state.events.find((x) => x.id === id);
      return window.__scouts.eventBudget(e);
    }, camp);
  expect((await budget()).spent).toBe(4500000);
  expect((await budget()).pct).toBe(0.5);
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('#rate', '100000');
  await page.locator('#rate').blur();
  expect((await budget()).spent).toBe(4500000);
});

test('a finished event leaves the entry form, and can be reopened', async ({ page }) => {
  await openScouts(page);
  const camp = await addEvent(page, { name: 'Camp' });
  await page.click('[data-act=editEvent]');
  await page.click('#sheet [data-act=eventClose]');
  expect((await st(page)).events[0].closed).toBe(true);
  await page.click('[data-act=eventsAll]');
  await expect(page.locator('#v-events .pill')).toHaveText('Finished');
  await page.click('[data-act=nav][data-v=home]');
  await page.click('.btn[data-act=new][data-v=expense]');
  // The only event is finished, so there is nothing to pick.
  await expect(page.locator('#sheet [data-f=eventId]')).toHaveCount(0);
  await page.click('#sheet [data-act=close]');
  await page.click('[data-act=nav][data-v=events]');
  await page.click(`[data-act=eventView][data-id="${camp}"]`);
  await page.click('[data-act=editEvent]');
  await page.click('#sheet [data-act=eventClose]');
  expect((await st(page)).events[0].closed).toBe(false);
});

test('deleting an event keeps its entries, and Undo links them again', async ({ page }) => {
  await openScouts(page);
  const camp = await addEvent(page, { name: 'Camp' });
  await page.click('#v-events [data-act=new][data-v=expense]');
  await page.fill('#f-amount', '30');
  await page.click('#sheet [data-act=fsave]');
  await page.click('[data-act=editEvent]');
  await expect(page.locator('#sheet .note')).toContainText('1 entry belongs');
  await page.click('#sheet [data-act=fdel]');
  await page.click('#sheet [data-act=fdel]');
  let s = await st(page);
  expect(s.events).toEqual([]);
  expect(s.tx.map((t) => [t.amount, t.eventId])).toEqual([[30, undefined]]);
  await page.click('#toast [data-act=undo]');
  s = await st(page);
  expect(s.events.map((e) => e.id)).toEqual([camp]);
  expect(s.tx[0].eventId).toBe(camp);
});

test('an event needs a name, and can’t end before it starts', async ({ page }) => {
  await openScouts(page);
  await page.click('[data-act=nav][data-v=events]');
  await page.click('[data-act=newEvent]');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('name');
  await page.fill('#sheet [data-f=name]', 'Camp');
  await page.fill('#sheet [data-f=start]', '2026-07-10');
  await page.fill('#sheet [data-f=end]', '2026-07-01');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('before the start');
  expect((await st(page)).events).toEqual([]);
});

/* ---------- members, dues and fees ---------- */

async function addMember(page, name, { leader = false, unit = '' } = {}) {
  await page.click('[data-act=nav][data-v=members]');
  await page.click('[data-act=newMember]');
  await page.fill('#sheet [data-f=name]', name);
  if (leader) await page.click('#sheet [data-act=frole][data-v=leader]');
  if (unit) await page.fill('#sheet [data-f=unit]', unit);
  await page.click('#sheet [data-act=fsave]');
  return page.evaluate((n) => window.__scouts.state.members.find((m) => m.name === n).id, name);
}

/** Creates a fee for every member still in the group and leaves its page open. */
async function addFee(page, { name, amount, cur, untick = [] }) {
  await page.click('[data-act=nav][data-v=members]');
  await page.click('[data-act=newFee]');
  await page.fill('#sheet [data-f=name]', name);
  if (cur) await page.click(`#sheet [data-act=fcur][data-v=${cur}]`);
  await page.fill('#f-amount', String(amount));
  for (const id of untick) await page.uncheck(`#sheet [data-feemember="${id}"]`);
  await page.click('#sheet [data-act=fsave]');
  return page.evaluate(() => window.__scouts.state.fees.at(-1).id);
}

const feeStatus = (page, id) => page.evaluate((x) => window.__scouts.feeStatus(x), id);

test('a fee tracks who has paid, part paid or not paid, and Home shows what is still owed', async ({
  page,
}) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali', { unit: 'Cubs' });
  const maya = await addMember(page, 'Maya');
  await addMember(page, 'Sam');
  const dues = await addFee(page, { name: 'Dues 2026', amount: 50 });
  await expect(page.locator('#v-members .acct-name h2')).toHaveText('Dues 2026');
  // "Paid" fills in what the member still owes; Ali pays in full.
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await expect(page.locator('#f-amount')).toHaveValue('50');
  await page.click('#sheet [data-act=fsave]');
  // Maya pays part.
  await page.click(`[data-act=newPayment][data-member="${maya}"]`);
  await page.fill('#f-amount', '20');
  await page.click('#sheet [data-act=fsave]');
  const fs = await feeStatus(page, dues);
  expect(fs.members.map((m) => m.state)).toEqual(['paid', 'part', 'unpaid']);
  expect([fs.expected, fs.collected, fs.outstanding, fs.paidCount]).toEqual([150, 70, 80, 1]);
  // Who still owes is listed first.
  await expect(page.locator('#v-members .row .row-title').first()).toContainText('Sam');
  await expect(page.locator('#v-members .row .row-sub').first()).toContainText('Not paid');
  const income = (await st(page)).tx;
  expect(income.map((t) => [t.type, t.memberId, t.feeId, t.categoryId])).toEqual([
    ['income', ali, dues, 'dues'],
    ['income', maya, dues, 'dues'],
  ]);
  expect((await bal(page)).wallet.USD).toBe(70);
  await page.click('[data-act=nav][data-v=home]');
  await expect(page.locator('#v-home')).toContainText('Still owed by members');
  await expect(page.locator('#v-home')).toContainText('$80');
});

test('a payment in lira toward a dollar fee counts at its own rate', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const dues = await addFee(page, { name: 'Dues', amount: 50 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fcur][data-v=LBP]');
  await page.fill('#f-amount', '2237.5'); // 2,237,500 LL at 89,500 = $25
  await page.click('#sheet [data-act=fsave]');
  expect((await feeStatus(page, dues)).outstanding).toBe(25);
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('#rate', '100000');
  await page.locator('#rate').blur();
  expect((await feeStatus(page, dues)).outstanding).toBe(25);
});

test('income can be recorded as a member’s payment from the entry form', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const dues = await addFee(page, { name: 'Dues', amount: 30 });
  await page.click('[data-act=nav][data-v=home]');
  await page.click('.btn[data-act=new][data-v=income]');
  await page.fill('#f-amount', '30');
  // The fee picker appears once a member is picked, offering only that member's fees.
  await expect(page.locator('#sheet [data-f=feeId]')).toHaveCount(0);
  await page.selectOption('#sheet [data-f=memberId]', ali);
  await page.selectOption('#sheet [data-f=feeId]', dues);
  await page.click('#sheet [data-act=fsave]');
  expect((await feeStatus(page, dues)).paidCount).toBe(1);
  await expect(page.locator('#v-home .row-sub').first()).toContainText('Ali');
  // An expense has no member or fee.
  await page.click('.btn[data-act=new][data-v=expense]');
  await expect(page.locator('#sheet [data-f=memberId]')).toHaveCount(0);
});

test('a fee can leave members out, and a camp fee brings its event to the payment', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const lea = await addMember(page, 'Lea', { leader: true });
  const camp = await addEvent(page, { name: 'Summer camp' });
  await page.click('[data-act=nav][data-v=members]');
  await page.click('[data-act=newFee]');
  await page.fill('#sheet [data-f=name]', 'Camp fee');
  await page.fill('#f-amount', '100');
  await page.selectOption('#sheet [data-f=eventId]', camp);
  await page.uncheck(`#sheet [data-feemember="${lea}"]`);
  await expect(page.locator('#sheet .who-head')).toContainText('Who pays (1)');
  await page.click('#sheet [data-act=fsave]');
  const fee = (await st(page)).fees[0];
  expect([fee.memberIds, fee.eventId]).toEqual([[ali], camp]);
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fsave]');
  expect((await st(page)).tx[0].eventId).toBe(camp);
  const t = await page.evaluate((id) => window.__scouts.eventTotals(id, 'USD'), camp);
  expect(t.earned).toBe(100);
});

test('a member who left keeps their payments; one with none can be deleted', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const sam = await addMember(page, 'Sam');
  const dues = await addFee(page, { name: 'Dues', amount: 10 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fsave]');
  // Ali has a payment, so they can only be marked as left.
  await page.click('[data-act=peopleAll]');
  await page.click(`[data-act=memberView][data-id="${ali}"]`);
  await page.click('[data-act=editMember]');
  await expect(page.locator('#sheet [data-act=fdel]')).toHaveCount(0);
  await page.click('#sheet [data-act=memberActive]');
  expect((await st(page)).members.find((m) => m.id === ali).active).toBe(false);
  await page.click('[data-act=peopleAll]');
  await expect(page.locator('#v-members')).toContainText('Left the group');
  // Sam has none: deleting takes them off the fee, and Undo puts them back.
  await page.click(`[data-act=memberView][data-id="${sam}"]`);
  await page.click('[data-act=editMember]');
  await page.click('#sheet [data-act=fdel]');
  await page.click('#sheet [data-act=fdel]');
  let s = await st(page);
  expect(s.members.map((m) => m.id)).toEqual([ali]);
  expect(s.fees[0].memberIds).toEqual([ali]);
  await page.click('#toast [data-act=undo]');
  s = await st(page);
  expect(s.members.map((m) => m.id).sort()).toEqual([ali, sam].sort());
  expect(s.fees[0].memberIds.sort()).toEqual([ali, sam].sort());
  expect((await feeStatus(page, dues)).paidCount).toBe(1);
});

test('deleting a fee keeps its payments as income, and Undo links them again', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const dues = await addFee(page, { name: 'Dues', amount: 10 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fsave]');
  await page.click('[data-act=editFee]');
  await expect(page.locator('#sheet')).toContainText('1 payment was made');
  await page.click('#sheet [data-act=fdel]');
  await page.click('#sheet [data-act=fdel]');
  let s = await st(page);
  expect(s.fees).toEqual([]);
  expect(s.tx.map((t) => [t.type, t.amount, t.memberId, t.feeId])).toEqual([['income', 10, ali, undefined]]);
  await page.click('#toast [data-act=undo]');
  s = await st(page);
  expect(s.fees.map((f) => f.id)).toEqual([dues]);
  expect(s.tx[0].feeId).toBe(dues);
});

test('a fee needs a name and an amount; a member needs a name', async ({ page }) => {
  await openScouts(page);
  await page.click('[data-act=nav][data-v=members]');
  await page.click('[data-act=newMember]');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('name');
  await page.click('#sheet [data-act=close]');
  await page.click('[data-act=newFee]');
  await page.fill('#sheet [data-f=name]', 'Dues');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('each member pays');
  const s = await st(page);
  expect([s.members, s.fees]).toEqual([[], []]);
});
