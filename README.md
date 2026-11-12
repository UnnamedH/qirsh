# Qirsh

A small, phone-first budget tracker for living with two currencies: US dollars and Lebanese lira (LL).

Live at **https://unnamedh.github.io/qirsh/**. It can be installed to the home screen on iPhone and Android, and it always opens from the phone, with or without a connection.

Plain HTML, CSS and JavaScript modules: no framework and no build step. GitHub Pages serves the files as they are.

## Features

- Wallet, Savings and Whish accounts, each holding both USD and LL
- Expenses entered as what you paid and the change you got back, or, if you turn it on, price first: say what you paid with and the change, or the rest paid on top, is worked out
- LL typed in thousands everywhere (type 385 for 385,000 LL)
- Transfers between accounts and exchanges between $ and LL at a rate you set
- Money paid on someone else's behalf, with paybacks, kept out of budgets
- Weekly and monthly budgets, overall or per category
- Quick add for repeat entries, history by month with search and filters
- A monthly report as an Excel file (summary, spending by category, savings, owed, budgets, every entry), and a CSV of the month's entries
- Accent colours and a light/dark theme, a "What's new" note after each update
- Editable categories with emoji, JSON backup export and import

## Privacy

- **All data stays on the phone**, in the browser's `localStorage`. There is no account, no server, no analytics and no tracking. Nothing the user enters is ever sent anywhere, so neither the developer nor GitHub can see it.
- **The app loads nothing from other websites.** Fonts are in `fonts/`, and a Content Security Policy in `index.html` makes the browser block scripts, fonts and requests to any other site. `tests/privacy.spec.js` checks both.
- **Data isn't encrypted on the device.** Anyone who can unlock the phone and open the app can see it. Clearing the browser's data or removing the app deletes it, which is what backups are for.
- **The code is what users trust.** GitHub Pages serves whatever is on `main`, so keep two-factor authentication on for the GitHub account and protect `main` so changes go through pull requests.

## Offline

The service worker (`sw.js`) stores every file on install, and the app always opens from that copy. A new version downloads in full in the background and only replaces the old one once every file has arrived; then the app offers to reload. The very first visit needs a connection.

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
| `npm run stamp`        | Updates `BUILD` in `sw.js` after you change app files     |
| `npm test`             | Runs the browser tests in `tests/` (Playwright)           |
| `npm run lint`         | Checks the code for mistakes (ESLint)                     |
| `npm run format`       | Reformats every file (Prettier)                           |
| `npm run format:check` | Reports files that need formatting, without changing them |

Locally the tests use the Microsoft Edge that comes with Windows. On GitHub they use Chromium. Every pull request runs lint, the format check and the tests (`.github/workflows/ci.yml`).

## Project layout

```
index.html              Page skeleton: header, the four views, tab bar, sheet and toast containers
css/styles.css          All styles; colours are CSS variables, with a dark set
fonts/                  Geist and Geist Mono (SIL Open Font License)
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
js/handoff.js           Moving data to frata.cc in a link, and reading it on arrival
js/report/              Monthly report: the data (monthly.js) and a small .xlsx writer (xlsx.js)
js/pwa.js               Install tip and service worker registration
js/util.js, icons.js    Small helpers and SVG icons
js/ui/                  Rendering the current view, shared row/budget HTML, toast, UI state
js/views/               Home, History, Budgets and Settings
js/sheets/              Bottom sheets: entry, payback, budget, "What's new"
sw.js                   Service worker: offline-first, all-or-nothing updates
manifest.webmanifest    Name, colours and icons for installing
icons/                  App, maskable, Apple touch and favicon icons
scripts/                `npm run stamp` and the BUILD fingerprint it writes into sw.js
tests/                  Playwright tests, and server.mjs, a test server that can be slow or publish a fake release
```

## Publishing updates

The site is served by GitHub Pages from `main`. Work on a branch, open a pull request, and merge it when CI passes. To try a branch on a phone before merging, open `https://raw.githack.com/UnnamedH/qirsh/<branch>/index.html`.

For each release that users will notice:

1. Add an entry at the top of `CHANGELOG` in `js/changelog.js` with the next version number and a short, plain list of what changed. People see it in a "What's new" sheet after they reload into the new version.
2. Run `npm run stamp` before committing. It writes a fingerprint of all the app's files into `BUILD` in `sw.js`, which is how phones notice there's something new.

If you add a new file, also add it to the `APP` list in `sw.js`. `npm test` fails if a file is missing from the list or if `BUILD` is out of date, so CI catches both.
