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
/** Adds a fund in Settings and returns its id. Leaves Settings open. */
async function addFund(page, name) {
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('#newAcc', name);
  await page.click('[data-act=accAdd]');
  return page.evaluate((n) => window.__scouts.state.accounts.find((a) => a.name === n).id, name);
}

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

test('opens with only the caisse, empty, and no list of funds', async ({ page }) => {
  await openScouts(page);
  await expect(page).toHaveTitle('Frata Scouts');
  const s = await st(page);
  expect(s.app).toBe('frata-scouts');
  expect(s.accounts.map((a) => a.name)).toEqual(['Caisse']);
  expect(await bal(page)).toEqual({ wallet: { USD: 0, LBP: 0 } });
  // On its own, the caisse needs no card: the total says what it holds.
  await expect(page.locator('.acc')).toHaveCount(0);
  await expect(page.locator('.balance-total')).toContainText('in the caisse');
  // A second fund brings the list of funds.
  await addFund(page, 'Bank');
  await page.click('[data-act=nav][data-v=home]');
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
  const bank = await addFund(page, 'Bank');
  await page.click('[data-act=nav][data-v=home]');
  await addEntry(page, { type: 'income', amount: 100 });
  await addEntry(page, { type: 'transfer', amount: 40, to: bank });
  expect(await bal(page)).toEqual({ wallet: { USD: 60, LBP: 0 }, [bank]: { USD: 40, LBP: 0 } });
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
  const bank = await addFund(page, 'Bank');
  await page.fill(`[data-accname="${bank}"]`, 'Bank Audi');
  // Tapping straight from the field to another button: the rename saves and the tap still works.
  await page.click('[data-act=setTheme][data-v=dark]');
  const s = await st(page);
  expect(s.accounts.find((a) => a.id === bank).name).toBe('Bank Audi');
  expect(s.settings.theme).toBe('dark');
  await page.reload();
  await page.waitForFunction(() => window.__scouts);
  expect((await st(page)).accounts.find((a) => a.id === bank).name).toBe('Bank Audi');
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
  expect(s.accounts.map((a) => a.name)).toEqual(['Caisse', 'Camp savings']);
  const camp = s.accounts[1].id;
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
  // With only the caisse, its name above the total opens its page.
  await page.click('#v-home .balance-head [data-act=accView][data-id=wallet]');
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
  await expect(tab.locator('.balance-total')).toContainText('in the caisse');
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
  // Putting it in the event put it in the event's own account.
  expect([(await st(page)).tx[0].eventId, (await st(page)).tx[0].account]).toEqual([hike, 'camp-' + hike]);
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
  await page.click('[data-act=nav][data-v=history]');
  await page.locator('#v-history [data-act=editTx]').last().click();
  await page.selectOption('#sheet [data-f=eventId]', '');
  await page.click('#sheet [data-act=fsave]');
  // Taken out of the event, it goes back to the caisse.
  expect([(await st(page)).tx[0].eventId, (await st(page)).tx[0].account]).toEqual([undefined, 'wallet']);
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
  // An entry in the event but paid from the caisse, so the camp's own account stays empty.
  await page.click('#v-events [data-act=new][data-v=expense]');
  await page.fill('#f-amount', '30');
  await page.selectOption('#sheet [data-f=account]', 'wallet');
  await page.click('#sheet [data-act=fsave]');
  await page.click('[data-act=editEvent]');
  await expect(page.locator('#sheet')).toContainText('1 entry belongs');
  await page.click('#sheet [data-act=fdel]');
  await page.click('#sheet [data-act=fdel]');
  let s = await st(page);
  expect(s.events).toEqual([]);
  expect(s.tx.map((t) => [t.amount, t.eventId])).toEqual([[30, undefined]]);
  expect(s.accounts.some((a) => a.id === 'camp-' + camp)).toBe(false);
  await page.click('#toast [data-act=undo]');
  s = await st(page);
  expect(s.events.map((e) => e.id)).toEqual([camp]);
  expect(s.tx[0].eventId).toBe(camp);
  expect(s.accounts.some((a) => a.id === 'camp-' + camp)).toBe(true);
});

