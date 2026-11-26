/* Adding, renaming and removing accounts, the savings switch, and folding accounts away on Home. */
import { test, expect, openApp, appState } from './helpers.js';

/** Starts empty, with $100 in the wallet and $50 on Whish. */
async function setUp(page) {
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    s.opening.wallet = { USD: 100, LBP: 0 };
    s.opening.whish = { USD: 50, LBP: 0 };
  });
  await nav(page, 'home');
}

const nav = (page, v) => page.click(`.tabs [data-act=nav][data-v=${v}]`);
const balances = (page) => page.evaluate(() => window.__qirsh.balances());
const nameField = (page, id) => page.locator(`[data-accname="${id}"]`);
const accountId = (page, name) =>
  page.evaluate((n) => window.__qirsh.state.accounts.find((a) => a.name === n).id, name);

async function addAccount(page, name) {
  await nav(page, 'settings');
  await page.click('[data-act=setPage][data-v=accounts]');
  await page.click('[data-act=accAdd]');
  const field = page.locator('#accountsSec .acct-row .input').last();
  await expect(field).toBeFocused();
  await field.fill(name);
  await field.blur();
}

test('a new account shows on Home and in the entry form, and money can go into it', async ({ page }) => {
  await setUp(page);
  await addAccount(page, 'Bank');
  const id = await accountId(page, 'Bank');

  await nav(page, 'home');
  // Three other accounts now, so they start folded into one row with their total.
  const head = page.locator('.accs-head');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(head).toContainText('$50');
  await head.click();
  await expect(page.locator(`.acc[data-id="${id}"]`)).toContainText('Bank');

  // With four accounts, the form offers them as wrapping buttons.
  await page.click('#fab');
  await page.click('[data-act=ftype][data-v=income]');
  await expect(page.locator('#sheet .acct-pick .chip')).toHaveCount(4);
  await page.click(`#sheet [data-act=facct][data-v="${id}"]`);
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '200');
  await page.click('#sheet [data-act=fcat]');
  await page.click('[data-act=fsave]');
  expect((await balances(page))[id].USD).toBe(200);

  // It can be the other side of a transfer, too.
  await page.click('#fab');
  await page.click('[data-act=ftype][data-v=transfer]');
  await expect(page.locator('#f-to option', { hasText: 'Bank' })).toHaveCount(1);
});

test('folding the other accounts is remembered', async ({ page }) => {
  await setUp(page);
  const head = page.locator('.accs-head');
  // Savings and Whish: two, so they start open.
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.accounts .acc')).toHaveCount(2);
  await head.click();
  await expect(page.locator('.accounts')).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(page.locator('.accs-head')).toHaveAttribute('aria-expanded', 'false');
  expect((await appState(page)).settings.accountsOpen).toBe(false);
});

test('accounts can be renamed, including Wallet, but not to nothing', async ({ page }) => {
  await setUp(page);
  await nav(page, 'settings');
  await page.click('[data-act=setPage][data-v=accounts]');
  await nameField(page, 'wallet').fill('Cash');
  await nameField(page, 'wallet').blur();
  await nameField(page, 'whish').fill('<b>OMT</b>');
  await nameField(page, 'whish').blur();
  await nameField(page, 'savings').fill('   ');
  await nameField(page, 'savings').blur();
  await expect(page.locator('#toast')).toContainText('needs a name');
  await expect(nameField(page, 'savings')).toHaveValue('Savings');

  await nav(page, 'home');
  await expect(page.locator('.balance .acc-open')).toHaveText('Cash');
  // Names are shown as text, never as markup.
  await expect(page.locator('.acc[data-id=whish] .label')).toHaveText('<b>OMT</b>');
  await expect(page.locator('.acc[data-id=whish] b')).toHaveCount(0);
  // Wallet has no Remove: there is always a main account.
  await nav(page, 'settings');
  await page.click('[data-act=setPage][data-v=accounts]');
  await expect(page.locator('#accountsSec [data-act=accRemove][data-v=wallet]')).toHaveCount(0);
});

