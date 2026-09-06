import { chromium } from 'playwright';
const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/?skiptitle=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // phone-ish
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(2500);
await page.waitForSelector('#btn-robot', { timeout: 10000 });
await page.waitForFunction(() => !!window.__ecraft?.activateRobot, null, { timeout: 10000 });

// One ROBOT tap = tracker + robot outdoors
await page.locator('#btn-robot').dispatchEvent('pointerdown');
await page.waitForTimeout(350);
let st = await page.evaluate(() => window.__ecraft.getState());
const activated = st.flags.hasTracker && st.flags.robotActive && !st.flags.inLair;

// GET IN CAR
await page.click('#btn-car');
await page.waitForTimeout(300);
st = await page.evaluate(() => window.__ecraft.getState());
const inCar = st.flags.inVehicle === true;

// Drive with finger stick API
const x0 = st.player.x;
await page.evaluate(() => window.__ecraftSetStick?.(1, 0));
await page.waitForTimeout(700);
await page.evaluate(() => window.__ecraftSetStick?.(0, 0));
st = await page.evaluate(() => window.__ecraft.getState());
const drove = Math.abs(st.player.x - x0) > 25;

const ok = errs.length === 0 && activated && inCar && drove;
console.log(JSON.stringify({ errs, activated, inCar, drove, x0, x1: st.player.x, flags: st.flags, ok }, null, 2));
await page.screenshot({ path: 'docs/ecraft-controls-fixed.png' });
await browser.close();
if (!ok) process.exit(1);
console.log('CONTROLS SMOKE PASSED');
