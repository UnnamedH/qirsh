/* Small helpers for DOM, HTML escaping, ids and dates. */

/** @param {string} s */
export const $ = (s) => /** @type {HTMLElement} */ (document.querySelector(s));

/** @type {Record<string, string>} */
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {unknown} s */
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** @param {number} n */
const pad = (n) => String(n).padStart(2, '0');

/** @param {Date} d */
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

/** @param {string} s */
export const parseYmd = (s) => {
  const p = String(s).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};

/**
 * @param {Date} d
 * @param {number} n
 */
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** @param {Date} d */
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

/** @param {string} s */
export const firstGlyph = (s) => {
  if (!s) return '';
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const first = new Intl.Segmenter().segment(s)[Symbol.iterator]().next().value;
      return first ? first.segment : '';
    }
  } catch (e) {}
  return Array.from(s)[0] || '';
};

/** @param {string} s */
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** @param {string} s */
export function dayLabel(s) {
  const d = parseYmd(s),
    t = startOfDay(new Date());
  const diff = Math.round((t.getTime() - d.getTime()) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
}

/**
 * Saves a file to the device through a temporary download link.
 * @param {Blob} blob
 * @param {string} name
 */
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
