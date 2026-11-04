# Qirsh

A small, phone-first budget tracker for living with two currencies: US dollars and Lebanese lira (LL).

It's a single `index.html` with no build step and no dependencies. Data is stored only on the device, in `localStorage` (and in native storage when it runs inside the Capacitor iOS shell).

## Features

- Wallet, Savings and Whish accounts, each holding both USD and LL
- Expenses and income paid in one or both currencies, including change you get back
- Transfers between accounts and exchanges between $ and LL at a rate you set
- Weekly and monthly budgets, overall or per category
- Quick add for repeat entries, history by month with search and filters
- Editable categories with emoji, JSON backup export and import

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

The first launch shows example data; tap **Start fresh** to clear it.
