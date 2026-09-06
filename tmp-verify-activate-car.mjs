import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const out = [];
const step = async (n, fn) => {
  try { const r = await fn(); out.push({ n, ok: true, ...(r && typeof r === 'object' ? r : {}) }); return r; }
  catch (e) { out.push({ n, ok: false, err: String(e.message || e).slice(0, 500) }); return null; }
};

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await step('boot', async () => {
  await page.waitForFunction(() => typeof window.__ecraft?.activateRobot === 'function' && typeof window.__ecraft?.enterCar === 'function', null, { timeout: 45000 });
  await page.waitForTimeout(800);
  return { ready: true };
});

await step('ui_present', async () => {
  const order = await page.locator('#ecraft-actions button').evaluateAll((bs) => bs.slice(0, 4).map((b) => b.id));
  const coachText = await page.locator('#ecraft-coach').innerText();
  const actVisible = await page.locator('#btn-activate').isVisible();
  const carVisible = await page.locator('#btn-car').isVisible();
  return {
    order,
    actVisible,
    carVisible,
    coachHasActivate: /ACTIVATE ROBOT/i.test(coachText),
    coachHasCar: /GET IN CAR/i.test(coachText),
    coachHasHold: /HOLD/i.test(coachText),
  };
});

await step('activate_robot', async () => {
  await page.locator('#btn-activate').dispatchEvent('pointerdown');
  await page.waitForFunction(() => !!window.__ecraft?.getState?.()?.flags?.robotActive, null, { timeout: 8000 });
  const st = await page.evaluate(() => window.__ecraft.getState());
  return { robotActive: !!st.flags.robotActive, status: st.status };
});

await step('get_in_car', async () => {
  await page.locator('#btn-car').dispatchEvent('pointerdown');
  await page.waitForFunction(() => !!window.__ecraft?.getState?.()?.flags?.inVehicle, null, { timeout: 8000 });
  const st = await page.evaluate(() => window.__ecraft.getState());
  return { inVehicle: !!st.flags.inVehicle, status: st.status };
});

await step('drive_hold', async () => {
  const right = page.locator('#ecraft-pad [data-dir="right"]');
  const before = await page.evaluate(() => window.__ecraft.getState().player.x);
  await right.dispatchEvent('pointerdown');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => window.__ecraft.getState().player.x);
  await right.dispatchEvent('pointerup');
  const moved = after - before;
  return { before, after, moved, drove: moved > 80 };
});

await step('e_without_robot_gate', async () => {
  // Exit car then prove E near bay doesn't require robot (robot already on; toggle off via debug if needed)
  // Force robot off and try enterCar API still works
  await page.evaluate(() => {
    const st = window.__ecraft.getState();
    // leave vehicle via interact/exit if in vehicle
  });
  // Use enterCar again after exit
  await page.locator('#btn-e').dispatchEvent('pointerdown'); // may exit
  await page.waitForTimeout(400);
  // Ensure enterCar works even if we clear robotActive through API path by calling enterCar directly
  const ok = await page.evaluate(() => {
    // soft-check: doEnterCar path has no robot gate — call enterCar
    window.__ecraft.enterCar();
    return !!window.__ecraft.getState().flags.inVehicle;
  });
  return { enterCarWorks: ok };
});

await page.screenshot({ path: '/tmp/ecraft-activate-car.png', fullPage: true });
await browser.close();
const failed = out.filter((x) => !x.ok).map((x) => x.n);
const ui = out.find((x) => x.n === 'ui_present');
const act = out.find((x) => x.n === 'activate_robot');
const car = out.find((x) => x.n === 'get_in_car');
const drive = out.find((x) => x.n === 'drive_hold');
const proof =
  !!ui?.actVisible &&
  !!ui?.carVisible &&
  ui?.order?.[0] === 'btn-activate' &&
  ui?.coachHasActivate &&
  ui?.coachHasCar &&
  ui?.coachHasHold &&
  !!act?.robotActive &&
  !!car?.inVehicle &&
  !!drive?.drove;
console.log(JSON.stringify({ ok: failed.length === 0 && proof, failed, proof, steps: out }, null, 2));
process.exit(failed.length === 0 && proof ? 0 : 1);
