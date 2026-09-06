import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const tex = await page.evaluate(() => {
  const t = window.__phaserGame?.textures;
  return {
    sign: !!t?.exists?.('bldg_sign'),
    siren: !!t?.exists?.('sirenhead_sheet'),
    anim: !!window.__phaserGame?.anims?.exists?.('sirenhead-lunge'),
    signsFlag: !!window.__ecraft.getState().buildingSigns,
  };
});

// Force close to sasquatch
await page.evaluate(() => {
  const scene = window.__phaserGame.scene.getScene('Game');
  scene.player.setPosition(scene.sasquatch.x - 80, scene.sasquatch.y);
});
await page.waitForTimeout(500);
const close = await page.evaluate(() => {
  const s = window.__ecraft.getState();
  const scene = window.__phaserGame.scene.getScene('Game');
  return {
    sirenMode: s.sirenMode,
    sheet: scene.sasquatch?.texture?.key,
    scale: Math.round((scene.sasquatch?.scaleX || 0) * 100) / 100,
  };
});

// Move far away
await page.evaluate(() => {
  const scene = window.__phaserGame.scene.getScene('Game');
  scene.player.setPosition(320, 620);
});
await page.waitForTimeout(400);
const far = await page.evaluate(() => window.__ecraft.getState().sirenMode);

const ok =
  errs.length === 0 &&
  tex.sign &&
  tex.siren &&
  tex.anim &&
  tex.signsFlag &&
  close.sirenMode === true &&
  close.sheet === 'sirenhead_sheet' &&
  close.scale >= 2 &&
  far === false;

console.log(JSON.stringify({ errs: errs.slice(0, 5), tex, close, far, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('SIGNS + SIREN HEAD SMOKE PASSED');
