/* Release notes shown in the "What's new" sheet. */
import { KEY } from './state.js';

/* Newest first. Each release adds an entry here with the next v, then runs `npm run stamp` for sw.js. */
export const CHANGELOG = [
  {
    v: 13,
    date: '2026-11-12',
    items: [
      'Qirsh is now Frata (فراطة), Lebanese for small change. It has a new icon and a new look at the top of the app.',
      'The coins at the top, and the icon in your browser tab, take on the accent colour you pick in Settings → Appearance, in light and dark.',
      'Frata has a new home at frata.cc. On the old address, a banner moves your data there in one tap (on iPhone, with a backup file).',
      'Nothing else changes: your entries, settings and backups are all where they were. On iPhone, the Home Screen icon may keep the old look until you add the app again.',
    ],
  },
  {
    v: 12,
    date: '2026-11-10',
    items: [
      'Changing the exchange rate no longer changes what past months cost. Each entry now keeps the rate of the day you added it, and totals, budgets and the monthly report use it.',
      'Budgets in LL now count LL spending exactly, without converting it through dollars.',
      'Your balances and what you’re owed still use today’s rate, because they’re what you have now.',
    ],
  },
  {
    v: 11,
    date: '2026-11-10',
    items: [
      'Frata now reminds you to back up when a month has gone by with new entries and no backup. Your entries live only on your phone, so a backup is the only copy.',
      'If Frata is open in two places, an out-of-date one can no longer write over newer entries. It catches up first, and tells you if a change needs making again.',
      '“Start fresh” now only removes the example data, so anything you added on top of it stays.',
      'Importing a backup, clearing all data and changing the exchange rate can now be undone. A rate far from the current one asks first, so a typo like 895 doesn’t slip in.',
      'Leaving Frata open overnight? It now shows the right day and month when you come back.',
    ],
  },
  {
    v: 10,
    date: '2026-11-09',
    items: [
      'New way to add expenses: type the price, say what you paid with, and Frata works out your change, even when it comes back in both $ and LL. Turn it on from the tip on Home, or in Settings → Display → “Adding an expense”.',
      'Got a different amount of change than Frata worked out? Just type what you got, and the price stays exact.',
      'LL is now always typed in thousands: type 385 for 385,000 LL. The ,000 is already there, so there’s no 000 button to tap.',
      'Amounts are checked more carefully: a comma works as a decimal point (4,50 is $4.50), and a slip like “12abc” is caught instead of being saved.',
    ],
  },
  {
    v: 9,
    date: '2026-11-07',
    items: [
      'Missed a few entries? In Settings → Balances, tap Correct next to an account and enter what it really holds. Frata records the difference for you.',
      'Choose “Count it” to add the difference as an expense or income in a category, so your totals and budgets include it, or “Just fix the balance” to change the balance only.',
      'Starting balances are now tucked away under “Edit starting balances”.',
    ],
  },
  {
    v: 8,
    date: '2026-11-06',
    items: [
      'Frata now opens instantly from your phone every time, even with a very weak connection or none at all.',
      'Updates download in the background. When one is ready, tap Reload to start using it.',
      'Frata no longer loads anything from other websites, not even its font, and the browser now blocks it from ever contacting one. See Settings → Privacy.',
    ],
  },
  {
    v: 7,
    date: '2026-11-06',
    items: [
      'Monthly report: in History, tap “Monthly report (Excel)” for the month you’re looking at. It shows what you earned and spent, where the money went, what you set aside in Savings, what you’re owed, how your budgets did, and every entry.',
      'Need the raw numbers? “Entries (CSV)” gives that month’s entries as a CSV file for other apps.',
    ],
  },
  {
    v: 6,
    date: '2026-11-06',
    items: [
      'Safer saving: if your saved data can’t be read, Frata keeps a copy instead of replacing it, and it warns you if a change couldn’t be saved.',
      'If Frata is open in two places, like the installed app and a browser tab, they now stay in sync instead of overwriting each other.',
      'A payback in the other currency keeps the exchange rate from the day you recorded it, so changing the rate no longer reopens a settled entry.',
    ],
  },
  {
    v: 5,
    date: '2026-11-06',
    items: [
      'Paying for someone else, like the scouts? Turn on “Someone will pay me back” when adding an expense. It comes out of your wallet but isn’t counted in your budgets or spending.',
      'Home shows what you’re still owed. Tap “Paid back” to record paybacks in full or in parts, in $ or LL. They go back into your wallet without counting as income.',
      'If you won’t get all of it back, close it and only the part you didn’t get back counts as your spending.',
      'New entries now start in the currency you used last, $ or LL.',
    ],
  },
  {
    v: 4,
    date: '2026-11-04',
    items: [
      'A note like this one now shows up after each update, so you know what changed. You can reread it any time from the bottom of Settings.',
    ],
  },
  {
    v: 3,
    date: '2026-11-04',
    items: [
      'Pick an accent colour in Settings → Appearance, from the presets or any colour you like.',
      'Choose a Light, Dark or System theme.',
    ],
  },
  { v: 2, date: '2026-11-04', items: ['Built-in categories now come with emojis.'] },
  {
    v: 1,
    date: '2026-11-04',
    items: ['Frata can be added to your Home Screen. It opens full screen and works offline.'],
  },
];

export const APP_VERSION = CHANGELOG[0].v,
  SEEN_KEY = 'qirsh.seenVersion';

/* People who used the app before these notes existed last saw version 2; brand-new users see nothing until the next update. */
export function unseenChanges() {
  let seen = null,
    had = false;
  try {
    seen = localStorage.getItem(SEEN_KEY);
    had = !!localStorage.getItem(KEY);
  } catch (e) {
    return [];
  }
  if (seen == null) {
    if (!had) {
      markSeen();
      return [];
    }
    seen = 2;
  }
  return CHANGELOG.filter((c) => c.v > +seen);
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(APP_VERSION));
  } catch (e) {}
}
