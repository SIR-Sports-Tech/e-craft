import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const info = await page.evaluate(() => {
  const t = window.__phaserGame?.textures;
  const keys = ['tile_road', 'tile_sidewalk', 'street_lamp', 'traffic_signal', 'manhole'];
  const has = {};
  for (const k of keys) has[k] = !!(t && t.exists(k));
  const st = window.__ecraft.getState();
  return {
    has,
    trafficSignals: st.trafficSignals,
    cover: (() => {
      const c = document.querySelector('canvas').getBoundingClientRect();
      return Math.round((c.width * c.height) / (innerWidth * innerHeight) * 100);
    })(),
    alive: !!st,
  };
});

const texOk = Object.values(info.has).every(Boolean);
const signalsOk = (info.trafficSignals || 0) >= 8;
const ok = errs.length === 0 && texOk && signalsOk && info.cover >= 90 && info.alive;

console.log(JSON.stringify({ errs: errs.slice(0, 5), ...info, texOk, signalsOk, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('REAL STREETS + SIGNALS SMOKE PASSED');
