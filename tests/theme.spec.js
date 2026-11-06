import { test, expect, openApp } from './helpers.js';

const COLOURS = [
  null,
  '#2457C5',
  '#6A4BC4',
  '#C23B5F',
  '#B85410',
  '#0F7C86',
  '#4B5563',
  '#FFD400',
  '#EEEEEE',
  '#000000',
  '#00FF66',
];

/** Contrast ratios for one accent and theme, measured from the live CSS variables. */
function measure(page, accent, theme) {
  return page.evaluate(
    async ([accent, theme]) => {
      const s = window.__qirsh.state;
      s.settings.accent = accent;
      s.settings.theme = theme;
      document.querySelector('[data-act=nav][data-v=settings]').click();
      await new Promise((r) => setTimeout(r, 30));
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue('--' + n).trim();
      const rgb = (c) => {
        const x = document.createElement('i');
        x.style.color = c;
        document.body.appendChild(x);
        const m = getComputedStyle(x).color.match(/\d+/g).map(Number);
        x.remove();
        return m;
      };
      const L = (c) => {
        const [r, g, b] = c.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const C = (a, b) => {
        const x = L(rgb(a));
        const y = L(rgb(b));
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      return {
        inkOnAccent: C(v('accent-ink'), v('accent')),
        accentOnSurface: C(v('accent'), v('surface')),
        fgOnBg: C(v('fg'), v('bg')),
        mutedOnSurface: C(v('muted'), v('surface')),
      };
    },
    [accent, theme],
  );
}

test('every accent stays readable in light and dark', async ({ page }) => {
  await openApp(page);
  for (const accent of COLOURS) {
    for (const theme of ['light', 'dark']) {
      const r = await measure(page, accent, theme);
      const label = `${accent || 'default'} ${theme}`;
      expect(r.inkOnAccent, label).toBeGreaterThanOrEqual(4.5);
      expect(r.accentOnSurface, label).toBeGreaterThanOrEqual(3);
      expect(r.fgOnBg, label).toBeGreaterThanOrEqual(7);
      expect(r.mutedOnSurface, label).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('accent and theme choices persist, and Green restores the original palette', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=nav][data-v=settings]');
  await page.click('[data-act=setAccent][data-v="#C23B5F"]');
  await page.click('[data-act=setTheme][data-v=dark]');
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  const after = await page.evaluate(() => ({
    settings: window.__qirsh.state.settings,
    theme: document.documentElement.dataset.theme,
  }));
  expect(after.settings.accent).toBe('#C23B5F');
  expect(after.theme).toBe('dark');

  await page.click('[data-act=nav][data-v=settings]');
  await page.locator('#accentPick').evaluate((el) => {
    el.value = '#0090ff';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.__qirsh.state.settings.accent)).toBe('#0090FF');
  await expect(page.locator('.swatch.custom[aria-pressed=true]')).toHaveCount(1);

  await page.click('[data-act=setAccent][data-v="#1D6A50"]');
  expect(await page.evaluate(() => window.__qirsh.state.settings.accent)).toBeNull();
  expect(await page.evaluate(() => document.getElementById('theme').textContent)).toBe('');
});

for (const width of [320, 390]) {
  test(`colour swatches fit on one row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openApp(page);
    await page.click('[data-act=nav][data-v=settings]');
    const rows = await page
      .locator('.swatch')
      .evaluateAll((s) => new Set(s.map((x) => Math.round(x.getBoundingClientRect().top))).size);
    expect(rows).toBe(1);
  });
}
