import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const before = await page.evaluate(() => window.__ecraft.getState());
if ((before.policeCars || 0) < 2) throw new Error('expected 2+ police cars, got ' + before.policeCars);

const a = before.policeCarPositions.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));

// Wait and move — cars should change position along roads
await page.waitForTimeout(1800);
const after = await page.evaluate(() => window.__ecraft.getState());
const b = after.policeCarPositions.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));

let moved = 0;
for (let i = 0; i < a.length; i++) {
  const dx = Math.abs(a[i].x - b[i].x);
  const dy = Math.abs(a[i].y - b[i].y);
  if (dx + dy > 20) moved++;
}

// Roughly on street bands (main ~760, park ~1035, market x~1485, forest x~1940, hq x~240)
const onRoad = b.every((p) => {
  const onH = Math.abs(p.y - 760) < 50 || Math.abs(p.y - 1035) < 50 || Math.abs(p.y - 900) < 80 || Math.abs(p.y - 520) < 80 || Math.abs(p.y - 640) < 80 || Math.abs(p.y - 860) < 80;
  const onV = Math.abs(p.x - 1940) < 50 || Math.abs(p.x - 1485) < 50 || Math.abs(p.x - 240) < 50 || Math.abs(p.x - 900) < 50 || Math.abs(p.x - 1100) < 80 || Math.abs(p.x - 1700) < 80 || Math.abs(p.x - 600) < 80 || Math.abs(p.x - 500) < 80 || Math.abs(p.x - 1850) < 80 || Math.abs(p.x - 280) < 80;
  return onH || onV;
});

const ok = errs.length === 0 && moved >= 2 && onRoad && after.policeCars >= 2;
console.log(JSON.stringify({ errs: errs.slice(0, 5), count: after.policeCars, moved, onRoad, before: a, after: b, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('POLICE CARS PATROL SMOKE PASSED');
