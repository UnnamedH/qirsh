# Qirsh

A small, phone-first budget tracker for living with two currencies: US dollars and Lebanese lira (LL).

Live at **https://unnamedh.github.io/qirsh/**. Data is stored only on the device, in the browser's `localStorage`. It can be installed to the home screen on iPhone and Android and works offline.

Plain HTML, CSS and JavaScript modules: no framework and no build step. GitHub Pages serves the files as they are.

## Features

- Wallet, Savings and Whish accounts, each holding both USD and LL
- Expenses and income paid in one or both currencies, including change you get back
- Transfers between accounts and exchanges between $ and LL at a rate you set
- Money paid on someone else's behalf, with paybacks, kept out of budgets
- Weekly and monthly budgets, overall or per category
- Quick add for repeat entries, history by month with search and filters
- A monthly report as an Excel file (summary, spending by category, savings, owed, budgets, every entry), and a CSV of the month's entries
- Accent colours and a light/dark theme, a "What's new" note after each update
- Editable categories with emoji, JSON backup export and import

## Install on a phone

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome or Samsung Internet):** tap **Install app** when prompted, or use the browser menu → **Add to Home screen**.

On iPhone, Safari and the installed app keep separate data. Install first, or move your data across with Settings → Backup.

## Development

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npm start
```

Then open http://127.0.0.1:8765. The app has to be served over `http://`: browsers don't load JavaScript modules or service workers from `file://`. The first launch shows example data; tap **Start fresh** to clear it.

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm start`            | Serves the app locally at http://127.0.0.1:8765           |
| `npm test`             | Runs the browser tests in `tests/` (Playwright)           |
| `npm run lint`         | Checks the code for mistakes (ESLint)                     |
| `npm run format`       | Reformats every file (Prettier)                           |
| `npm run format:check` | Reports files that need formatting, without changing them |

Locally the tests use the Microsoft Edge that comes with Windows. On GitHub they use Chromium. Every pull request runs lint, the format check and the tests (`.github/workflows/ci.yml`).

## Project layout

```
index.html              Page skeleton: header, the four views, tab bar, sheet and toast containers
css/styles.css          All styles; colours are CSS variables, with a dark set
js/main.js              Entry point: first render, "What's new", service worker
js/events.js            Every tap, input and keypress, dispatched on the element's data-act
js/state.js             The saved state: default shape, loading, saving, repairing old data
js/sample.js            Example data for the first launch
js/config.js            Accounts and built-in categories
js/money.js             Formatting and parsing amounts, USD/LL conversion
js/ledger.js            Balances, spending totals and budget progress
js/advances.js          Money paid for others and its paybacks
js/templates.js         Quick add (frequent and recent entries)
js/theme.js             Accent colour palette and light/dark theme
js/changelog.js         Release notes for "What's new"
js/backup.js            Export and import, saving generated files
js/report/              Monthly report: the data (monthly.js) and a small .xlsx writer (xlsx.js)
js/pwa.js               Install tip and service worker registration
js/util.js, icons.js    Small helpers and SVG icons
js/ui/                  Rendering the current view, shared row/budget HTML, toast, UI state
js/views/               Home, History, Budgets and Settings
js/sheets/              Bottom sheets: entry, payback, budget, "What's new"
sw.js                   Service worker for offline use
manifest.webmanifest    Name, colours and icons for installing
icons/                  App, maskable, Apple touch and favicon icons
tests/                  Playwright tests
```

## Publishing updates

The site is served by GitHub Pages from `main`. Work on a branch, open a pull request, and merge it when CI passes. To try a branch on a phone before merging, open `https://raw.githack.com/UnnamedH/qirsh/<branch>/index.html`.

For each release that users will notice:

1. Add an entry at the top of `CHANGELOG` in `js/changelog.js` with the next version number and a short, plain list of what changed. People see it in a "What's new" sheet the first time they open the updated app.
2. Bump `VERSION` in `sw.js` (for example `qirsh-v7`) so installed copies refresh their offline copy.

If you add a new file, also add it to the `APP` list in `sw.js`. `npm test` fails if you forget.
