import { chromium } from 'playwright';
const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/?skiptitle=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.capture);
await page.evaluate(() => {
  const a = window.__ecraft;
  a.runAcceptanceStep('get_tracker');
  a.runAcceptanceStep('activate_robot');
  a.runAcceptanceStep('exit_lair');
  a.runAcceptanceStep('go_forest');
  a.runAcceptanceStep('find_sasquatch');
});
await page.waitForTimeout(300);
await page.click('#btn-cap');
await page.waitForTimeout(600);
const st = await page.evaluate(() => {
  const s = window.__ecraft.getState();
  return { captured: s.flags.sasquatchCaptured, phase: s.phase, status: s.status };
});
console.log(JSON.stringify({ errs, st, ok: errs.length===0 && st.captured }, null, 2));
await page.screenshot({ path: 'docs/ecraft-capture-down.png' });
await browser.close();
if (!st.captured) process.exit(1);
console.log('CAPTURE DOWN PASSED');