test('a camp whose account has entries can’t be deleted, only finished', async ({ page }) => {
  await openScouts(page);
  await addEvent(page, { name: 'Camp' });
  await page.click('#v-events [data-act=new][data-v=income]');
  await page.fill('#f-amount', '30');
  await page.click('#sheet [data-act=fsave]');
  await page.click('[data-act=editEvent]');
  await expect(page.locator('#sheet [data-act=fdel]')).toHaveCount(0);
  await expect(page.locator('#sheet')).toContainText('can’t be deleted');
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

/* ---------- members, camps and cotisations ---------- */

async function addMember(page, name, { leader = false } = {}) {
  await page.click('[data-act=nav][data-v=members]');
  await page.click('[data-act=newMember]');
  await page.fill('#sheet [data-f=name]', name);
  if (leader) await page.click('#sheet [data-act=frole][data-v=leader]');
  await page.click('#sheet [data-act=fsave]');
  return page.evaluate((n) => window.__scouts.state.members.find((m) => m.name === n).id, name);
}

/**
 * Creates a camp with a cotisation and ticks who attends (everyone, unless `attend` lists them).
 * Leaves the camp's page open and returns its id.
 */
async function addCamp(page, { name, cotisation, cur, budget, attend }) {
  await page.click('[data-act=nav][data-v=events]');
  await page.click('[data-act=newEvent]');
  await page.fill('#sheet [data-f=name]', name);
  if (cur) await page.click(`#sheet [data-act=fcotcur][data-v=${cur}]`);
  if (cotisation != null) await page.fill('#f-cot', String(cotisation));
  if (budget != null) await page.fill('#f-amount', String(budget));
  if (attend) for (const id of attend) await page.check(`#sheet [data-attendee="${id}"]`);
  else await page.click('#sheet [data-act=attAll]');
  await page.click('#sheet [data-act=fsave]');
  return page.evaluate(() => window.__scouts.state.events.at(-1).id);
}

const cotisation = (page, id) => page.evaluate((x) => window.__scouts.feeStatus(x), id);

test('a camp’s attendees pay its cotisation: paid, part paid and not paid', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const maya = await addMember(page, 'Maya');
  await addMember(page, 'Sam');
  const camp = await addCamp(page, { name: 'Camp HP', cotisation: 50, budget: 400 });
  await expect(page.locator('#v-events .acct-name h2')).toHaveText('Camp HP');
  await expect(page.locator('#v-events')).toContainText('Attending (3)');
  // "Record" fills in what the attendee still owes; Ali pays in full, Maya part of it.
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await expect(page.locator('#f-amount')).toHaveValue('50');
  await page.click('#sheet [data-act=fsave]');
  await page.click(`[data-act=newPayment][data-member="${maya}"]`);
  await page.fill('#f-amount', '20');
  await page.click('#sheet [data-act=fsave]');
  const c = await cotisation(page, camp);
  expect(c.members.map((m) => m.state)).toEqual(['paid', 'part', 'unpaid']);
  expect([c.expected, c.collected, c.outstanding, c.paidCount]).toEqual([150, 70, 80, 1]);
  // Who still owes is listed first.
  await expect(page.locator('#v-events .row .row-title').first()).toContainText('Sam');
  await expect(page.locator('#v-events .row .row-sub').first()).toContainText('Not paid');
  // Payments are the camp's income, in the caisse.
  const s = await st(page);
  expect(s.tx.map((t) => [t.type, t.memberId, t.feeId, t.eventId, t.categoryId])).toEqual([
    ['income', ali, camp, camp, 'dues'],
    ['income', maya, camp, camp, 'dues'],
  ]);
  expect(await page.evaluate((id) => window.__scouts.eventTotals(id, 'USD').earned, camp)).toBe(70);
  // Cotisations go into the camp's own account, not the caisse.
  expect((await bal(page))['camp-' + camp].USD).toBe(70);
  expect((await bal(page)).wallet.USD).toBe(0);
  await page.click('[data-act=nav][data-v=home]');
  await expect(page.locator('#v-home')).toContainText('Cotisations still owed');
  await expect(page.locator('#v-home')).toContainText('$80');
});

test('a cotisation paid in lira counts at its own rate', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const camp = await addCamp(page, { name: 'Camp Noël', cotisation: 50 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fcur][data-v=LBP]');
  await page.fill('#f-amount', '2237.5'); // 2,237,500 LL at 89,500 = $25
  await page.click('#sheet [data-act=fsave]');
  expect((await cotisation(page, camp)).outstanding).toBe(25);
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('#rate', '100000');
  await page.locator('#rate').blur();
  expect((await cotisation(page, camp)).outstanding).toBe(25);
});

test('a cotisation can be recorded from the income form, and puts the entry in the camp', async ({
  page,
}) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const camp = await addCamp(page, { name: 'Camp Pâques', cotisation: 30 });
  await page.click('[data-act=nav][data-v=home]');
  await page.click('.btn[data-act=new][data-v=income]');
  await page.fill('#f-amount', '30');
  // The cotisation picker appears once a member is picked, offering only the camps they attend.
  await expect(page.locator('#sheet [data-f=feeId]')).toHaveCount(0);
  await page.selectOption('#sheet [data-f=memberId]', ali);
  await page.selectOption('#sheet [data-f=feeId]', camp);
  await expect(page.locator('#sheet [data-f=eventId]')).toHaveValue(camp);
  await page.click('#sheet [data-act=fsave]');
  expect((await cotisation(page, camp)).paidCount).toBe(1);
  const t = (await st(page)).tx[0];
  expect([t.eventId, t.account, t.memberId]).toEqual([camp, 'camp-' + camp, ali]);
  // An expense has no member.
  await page.click('.btn[data-act=new][data-v=expense]');
  await expect(page.locator('#sheet [data-f=memberId]')).toHaveCount(0);
});

