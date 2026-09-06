import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.layBed && !!window.__ecraft?.toggleBuild);

async function tap(id) {
  await page.locator(`#${id}`).dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
}

// Enter house (skip door via acceptance)
await page.evaluate(() => window.__ecraft.runAcceptanceStep('enter_house'));
await page.waitForTimeout(200);

// Walk a bit inside
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
await page.waitForTimeout(400);
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
let st = await page.evaluate(() => window.__ecraft.getState());
const walked = st.flags.inHouse && String(st.playerAnim || '').includes('walk');

await tap('btn-bed');
await page.waitForTimeout(250);
st = await page.evaluate(() => window.__ecraft.getState());
const lying = st.house?.lyingInBed === true;

await tap('btn-bed');
await page.waitForTimeout(200);

// TV + cook via API positions
await page.evaluate(() => {
  const scene = window.__phaserGame.scene.getScene('Game');
  scene.player.setPosition(scene.houseTv.x, scene.houseTv.y + 20);
  scene.toggleTv();
  scene.player.setPosition(scene.houseKitchen.x, scene.houseKitchen.y + 20);
  scene.cookOrEat();
});
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const tvOk = st.house?.tvOn === true;
const cookOk = st.house?.cookedMeal === true;

await tap('btn-build');
await tap('btn-block');
await page.evaluate(() => {
  const scene = window.__phaserGame.scene.getScene('Game');
  scene.player.setPosition(400, 1100);
  scene.placeCraftBlock();
  scene.placeCraftBlock();
});
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const buildOk = st.house?.buildMode === true && st.house?.blocksPlaced >= 2;

const tex = await page.evaluate(() => {
  const t = window.__phaserGame.textures;
  return ['tv_on', 'food_plate', 'block_grass', 'block_stone', 'block_brick'].every((k) => t.exists(k));
});

const ok = errs.length === 0 && walked && lying && tvOk && cookOk && buildOk && tex;
console.log(
  JSON.stringify({ errs: errs.slice(0, 5), walked, lying, tvOk, cookOk, buildOk, tex, house: st.house, ok }, null, 2),
);
await browser.close();
if (!ok) process.exit(1);
console.log('HOUSE LIFE SMOKE PASSED');
