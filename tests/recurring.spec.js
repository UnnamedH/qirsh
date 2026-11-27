/* Recurring entries (Frata Plus): set up in Settings, due on Home, added or skipped with a tap, never by themselves. */
import { test, expect, openApp, appState, unlockPlus } from './helpers.js';

const rent = (over = {}) => ({
  id: 'rent',
  type: 'expense',
  amount: 300,
  currency: 'USD',
  categoryId: 'bills',
  account: 'wallet',
  note: 'Rent',
  every: 'month',
  day: 1,
  next: '2026-11-01',
  ...over,
});

/** Today is 27 November 2026. The app starts with the given recurring entries and none of the examples. */
async function start(page, recurring = [rent()], { plus = true } = {}) {
  await page.clock.install({ time: new Date('2026-11-27T12:00:00') });
  await openApp(page);
  await page.evaluate((r) => {
    const s = window.__qirsh.state;
    s.tx = [];
    s.sample = false;
    s.recurring = r;
  }, recurring);
  if (plus) await unlockPlus(page);
  else await page.click('.tabs [data-act=nav][data-v=home]');
}
const rec = async (page) => (await appState(page)).recurring;
const due = (page) => page.locator('#dueSec');
const goRecurring = async (page) => {
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=setPage][data-v=recurring]');
};

test('a due entry shows on Home, and Add makes the entry dated the day it fell due, then moves on', async ({
  page,
}) => {
  await start(page);
  await expect(due(page)).toContainText('Rent');
  await expect(due(page)).toContainText('$300');
  await page.click('#dueSec [data-act=dueAdd]');
  const s = await appState(page);
  expect(s.tx).toHaveLength(1);
  expect(s.tx[0]).toMatchObject({
    type: 'expense',
    amount: 300,
    currency: 'USD',
    categoryId: 'bills',
    account: 'wallet',
    note: 'Rent',
    date: '2026-11-01',
    rate: s.rate,
  });
  expect(s.recurring[0].next).toBe('2026-12-01');
  await expect(due(page)).toHaveCount(0);
  // Undo puts both back.
  await page.click('#toast [data-act=undo]');
  const back = await appState(page);
  expect(back.tx).toHaveLength(0);
  expect(back.recurring[0].next).toBe('2026-11-01');
  await expect(due(page)).toContainText('Rent');
});

test('Skip adds nothing and moves on; nothing is ever added by itself', async ({ page }) => {
  await start(page);
  // Opening the app, reloading and waiting change nothing.
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  expect((await appState(page)).tx).toHaveLength(0);
  await page.click('#dueSec [data-act=dueSkip]');
  const s = await appState(page);
  expect(s.tx).toHaveLength(0);
  expect(s.recurring[0].next).toBe('2026-12-01');
  await expect(due(page)).toHaveCount(0);
});

test('after a long gap each missed date waits its turn, and Add all takes them in one go', async ({
  page,
}) => {
  await start(page, [rent({ next: '2026-09-15', day: 15 })]);
  await expect(due(page)).toContainText('Due Tue 15 Sep · 2 more after it');
  await expect(due(page).locator('[data-act=dueAll]')).toHaveText('Add all 3');
  await page.click('#dueSec [data-act=dueAdd]');
  await expect(due(page)).toContainText('Due Thu 15 Oct · 1 more after it');
  await page.click('#toast [data-act=undo]');
  expect((await rec(page))[0].next).toBe('2026-09-15');
  await page.click('#dueSec [data-act=dueAll]');
  const s = await appState(page);
  expect(s.tx.map((t) => t.date).sort()).toEqual(['2026-09-15', '2026-10-15', '2026-11-15']);
  expect(s.recurring[0].next).toBe('2026-12-15');
  await expect(due(page)).toHaveCount(0);
  await page.click('#toast [data-act=undo]');
  expect((await appState(page)).tx).toHaveLength(0);
  expect((await rec(page))[0].next).toBe('2026-09-15');
});

test('a monthly entry on the 31st falls on the last day of a short month, then back to the 31st', async ({
  page,
}) => {
  await start(page, [rent({ id: 'x', day: 31, next: '2026-01-31' })]);
  await page.click('#dueSec [data-act=dueAll]');
  const s = await appState(page);
  // Today is 27 November: all ten dates from January are due, and the latest twelve are offered.
  expect(s.tx.map((t) => t.date).sort()).toEqual([
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
    '2026-05-31',
    '2026-06-30',
    '2026-07-31',
    '2026-08-31',
    '2026-09-30',
    '2026-10-31',
  ]);
  expect(s.recurring[0].next).toBe('2026-11-30');
  expect(s.recurring[0].day).toBe(31);
});