test('only the ticked members attend, and a camp can have no cotisation', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  await addMember(page, 'Lea', { leader: true });
  const hike = await addCamp(page, { name: 'Sortie', attend: [ali] });
  const e = (await st(page)).events.find((x) => x.id === hike);
  expect([e.attendees, e.cotisation]).toEqual([[ali], null]);
  await expect(page.locator('#v-events')).toContainText('Attending (1)');
  await expect(page.locator('#v-events [data-act=newPayment]')).toHaveCount(0);
});

test('a cotisation can’t be removed once payments are recorded toward it', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  await addCamp(page, { name: 'Camp HP', cotisation: 40 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fsave]');
  await page.click('[data-act=editEvent]');
  await page.fill('#f-cot', '');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('already recorded');
  expect((await st(page)).events[0].cotisation).toEqual({ amount: 40, currency: 'USD' });
});

test('a member’s page shows their cotisations and payments', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  await addCamp(page, { name: 'Camp HP', cotisation: 40 });
  await addCamp(page, { name: 'Camp d’été', cotisation: 120 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fsave]');
  await page.click('[data-act=nav][data-v=members]');
  await expect(page.locator('#v-members .row').first()).toContainText('owes $40');
  await page.click(`[data-act=memberView][data-id="${ali}"]`);
  await expect(page.locator('#v-members .row-title')).toContainText(['Camp HP', 'Camp d’été']);
  await expect(page.locator('#v-members')).toContainText('Payments');
});

test('a member who left keeps their payments; one with none can be deleted', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const sam = await addMember(page, 'Sam');
  const camp = await addCamp(page, { name: 'Camp HP', cotisation: 10 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fsave]');
  // Ali has a payment, so they can only be marked as left.
  await page.click('[data-act=nav][data-v=members]');
  await page.click(`[data-act=memberView][data-id="${ali}"]`);
  await page.click('[data-act=editMember]');
  await expect(page.locator('#sheet [data-act=fdel]')).toHaveCount(0);
  await page.click('#sheet [data-act=memberActive]');
  expect((await st(page)).members.find((m) => m.id === ali).active).toBe(false);
  await page.click('[data-act=peopleAll]');
  await expect(page.locator('#v-members')).toContainText('Left the group');
  // Sam has none: deleting takes them off the camp, and Undo puts them back.
  await page.click(`[data-act=memberView][data-id="${sam}"]`);
  await page.click('[data-act=editMember]');
  await page.click('#sheet [data-act=fdel]');
  await page.click('#sheet [data-act=fdel]');
  let s = await st(page);
  expect(s.members.map((m) => m.id)).toEqual([ali]);
  expect(s.events[0].attendees).toEqual([ali]);
  await page.click('#toast [data-act=undo]');
  s = await st(page);
  expect(s.events[0].attendees.sort()).toEqual([ali, sam].sort());
  expect((await cotisation(page, camp)).paidCount).toBe(1);
});

