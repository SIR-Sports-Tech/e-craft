import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.getState);

async function walk(dir) {
  await page.locator(`#ecraft-pad [data-dir="${dir}"]`).dispatchEvent('pointerdown');
  await page.waitForTimeout(450);
  const st = await page.evaluate(() => window.__ecraft.getState());
  await page.locator(`#ecraft-pad [data-dir="${dir}"]`).dispatchEvent('pointerup');
  await page.waitForTimeout(80);
  return st;
}

const right = await walk('right');
const left = await walk('left');
const up = await walk('up');
const down = await walk('down');
await page.waitForTimeout(200);
const stopped = await page.evaluate(() => window.__ecraft.getState());

const ok =
  errs.length === 0 &&
  right.facingDir === 'right' &&
  right.flipX === false &&
  right.playerSheet === 'player_sheet' &&
  String(right.playerAnim).includes('walk') &&
  left.facingDir === 'left' &&
  left.flipX === true &&
  left.playerSheet === 'player_sheet' &&
  up.facingDir === 'up' &&
  up.playerSheet === 'player_back_sheet' &&
  down.facingDir === 'down' &&
  down.playerSheet === 'player_front_sheet' &&
  String(stopped.playerAnim).includes('idle');

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      right: { dir: right.facingDir, flip: right.flipX, sheet: right.playerSheet, anim: right.playerAnim },
      left: { dir: left.facingDir, flip: left.flipX, sheet: left.playerSheet, anim: left.playerAnim },
      up: { dir: up.facingDir, sheet: up.playerSheet, anim: up.playerAnim },
      down: { dir: down.facingDir, sheet: down.playerSheet, anim: down.playerAnim },
      stopped: stopped.playerAnim,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('4-WAY FACING WALK SMOKE PASSED');
