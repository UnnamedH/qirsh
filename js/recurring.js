/* Recurring entries in the app: what is due today, and adding or skipping it (with Undo). */
import { allDue, dueNow as coreDue, entryFor, nextDate } from './core/recurring.js';
import { catName } from './ledger.js';
import { fmt } from './money.js';
import { state } from './state.js';
import { commit } from './ui/render.js';
import { toast } from './ui/toast.js';
import { uid, ymd } from './util.js';

const today = () => ymd(new Date());

/** What needs a decision today: each due entry's oldest due date, and how many more wait behind it. */
export const dueNow = () => coreDue(state.recurring, today());

/** The name an entry goes by: its note, or its category. */
export const recName = (r) => r.note || catName(r.categoryId);

/** "$300" for spending, "+$300" for income. */
export const recAmount = (r) => (r.type === 'income' ? '+' : '') + fmt(r.amount, r.currency);

/* 1st, 2nd, 3rd, 4th… 11th, 12th, 13th, 21st. */
const ord = (n) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + 'th';
  return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
};

/** "Monthly on the 1st" or "Weekly on Mondays". */
export const recEvery = (r) =>
  r.every === 'week'
    ? 'Weekly on ' +
      ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][
        new Date(r.next + 'T12:00:00').getDay()
      ]
    : 'Monthly on the ' + ord(r.day || +r.next.slice(8));

/* Adds the entry for each due date (or, skipping, just moves on), then moves each schedule past it, all in one
   save so a reload can't add the same one twice. Undo puts the schedules and the entries back. */
function apply(items, add, message) {
  const before = structuredClone(state.recurring);
  const made = [];
  const now = Date.now();
  for (const { rec, date } of items) {
    const r = state.recurring.find((x) => x.id === rec.id);
    if (!r) continue;
    if (add) {
      const t = entryFor(r, date, state.rate, uid(), now + made.length);
      state.tx.push(t);
      made.push(t.id);
    }
    r.next = nextDate(r, date);
  }
  commit();
  toast(message, () => {
    state.recurring = before;
    state.tx = state.tx.filter((t) => !made.includes(t.id));
    commit();
  });
}

/** Adds or skips one due entry. A tap on something no longer due (an old screen) does nothing. */
export function actOnDue(kind, id, date) {
  const d = dueNow().find((x) => x.rec.id === id && x.date === date);
  if (!d) return;
  const name = recName(d.rec);
  if (kind === 'add') apply([d], true, 'Added ' + name + ' · ' + recAmount(d.rec));
  else apply([d], false, 'Skipped ' + name);
}

/** Adds every due date of every entry. */
export function addAllDue() {
  const items = allDue(state.recurring, today());
  if (!items.length) return;
  apply(items, true, 'Added ' + items.length + (items.length === 1 ? ' entry' : ' entries'));
}