test('the member form asks only for a name and role, and needs a name', async ({ page }) => {
  await openScouts(page);
  await page.click('[data-act=nav][data-v=members]');
  await page.click('[data-act=newMember]');
  await expect(page.locator('#sheet [data-f=unit]')).toHaveCount(0);
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#f-err')).toContainText('name');
  expect((await st(page)).members).toEqual([]);
});

test('the unité’s name is set once in Settings and shown on Home', async ({ page }) => {
  await openScouts(page);
  await page.click('[data-act=nav][data-v=settings]');
  await page.fill('#groupName', 'Unité Saint-Joseph');
  await page.locator('#groupName').blur();
  await page.click('[data-act=nav][data-v=home]');
  await expect(page.locator('.balance-head')).toContainText('Unité Saint-Joseph');
});

test('the caisse counts this year’s entries outside camps, and History can show just those', async ({
  page,
}) => {
  await openScouts(page);
  await addEntry(page, { type: 'expense', amount: 30, note: 'Rent' });
  await addEntry(page, { type: 'income', amount: 100, note: 'Donation' });
  const camp = await addEvent(page, { name: 'Camp HP' });
  await page.click('#v-events [data-act=new][data-v=expense]');
  await page.fill('#f-amount', '45');
  await page.click('#sheet [data-act=fsave]');
  await page.click('[data-act=nav][data-v=home]');
  const general = page.locator('#v-home .sec', { hasText: 'Caisse ' + new Date().getFullYear() });
  await expect(general).toContainText('$30');
  await expect(general).toContainText('$100');
  await expect(general).toContainText('+$70');
  await page.click('[data-act=historyGeneral]');
  await expect(page.locator('#hevent')).toHaveValue('general');
  await expect(page.locator('#v-history .list .row')).toHaveCount(2);
  await page.selectOption('#hevent', camp);
  await expect(page.locator('#v-history .list .row')).toHaveCount(1);
  await expect(page.locator('#v-history .stat').first()).toContainText('$45');
});

/* ---------- recording in one step, Home's tabs, and camps' own accounts ---------- */

