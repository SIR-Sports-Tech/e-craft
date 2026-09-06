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

// Walk right — face right (flipX false)
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
await page.waitForTimeout(500);
const right = await page.evaluate(() => window.__ecraft.getState());
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
await page.waitForTimeout(150);

// Walk left — face left (flipX true)
await page.locator('#ecraft-pad [data-dir="left"]').dispatchEvent('pointerdown');
await page.waitForTimeout(500);
const left = await page.evaluate(() => window.__ecraft.getState());
await page.locator('#ecraft-pad [data-dir="left"]').dispatchEvent('pointerup');
await page.waitForTimeout(200);
const stopped = await page.evaluate(() => window.__ecraft.getState());

const ok =
  errs.length === 0 &&
  idle.onFoot === true &&
  right.playerAnim === 'player-walk' &&
  right.facing === 1 &&
  right.flipX === false &&
  left.playerAnim === 'player-walk' &&
  left.facing === -1 &&
  left.flipX === true &&
  stopped.playerAnim === 'player-idle';

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      idle: idle.playerAnim,
      right: { anim: right.playerAnim, facing: right.facing, flipX: right.flipX },
      left: { anim: left.playerAnim, facing: left.facing, flipX: left.flipX },
      stopped: stopped.playerAnim,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('SIDE-VIEW WALK + FACING SMOKE PASSED');
