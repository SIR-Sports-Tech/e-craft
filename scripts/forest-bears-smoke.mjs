import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2800);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const base = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  const t = window.__phaserGame.textures;
  return {
    world: st.world,
    forest: st.forest,
    brown: t.exists('bear_brown_head'),
    black: t.exists('bear_black_head'),
  };
});

// Old forest was 1600×2200=3.52e6; new should be ~10× area (~35e6)
const area = (base.forest?.w || 0) * (base.forest?.h || 0);
const areaOk = area >= 30_000_000; // ~10× old 3.52M
const worldOk = (base.world?.w || 0) >= 7000 && (base.world?.h || 0) >= 6000;

// Walk near a bear tree to trigger peek
const peek = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  const bears = s.forestBears;
  const spots = bears?.getHideSpots?.() || [];
  if (!spots.length) return { peeking: 0, bears: 0 };
  const b = spots[0];
  s.player.setPosition(b.x + 30, b.y);
  await new Promise((r) => setTimeout(r, 1000));
  return {
    bears: bears.count(),
    peeking: bears.peekingCount(),
  };
});

const ok =
  errs.length === 0 &&
  areaOk &&
  worldOk &&
  base.brown &&
  base.black &&
  (base.forest?.bears || 0) >= 12 &&
  peek.bears >= 12 &&
  (peek.peeking >= 1 || peek.alpha > 0.5);

console.log(JSON.stringify({ errs: errs.slice(0, 5), base, area, peek, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('FOREST ×10 + BEARS SMOKE PASSED');
