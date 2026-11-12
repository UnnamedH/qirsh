import { test, expect, openApp, appState } from './helpers.js';

const alerts = (page) => page.locator('#alerts');
const DAY = 864e5;

/**
 * Writes newer data straight into storage, the way another copy of the app would. A page never gets
 * a `storage` event for its own writes, so this is exactly a save that this copy did not hear about.
 */
const saveElsewhere = (page, amount) =>
  page.evaluate((amount) => {
    const s = JSON.parse(localStorage.getItem('qirsh.v1'));
    s.tx.push({
      id: 'else' + amount,
      type: 'expense',
      amount,
      currency: 'USD',
      categoryId: 'food',
      account: 'wallet',
      date: '2026-11-01',
      createdAt: Date.now(),
    });
    s.savedAt = Date.now() + 1000;
    localStorage.setItem('qirsh.v1', JSON.stringify(s));
  }, amount);

const addCoffee = async (page, amount) => {
  await page.click('#fab');
  await page.fill('#f-pay0', String(amount));
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');
};

const amounts = async (page) => (await appState(page)).tx.map((t) => t.amount).sort((a, b) => a - b);

test('a copy that missed another copy’s save does not write over it', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await addCoffee(page, 3);
  await saveElsewhere(page, 50);

  // This copy still shows the old data. Its next change must not erase the $50 entry.
  await addCoffee(page, 4);
  await expect(alerts(page)).toContainText('changed in another tab or window');
  expect(await amounts(page)).toEqual([3, 50]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('qirsh.v1')).tx.length);
  expect(stored).toBe(2);

  // Making the change again works, and the warning goes away.
  await addCoffee(page, 4);
  await expect(alerts(page)).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  expect(await amounts(page)).toEqual([3, 4, 50]);
});

test('coming back to the app picks up changes made elsewhere', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await addCoffee(page, 3);
  await saveElsewhere(page, 50);
  expect(await amounts(page)).toEqual([3]);

  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(await amounts(page)).toEqual([3, 50]);
  await expect(alerts(page)).toBeHidden();
  await addCoffee(page, 4);
  expect(await amounts(page)).toEqual([3, 4, 50]);
});

test('an app left open overnight shows the new day when you come back', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T22:00:00') });
  await openApp(page);
  await expect(page.locator('#topSub')).toHaveText('Fri 20 November');
  await page.clock.setFixedTime(new Date('2026-11-21T08:00:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#topSub')).toHaveText('Sat 21 November');
});

/* ---------- backup reminder ---------- */

const reminder = (page) => alerts(page).locator('[data-act=backupNow]');
const stateWith = (entryAgeDays, extra = {}) => ({
  'qirsh.v1': JSON.stringify({
    tx: [
      {
        id: 'a',
        type: 'expense',
        amount: 5,
        currency: 'USD',
        categoryId: 'food',
        date: '2026-10-01',
        createdAt: Date.now() - entryAgeDays * DAY,
      },
    ],
    ...extra,
  }),
});

test('a reminder appears when entries have gone a month without a backup', async ({ page }) => {
  await openApp(page, { storage: stateWith(40) });
  await expect(alerts(page)).toContainText('You haven’t made a backup yet');

  // "Back up" opens the Backup section in Settings.
  await reminder(page).click();
  await expect(page.locator('#backupSec')).toBeInViewport();
  await expect(reminder(page)).toHaveCount(0);

  // "Later" hides it, and it stays hidden after a reload.
  await page.click('.tabs [data-act=nav][data-v=home]');
  await page.click('[data-act=backupLater]');
  await expect(reminder(page)).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(reminder(page)).toHaveCount(0);
});

test('exporting a backup clears the reminder', async ({ page }) => {
  await openApp(page, { storage: stateWith(40) });
  await expect(reminder(page)).toHaveCount(1);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  const download = page.waitForEvent('download');
  await page.click('[data-act=exportSave]');
  await download;
  await page.click('.tabs [data-act=nav][data-v=home]');
  await expect(reminder(page)).toHaveCount(0);
});

for (const [name, storage, shown] of [
  ['entries newer than a month', stateWith(10), false],
  ['a recent backup', stateWith(40, { lastExport: new Date(Date.now() - 5 * DAY).toISOString() }), false],
  [
    'an old backup with nothing added since',
    stateWith(60, { lastExport: new Date(Date.now() - 40 * DAY).toISOString() }),
    false,
  ],
  [
    'an old backup and entries added since',
    stateWith(10, { lastExport: new Date(Date.now() - 40 * DAY).toISOString() }),
    true,
  ],
]) {
  test(`backup reminder with ${name}: ${shown ? 'shown' : 'not shown'}`, async ({ page }) => {
    await openApp(page, { storage });
    await expect(page.locator('.balance-total')).toBeVisible();
    await expect(reminder(page)).toHaveCount(shown ? 1 : 0);
  });
}

test('no backup reminder over the example data', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('[data-act=clearSample]')).toBeVisible();
  await expect(reminder(page)).toHaveCount(0);
});
