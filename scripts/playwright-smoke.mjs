import { chromium } from 'playwright';
const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/?skiptitle=1';
const pageErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.locator('#app').click();
// Prefer DOM pad if present
const hasPad = await page.locator('#ecraft-pad').count();
if (hasPad) {
  await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
}
for (const k of ['KeyD','KeyD','KeyW']) {
  await page.keyboard.down(k);
  await page.waitForTimeout(100);
  await page.keyboard.up(k);
}
const moved = await page.evaluate(() => window.__ecraft?.getState?.()?.player ?? null);
await page.evaluate(() => window.__ecraft?.complete?.());
await page.waitForTimeout(1000);
const after = await page.evaluate(() => {
  const s = window.__ecraft?.getState?.();
  return s ? { phase: s.phase, reward: s.flags.rewardClaimed, jailed: s.flags.sasquatchJailed } : null;
});
const ok = pageErrors.length === 0 && !!moved && after?.reward === true;
console.log(JSON.stringify({ pageErrors, hasPad, moved, after, ok }, null, 2));
await page.screenshot({ path: 'docs/ecraft-v022-chrome.png' });
await browser.close();
if (!ok) process.exit(1);
