import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForSelector('#btn-restart');

// Put a fake save so restart clears it
await page.evaluate(() => {
  localStorage.setItem('ecraft_save_v02', JSON.stringify({ version: 2, phase: 'AtSecurityHQ', flags: {}, player: { x: 1, y: 1 }, builds: [], savedAt: 'x' }));
});

// Open confirm
await page.locator('#btn-restart').dispatchEvent('pointerdown');
await page.waitForTimeout(150);
const shown = await page.evaluate(() => document.getElementById('ecraft-confirm')?.classList.contains('show'));
const text = await page.evaluate(() => document.getElementById('ecraft-confirm')?.innerText || '');
const asks = /are you sure/i.test(text) && /Y/i.test(text) && /N/i.test(text);

// N cancels
await page.locator('#btn-no').dispatchEvent('pointerdown');
await page.waitForTimeout(150);
const closed = await page.evaluate(() => !document.getElementById('ecraft-confirm')?.classList.contains('show'));
const stillSaved = await page.evaluate(() => !!localStorage.getItem('ecraft_save_v02'));

// Y restarts
await page.locator('#btn-restart').dispatchEvent('pointerdown');
await page.waitForTimeout(100);
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle' }),
  page.locator('#btn-yes').dispatchEvent('pointerdown'),
]);
await page.waitForTimeout(1500);
const after = await page.evaluate(() => ({
  save: localStorage.getItem('ecraft_save_v02'),
  url: location.href,
  hasRestart: !!document.getElementById('btn-restart'),
}));

const ok =
  errs.length === 0 &&
  shown &&
  asks &&
  closed &&
  stillSaved &&
  after.save === null &&
  after.url.includes('new=1') &&
  after.hasRestart;

console.log(JSON.stringify({ errs: errs.slice(0, 5), shown, asks, closed, stillSaved, after, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('RESTART Y/N SMOKE PASSED');
