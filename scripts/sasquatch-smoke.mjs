import { chromium } from 'playwright';
const url = 'http://127.0.0.1:5173/?skiptitle=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.runAcceptanceStep);
await page.evaluate(() => {
  window.__ecraft.runAcceptanceStep('get_tracker');
  window.__ecraft.runAcceptanceStep('activate_robot');
  window.__ecraft.runAcceptanceStep('exit_lair');
  window.__ecraft.runAcceptanceStep('enter_vehicle');
  window.__ecraft.runAcceptanceStep('go_forest');
});
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const s = window.__ecraft.getState();
  // peek anim via internal if available
  return { phase: s.phase, errs: null, player: s.player };
});
await page.screenshot({ path: 'docs/ecraft-scary-sasquatch.png' });
console.log(JSON.stringify({ errs, info, ok: errs.length === 0 }, null, 2));
await browser.close();
if (errs.length) process.exit(1);
