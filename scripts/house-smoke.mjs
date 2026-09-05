import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.enterHouse && !!window.__ecraft?.sleep);

const before = await page.evaluate(() => {
  const s = window.__ecraft.getState();
  return { hour: s.hour, dayPhase: s.dayPhase, inHouse: s.flags.inHouse };
});

// Force evening-ish via sleep path: enter house + sleep
await page.locator('#btn-house').dispatchEvent('pointerdown');
await page.waitForTimeout(1400); // door swing then enter
let st = await page.evaluate(() => window.__ecraft.getState());
if (!st.flags.inHouse) throw new Error('GO HOME did not enter house');

await page.click('#btn-sleep');
await page.waitForTimeout(1600); // fade sleep tween

st = await page.evaluate(() => window.__ecraft.getState());
const slept =
  st.flags.inHouse === true &&
  st.hour === 7 &&
  (st.dayPhase === 'morning' || st.dayPhase === 'day');

// Exit house
await page.evaluate(() => window.__ecraft.runAcceptanceStep('exit_house'));
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const exited = st.flags.inHouse === false;

const ok = errs.length === 0 && slept && exited;
console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      before,
      afterHour: st.hour,
      afterPhase: st.dayPhase,
      slept,
      exited,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('HOUSE + SLEEP SMOKE PASSED');