test('Record asks only for the amount, then records the cotisation straight away', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  const camp = await addCamp(page, { name: 'Camp HP', cotisation: 40 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await expect(page.locator('#sheet')).toContainText('Ali');
  await expect(page.locator('#f-amount')).toHaveValue('40');
  // Only the amount: no fund, category, date or member to choose.
  for (const f of ['account', 'categoryId', 'date', 'memberId', 'feeId', 'eventId'])
    await expect(page.locator(`#sheet [data-f=${f}]`)).toHaveCount(0);
  await page.fill('#f-amount', '25');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#sheet')).toBeHidden();
  const t = (await st(page)).tx[0];
  expect([t.type, t.amount, t.memberId, t.feeId, t.eventId, t.account, t.categoryId]).toEqual([
    'income',
    25,
    ali,
    camp,
    camp,
    'camp-' + camp,
    'dues',
  ]);
  // A slip can be undone.
  await page.click('#toast [data-act=undo]');
  expect((await st(page)).tx).toEqual([]);
});

test('Home has a tab for the caisse and one for each open camp', async ({ page }) => {
  await openScouts(page);
  await expect(page.locator('.home-tabs')).toHaveCount(0); // no camps yet
  const hp = await addEvent(page, { name: 'Camp HP' });
  await addEvent(page, { name: 'Camp Noël' });
  await page.click('[data-act=nav][data-v=home]');
  await expect(page.locator('.home-tabs button')).toHaveText(['Caisse', 'Camp HP', 'Camp Noël']);
  await expect(page.locator('.home-tabs [aria-pressed=true]')).toHaveText('Caisse');
  await page.click(`[data-act=homeTab][data-v="${hp}"]`);
  await expect(page.locator('#v-home .acct-name h2')).toHaveText('Camp HP');
  await expect(page.locator('#v-home [data-act=eventsAll]')).toHaveCount(0);
  // An expense added from the camp's tab is the camp's, from its account.
  await page.click('#fab');
  await page.fill('#f-amount', '15');
  await page.click('#sheet [data-act=fsave]');
  const t = (await st(page)).tx[0];
  expect([t.eventId, t.account]).toEqual([hp, 'camp-' + hp]);
  // The caisse tab leaves camps' accounts out: with only the caisse, there is no list of funds.
  await page.click('[data-act=homeTab][data-v=caisse]');
  await expect(page.locator('#v-home .acc')).toHaveCount(0);
});

test('finishing a camp sends what is left back to the caisse and removes its tab', async ({ page }) => {
  await openScouts(page);
  const hp = await addEvent(page, { name: 'Camp HP' });
  await page.click('#v-events [data-act=new][data-v=income]');
  await page.fill('#f-amount', '100');
  await page.click('#sheet [data-act=fsave]');
  await page.click('#v-events [data-act=new][data-v=expense]');
  await page.fill('#f-amount', '60');
  await page.click('#sheet [data-act=fsave]');
  await expect(page.locator('#v-events .acct-name')).toContainText('$40 in the camp’s account');
  await page.click('[data-act=editEvent]');
  await page.click('#sheet [data-act=eventClose]');
  const b = await bal(page);
  expect([b['camp-' + hp].USD, b.wallet.USD]).toEqual([0, 40]);
  await page.click('[data-act=nav][data-v=home]');
  await expect(page.locator('.home-tabs')).toHaveCount(0);
  // Reopening brings back the camp and its account.
  await page.click('[data-act=nav][data-v=events]');
  await page.click(`[data-act=eventView][data-id="${hp}"]`);
  await page.click('[data-act=editEvent]');
  await page.click('#sheet [data-act=eventClose]');
  expect((await st(page)).accounts.find((a) => a.id === 'camp-' + hp).hidden).toBeUndefined();
});

/* ---------- long forms, and sections that fold ---------- */

test('with many members, every one can be reached and ticked in the event form', async ({ page }) => {
  const members = Array.from({ length: 30 }, (_, i) => ({
    id: 'm' + i,
    name: 'Member ' + (i + 1),
    role: 'scout',
    active: true,
  }));
  await openScouts(page, {
    storage: {
      [KEY]: JSON.stringify({
        app: 'frata-scouts',
        tx: [],
        members,
        events: [{ id: 'hp', name: 'Camp HP', start: '2026-12-26' }],
      }),
    },
  });
  await page.click('[data-act=nav][data-v=events]');
  await page.click('[data-act=eventView][data-id=hp]');
  await page.click('[data-act=editEvent]');
  // The list is never squeezed to a sliver: every row has its full height, and the sheet scrolls instead.
  const m = await page.evaluate(() => {
    const who = document.querySelector('#sheet .who');
    return { shown: who.clientHeight, needed: who.scrollHeight };
  });
  expect(m.shown).toBeGreaterThanOrEqual(m.needed - 2);
  // The last member can be scrolled to and ticked, and Save is still in reach there.
  await page.locator('#sheet [data-attendee=m29]').scrollIntoViewIfNeeded();
  await page.check('#sheet [data-attendee=m29]');
  await expect(page.locator('#sheet .who-head')).toContainText('Attending (1)');
  await expect(page.locator('#sheet [data-act=fsave]')).toBeInViewport();
  await page.click('#sheet [data-act=fsave]');
  expect((await st(page)).events[0].attendees).toEqual(['m29']);
});

test('sections fold to a summary, and stay folded after a reload', async ({ page }) => {
  await openScouts(page);
  await addEntry(page, { type: 'income', amount: 100, note: 'Donation' });
  const latest = page.locator('#v-home .fold', { has: page.locator('[data-act=fold][data-v=latest]') });
  await expect(latest.locator('.list .row')).toHaveCount(1);
  await expect(latest.locator('.fold-sum')).toHaveCount(0);
  await latest.locator('[data-act=fold]').click();
  await expect(latest.locator('.list')).toHaveCount(0);
  await expect(latest.locator('.fold-sum')).toHaveText('1 entry');
  expect((await st(page)).settings.fold).toEqual({ latest: true });
  // The caisse's year folds to its net.
  const year = page.locator('#v-home .fold', { has: page.locator('[data-act=fold][data-v=caisseYear]') });
  await year.locator('[data-act=fold]').click();
  await expect(year.locator('.stats')).toHaveCount(0);
  await expect(year.locator('.fold-sum')).toContainText('Net +$100');
  await page.reload();
  await page.waitForFunction(() => window.__scouts);
  await expect(latest.locator('.list')).toHaveCount(0);
  await latest.locator('[data-act=fold]').click();
  await expect(latest.locator('.list .row')).toHaveCount(1);
  expect((await st(page)).settings.fold).toEqual({ caisseYear: true });
});

test('every section of an event’s page folds, with something useful to say when shut', async ({ page }) => {
  await openScouts(page);
  const ali = await addMember(page, 'Ali');
  await addMember(page, 'Maya');
  await addCamp(page, { name: 'Camp HP', cotisation: 40, budget: 400 });
  await page.click(`[data-act=newPayment][data-member="${ali}"]`);
  await page.click('#sheet [data-act=fsave]');
  await page.click('#v-events [data-act=new][data-v=expense]');
  await page.fill('#f-amount', '25');
  await page.click('#sheet [data-act=fsave]');
  const keys = ['evTotals', 'evAttending', 'evBudget', 'evSpend', 'evEntries'];
  for (const k of keys) await page.click(`#v-events [data-act=fold][data-v=${k}]`);
  expect(Object.keys((await st(page)).settings.fold).sort()).toEqual([...keys].sort());
  const sum = (k) =>
    page
      .locator('#v-events .fold', { has: page.locator(`[data-act=fold][data-v=${k}]`) })
      .locator('.fold-sum');
  await expect(sum('evTotals')).toContainText('Net +$15');
  await expect(sum('evAttending')).toHaveText('1 of 2 paid');
  await expect(sum('evBudget')).toContainText('$25 / $400');
  await expect(sum('evSpend')).toContainText('$25');
  await expect(sum('evEntries')).toHaveText('2 entries');
  // Nothing but headings is left to scroll past, and the Add buttons stay.
  await expect(page.locator('#v-events .list')).toHaveCount(0);
  await expect(page.locator('#v-events [data-act=new][data-v=expense]')).toBeVisible();
});

test('Members, Events and Settings fold too, and a rate waiting for an answer stays open', async ({
  page,
}) => {
  await openScouts(page);
  await addMember(page, 'Ali');
  await page.click('[data-act=fold][data-v=memList]');
  await expect(page.locator('#v-members .row')).toHaveCount(0);
  await page.click('[data-act=fold][data-v=memList]');
  await expect(page.locator('#v-members .row')).toHaveCount(1);
  await page.click('[data-act=nav][data-v=events]');
  await page.click('[data-act=fold][data-v=evRunning]');
  await expect(page.locator('#v-events .fold-sum')).toHaveText('0 camps');
  await page.click('[data-act=nav][data-v=settings]');
  await page.click('[data-act=fold][data-v=setFunds]');
  await expect(page.locator('#newAcc')).toHaveCount(0);
  await page.click('[data-act=fold][data-v=setFunds]');
  await expect(page.locator('#newAcc')).toBeVisible();
  // A big rate change waits for an answer, so its section can't be folded away from under it.
  await page.fill('#rate', '895');
  await page.locator('#rate').blur();
  await expect(page.locator('[data-act=rateConfirm]')).toBeVisible();
  await page.click('[data-act=fold][data-v=setRate]');
  await expect(page.locator('[data-act=rateConfirm]')).toBeVisible();
});
