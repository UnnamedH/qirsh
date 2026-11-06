import fs from 'node:fs';
import { test, expect, openApp } from './helpers.js';

/* ---------- reading the generated files ---------- */

/** Reads a zip made of stored (uncompressed) entries, which is what the app writes. */
function unzip(buf) {
  const files = {};
  let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8);
    const size = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const name = buf.toString('utf8', p + 30, p + 30 + nameLen);
    const start = p + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error('unexpected compression in ' + name);
    files[name] = buf.toString('utf8', start, start + size);
    p = start + size;
  }
  return files;
}

/** Turns a worksheet's XML into rows of cell values (numbers stay numbers). */
function sheetRows(xml) {
  const rows = [];
  for (const [, n, body] of xml.matchAll(/<row r="(\d+)">(.*?)<\/row>/g)) {
    const row = [];
    for (const [, col, attrs, inner] of body.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(.*?)<\/c>/g)) {
      const i = [...col].reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const unescape = (s) =>
        s
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&');
      row[i] = attrs.includes('inlineStr')
        ? unescape(inner.match(/<t[^>]*>(.*?)<\/t>/)[1])
        : Number(inner.match(/<v>(.*?)<\/v>/)[1]);
    }
    rows[+n - 1] = row;
  }
  return rows;
}

function readWorkbook(path) {
  const files = unzip(fs.readFileSync(path));
  const names = [...files['xl/workbook.xml'].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
  const sheets = {};
  names.forEach((n, i) => (sheets[n] = sheetRows(files[`xl/worksheets/sheet${i + 1}.xml`])));
  return { files, names, sheets };
}

const rowOf = (rows, label) => rows.find((r) => r && r[0] === label);

/* ---------- a known month of data ---------- */

async function setUpMonth(page) {
  await page.clock.install({ time: new Date('2026-11-20T12:00:00') });
  await openApp(page);
  await page.click('[data-act=clearSample]');
  await page.evaluate(() => {
    const s = window.__qirsh.state;
    let n = 0;
    const add = (date, o) =>
      s.tx.push({ id: 't' + ++n, date, account: 'wallet', note: '', createdAt: Date.now() - 1e6 + n, ...o });
    // October, for the "last month" comparison
    add('2026-10-10', { type: 'expense', amount: 40, currency: 'USD', categoryId: 'food' });
    add('2026-10-12', { type: 'income', amount: 600, currency: 'USD', categoryId: 'salary' });
    // November
    add('2026-11-01', {
      type: 'income',
      amount: 650,
      currency: 'USD',
      categoryId: 'salary',
      note: 'Monthly pay',
    });
    add('2026-11-03', {
      type: 'expense',
      amount: 150000,
      currency: 'LBP',
      categoryId: 'food',
      note: 'Manoushe',
    });
    add('2026-11-04', {
      type: 'expense',
      amount: 150000,
      currency: 'LBP',
      categoryId: 'food',
      note: 'Manoushe',
    });
    add('2026-11-05', {
      type: 'expense',
      amount: 25,
      currency: 'USD',
      categoryId: 'transport',
      note: 'Fuel, full tank',
    });
    add('2026-11-06', {
      type: 'expense',
      amount: 2,
      currency: 'USD',
      categoryId: 'coffee',
      note: 'Espresso',
    });
    add('2026-11-07', {
      type: 'advance',
      amount: 100,
      currency: 'USD',
      who: 'Scouts',
      note: 'Camp',
      rate: 89500,
    });
    add('2026-11-09', { type: 'repay', amount: 60, currency: 'USD', advanceId: 't' + n, rate: 89500 });
    add('2026-11-10', {
      type: 'transfer',
      amount: 150,
      currency: 'USD',
      from: 'wallet',
      to: 'savings',
      toAmount: 150,
      toCurrency: 'USD',
    });
    s.budgets.push({ id: 'b1', categoryId: null, period: 'month', amount: 600, currency: 'USD' });
    s.budgets.push({ id: 'b2', categoryId: 'food', period: 'month', amount: 2000000, currency: 'LBP' });
  });
  await page.click('.tabs [data-act=nav][data-v=history]');
}

async function download(page, act) {
  const wait = page.waitForEvent('download');
  await page.click(`[data-act=${act}]`);
  const d = await wait;
  const path = test.info().outputPath(d.suggestedFilename());
  await d.saveAs(path);
  return { name: d.suggestedFilename(), path };
}

/* ---------- tests ---------- */

test('the Excel report has the summary and detail sheets with the right totals', async ({ page }) => {
  await setUpMonth(page);
  const { name, path } = await download(page, 'reportXlsx');
  expect(name).toBe('qirsh-report-2026-11.xlsx');
  const wb = readWorkbook(path);
  expect(wb.names).toEqual(['Summary', 'Spending', 'Income', 'By day', 'Owed to you', 'Entries']);
  for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml'])
    expect(wb.files[f]).toBeTruthy();

  const food = 300000 / 89500;
  const spent = 25 + 2 + food;
  const s = wb.sheets.Summary;
  expect(s[0][0]).toBe('Qirsh · November 2026');
  expect(rowOf(s, 'Earned').slice(1, 4)).toEqual([650, 650 * 89500, 600]);
  expect(rowOf(s, 'Spent')[1]).toBeCloseTo(spent, 2);
  expect(rowOf(s, 'Spent')[3]).toBe(40);
  expect(rowOf(s, 'Net (earned − spent)')[1]).toBeCloseTo(650 - spent, 2);
  expect(rowOf(s, 'Moved into Savings')[1]).toBe(150);
  expect(rowOf(s, 'Net set aside')[1]).toBe(150);
  expect(rowOf(s, 'Paid for others this month')[1]).toBe(100);
  expect(rowOf(s, 'Paid back to you this month')[1]).toBe(60);
  expect(rowOf(s, 'Still owed to you, all time')[1]).toBe(40);
  expect(rowOf(s, 'Transport')[2]).toBeCloseTo(25 / spent, 4);
  expect(rowOf(s, 'All spending').slice(1, 3)).toEqual([600, Math.round(spent * 100) / 100]);
  expect(rowOf(s, 'Fuel, full tank')).toBeTruthy();
  const budgets = s.slice(s.findIndex((r) => r && r[0] === 'Monthly budgets'));
  expect(rowOf(budgets, 'Food').slice(1, 3), 'LL budget stays in LL').toEqual([2000000, 300000]);

  const sp = wb.sheets.Spending;
  expect(sp.slice(1, 4).map((r) => r[0])).toEqual(['Transport', 'Food', 'Coffee']);
  expect(rowOf(sp, 'Food')[4]).toBe(2);
  expect(rowOf(sp, 'Food')[5]).toBe(40);
  expect(rowOf(sp, 'Total')[1]).toBeCloseTo(spent, 2);

  expect(rowOf(wb.sheets.Income, 'Salary')[1]).toBe(650);
  expect(wb.sheets['By day'].length).toBe(1 + 30 + 1);
  expect(rowOf(wb.sheets['Owed to you'], 'Scouts').slice(3, 7)).toEqual([100, 60, 40, 'Open']);

  const entries = wb.sheets.Entries;
  expect(entries.length).toBe(1 + 8);
  expect(entries.map((r) => r[1]).slice(1)).toEqual([
    'Income',
    'Expense',
    'Expense',
    'Expense',
    'Expense',
    'Paid for others',
    'Payback',
    'Transfer',
  ]);
});

test('the CSV lists the month’s entries with plain numbers', async ({ page }) => {
  await setUpMonth(page);
  const { name, path } = await download(page, 'reportCsv');
  expect(name).toBe('qirsh-entries-2026-11.csv');
  const text = fs.readFileSync(path, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).trim().split('\r\n');
  expect(lines.length).toBe(1 + 8);
  expect(lines[0].split(',').slice(0, 6)).toEqual(['Date', 'Type', 'What', 'Note', 'Amount', 'Currency']);
  expect(lines[2]).toMatch(/^2026-11-03,Expense,Food,Manoushe,150000,LBP,/);
  expect(lines[4], 'note with a comma is quoted').toContain('"Fuel, full tank"');
});

test('an empty month still makes a report', async ({ page }) => {
  await setUpMonth(page);
  await page.click('[data-act=month][data-v="1"]');
  const { path } = await download(page, 'reportXlsx');
  const wb = readWorkbook(path);
  expect(rowOf(wb.sheets.Summary, 'Spent')[1]).toBe(0);
  expect(wb.sheets.Summary.flat()).toContain('No spending this month.');
});

test('text in notes cannot break the file', async ({ page }) => {
  await setUpMonth(page);
  await page.evaluate(() => {
    window.__qirsh.state.tx.push({
      id: 'weird',
      type: 'expense',
      amount: 1,
      currency: 'USD',
      categoryId: 'other',
      date: '2026-11-11',
      note: '<b>&"quotes"</b> \u0007 قرش',
      createdAt: Date.now(),
    });
  });
  const { path } = await download(page, 'reportXlsx');
  const wb = readWorkbook(path);
  expect(wb.sheets.Entries.some((r) => r && r[3] === '<b>&"quotes"</b>  قرش')).toBe(true);
});
