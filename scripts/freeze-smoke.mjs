import { chromium } from 'playwright';
const url = 'http://127.0.0.1:5173/?skiptitle=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.enterRaceCar);

await page.click('#btn-activate'); await page.waitForTimeout(100);
await page.click('#btn-activate'); await page.waitForTimeout(100);
await page.click('#btn-e'); await page.waitForTimeout(150);
await page.click('#btn-race'); await page.waitForTimeout(150);

// Drive around generating trail for ~8 seconds
for (let i = 0; i < 16; i++) {
  const dir = i % 2 === 0 ? 'right' : 'down';
  await page.locator(`#ecraft-pad [data-dir="${dir}"]`).dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  await page.locator(`#ecraft-pad [data-dir="${dir}"]`).dispatchEvent('pointerup');
  await page.waitForTimeout(50);
  // still responsive?
  const alive = await page.evaluate(() => !!window.__ecraft?.getState?.());
  if (!alive) throw new Error('game died');
}

await page.click('#btn-recover');
await page.waitForTimeout(200);
const st = await page.evaluate(() => window.__ecraft.getState());
const ok = errs.length === 0 && !!st;
console.log(JSON.stringify({ errs: errs.slice(0,5), phase: st.phase, inVehicle: st.flags.inVehicle, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('FREEZE SMOKE PASSED');
