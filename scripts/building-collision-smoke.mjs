import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const base = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  return {
    solidCount: st.building?.solidCount ?? 0,
    craftTypes: st.craft?.types ?? 0,
  };
});

// Try to walk into HQ building center — should be blocked by solid footprint
const walk = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  // Start south of HQ door
  s.player.setPosition(390, 455);
  s.player.setVelocity(0, -280);
  await new Promise((r) => setTimeout(r, 900));
  s.player.setVelocity(0, 0);
  const y = s.player.y;
  // Building collider sits above door apron — player should not reach deep into HQ (y ~ 300)
  return { y, blocked: y > 340 };
});

// Place a craft wall and walk into it
const craft = await page.evaluate(async () => {
  localStorage.removeItem('ecraft_craft_blocks_v2');
  localStorage.removeItem('ecraft_craft_blocks_v1');
  const s = window.__phaserGame.scene.getScene('Game');
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
  const after = s.player.x;
  return {
    before,
    after,
    blocked: after - before < 180,
    count: window.__ecraft.getState().craft?.count ?? 0,
  };
});

// Drive into jail footprint
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

const ok =
  errs.length === 0 &&
  base.solidCount >= 10 &&
  base.craftTypes >= 20 &&
  walk.blocked &&
  craft.blocked &&
  craft.count >= 1 &&
  drive.blocked;

console.log(JSON.stringify({ errs: errs.slice(0, 5), base, walk, craft, drive, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('BUILDING + CRAFT COLLISION SMOKE PASSED');
