/* Settings → Feedback & bugs: an email link with the version and phone, and nothing else. */
import { test, expect, openApp } from './helpers.js';

test('the feedback link opens an email with the version and phone filled in', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  const version = await page.evaluate(() => window.__qirsh.APP_VERSION);
  const size = await page.evaluate(() => innerWidth + '×' + innerHeight);
  const intro = `Frata feedback (version ${version}, Android, Chrome, ${size}, on Settings):\n\n`;

  // Email only: no phone number or chat link anywhere in the app.
  await expect(page.locator('#feedbackSec a')).toHaveCount(1);
  const mail = await page.locator('#feedbackSec a', { hasText: 'Email' }).getAttribute('href');
  expect(mail.startsWith('mailto:support@frata.cc?')).toBe(true);
  const q = new URLSearchParams(mail.split('?')[1]);
  expect(q.get('subject')).toBe('Frata feedback');
  expect(q.get('body')).toBe(intro);
});

test('the phone is described from the browser, never from the person’s data', async ({ page }) => {
  await openApp(page);
  const labels = await page.evaluate(async () => {
    const { deviceLabel } = await import('/js/feedback.js');
    return [
      deviceLabel('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'),
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
      ),
      deviceLabel('Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'),
    ];
  });
  expect(labels).toEqual(['Android, Chrome', 'Android, Samsung Internet', 'computer, Firefox']);
});

test('a one-time note on Home says feedback can be sent', async ({ page }) => {
  await openApp(page, { showTips: true });
  const tip = page.locator('#alerts .banner', { hasText: 'report bugs' });
  // Not over the example data, and not next to the price-first tip.
  await expect(tip).toHaveCount(0);
  await page.click('[data-act=clearSample]');
  await expect(
    page.locator('[data-act=showDemo], .banner', { hasText: 'type the price' }).first(),
  ).toBeVisible();
  await expect(tip).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('qirsh.tipPriceFirst', 'done'));
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.click('.tabs [data-act=nav][data-v=home]');
  await expect(tip).toBeVisible();
  // Only on Home.
  await page.click('.tabs [data-act=nav][data-v=history]');
  await expect(tip).toHaveCount(0);
  await page.click('.tabs [data-act=nav][data-v=home]');

  // "Send feedback" opens the feedback sheet, and the note doesn't come back.
  await tip.locator('[data-act=feedbackOpen]').click();
  await expect(page.locator('#sheet h2')).toHaveText('Feedback & bugs');
  await page.click('#sheet [data-act=close]');
  await expect(tip).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(tip).toHaveCount(0);
});

test('"Got it" puts the feedback note away for good', async ({ page }) => {
  await openApp(page, { showTips: true, storage: { 'qirsh.tipPriceFirst': 'done' } });
  await page.click('[data-act=clearSample]');
  await page.click('[data-act=feedbackTipDone]');
  await expect(page.locator('#alerts .banner', { hasText: 'report bugs' })).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(page.locator('#alerts .banner', { hasText: 'report bugs' })).toHaveCount(0);
});

test('the button at the top opens Feedback & bugs from any tab, saying which tab', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=budgets]');
  await page.click('.top [data-act=feedbackOpen]');
  await expect(page.locator('#sheet h2')).toHaveText('Feedback & bugs');
  const mail = await page.locator('#sheet a', { hasText: 'Email' }).getAttribute('href');
  expect(mail).toMatch(/^mailto:support@frata\.cc\?/);
  expect(new URLSearchParams(mail.split('?')[1]).get('body')).toMatch(/, \d+×\d+, on Budgets\):\n\n$/);
});

test('Support Frata opens the maker’s Whish payment link', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  // Plus, feedback and support share one Frata section.
  await expect(page.locator('#frataSec h3')).toHaveText(['Frata Plus', 'Feedback & bugs', 'Support Frata']);
  const link = page.locator('#supportSec a', { hasText: 'Buy me a coffee' });
  await expect(link).toHaveAttribute('href', 'https://whish.money/app/pay/ynLO2j39h');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
});

test('the heart at the top opens Support Frata, with the same coffee link as Settings', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=history]');
  const heart = page.locator('.top [data-act=supportOpen]');
  await expect(heart).toHaveAttribute('aria-label', 'Support Frata');
  await heart.click();
  await expect(page.locator('#sheet h2')).toHaveText('Support Frata');
  const link = page.locator('#sheet a', { hasText: 'Buy me a coffee' });
  await expect(link).toHaveAttribute('href', 'https://whish.money/app/pay/ynLO2j39h');
  await expect(link).toHaveAttribute('target', '_blank');
  await page.click('#sheet [data-act=close]');
  await expect(page.locator('#sheet')).toBeHidden();
  // Next to the feedback button, both in the header.
  await expect(page.locator('.top-end [data-act=feedbackOpen]')).toBeVisible();
});

test('the app holds no phone number or chat link', async ({ page }) => {
  const files = ['js/config.js', 'js/feedback.js', 'js/sheets/feedback.js', 'js/sheets/support.js'];
  const fs = await import('node:fs');
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    expect(text, f).not.toMatch(/wa\.me|whatsapp|\+?961\s?\d/i);
  }
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  expect(await page.locator('#v-settings').innerHTML()).not.toMatch(/wa\.me|whatsapp/i);
});
