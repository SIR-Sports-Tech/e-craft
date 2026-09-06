import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.enterCar && !!window.__ecraft?.visitJail);

// GET IN CAR without robot must work now
await page.locator('#btn-car').dispatchEvent('pointerdown');
await page.waitForTimeout(350);
let st = await page.evaluate(() => window.__ecraft.getState());
const carNoRobot = st.flags.inVehicle === true;

await page.locator('#btn-e').dispatchEvent('pointerdown');
await page.waitForTimeout(250);
st = await page.evaluate(() => window.__ecraft.getState());
const exited = st.flags.inVehicle === false;

// Jail + visit (full acceptance path)
for (const step of ['get_tracker', 'activate_robot', 'exit_lair', 'capture', 'enter_jail', 'lock_cell', 'exit_jail']) {
  await page.evaluate((s) => window.__ecraft.runAcceptanceStep(s), step);
  await page.waitForTimeout(120);
}

await page.locator('#btn-jail').dispatchEvent('pointerdown');
await page.waitForTimeout(1500);
st = await page.evaluate(() => {
  const s = window.__ecraft.getState();
  const scene = window.__phaserGame?.scene?.getScene?.('Game');
  return {
    inJail: !!s.flags.inJailBuilding,
    jailed: !!s.flags.sasquatchJailed,
    visitVisible: !!scene?.jailedSprite?.visible,
    label: scene?.jailedLabel?.text || null,
  };
});

const visitOk = st.inJail && st.jailed && st.visitVisible;

const ok = errs.length === 0 && carNoRobot && exited && visitOk;
console.log(JSON.stringify({ errs: errs.slice(0, 5), carNoRobot, exited, visit: st, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('CAR ENTER + VISIT JAIL SMOKE PASSED');