test('tapping the name opens the entry first, for a bill that came to a different amount', async ({
  page,
}) => {
  await start(page);
  await page.click('#dueSec [data-act=dueEdit]');
  await expect(page.locator('#f-pay0')).toHaveValue('300');
  await expect(page.locator('#f-note')).toHaveValue('Rent');
  await expect(page.locator('#f-date')).toHaveValue('2026-11-01');
  // Closing without saving changes nothing: it is still due.
  await page.click('#sheet [data-act=close]');
  await expect(due(page)).toContainText('Rent');
  await page.click('#dueSec [data-act=dueEdit]');
  await page.fill('#f-pay0', '320');
  await page.click('#sheet [data-act=fsave]');
  const s = await appState(page);
  expect(s.tx).toHaveLength(1);
  expect(s.tx[0]).toMatchObject({ amount: 320, date: '2026-11-01', categoryId: 'bills', note: 'Rent' });
  expect(s.recurring[0]).toMatchObject({ amount: 300, next: '2026-12-01' }); // the saved amount is unchanged
  await expect(due(page)).toHaveCount(0);
  await page.click('#toast [data-act=undo]');
  expect((await rec(page))[0].next).toBe('2026-11-01');
});

test('setting one up in Settings: it is checked, saved, and due straight away when its first day has passed', async ({
  page,
}) => {
  await start(page, []);
  await goRecurring(page);
  await page.click('[data-act=recNew]');
  await page.click('#sheet [data-act=recsave]');
  await expect(page.locator('#r-err')).toHaveText('Enter an amount above zero.');
  await page.fill('#r-amount', '300');
  await page.click('#sheet [data-act=recsave]');
  await expect(page.locator('#r-err')).toHaveText('Pick a category.');
  await page.click('#sheet [data-act=rcat][data-v=bills]');
  await page.fill('#r-note', 'Rent');
  await page.fill('#r-date', '');
  await page.click('#sheet [data-act=recsave]');
  await expect(page.locator('#r-err')).toHaveText('Pick the date it is first due.');
  await page.fill('#r-date', '2026-11-01');
  await page.click('#sheet [data-act=recsave]');
  expect((await rec(page))[0]).toMatchObject({
    type: 'expense',
    amount: 300,
    currency: 'USD',
    categoryId: 'bills',
    note: 'Rent',
    every: 'month',
    day: 1,
    next: '2026-11-01',
  });
  await expect(page.locator('#recurringSec')).toContainText('Monthly on the 1st · next');
  await page.click('.tabs [data-act=nav][data-v=home]');
  await expect(due(page)).toContainText('Rent');
});

test('an income repeats into its account, weekly, and an LL amount is typed in thousands', async ({
  page,
}) => {
  await start(page, []);
  await goRecurring(page);
  await page.click('[data-act=recNew]');
  await page.click('#sheet [data-act=rtype][data-v=income]');
  await page.click('#sheet [data-act=rcur][data-v=LBP]');
  await page.fill('#r-amount', '450');
  await page.click('#sheet [data-act=rcat][data-v=salary]');
  await page.selectOption('#r-acct', 'savings');
  await page.click('#sheet [data-act=revery][data-v=week]');
  await page.fill('#r-date', '2026-11-23');
  await page.click('#sheet [data-act=recsave]');
  expect((await rec(page))[0]).toMatchObject({
    type: 'income',
    amount: 450000,
    currency: 'LBP',
    account: 'savings',
    every: 'week',
    next: '2026-11-23',
  });
  expect((await rec(page))[0].day).toBeUndefined();
  await page.click('.tabs [data-act=nav][data-v=home]');
  await expect(due(page)).toContainText('+450,000 LL');
  await page.click('#dueSec [data-act=dueAdd]');
  const s = await appState(page);
  expect(s.tx[0]).toMatchObject({ type: 'income', account: 'savings', date: '2026-11-23', amount: 450000 });
  expect(s.recurring[0].next).toBe('2026-11-30');
});

test('an entry can be changed or deleted, and Undo brings a deleted one back', async ({ page }) => {
  await start(page, [rent({ next: '2026-12-01' })]);
  await goRecurring(page);
  await page.click('[data-act=recEdit][data-id=rent]');
  await page.fill('#r-amount', '350');
  await page.click('#sheet [data-act=recsave]');
  expect((await rec(page))[0].amount).toBe(350);
  await page.click('[data-act=recEdit][data-id=rent]');
  await page.click('#sheet [data-act=recdel]');
  await expect(page.locator('#sheet [data-act=recdel]')).toHaveText('Tap to confirm');
  await page.click('#sheet [data-act=recdel]');
  expect(await rec(page)).toHaveLength(0);
  await page.click('#toast [data-act=undo]');
  expect(await rec(page)).toHaveLength(1);
});

