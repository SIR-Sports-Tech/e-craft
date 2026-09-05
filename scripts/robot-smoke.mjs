import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.activate);

async function tap(id) {
  await page.locator(`#${id}`).dispatchEvent('pointerdown');
  await page.waitForTimeout(150);
}

await tap('btn-activate'); // one tap = tracker + robot
await page.waitForTimeout(200);
let st = await page.evaluate(() => window.__ecraft.getState());
const activated = st.flags.robotActive === true && st.flags.hasTracker === true && st.robot?.active === true;

await tap('btn-exit');
await page.waitForTimeout(400);
st = await page.evaluate(() => window.__ecraft.getState());
const beside =
  st.robot?.visible === true &&
  typeof st.robot.dist === 'number' &&
  st.robot.dist < 80;

// Walk — robot should stay close / catch up
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
await page.waitForTimeout(900);
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
await page.waitForTimeout(500);
st = await page.evaluate(() => window.__ecraft.getState());
const following =
  st.robot?.visible === true &&
  st.robot.dist < 120 &&
  (st.robot.anim === 'robot-walk' || st.robot.anim === 'robot-idle');

// Enter car — robot rides along
await tap('btn-car');
await page.waitForTimeout(300);
st = await page.evaluate(() => window.__ecraft.getState());
const riding = st.flags.inVehicle && st.robot?.visible === true && st.robot.dist < 80;

const ok = errs.length === 0 && activated && beside && following && riding;
console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      activated,
      beside,
      following,
      riding,
      robot: st.robot,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('ROBOT FOLLOW SMOKE PASSED');
