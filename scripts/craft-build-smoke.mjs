import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(
  () => !!window.__ecraft?.toggleBuild && !!window.__ecraft?.breakBlock && !!window.__ecraft?.placeBlock,
);

// Clear any prior craft save
await page.evaluate(() => localStorage.removeItem('ecraft_craft_blocks_v1'));

await page.locator('#btn-build').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
let st = await page.evaluate(() => window.__ecraft.getState());
const modeOn = st.craft?.mode === true;
const hotbar = await page.evaluate(() => document.getElementById('ecraft-hotbar')?.classList.contains('show'));
const placeBtn = await page.evaluate(() => !!document.getElementById('btn-place'));

// Select stone (index 2)
await page.locator('#ecraft-hotbar [data-block="2"]').dispatchEvent('pointerdown');
await page.waitForTimeout(100);

// Place a few blocks outdoors via PLACE API + stacking
await page.evaluate(() => {
  const a = window.__ecraft;
  a.selectBlock(2);
  const scene = window.__phaserGame.scene.getScene('Game');
  scene.player.setPosition(900, 760);
  scene.facing = 1;
  scene.facingDir = 'right';
  a.placeBlock();
  scene.player.x += 40;
  a.placeBlock();
  scene.player.x += 40;
  a.placeBlock();
  // stack on same cell
  a.placeBlock();
});
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const placed = (st.craft?.count || 0) >= 4;

// Break one
await page.locator('#btn-break').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const afterBreak = st.craft?.count;

const tex = await page.evaluate(() => {
  const t = window.__phaserGame.textures;
  return [
    'block_dirt',
    'block_grass',
    'block_stone',
    'block_water',
    'block_sand',
    'block_leaf',
    'block_glass',
    'block_iron',
    'block_wool',
  ].every((k) => t.exists(k));
});

const slots = await page.evaluate(() => document.querySelectorAll('#ecraft-hotbar [data-block]').length);

const ok = errs.length === 0 && modeOn && hotbar && placeBtn && placed && afterBreak < 4 && tex && slots >= 12;
console.log(
  JSON.stringify(
    { errs: errs.slice(0, 5), modeOn, hotbar, placeBtn, placed, afterBreak, tex, slots, craft: st.craft, ok },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('CRAFT BUILD (MINECRAFT-LIKE) SMOKE PASSED');
