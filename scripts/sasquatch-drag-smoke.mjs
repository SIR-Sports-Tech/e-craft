import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.capture);

// Force capture near sasquatch
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.flags.hasTracker = true;
  s.trackerHeld = true;
  s.flags.inLair = false;
  s.player.setPosition(s.sasquatch.x - 60, s.sasquatch.y);
  window.__ecraft.capture();
});
await page.waitForTimeout(600);

let st = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const g = window.__ecraft.getState();
  return {
    captured: !!g.flags?.sasquatchCaptured,
    dragging: !!g.sasquatchDragging,
    angle: Math.abs(s.sasquatch.angle),
    visible: s.sasquatch.visible,
    rope: !!(s.ropeGfx && s.ropeGfx.visible),
    sx: s.sasquatch.x,
    sy: s.sasquatch.y,
    px: s.player.x,
    py: s.player.y,
  };
});

// Walk right — sasquatch should be dragged along
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.facing = 1;
  s.facingDir = 'right';
  window.__ecraftSetStick?.(1, 0);
});
await page.waitForTimeout(1400);
await page.evaluate(() => window.__ecraftSetStick?.(0, 0));
await page.waitForTimeout(200);

const after = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const g = window.__ecraft.getState();
  return {
    dragging: !!g.sasquatchDragging,
    sx: s.sasquatch.x,
    sy: s.sasquatch.y,
    px: s.player.x,
    angle: Math.abs(s.sasquatch.angle),
    rope: !!(s.ropeGfx && s.ropeGfx.visible),
    dist: Math.hypot(s.player.x - s.sasquatch.x, s.player.y - s.sasquatch.y),
  };
});

const dragged = Math.abs(after.sx - st.sx) > 20 && after.dist < 160;
const prone = after.angle > 45;
const ok = errs.length === 0 && st.captured && st.dragging && st.rope && dragged && prone && after.rope;

console.log(JSON.stringify({ errs: errs.slice(0, 5), st, after, dragged, prone, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('SASQUATCH ROPE DRAG SMOKE PASSED');
