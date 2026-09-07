import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const base = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  return {
    world: st.world,
    forest: st.forest,
    snakeTex: window.__phaserGame.textures.exists('snake'),
    anim: window.__phaserGame.anims.exists('snake-slither'),
  };
});

const area = (base.forest?.w || 0) * (base.forest?.h || 0);
const bigger = area >= 70_000_000; // 8000*10000

const bite = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  const trees = s.forestSnakes?.getDropTrees?.() || [];
  if (!trees.length) return { ok: false, reason: 'no snakes' };
  const t = trees[0];
  s.player.setPosition(t.x, t.y);
  // Wait for drop + bite
  await new Promise((r) => setTimeout(r, 1400));
  const st = window.__ecraft.getState();
  return {
    ok: true,
    snakes: s.forestSnakes.count(),
    bitten: st.forest?.bitten === true,
    status: st.status || '',
  };
});

const ok =
  errs.length === 0 &&
  bigger &&
  base.snakeTex &&
  base.anim &&
  (base.forest?.snakes || 0) >= 12 &&
  bite.ok &&
  bite.snakes >= 12 &&
  (bite.bitten || /SNAKE|bite|🐍/i.test(bite.status));

console.log(JSON.stringify({ errs: errs.slice(0, 5), base, area, bite, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('FOREST LARGER + SNAKES SMOKE PASSED');
