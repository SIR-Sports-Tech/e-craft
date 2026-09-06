import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const st = await page.evaluate(() => {
  const g = window.__phaserGame;
  const tex = g.textures.get('police_car');
  const src = tex?.getSourceImage?.();
  const s = g.scene.getScene('Game');
  const cars = s.patrolCars.getSprites();
  const first = cars[0];
  // Sample a few non-transparent pixels from police_car texture (Cybertruck silver + lights)
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const mid = ctx.getImageData(Math.floor(src.width * 0.45), Math.floor(src.height * 0.45), 1, 1).data;
  const roof = ctx.getImageData(Math.floor(src.width * 0.55), Math.floor(src.height * 0.12), 1, 1).data;
  return {
    w: src?.width ?? 0,
    h: src?.height ?? 0,
    count: cars.length,
    key: first?.texture?.key,
    mid: [mid[0], mid[1], mid[2], mid[3]],
    roof: [roof[0], roof[1], roof[2], roof[3]],
    policeCars: window.__ecraft.getState().policeCars,
  };
});

// Texture should be the new larger Cybertruck size
const bigger = st.w >= 120 && st.h >= 70;
// Mid body should be silvery (high R/G/B, not pure white cruiser)
const silverish = st.mid[3] > 200 && st.mid[0] > 100 && st.mid[0] < 230;
// Roof lightbar area should have red or blue-ish pixels
const lights =
  (st.roof[0] > 150 && st.roof[2] < 120) || // red-ish
  (st.roof[2] > 150 && st.roof[0] < 120) || // blue-ish
  (st.roof[0] > 40 && st.roof[3] > 200); // any opaque light housing

const ok = errs.length === 0 && bigger && st.count >= 2 && st.key === 'police_car' && silverish && lights;

console.log(JSON.stringify({ errs: errs.slice(0, 5), st, bigger, silverish, lights, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('CYBERTRUCK POLICE SMOKE PASSED');
