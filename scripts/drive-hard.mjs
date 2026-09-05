import { chromium } from 'playwright';
const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/?skiptitle=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(2000);
await page.waitForSelector('#btn-car');
await page.waitForFunction(() => !!window.__ecraft?.enterCar);

await page.click('#btn-activate');
await page.waitForTimeout(150);
await page.click('#btn-activate');
await page.waitForTimeout(150);
await page.click('#btn-e');
await page.waitForTimeout(200);
await page.click('#btn-car');
await page.waitForTimeout(200);

const before = await page.evaluate(() => {
  const s = window.__ecraft.getState();
  return { x: s.player.x, inVehicle: s.flags.inVehicle, move: window.__ecraftMove };
});

await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
await page.waitForTimeout(1000);
const mid = await page.evaluate(() => ({
  x: window.__ecraft.getState().player.x,
  move: { ...window.__ecraftMove },
  vx: window.__ecraft.getState().player.x,
}));
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
await page.waitForTimeout(100);

const after = await page.evaluate(() => window.__ecraft.getState().player.x);
const delta = after - before.x;
const ok = errs.length === 0 && before.inVehicle && mid.move.x === 1 && delta > 80;
console.log(JSON.stringify({ errs, before, midMove: mid.move, delta, ok }, null, 2));
await page.screenshot({ path: 'docs/ecraft-drive-hard.png' });
await browser.close();
if (!ok) process.exit(1);
console.log('DRIVE HARD PASSED');
