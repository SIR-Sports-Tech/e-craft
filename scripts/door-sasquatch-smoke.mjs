import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.getState);

const tex = await page.evaluate(() => {
  const t = window.__phaserGame?.textures;
  const keys = ['door', 'door_open', 'door_frame', 'sasquatch_sheet', 'sasquatch'];
  const has = {};
  for (const k of keys) has[k] = !!(t && t.exists(k));
  const anims = window.__phaserGame?.anims;
  return {
    has,
    walk: !!anims?.exists?.('sasquatch-walk'),
    idle: !!anims?.exists?.('sasquatch-idle'),
    talk: !!anims?.exists?.('sasquatch-talk'),
  };
});

// GO HOME should open door then enter
await page.locator('#btn-house').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
const mid = await page.evaluate(() => {
  const scene = window.__phaserGame?.scene?.getScene?.('Game');
  const door = scene?.outdoorDoors?.house;
  return {
    doorBusy: !!scene?.doorBusy,
    doorAngle: door ? Math.round(door.angle) : null,
    doorKey: door?.texture?.key ?? null,
  };
});
await page.waitForTimeout(1400);
const after = await page.evaluate(() => {
  const s = window.__ecraft.getState();
  const scene = window.__phaserGame?.scene?.getScene?.('Game');
  const sq = scene?.sasquatch;
  return {
    inHouse: !!s.flags.inHouse,
    sasquatchAnim: sq?.anims?.currentAnim?.key ?? null,
    sheet: sq?.texture?.key ?? null,
  };
});

const texOk = Object.values(tex.has).every(Boolean);
const doorOk = mid.doorBusy === true || (mid.doorAngle !== null && Math.abs(mid.doorAngle) > 5);
const entered = after.inHouse === true;
const sasOk = tex.walk && tex.idle && after.sheet === 'sasquatch_sheet';

const ok = errs.length === 0 && texOk && doorOk && entered && sasOk;
console.log(
  JSON.stringify({ errs: errs.slice(0, 5), tex, mid, after, doorOk, entered, sasOk, ok }, null, 2),
);
await browser.close();
if (!ok) process.exit(1);
console.log('DOOR OPEN + SASQUATCH SMOKE PASSED');
