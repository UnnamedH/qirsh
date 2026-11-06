/* Release notes shown in the "What's new" sheet. */
import { KEY } from './state.js';

/* Newest first. Each release adds an entry here with the next v, and bumps VERSION in sw.js. */
export const CHANGELOG = [
  {
    v: 6,
    date: '2026-11-06',
    items: [
      'Safer saving: if your saved data can’t be read, Qirsh keeps a copy instead of replacing it, and it warns you if a change couldn’t be saved.',
      'If Qirsh is open in two places, like the installed app and a browser tab, they now stay in sync instead of overwriting each other.',
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
    items: ['Qirsh can be added to your Home Screen. It opens full screen and works offline.'],
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
