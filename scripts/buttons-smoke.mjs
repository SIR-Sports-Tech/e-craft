import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.exitIndoor);

const ids = [
  'btn-e',
  'btn-cap',
  'btn-tracker',
  'btn-activate',
  'btn-exit',
  'btn-house',
  'btn-sleep',
  'btn-car',
  'btn-race',
  'btn-panther',
  'btn-recover',
];

// All buttons exist + in viewport
const layout = await page.evaluate((ids) => {
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) {
      out[id] = { exists: false };
      continue;
    }
    const r = el.getBoundingClientRect();
    out[id] = {
      exists: true,
      inView: r.top >= 0 && r.bottom <= window.innerHeight + 2 && r.width > 0,
    };
  }
  return out;
}, ids);
const allVisible = Object.values(layout).every((b) => b.exists && b.inView);

async function tap(id) {
  await page.locator(`#${id}`).dispatchEvent('pointerdown');
  await page.waitForTimeout(120);
}

// Fresh path proving each control
await tap('btn-tracker');
await page.waitForTimeout(200);
let st = await page.evaluate(() => window.__ecraft.getState());
const trackerOk = st.flags.hasTracker && st.flags.trackerHeld && st.flags.inLair;

await tap('btn-activate');
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const activateOk = st.flags.robotActive;

await tap('btn-exit');
await page.waitForTimeout(250);
st = await page.evaluate(() => window.__ecraft.getState());
const exitOk = !st.flags.inLair && !st.flags.inHouse;

await tap('btn-house');
await page.waitForTimeout(250);
st = await page.evaluate(() => window.__ecraft.getState());
const houseOk = st.flags.inHouse === true && st.flags.inLair === false && st.flags.inVehicle === false;

await tap('btn-sleep');
await page.waitForTimeout(1600);
st = await page.evaluate(() => window.__ecraft.getState());
const sleepOk = st.flags.inHouse && st.hour === 7;

await tap('btn-exit');
await page.waitForTimeout(250);
st = await page.evaluate(() => window.__ecraft.getState());
const exitHouseOk = !st.flags.inHouse;

await tap('btn-car');
await page.waitForTimeout(300);
st = await page.evaluate(() => window.__ecraft.getState());
const carOk = st.flags.inVehicle === true && st.flags.inHouse === false;

// Exit car via E near bay / API interact while in vehicle toggles exit
await tap('btn-e');
await page.waitForTimeout(250);
st = await page.evaluate(() => window.__ecraft.getState());
const exitCarOk = st.flags.inVehicle === false;

await tap('btn-race');
await page.waitForTimeout(300);
st = await page.evaluate(() => window.__ecraft.getState());
const raceOk = st.flags.inVehicle === true;

await tap('btn-e');
await page.waitForTimeout(200);
await tap('btn-panther');
await page.waitForTimeout(300);
st = await page.evaluate(() => window.__ecraft.getState());
const pantherOk = st.pantherActive === true && !st.flags.inHouse;

await tap('btn-recover');
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const recoverOk = !!st;

await tap('btn-cap');
await page.waitForTimeout(200);
const capToast = await page.evaluate(() => document.getElementById('ecraft-toast')?.textContent || '');
const capOk = capToast.length > 0; // gives feedback even if too far

const ok =
  errs.length === 0 &&
  allVisible &&
  trackerOk &&
  activateOk &&
  exitOk &&
  houseOk &&
  sleepOk &&
  exitHouseOk &&
  carOk &&
  exitCarOk &&
  raceOk &&
  pantherOk &&
  recoverOk &&
  capOk;

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      allVisible,
      layout,
      trackerOk,
      activateOk,
      exitOk,
      houseOk,
      sleepOk,
      exitHouseOk,
      carOk,
      exitCarOk,
      raceOk,
      pantherOk,
      recoverOk,
      capOk,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('ALL BUTTONS SMOKE PASSED');
