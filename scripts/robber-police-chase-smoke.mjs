import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const result = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  // Jump to Eastport with police car
  s.player.setPosition(11400, 700);
  s.flags.inVehicle = true;
  s.activeCarKey = 'police_car';
  s.player.setTexture('police_car');
  s.player.setScale(0.95);
  const body = s.player.body;
  body.setSize(88, 40).setOffset(18, 22);

  const robbers = s.robbers;
  const sprites = robbers.getSprites();
  if (!sprites.length) return { ok: false, reason: 'no robbers' };
  const target = sprites[0];
  // Place robber ahead, drive into them
  target.setPosition(11520, 700);
  s.player.setPosition(11440, 700);
  s.player.setVelocity(400, 0);

  let squished = 0;
  for (let i = 0; i < 40; i++) {
    const spd = Math.hypot(body.velocity.x, body.velocity.y) || 400;
    s.player.setVelocity(400, 0);
    robbers.update(
      50,
      s.player,
      true,
      () => {},
      { inPoliceCar: true, playerSpeed: spd },
    );
    await new Promise((r) => setTimeout(r, 40));
    squished = robbers.squishedCount();
    if (squished >= 1) break;
    // Keep closing distance
    s.player.setPosition(target.x - 40, target.y);
  }
  s.player.setVelocity(0, 0);
  const st = window.__ecraft.getState();
  return {
    ok: true,
    squished,
    hudSquished: st.robbersSquished ?? 0,
    status: st.status || '',
    robberScaleY: Math.round(target.scaleY * 100) / 100,
  };
});

const ok =
  errs.length === 0 &&
  result.ok &&
  (result.squished >= 1 || result.hudSquished >= 1) &&
  (result.robberScaleY < 0.5 || /SQUISH|blood|flattened/i.test(result.status));

console.log(JSON.stringify({ errs: errs.slice(0, 5), result, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('ROBBER POLICE CHASE SQUISH SMOKE PASSED');
