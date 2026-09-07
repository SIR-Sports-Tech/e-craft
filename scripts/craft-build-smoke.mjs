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

// Clear any prior craft save (all versions)
await page.evaluate(() => {
  localStorage.removeItem('ecraft_craft_blocks_v1');
  localStorage.removeItem('ecraft_craft_blocks_v2');
  localStorage.removeItem('ecraft_craft_blocks_v3');
  localStorage.removeItem('ecraft_craft_blocks_v4');
  const s = window.__phaserGame.scene.getScene('Game');
  s.craftBuild?.clearAll?.();
});

await page.locator('#btn-build').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
let st = await page.evaluate(() => window.__ecraft.getState());
const modeOn = st.craft?.mode === true;
const hotbar = await page.evaluate(() => document.getElementById('ecraft-hotbar')?.classList.contains('show'));
const placeBtn = await page.evaluate(() => !!document.getElementById('btn-place'));

// Select stone (index 2)
await page.evaluate(() => window.__ecraft.selectBlock(2));
await page.waitForTimeout(100);

// Place via tap-aim (Minecraft: aim cell then place stacks there)
const tapPlace = await page.evaluate(() => {
  const scene = window.__phaserGame.scene.getScene('Game');
  scene.player.setPosition(900, 760);
  scene.facing = 1;
  scene.facingDir = 'right';
  scene.craftBuild.clearPointerAim();
  // Tap a world cell, then PLACE without clearing aim (must stack on tapped cell)
  scene.craftBuild.aimAtWorld(980, 760);
  scene.craftBuild.place(900, 760, 1, 'right');
  scene.craftBuild.place(900, 760, 1, 'right');
  scene.craftBuild.place(900, 760, 1, 'right');
  // Separate column in front
  scene.craftBuild.clearPointerAim();
  scene.craftBuild.place(900, 760, 1, 'right');
  scene.craftBuild.place(900, 760, 1, 'right');
  return { count: window.__ecraft.getState().craft?.count ?? 0 };
});
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const placed = (st.craft?.count || 0) >= 5 && tapPlace.count >= 5;
const beforeBreak = st.craft?.count || 0;

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
    'block_cobble',
    'block_plank',
    'block_water',
    'block_sand',
    'block_leaf',
    'block_glass',
    'block_iron',
    'block_wool',
    'block_obsidian',
    'block_fence',
    'block_torch',
  ].every((k) => t.exists(k));
});

const slots = await page.evaluate(() => document.querySelectorAll('#ecraft-palette [data-block]').length);
const types = await page.evaluate(() => window.__ecraft.getState().craft?.types ?? 0);

const ok =
  errs.length === 0 &&
  modeOn &&
  hotbar &&
  placeBtn &&
  placed &&
  afterBreak < beforeBreak &&
  tex &&
  slots >= 20 &&
  types >= 20;
console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      modeOn,
      hotbar,
      placeBtn,
      placed,
      beforeBreak,
      afterBreak,
      tex,
      slots,
      craft: st.craft,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('CRAFT BUILD (MINECRAFT-LIKE) SMOKE PASSED');
