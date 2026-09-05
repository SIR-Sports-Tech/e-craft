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
  const g = window.__phaserGame;
  const tex = g?.textures;
  const keys = ['tile_road', 'tile_sidewalk', 'street_lamp', 'manhole', 'police_car'];
  const has = {};
  for (const k of keys) has[k] = !!(tex && tex.exists && tex.exists(k));
  // Drive along main road a bit — game stays alive
  return { has, alive: !!window.__ecraft.getState(), policeCars: window.__ecraft.getState().policeCars };
});

// Hold right to cruise streets
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
await page.waitForTimeout(1200);
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
await page.waitForTimeout(200);

const after = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  return { alive: !!st, x: Math.round(st.player.x), anim: st.playerAnim };
});

const texOk = Object.values(info.has).every(Boolean);
const ok = errs.length === 0 && texOk && after.alive && info.policeCars >= 2;
console.log(JSON.stringify({ errs: errs.slice(0, 5), textures: info.has, policeCars: info.policeCars, after, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('LIFELIKE STREETS SMOKE PASSED');
