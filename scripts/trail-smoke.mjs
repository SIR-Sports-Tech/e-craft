import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.holdTracker);

// Before holding: trail should NOT be tracking
let st = await page.evaluate(() => window.__ecraft.getState());
if (st.tracking) throw new Error('trail lit before holding tracker');

// HOLD TRACKER button should grab + equip
await page.click('#btn-tracker');
await page.waitForTimeout(300);
st = await page.evaluate(() => window.__ecraft.getState());
if (!st.flags.hasTracker || !st.flags.trackerHeld || !st.tracking) {
  throw new Error('HOLD TRACKER failed: ' + JSON.stringify(st.flags) + ' tracking=' + st.tracking);
}

// Activate robot + go forest via acceptance for trail follow
await page.evaluate(() => {
  const a = window.__ecraft;
  a.runAcceptanceStep('activate_robot');
  a.runAcceptanceStep('exit_lair');
  a.runAcceptanceStep('enter_vehicle');
  a.runAcceptanceStep('go_forest');
});
await page.waitForTimeout(400);

// Holding is idempotent — second tap keeps it ON
await page.click('#btn-tracker');
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const stillHeld = st.flags.trackerHeld === true && st.tracking === true && st.trailClues > 5;

const ok = errs.length === 0 && stillHeld;
console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      stillHeld,
      trailClues: st.trailClues,
      tracking: st.tracking,
      trackerHeld: st.flags.trackerHeld,
      phase: st.phase,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('TRAIL + HOLD TRACKER SMOKE PASSED');
