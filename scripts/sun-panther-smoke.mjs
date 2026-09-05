import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.pantherJump);

// Force sunrise — sun should be visible in morning
await page.evaluate(() => window.__ecraft.runAcceptanceStep('sunrise'));
await page.waitForTimeout(150);
let st = await page.evaluate(() => window.__ecraft.getState());
const sunOk = st.sunVisible === true && st.hour >= 5 && st.hour < 12;

// Sleep also lands on morning with sun
await page.click('#btn-sleep');
await page.waitForTimeout(1600);
st = await page.evaluate(() => window.__ecraft.getState());
const sleepSun = st.hour === 7 && st.sunVisible === true;

// Exit house then panther jump
await page.evaluate(() => window.__ecraft.runAcceptanceStep('exit_house'));
await page.waitForTimeout(200);
await page.click('#btn-panther');
await page.waitForTimeout(300);
st = await page.evaluate(() => window.__ecraft.getState());
const pantherOk = st.pantherActive === true;

await page.waitForTimeout(2500);
st = await page.evaluate(() => window.__ecraft.getState());
const fled = st.pantherActive === false;

const ok = errs.length === 0 && sunOk && sleepSun && pantherOk && fled;
console.log(
  JSON.stringify(
    { errs: errs.slice(0, 5), sunOk, sleepSun, pantherOk, fled, hour: st.hour, ok },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('SUN + PANTHER SMOKE PASSED');
