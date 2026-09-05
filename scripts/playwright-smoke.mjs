import { chromium } from 'playwright';
const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/?skiptitle=1';
const pageErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.locator('#app').click();
await page.waitForTimeout(300);
// Move with WASD briefly
for (const k of ['KeyD','KeyD','KeyD','KeyW','KeyW']) {
  await page.keyboard.down(k);
  await page.waitForTimeout(120);
  await page.keyboard.up(k);
}
const moved = await page.evaluate(() => {
  const s = window.__ecraft?.getState?.();
  return s ? { x: s.player.x, y: s.player.y, phase: s.phase } : null;
});
await page.evaluate(() => window.__ecraft?.complete?.());
await page.waitForTimeout(1200);
const after = await page.evaluate(() => {
  const s = window.__ecraft?.getState?.();
  return s ? { phase: s.phase, jailed: s.flags.sasquatchJailed, reward: s.flags.rewardClaimed } : null;
});
const ok = pageErrors.length === 0 && !!moved && after?.reward === true;
console.log(JSON.stringify({ pageErrors, moved, after, ok }, null, 2));
await page.screenshot({ path: 'docs/ecraft-v021-play.png' });
await browser.close();
if (!ok) process.exit(1);
