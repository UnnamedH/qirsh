/* Small helpers for DOM, HTML escaping, ids and dates. */

export const $ = (s) => document.querySelector(s);

export const esc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = (n) => String(n).padStart(2, '0');

export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

export const parseYmd = (s) => {
  const p = String(s).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const firstGlyph = (s) => {
  if (!s) return '';
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return new Intl.Segmenter().segment(s)[Symbol.iterator]().next().value.segment;
    }
  } catch (e) {}
  return Array.from(s)[0] || '';
};

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function dayLabel(s) {
  const d = parseYmd(s),
    t = startOfDay(new Date());
  const diff = Math.round((t - d) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
}
