import { chromium } from 'playwright';
const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/?skiptitle=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForSelector('#btn-race');
await page.waitForFunction(() => !!window.__ecraft?.enterRaceCar);

const prep = async () => {
  await page.click('#btn-activate');
  await page.waitForTimeout(120);
  await page.click('#btn-activate');
  await page.waitForTimeout(120);
  await page.click('#btn-e');
  await page.waitForTimeout(200);
};

await prep();

async function driveTest(btn) {
  await page.click(btn);
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => {
    const s = window.__ecraft.getState();
    return { x: s.player.x, inVehicle: s.flags.inVehicle };
  });
  await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(800);
  await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
  const after = await page.evaluate(() => window.__ecraft.getState().player.x);
  // exit
  await page.click('#btn-e');
  await page.waitForTimeout(150);
  return { before, delta: after - before.x, ok: before.inVehicle && after - before.x > 60 };
}

const patrol = await driveTest('#btn-car');
const race = await driveTest('#btn-race');
const ok = errs.length === 0 && patrol.ok && race.ok;
console.log(JSON.stringify({ errs, patrol, race, ok }, null, 2));
await page.screenshot({ path: 'docs/ecraft-race-car.png' });
await browser.close();
if (!ok) process.exit(1);
console.log('BOTH CARS DRIVE PASSED');
