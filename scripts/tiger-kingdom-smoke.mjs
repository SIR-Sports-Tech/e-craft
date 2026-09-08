import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.waitForFunction(() => !!window.__ecraft?.goTigerKingdom);

const hasBtn = await page.locator('#btn-tiger-kingdom').count();
await page.locator('#btn-tiger-kingdom').dispatchEvent('pointerdown');
await page.waitForTimeout(600);

const st = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const hud = window.__ecraft.getState();
  return {
    x: Math.round(s.player.x),
    y: Math.round(s.player.y),
    tk: hud.tigerKingdom,
    status: hud.status || '',
    inKingdom: s.tigerKingdom?.contains?.(s.player.x, s.player.y),
  };
});

const ok =
  errs.length === 0 &&
  hasBtn === 1 &&
  st.inKingdom === true &&
  (st.tk?.tigers || 0) >= 8 &&
  st.y > 8500 &&
  /TIGER KINGDOM/i.test(st.status);

console.log(JSON.stringify({ errs: errs.slice(0, 5), hasBtn, st, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('TIGER KINGDOM SMOKE PASSED');
