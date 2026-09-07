import { chromium } from 'playwright';

/** FOREST LAW: player must freely walk deep in the wilderness. */
const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const result = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.craftBuild?.clearAll?.();
  s.craftBuild?.clearForestSolids?.();
  s.paused = false;
  s.flattened = false;
  s.snakeBittenT = 0;
  s.atComputer = false;

  // Place a craft wall IN the forest — must NOT block
  s.player.setPosition(4800, 4800);
  s.craftBuild.setMode(true);
  s.craftBuild.select(2);
  s.craftBuild.aimAtWorld(4840, 4800);
  s.craftBuild.place(4800, 4800, 1, 'right');
  s.craftBuild.place(4800, 4800, 1, 'right');
  const cleared = s.craftBuild.clearForestSolids();

  // Walk east across deep forest via stick
  s.player.setPosition(4500, 4500);
  const start = { x: s.player.x, y: s.player.y };
  for (let i = 0; i < 40; i++) {
    window.__ecraftMove.x = 1;
    window.__ecraftMove.y = 0;
    // also poke stick path
    await new Promise((r) => setTimeout(r, 33));
  }
  // Force velocity path in case stick object differs
  for (let i = 0; i < 25; i++) {
    s.player.setVelocity(280, 0);
    await new Promise((r) => setTimeout(r, 33));
  }
  window.__ecraftMove.x = 0;
  const moved = Math.hypot(s.player.x - start.x, s.player.y - start.y);

  const hitCraft = s.physics.overlap(s.player, s.craftBuild.getSolids());
  const hitBldg = s.physics.overlap(s.player, s.buildingCollision.getSolids());
  const st = window.__ecraft.getState();

  return {
    moved,
    cleared,
    hitCraft,
    hitBldg,
    forest: st.forest,
    label: 'OPEN',
    x: s.player.x,
  };
});

const ok =
  errs.length === 0 &&
  result.moved > 80 &&
  result.hitCraft === false &&
  result.hitBldg === false &&
  (result.forest?.w || 0) >= 7000;

console.log(JSON.stringify({ errs: errs.slice(0, 5), result, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('FOREST FULLY WALKABLE SMOKE PASSED');
