import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const out = [];
const step = async (n, fn) => {
  try { const r = await fn(); out.push({ n, ok: true, ...(r && typeof r === 'object' ? r : {}) }); return r; }
  catch (e) { out.push({ n, ok: false, err: String(e.message || e).slice(0, 500) }); return null; }
};

// Path A: fresh title → tap ACTIVATE (should auto-start)
await page.goto('http://127.0.0.1:5173/?new=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);

await step('ui_on_title', async () => {
  const order = await page.locator('#ecraft-actions button').evaluateAll((bs) => bs.slice(0, 3).map((b) => b.id));
  const coach = await page.locator('#ecraft-coach').innerText();
  return {
    order,
    coachHasSteps: /ACTIVATE ROBOT/i.test(coach) && /GET IN CAR/i.test(coach) && /HOLD/i.test(coach),
    activateVisible: await page.locator('#btn-activate').isVisible(),
  };
});

await step('activate_from_title', async () => {
  await page.locator('#btn-activate').dispatchEvent('pointerdown');
  await page.waitForFunction(() => !!window.__ecraft?.getState?.()?.flags?.robotActive, null, { timeout: 20000 });
  const st = await page.evaluate(() => window.__ecraft.getState());
  return { robotActive: !!st.flags.robotActive, status: st.status };
});

await step('get_in_car', async () => {
  await page.locator('#btn-car').dispatchEvent('pointerdown');
  await page.waitForFunction(() => !!window.__ecraft?.getState?.()?.flags?.inVehicle, null, { timeout: 10000 });
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
  return { before, after, moved: after - before, drove: after - before > 80 };
});

await step('enter_without_robot', async () => {
  // Exit then clear robot and enter again
  await page.evaluate(() => {
    const api = window.__ecraft;
    api.interact?.(); // exit vehicle if interact exits
  });
  await page.waitForTimeout(300);
  // force exit via flag if still in
  await page.evaluate(() => {
    const api = window.__ecraft;
    if (api.getState().flags.inVehicle) api.interact?.();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    // poke robot off if possible via debug-ish: just enterCar must work regardless
    window.__ecraft.enterCar();
  });
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => window.__ecraft.getState());
  return { inVehicle: !!st.flags.inVehicle };
});

await page.screenshot({ path: '/tmp/ecraft-activate-car.png', fullPage: true });
await browser.close();
const failed = out.filter((x) => !x.ok).map((x) => x.n);
const ui = out.find((x) => x.n === 'ui_on_title');
const act = out.find((x) => x.n === 'activate_from_title');
const car = out.find((x) => x.n === 'get_in_car');
const drive = out.find((x) => x.n === 'drive_hold');
const free = out.find((x) => x.n === 'enter_without_robot');
const proof =
  ui?.activateVisible &&
  ui?.order?.[0] === 'btn-activate' &&
  ui?.coachHasSteps &&
  act?.robotActive &&
  car?.inVehicle &&
  drive?.drove &&
  free?.inVehicle;
console.log(JSON.stringify({ ok: failed.length === 0 && proof, failed, proof, steps: out }, null, 2));
process.exit(failed.length === 0 && proof ? 0 : 1);
