/* Budgets view. */
import { budgetCats, budgetStatus } from '../ledger.js';
import { state } from '../state.js';
import { budgetHtml } from '../ui/format.js';
import { $ } from '../util.js';

export function renderBudgets() {
  const overall = state.budgets.filter((b) => !budgetCats(b).length),
    cats = state.budgets.filter((b) => budgetCats(b).length);
  let h = '';
  h +=
    '<section class="sec"><div class="sec-head"><h2>Overall cap</h2></div>' +
    (overall.length
      ? '<div class="list">' + overall.map((b) => budgetHtml(b, true)).join('') + '</div>'
      : '<div class="list"><p class="empty">No overall cap. Add one with "All spending".</p></div>') +
    '</section>';
  h +=
    '<section class="sec"><div class="sec-head"><h2>By category</h2></div>' +
    (cats.length
      ? '<div class="list">' +
        cats
          .map((x) => ({ b: x, s: budgetStatus(x) }))
          .sort((a, c) => c.s.pct - a.s.pct)
          .map((x) => budgetHtml(x.b, true))
          .join('') +
        '</div>'
      : '<div class="list"><p class="empty">No category budgets yet.</p></div>') +
    '</section>';
  h += '<button class="btn primary" data-act="newBudget">Add budget</button>';
  $('#v-budgets').innerHTML = h;
}
