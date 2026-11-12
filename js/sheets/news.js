/* "What's new" sheet. */
import { ICON } from '../icons.js';
import { dayLabel, esc } from '../util.js';

export let newsList = [];

export function newsSheet() {
  let h =
    '<div class="sheet-head"><h2>What’s new in Frata</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div><div class="news">';
  h += newsList
    .map(
      (c) =>
        '<section><p class="label">Version ' +
        c.v +
        ' · ' +
        esc(dayLabel(c.date)) +
        '</p><ul>' +
        c.items.map((i) => '<li>' + esc(i) + '</li>').join('') +
        '</ul></section>',
    )
    .join('');
  return (
    h + '</div><div class="sheet-actions"><button class="btn primary" data-act="close">Got it</button></div>'
  );
}

export function setNewsList(value) {
  newsList = value;
  return value;
}
