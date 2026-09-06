import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const idle = await page.evaluate(() => window.__ecraft.getState());
if (!idle.onFoot) throw new Error('player not on foot sheet at start');
if (!String(idle.playerAnim || '').includes('idle')) {
  throw new Error('expected idle anim, got ' + idle.playerAnim);
}

await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
await page.waitForTimeout(450);
const walking = await page.evaluate(() => window.__ecraft.getState());
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
await page.waitForTimeout(200);
const stopped = await page.evaluate(() => window.__ecraft.getState());

const ok =
  errs.length === 0 &&
  String(walking.playerAnim || '').includes('walk') &&
  walking.onFoot === true &&
  walking.facingDir === 'right' &&
  String(stopped.playerAnim || '').includes('idle');

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      idle: idle.playerAnim,
      walking: walking.playerAnim,
      facingDir: walking.facingDir,
      stopped: stopped.playerAnim,
      onFoot: walking.onFoot,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('PLAYER WALK ANIM SMOKE PASSED');
