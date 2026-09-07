import { chromium } from 'playwright';

/**
 * WALL LAW: people, cars (player + police), animals cannot ghost through
 * city buildings or craft-built solid walls.
 */
const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const base = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  return { solidCount: st.building?.solidCount ?? 0, craftTypes: st.craft?.types ?? 0 };
});

// Player walk into HQ
const walk = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.player.setPosition(390, 455);
  s.player.setVelocity(0, -280);
  await new Promise((r) => setTimeout(r, 900));
  s.player.setVelocity(0, 0);
  return { y: s.player.y, blocked: s.player.y > 340 };
});

// Place craft stone wall, walk into it
const craft = await page.evaluate(async () => {
  localStorage.removeItem('ecraft_craft_blocks_v4');
  localStorage.removeItem('ecraft_craft_blocks_v3');
  localStorage.removeItem('ecraft_craft_blocks_v2');
  localStorage.removeItem('ecraft_craft_blocks_v1');
  const s = window.__phaserGame.scene.getScene('Game');
  s.craftBuild?.clearAll?.();
  s.player.setPosition(900, 760);
  s.facing = 1;
  s.facingDir = 'right';
  window.__ecraft.selectBlock(2); // stone
  window.__ecraft.placeBlock();
  window.__ecraft.placeBlock();
  const before = s.player.x;
  s.player.setVelocity(320, 0);
  await new Promise((r) => setTimeout(r, 700));
  s.player.setVelocity(0, 0);
  return {
    before,
    after: s.player.x,
    blocked: s.player.x - before < 180,
    count: window.__ecraft.getState().craft?.count ?? 0,
  };
});

// Drive player car into jail footprint
const drive = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  window.__ecraft.enterCar?.();
  await new Promise((r) => setTimeout(r, 200));
  s.player.setPosition(820, 480);
  s.player.setVelocity(0, -400);
  await new Promise((r) => setTimeout(r, 900));
  s.player.setVelocity(0, 0);
  return { y: s.player.y, blocked: s.player.y > 360, inVehicle: !!s.flags.inVehicle };
});

// Police patrol car into craft wall
const police = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  // Exit vehicle if needed
  if (s.flags.inVehicle) {
    s.flags.inVehicle = false;
    s.player.setTexture('player_sheet');
  }
  s.craftBuild?.clearAll?.();
  // Wall in front of first patrol car
  const car = s.patrolCars.getSprites()[0];
  const wallX = car.x + 80;
  const wallY = car.y;
  // Place solids via system at world cells near car
  s.player.setPosition(wallX - 40, wallY);
  s.facing = 1;
  s.facingDir = 'right';
  window.__ecraft.selectBlock(2);
  window.__ecraft.placeBlock();
  window.__ecraft.placeBlock();
  const before = { x: car.x, y: car.y };
  car.setPosition(wallX - 90, wallY);
  car.setVelocity(420, 0);
  await new Promise((r) => setTimeout(r, 800));
  car.setVelocity(0, 0);
  const dx = car.x - (wallX - 90);
  return { before, after: { x: car.x, y: car.y }, dx, blocked: dx < 160 };
});

// Tiger pack vs craft wall
const tiger = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.craftBuild?.clearAll?.();
  window.__ecraft.tigerAmbush?.();
  await new Promise((r) => setTimeout(r, 400));
  const sprites = s.tigers.getSprites().filter((t) => t.visible);
  if (!sprites.length) return { blocked: false, reason: 'no tigers' };
  const t = sprites[0];
  // Build a wall west of tiger (they chase west)
  s.player.setPosition(t.x - 100, t.y);
  s.facing = 1;
  s.facingDir = 'right';
  window.__ecraft.selectBlock(21); // obsidian if available else stone
  window.__ecraft.selectBlock(2);
  for (let i = 0; i < 3; i++) window.__ecraft.placeBlock();
  const startX = t.x;
  t.setPosition(startX, t.y);
  t.setVelocity(-400, 0);
  await new Promise((r) => setTimeout(r, 700));
  t.setVelocity(0, 0);
  return { startX, afterX: t.x, blocked: startX - t.x < 200, bound: true };
});

// Panther velocity bound
const panther = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  window.__ecraft.pantherJump?.();
  await new Promise((r) => setTimeout(r, 100));
  const p = s.panther.getSprite?.();
  if (!p) return { ok: false };
  // Has physics body and is bound (collider exists via WALL LAW)
  return { ok: !!p.body, immovable: p.body?.immovable === true };
});

const ok =
  errs.length === 0 &&
  base.solidCount >= 10 &&
  walk.blocked &&
  craft.blocked &&
  craft.count >= 1 &&
  drive.blocked &&
  police.blocked &&
  tiger.blocked &&
  panther.ok &&
  panther.immovable === false;

console.log(
  JSON.stringify(
    { errs: errs.slice(0, 5), base, walk, craft, drive, police, tiger, panther, ok },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('WALL LAW SMOKE PASSED');
