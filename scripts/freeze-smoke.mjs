import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(`${base}/?skiptitle=1&new=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.enterRaceCar);

await page.click('#btn-activate');
await page.waitForTimeout(100);
await page.click('#btn-activate');
await page.waitForTimeout(100);
await page.click('#btn-e');
await page.waitForTimeout(150);
await page.click('#btn-race');
await page.waitForTimeout(150);

// Drive around generating trail for ~8 seconds
for (let i = 0; i < 16; i++) {
  const dir = i % 2 === 0 ? 'right' : 'down';
  await page.locator(`#ecraft-pad [data-dir="${dir}"]`).dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  await page.locator(`#ecraft-pad [data-dir="${dir}"]`).dispatchEvent('pointerup');
  await page.waitForTimeout(50);
  const alive = await page.evaluate(() => !!window.__ecraft?.getState?.());
  if (!alive) throw new Error('game died');
}

await page.click('#btn-recover');
await page.waitForTimeout(200);

// Force a save with a known phase marker
const before = await page.evaluate(() => {
  window.__ecraft.save();
  return window.__ecraft.getState();
});

// Reload WITHOUT continue=1 — must auto-resume (v1.0.9)
await page.goto(`${base}/?skiptitle=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const after = await page.evaluate(() => {
  const raw = localStorage.getItem('ecraft_save_v02');
  const save = raw ? JSON.parse(raw) : null;
  return { state: window.__ecraft.getState(), savePhase: save?.phase, savePlayer: save?.player };
});

const resumed =
  !!after.savePhase &&
  after.state?.phase === after.savePhase &&
  typeof after.savePlayer?.x === 'number';

const ok = errs.length === 0 && !!before && resumed;
console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      beforePhase: before.phase,
      afterPhase: after.state?.phase,
      savePhase: after.savePhase,
      resumed,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('FREEZE SMOKE PASSED (drive + recover + auto-resume)');
