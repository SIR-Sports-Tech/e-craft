import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });

async function runViewport(name, viewport) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => !!window.__ecraft?.getState && !!document.getElementById('ecraft-stick'));

  const hasStick = await page.evaluate(() => {
    const el = document.getElementById('ecraft-stick');
    const base = document.getElementById('ecraft-stick-base');
    const knob = document.getElementById('ecraft-stick-knob');
    return !!(el && base && knob);
  });

  // Drag stick to the right via pointer events on the base
  const box = await page.locator('#ecraft-stick-base').boundingBox();
  if (!box) throw new Error('no stick box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const st0 = await page.evaluate(() => window.__ecraft.getState());
  const x0 = st0.player.x;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.width * 0.35, cy, { steps: 8 });
  await page.waitForTimeout(700);
  const mid = await page.evaluate(() => ({
    move: { ...window.__ecraftMove },
    x: window.__ecraft.getState().player.x,
  }));
  await page.mouse.up();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    move: { ...window.__ecraftMove },
    x: window.__ecraft.getState().player.x,
  }));

  // Also exercise __ecraftSetStick API
  await page.evaluate(() => window.__ecraftSetStick?.(0, 1));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__ecraftSetStick?.(0, 0));
  const st1 = await page.evaluate(() => window.__ecraft.getState());

  const moved = mid.x - x0 > 20;
  const stickLive = mid.move.x > 0.4;
  const cleared = Math.abs(after.move.x) < 0.05 && Math.abs(after.move.y) < 0.05;
  const ok = errs.length === 0 && hasStick && moved && stickLive && cleared;

  console.log(
    JSON.stringify(
      {
        name,
        viewport,
        errs: errs.slice(0, 3),
        hasStick,
        moved,
        stickLive,
        cleared,
        x0,
        midX: mid.x,
        midMove: mid.move,
        afterMove: after.move,
        y1: st1.player.y,
        ok,
      },
      null,
      2,
    ),
  );
  await page.close();
  return ok;
}

const phone = await runViewport('phone', { width: 390, height: 844 });
const ipad = await runViewport('ipad', { width: 768, height: 1024 });
await browser.close();
if (!phone || !ipad) process.exit(1);
console.log('TOUCH STICK (PHONE + IPAD) SMOKE PASSED');
