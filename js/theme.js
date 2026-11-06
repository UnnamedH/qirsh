/* Accent colour and light/dark theme. */
import { state } from './state.js';

/* One accent colour drives the whole palette. Green is the built-in palette from the stylesheet; any other colour is
   turned into light and dark tokens with the same hue, with the accent darkened or lightened until text on it stays readable. */
export const DEFAULT_ACCENT = '#1D6A50';

export const ACCENTS = [
  ['#1D6A50', 'Green'],
  ['#2457C5', 'Blue'],
  ['#6A4BC4', 'Violet'],
  ['#C23B5F', 'Rose'],
  ['#B85410', 'Amber'],
  ['#0F7C86', 'Teal'],
  ['#4B5563', 'Graphite'],
];

const BG_DEFAULT = { light: '#F3F6F4', dark: '#0E1311' };

export function hexRgb(x) {
  x = String(x || '').replace('#', '');
  if (x.length === 3) x = x.replace(/./g, '$&$&');
  const n = parseInt(x, 16);
  return /^[0-9a-f]{6}$/i.test(x) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null;
}

function rgbHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  let h = 0,
    s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s * 100, l * 100];
}

function hslRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l),
    f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

const hslCss = (h, s, l) => {
  const c = hslRgb(h, s, l);
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

const lum = (c) => {
  const [r, g, b] = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

function fitL(h, s, l, step, against, min) {
  for (let i = 0; i < 80 && contrast(hslRgb(h, s, l), against) < min && l > 2 && l < 98; i++) l += step;
  return l;
}

function palette(hex) {
  const rgb = hexRgb(hex);
  if (!rgb) return null;
  const [h, s0] = rgbHsl(rgb),
    s = Math.min(s0, 85),
    t = Math.min(s0, 18);
  const lightA = fitL(h, s, Math.min(rgbHsl(rgb)[2], 46), -1, [255, 255, 255], 5);
  const darkSurf = hslRgb(h, t * 0.8, 10),
    darkA = fitL(h, Math.min(s, 70), Math.max(rgbHsl(rgb)[2], 52), 1, darkSurf, 6.5);
  return {
    light: {
      bg: hslCss(h, t, 96),
      surface: '#FFFFFF',
      fg: hslCss(h, t * 1.4, 10),
      muted: hslCss(h, t * 0.6, 38),
      line: hslCss(h, t * 0.9, 88),
      accent: hslCss(h, s, lightA),
      'accent-ink': '#FFFFFF',
      'accent-soft': hslCss(h, Math.min(s, 45), 92),
      scrim: 'rgba(10,16,20,.38)',
    },
    dark: {
      bg: hslCss(h, t * 0.9, 6),
      surface: hslCss(h, t * 0.8, 10),
      fg: hslCss(h, t * 0.8, 91),
      muted: hslCss(h, t * 0.5, 58),
      line: hslCss(h, t * 0.7, 17),
      accent: hslCss(h, Math.min(s, 70), darkA),
      'accent-ink': hslCss(h, 50, 6),
      'accent-soft': hslCss(h, Math.min(s, 40), 16),
      scrim: 'rgba(0,0,0,.55)',
    },
  };
}

const varsCss = (o) =>
  Object.keys(o)
    .map((k) => '--' + k + ':' + o[k])
    .join(';');

let themeEl = null;

export function applyTheme() {
  const s = state.settings,
    root = document.documentElement;
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme;
  else delete root.dataset.theme;
  if (!themeEl) {
    themeEl = document.createElement('style');
    themeEl.id = 'theme';
    document.head.appendChild(themeEl);
  }
  const p = s.accent && s.accent.toLowerCase() !== DEFAULT_ACCENT.toLowerCase() ? palette(s.accent) : null;
  themeEl.textContent = p
    ? ':root{' +
      varsCss(p.light) +
      '}\n@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' +
      varsCss(p.dark) +
      ';color-scheme:dark}}\n:root[data-theme="dark"]{' +
      varsCss(p.dark) +
      ';color-scheme:dark}'
    : '';
  const bg = p ? { light: p.light.bg, dark: p.dark.bg } : BG_DEFAULT;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const dark = /dark/.test(m.media || '');
    m.content = s.theme === 'light' ? bg.light : s.theme === 'dark' ? bg.dark : dark ? bg.dark : bg.light;
  });
}
