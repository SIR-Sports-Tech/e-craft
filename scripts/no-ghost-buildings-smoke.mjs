import { chromium } from 'playwright';

/**
 * WALL LAW: building shells are real-sized; door gap open; core/wings block.
 * (Does not rely on setVelocity — GameScene overwrites velocity each frame.)
 */
const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const result = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const solids = s.buildingCollision.getSolids();
  const kids = solids.getChildren();
  const sizes = kids.map((c) => ({
    id: c.buildingId,
    w: Math.round(c.body.width),
    h: Math.round(c.body.height),
  }));
  const maxW = Math.max(...sizes.map((x) => x.w));
  const hq = kids.filter((c) => c.buildingId === 'security_hq');

  const overlapsPoint = (x, y) => {
    const z = s.add.zone(x, y, 12, 12);
    s.physics.add.existing(z, false);
    const hit = s.physics.overlap(z, solids);
    z.destroy();
    return !!hit;
  };

  // Inside HQ core (should hit)
  const coreBlocked = overlapsPoint(390, 250);
  // Through SE wing path (should hit)
  const wingBlocked = overlapsPoint(520, 400);
  // Door gap approach (should be open)
  const doorOpen = !overlapsPoint(390, 420);
  // South apron outside building (open)
  const apronOpen = !overlapsPoint(390, 500);

  // Player shoved into core then resolve — must separate out of solid
  s.player.setPosition(390, 250);
  s.buildingCollision.resolveNow(s.player);
  const pushedOut = !s.physics.overlap(s.player, solids) || s.player.y > 300 || s.player.y < 200;

  // Police car into jail core then resolve
  const car = s.patrolCars.getSprites()[0];
  const cy0 = car.y;
  car.setPosition(820, 280);
  s.buildingCollision.resolveNow(car);
  const carPushed = Math.abs(car.y - 280) > 5 || !s.physics.overlap(car, solids);

  return {
    solidCount: kids.length,
    maxW,
    hqPieces: hq.length,
    coreBlocked,
    wingBlocked,
    doorOpen,
    apronOpen,
    pushedOut,
    carPushed,
    cy0,
    carY: car.y,
  };
});

const ok =
  errs.length === 0 &&
  result.solidCount >= 30 &&
  result.maxW > 100 &&
  result.hqPieces >= 3 &&
  result.coreBlocked &&
  result.wingBlocked &&
  result.doorOpen &&
  result.apronOpen &&
  result.pushedOut &&
  result.carPushed;

console.log(JSON.stringify({ errs: errs.slice(0, 5), result, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('NO-GHOST BUILDINGS SMOKE PASSED');