test('without Plus, setting up a new one leads to Plus, but ones already set up still work', async ({
  page,
}) => {
  await start(page, [rent()], { plus: false });
  // What is due can be added, as before.
  await expect(due(page)).toContainText('Rent');
  await goRecurring(page);
  await expect(page.locator('#recurringSec')).toContainText('part of Frata Plus');
  await expect(page.locator('[data-act=recNew]')).toHaveCount(0);
  // Existing entries can be opened and changed.
  await page.click('[data-act=recEdit][data-id=rent]');
  await expect(page.locator('#sheet h2')).toHaveText('Edit recurring entry');
  await page.click('#sheet [data-act=close]');
  await page.click('#recurringSec [data-act=plusOpen]');
  await expect(page.locator('#sheet h2')).toHaveText('Frata Plus');
  await page.click('#sheet [data-act=close]');
  await page.click('.tabs [data-act=nav][data-v=home]');
  await page.click('#dueSec [data-act=dueAdd]');
  expect((await appState(page)).tx).toHaveLength(1);
});

test('deleting a category or removing an account moves recurring entries off it', async ({ page }) => {
  await start(page, [
    rent({ id: 'a', categoryId: 'coffee', next: '2026-12-01' }),
    rent({ id: 'b', account: 'whish', next: '2026-12-01' }),
  ]);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=setPage][data-v=categories]');
  await page.click('[data-act=catEdit]');
  await page.click('[data-act=delCat][data-id=coffee]');
  await page.click('[data-act=delCat][data-id=coffee]');
  expect((await rec(page)).find((r) => r.id === 'a').categoryId).toBe('other');
  await page.click('#v-settings .back-link');
  await page.click('[data-act=setPage][data-v=accounts]');
  await page.click('[data-act=accRemove][data-v=whish]');
  await page.click('[data-act=accRemove][data-v=whish]');
  expect((await rec(page)).find((r) => r.id === 'b').account).toBe('wallet');
});

test('Start fresh keeps recurring entries; Clear all data removes them', async ({ page }) => {
  await start(page, [rent({ next: '2026-12-01' })]);
  await page.evaluate(() => (window.__qirsh.state.sample = true));
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('.tabs [data-act=nav][data-v=home]');
  await page.click('[data-act=clearSample]');
  expect(await rec(page)).toHaveLength(1);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=wipe]');
  await page.click('[data-act=wipe]');
  expect(await rec(page)).toHaveLength(0);
});

test('saved or restored data is repaired, never trusted', async ({ page }) => {
  const good = rent({ id: 'ok', next: '2026-12-01' });
  const data = {
    tx: [],
    recurring: [
      good,
      good, // a repeat of the same id
      { ...good, id: 'cat', categoryId: 'gone' },
      { ...good, id: 'acct', account: 'nowhere' },
      { ...good, id: 'inc', type: 'income', categoryId: 'food' }, // spending category on an income
      { ...good, id: 'week', every: 'week', day: 99 },
      { ...good, id: 'day', day: 99 },
      { ...good, id: 'note', note: 'x'.repeat(500) },
      { ...good, id: 'zero', amount: 0 },
      { ...good, id: 'cur', currency: 'EUR' },
      { ...good, id: 'date', next: '2026-02-30' },
      { ...good, id: 'type', type: 'transfer' },
      { ...good, id: '' },
      'nonsense',
      null,
    ],
  };
  await openApp(page, { storage: { 'qirsh.v1': JSON.stringify(data) } });
  const r = await rec(page);
  const by = (id) => r.find((x) => x.id === id);
  expect(r.map((x) => x.id)).toEqual(['ok', 'cat', 'acct', 'inc', 'week', 'day', 'note']);
  expect(by('cat').categoryId).toBe('other');
  expect(by('acct').account).toBe('wallet');
  expect(by('inc')).toMatchObject({ type: 'income', categoryId: 'other-in' });
  expect(by('week').day).toBeUndefined();
  expect(by('day').day).toBe(31);
  expect(by('note').note).toHaveLength(100);
  // Old data with no list at all gets an empty one.
  const none = await page.evaluate(() => window.__qirsh.normalize({ tx: [] }).recurring);
  expect(none).toEqual([]);
  // The list is capped.
  const many = await page.evaluate(
    (g) =>
      window.__qirsh.normalize({
        tx: [],
        recurring: Array.from({ length: 80 }, (_, i) => ({ ...g, id: 'r' + i })),
      }).recurring.length,
    good,
  );
  expect(many).toBe(50);
});