test('removing a used account moves its money to Wallet and keeps its history', async ({ page }) => {
  await setUp(page);
  // $5 spent from Whish leaves $45 in it.
  await page.click('#fab');
  await page.click('[data-act=lcur][data-v=USD]');
  await page.fill('#f-pay0', '5');
  await page.click('[data-act=facct][data-v=whish]');
  await page.click('[data-act=fcat][data-v=phone]');
  await page.click('[data-act=fsave]');

  await nav(page, 'settings');
  await page.click('[data-act=setPage][data-v=accounts]');
  const remove = page.locator('#accountsSec [data-act=accRemove][data-v=whish]');
  await remove.click();
  await expect(remove).toHaveText('Tap again');
  await page.locator('#accountsSec [data-act=accRemove][data-v=whish]').click();

  await expect(page.locator('#toast')).toContainText('Whish removed · $45 moved to Wallet');
  const b = await balances(page);
  expect(b.wallet.USD).toBe(145);
  expect(b.whish.USD).toBe(0);
  const s = await appState(page);
  expect(s.accounts.find((a) => a.id === 'whish').hidden).toBe(true);
  expect(s.tx.at(-1)).toMatchObject({ type: 'transfer', from: 'whish', to: 'wallet', amount: 45 });

  // Gone from Home and the form; History still says where the money went.
  await nav(page, 'home');
  await expect(page.locator('.acc[data-id=whish]')).toHaveCount(0);
  await page.click('#fab');
  await expect(page.locator('#sheet [data-act=facct][data-v=whish]')).toHaveCount(0);
  await page.click('#sheet [data-act=close]');
  await nav(page, 'history');
  await expect(page.locator('#histList')).toContainText('Whish');

  // And it can come back.
  await nav(page, 'settings');
  await page.click('[data-act=setPage][data-v=accounts]');
  await page.click('[data-act=accRestore][data-v=whish]');
  await nav(page, 'home');
  await expect(page.locator('.acc[data-id=whish]')).toBeVisible();
});

test('removing an unused account deletes it, and Undo brings it back', async ({ page }) => {
  await setUp(page);
  await addAccount(page, 'Spare');
  const id = await accountId(page, 'Spare');
  // Typing a new name, then tapping Remove straight away: the rename is kept and the tap counts.
  await nameField(page, id).fill('Spare cash');
  await page.click(`#accountsSec [data-act=accRemove][data-v="${id}"]`);
  await expect(page.locator(`#accountsSec [data-act=accRemove][data-v="${id}"]`)).toHaveText('Tap again');
  expect(await accountId(page, 'Spare cash')).toBe(id);
  await page.click(`#accountsSec [data-act=accRemove][data-v="${id}"]`);
  let s = await appState(page);
  expect(s.accounts.some((a) => a.id === id)).toBe(false);
  expect(s.opening[id]).toBeUndefined();
  await page.click('#toast [data-act=undo]');
  s = await appState(page);
  expect(s.accounts.find((a) => a.id === id).name).toBe('Spare cash');
});

test('the report counts money moved into any account marked as savings', async ({ page }) => {
  await setUp(page);
  const moveTo = async (to, amount) => {
    await page.click('#fab');
    await page.click('[data-act=ftype][data-v=transfer]');
    await page.selectOption('#f-to', to);
    await page.click('[data-act=lcur][data-v=USD]');
    await page.fill('#f-pay0', String(amount));
    await page.click('[data-act=fsave]');
  };
  await moveTo('savings', 20);
  await moveTo('whish', 7);
  const report = () =>
    page.evaluate(async () => (await import('/js/report/monthly.js')).monthlyData(new Date()).toSavings);
  expect(await report()).toBe(20);

  await nav(page, 'settings');
  await page.click('[data-act=setPage][data-v=accounts]');
  await page.check('[data-accsave=whish]');
  expect(await report()).toBe(27);
  await page.uncheck('[data-accsave=savings]');
  expect(await report()).toBe(7);
});

test('accounts are checked when data is loaded', async ({ page }) => {
  await openApp(page);
  const out = await page.evaluate(() => {
    const n = (s) => window.__qirsh.normalize(Object.assign({ tx: [] }, s));
    return {
      // Data from before accounts could change gets the original three.
      old: n({}).accounts.map((a) => a.id),
      // Wallet is always there, first and never hidden; bad items and repeats are dropped.
      fixed: n({
        accounts: [
          { id: 'bank', name: '  Bank  ', savings: 'yes' },
          'junk',
          { id: 'bad id!', name: 'x' },
          { id: 'bank', name: 'Again' },
          { id: 'wallet', name: '', hidden: true },
        ],
      }).accounts,
      // An account an entry points to is kept, so its money doesn't vanish.
      recovered: n({
        accounts: [{ id: 'wallet', name: 'Wallet' }],
        tx: [{ id: 't', type: 'expense', amount: 1, currency: 'USD', date: '2026-11-01', account: 'card' }],
      }).accounts.map((a) => a.id),
    };
  });
  expect(out.old).toEqual(['wallet', 'savings', 'whish']);
  expect(out.fixed).toEqual([
    { id: 'wallet', name: 'Wallet' },
    { id: 'bank', name: 'Bank' },
  ]);
  expect(out.recovered).toEqual(['wallet', 'card']);
});
