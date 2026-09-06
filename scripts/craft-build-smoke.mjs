import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.toggleBuild && !!window.__ecraft?.breakBlock);

// Clear any prior craft save
await page.evaluate(() => localStorage.removeItem('ecraft_craft_blocks_v1'));

await page.locator('#btn-build').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
let st = await page.evaluate(() => window.__ecraft.getState());
const modeOn = st.craft?.mode === true;
const hotbar = await page.evaluate(() => document.getElementById('ecraft-hotbar')?.classList.contains('show'));

// Select stone (index 2)
await page.locator('#ecraft-hotbar [data-block="2"]').dispatchEvent('pointerdown');
await page.waitForTimeout(100);

// Place a few blocks outdoors
await page.evaluate(() => {
  const a = window.__ecraft;
  a.selectBlock(2);
  for (let i = 0; i < 3; i++) {
    a.breakBlock; // no-op ensure exists
  }
  const scene = window.__phaserGame.scene.getScene('Game');
  scene.player.setPosition(900, 760);
  scene.facing = 1;
  scene.facingDir = 'right';
  scene.placeCraftBlock();
  scene.player.x += 40;
  scene.placeCraftBlock();
  scene.player.x += 40;
  scene.placeCraftBlock();
});
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const placed = (st.craft?.count || 0) >= 3;

// Break one
await page.locator('#btn-break').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const afterBreak = st.craft?.count;

const tex = await page.evaluate(() => {
  const t = window.__phaserGame.textures;
  return ['block_dirt', 'block_grass', 'block_stone', 'block_water', 'block_sand'].every((k) => t.exists(k));
});

const ok = errs.length === 0 && modeOn && hotbar && placed && afterBreak < 3 && tex;
console.log(JSON.stringify({ errs: errs.slice(0, 5), modeOn, hotbar, placed, afterBreak, tex, craft: st.craft, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('CRAFT BUILD (MINECRAFT-LIKE) SMOKE PASSED');
