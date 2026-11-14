/* Touch gestures that make Frata feel like an app: drag a sheet down to close it, swipe sideways between tabs. */
import { closeSheet } from '../sheets/sheet.js';
import { $ } from '../util.js';
import { view } from './ui-state.js';

/* The tab bar's order, so a swipe moves to the tab next to the current one. */
export const TABS = ['home', 'history', 'budgets', 'settings'];

/* Swipes starting this close to the screen edge are left to the phone: it's the system Back gesture. */
const EDGE = 24;
/* Movement before a gesture picks a direction, so taps and small wobbles stay taps. */
const SLOP = 10;

let g = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Fields keep their own touch behaviour (moving the caret, selecting text). */
const isField = (el) => !!el.closest('input, textarea, select, [contenteditable]');

/* Something between the touch and the page that scrolls sideways handles the swipe itself. */
function scrollsSideways(el, stop) {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    const ox = getComputedStyle(n).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) return true;
  }
  return false;
}

export function swipeStart(e) {
  g = null;
  if (e.touches.length !== 1) return;
  const t = e.touches[0],
    target = e.target;
  if (!(target instanceof Element) || isField(target)) return;
  const sheet = $('#sheet');
  const base = { x: t.clientX, y: t.clientY, at: Date.now(), dx: 0, dy: 0, mode: null };
  if (!sheet.hidden) {
    // Only a sheet scrolled to its top can be pulled down; otherwise the drag scrolls its content.
    if (sheet.contains(target) && sheet.scrollTop <= 0) g = { ...base, can: 'sheet', el: sheet };
    return;
  }
  if (!target.closest('main')) return;
  if (t.clientX < EDGE || t.clientX > innerWidth - EDGE) return;
  if (scrollsSideways(target, document.body)) return;
  g = { ...base, can: 'tabs', el: $('#v-' + view) };
}

export function swipeMove(e) {
  if (!g) return;
  const t = e.touches[0];
  g.dx = t.clientX - g.x;
  g.dy = t.clientY - g.y;
  if (!g.mode) {
    if (Math.abs(g.dx) < SLOP && Math.abs(g.dy) < SLOP) return;
    if (g.can === 'sheet' && g.dy > 0 && g.dy > Math.abs(g.dx)) g.mode = 'sheet';
    else if (g.can === 'tabs' && Math.abs(g.dx) > Math.abs(g.dy) * 1.5) g.mode = 'tabs';
    else {
      g = null; // a scroll, or a sideways move inside a sheet: leave it to the browser
      return;
    }
    g.el.style.transition = 'none';
  }
  // The gesture is ours now: stop the page scrolling and Chrome's pull-to-refresh.
  if (e.cancelable) e.preventDefault();
  if (g.mode === 'sheet') {
    g.el.style.transform = 'translate(-50%, ' + Math.max(0, g.dy) + 'px)';
    $('#scrim').style.opacity = String(Math.max(0.2, 1 - g.dy / g.el.offsetHeight));
  } else {
    // The page follows the finger a little, and less where there is no tab to go to.
    const i = TABS.indexOf(view),
      edge = (g.dx > 0 && i === 0) || (g.dx < 0 && i === TABS.length - 1);
    g.el.style.transform = 'translateX(' + g.dx * (edge ? 0.08 : 0.25) + 'px)';
  }
}

/** Ends a gesture. `goTab(view, from)` switches tabs; `from` is the side the new page slides in from. */
export function swipeEnd(goTab) {
  if (!g || !g.mode) {
    g = null;
    return;
  }
  const { el, mode, dx, dy } = g,
    ms = Math.max(1, Date.now() - g.at);
  g = null;
  const settle = () => {
    el.style.transition = '';
    el.style.transform = '';
    $('#scrim').style.opacity = '';
  };
  if (mode === 'sheet') {
    // Far enough, or a quick flick, closes it; otherwise it springs back.
    if (dy > Math.min(140, el.offsetHeight * 0.25) || (dy > 40 && dy / ms > 0.6)) {
      if (reduced()) {
        closeSheet();
        settle();
        return;
      }
      el.style.transition = 'transform 0.16s ease-in';
      el.style.transform = 'translate(-50%, 100%)';
      setTimeout(() => {
        closeSheet();
        settle();
      }, 160);
    } else {
      el.style.transition = 'transform 0.16s ease-out';
      el.style.transform = '';
      setTimeout(settle, 170);
    }
    return;
  }
  settle();
  const i = TABS.indexOf(view),
    next = TABS[i + (dx < 0 ? 1 : -1)];
  if (next && (Math.abs(dx) > 70 || (Math.abs(dx) > 35 && Math.abs(dx) / ms > 0.4)))
    goTab(next, dx < 0 ? 'right' : 'left');
}

/** Slides a newly shown tab in from the side the swipe came from. */
export function slideIn(el, from) {
  if (reduced() || !el) return;
  el.classList.remove('in-left', 'in-right');
  void el.offsetWidth; // restart the animation if the same tab slides in twice
  el.classList.add('in-' + from);
  setTimeout(() => el.classList.remove('in-' + from), 220);
}
