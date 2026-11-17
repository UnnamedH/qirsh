/* Page and sheet layout that must hold on every phone: the tab bar pinned to the bottom, pages that fill
   the screen, and sheets that never move sideways. */
import { test, expect, openApp } from './helpers.js';

const WIDTHS = [320, 360, 390, 430];

test('every page fills the screen, and the tab bar sits at the very bottom of it', async ({ page }) => {
  await openApp(page);
  await page.click('[data-act=clearSample]'); // empty pages are the short ones
  for (const v of ['home', 'history', 'budgets', 'settings']) {
    await page.click(`.tabs [data-act=nav][data-v=${v}]`);
    const m = await page.evaluate(() => ({
      inner: innerHeight,
      doc: document.documentElement.scrollHeight,
      mainBottom: document.querySelector('main').getBoundingClientRect().bottom,
      tabsBottom: document.querySelector('.tabs').getBoundingClientRect().bottom,
      tabsHeight: document.querySelector('.tabs').getBoundingClientRect().height,
    }));
    expect(m.mainBottom, v + ': the page reaches the bottom of the screen').toBeGreaterThanOrEqual(m.inner);
    expect(m.doc, v + ': at least a screen tall').toBeGreaterThanOrEqual(m.inner);
    expect(m.tabsBottom, v + ': tab bar at the bottom').toBe(m.inner);
    // The bar is the same height on every page.
    if (v === 'home') var first = m.tabsHeight;
    expect(m.tabsHeight, v + ': same bar height').toBe(first);
  }
  // A short page doesn't scroll at all.
  await page.click('.tabs [data-act=nav][data-v=history]');
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(
    0,
  );
});

test('sheets only move up and down, and every entry type fits narrow phones', async ({ page }) => {
  await openApp(page);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 700 });
    for (const type of ['expense', 'income', 'transfer', 'exchange']) {
      await page.click('#fab');
      await page.click(`#sheet [data-act=ftype][data-v=${type}]`);
      const r = await page.evaluate(() => {
        const s = document.querySelector('#sheet'),
          box = s.getBoundingClientRect(),
          css = getComputedStyle(s);
        return {
          overflowX: css.overflowX,
          touch: css.touchAction,
          scrimTouch: getComputedStyle(document.querySelector('#scrim')).touchAction,
          wide: s.scrollWidth - s.clientWidth,
          sheetRight: Math.round(box.right),
          past: [...s.querySelectorAll('*')]
            .filter((e) => e.getBoundingClientRect().right > box.right + 0.5)
            .map(
              (e) => e.tagName + (e.id ? '#' + e.id : '') + ' ' + Math.round(e.getBoundingClientRect().right),
            )
            .slice(0, 5),
          viewport: innerWidth,
          clipped: [...s.querySelectorAll('.seg button')]
            .filter((b) => b.scrollWidth > b.clientWidth)
            .map((b) => b.textContent),
        };
      });
      const at = `${type} at ${width}px`;
      expect(r.overflowX, at).toBe('hidden');
      expect(r.touch, at).toBe('pan-y');
      expect(r.scrimTouch, at).toBe('none');
      expect(r.sheetRight, at).toBeLessThanOrEqual(r.viewport);
      expect(r.wide, at).toBeLessThanOrEqual(0);
      expect(r.past, at).toEqual([]);
      expect(r.clipped, at + ': no tab text is cut off').toEqual([]);
      await page.click('#sheet [data-act=close]');
    }
  }
});

test('the feedback and correction sheets fit narrow phones too', async ({ page }) => {
  await openApp(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.click('.top [data-act=feedbackOpen]');
  expect(await page.evaluate(() => document.querySelector('#sheet').scrollWidth - 320)).toBeLessThanOrEqual(
    0,
  );
  await page.click('#sheet [data-act=close]');
  await page.click('[data-act=accView][data-id=whish]');
  await page.click('#v-history .acct-head [data-act=newAdjust]');
  expect(await page.evaluate(() => document.querySelector('#sheet').scrollWidth - 320)).toBeLessThanOrEqual(
    0,
  );
});

test('the header keeps its date, heart and chat buttons on one line, even at 320px', async ({ page }) => {
  await openApp(page);
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 700 });
    for (const v of ['home', 'history', 'budgets', 'settings']) {
      await page.click(`.tabs [data-act=nav][data-v=${v}]`);
      const m = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        return {
          brandRight: r('.brand').right,
          endLeft: r('.top-end').left,
          endRight: r('.top-end').right,
          dateHeight: r('#topSub').height,
          lineHeight: parseFloat(getComputedStyle(document.querySelector('#topSub')).lineHeight) || 20,
          docWidth: document.documentElement.scrollWidth,
          width: innerWidth,
        };
      });
      const at = `${v} at ${width}px`;
      expect(m.endLeft, at + ': buttons clear the logo').toBeGreaterThanOrEqual(m.brandRight);
      expect(m.endRight, at).toBeLessThanOrEqual(m.width);
      expect(m.dateHeight, at + ': the date is on one line').toBeLessThanOrEqual(m.lineHeight * 1.5);
      expect(m.docWidth, at + ': nothing scrolls sideways').toBeLessThanOrEqual(m.width);
    }
  }
});

test('the header’s date and icons are evenly spaced, level, and flush with the page edge', async ({
  page,
}) => {
  await openApp(page);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 700 });
    await page.click('.tabs [data-act=nav][data-v=budgets]');
    const g = await page.evaluate(() => {
      const rng = document.createRange();
      rng.selectNodeContents(document.querySelector('#topSub'));
      const date = rng.getBoundingClientRect();
      const heart = document.querySelector('[data-act=supportOpen] path').getBoundingClientRect();
      const chat = document.querySelector('[data-act=feedbackOpen] path').getBoundingClientRect();
      return {
        dateToHeart: heart.left - date.right,
        heartToChat: chat.left - heart.right,
        heartW: heart.width,
        chatW: chat.width,
        heartCy: (heart.top + heart.bottom) / 2,
        chatCy: (chat.top + chat.bottom) / 2,
        edge: chat.right - (innerWidth - 16),
      };
    });
    const at = `at ${width}px`;
    expect(Math.abs(g.dateToHeart - g.heartToChat), 'gaps even ' + at).toBeLessThanOrEqual(1);
    expect(Math.abs(g.heartW - g.chatW), 'icons the same size ' + at).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g.heartCy - g.chatCy), 'icons level ' + at).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g.edge), 'flush with the page edge ' + at).toBeLessThanOrEqual(1);
  }
});
