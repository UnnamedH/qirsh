/* Light/dark theme. The scouts colours themselves are in css/scouts.css. */
import { state } from './state.js';

const BG = { light: '#F3F5FA', dark: '#0E1118' };

export function applyTheme() {
  const t = state.settings.theme,
    root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  else delete root.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const dark = /dark/.test(m.media || '');
    m.content = t === 'light' ? BG.light : t === 'dark' ? BG.dark : dark ? BG.dark : BG.light;
  });
}
