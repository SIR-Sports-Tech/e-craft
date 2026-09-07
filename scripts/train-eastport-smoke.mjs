import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3200);
await page.waitForFunction(() => !!window.__ecraft?.boardTrain && !!window.__ecraft?.getState);

const base = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  const t = window.__phaserGame.textures;
  return {
    world: st.world,
    train: st.train,
    robbers: st.robbers,
    engine: t.exists('train_engine'),
    car: t.exists('train_car'),
    robber: t.exists('robber'),
    enterable: st.building?.enterable || [],
  };
});

const eastCity = (base.enterable || []).filter((id) => String(id).startsWith('east_'));

// Board at west station
const ride = await page.evaluate(async () => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.player.setPosition(2290, 720);
  window.__ecraft.boardTrain();
  // Wait for boarding + ride + alight (capped)
  let side = 'west';
  let busy = true;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const st = window.__ecraft.getState();
    side = st.train?.side || side;
    busy = !!st.train?.busy;
    if (!busy && side === 'east') break;
  }
  const st = window.__ecraft.getState();
  return {
    side: st.train?.side,
    busy: st.train?.busy,
    playerX: s.player.x,
    visible: s.player.visible,
    status: st.status || '',
  };
});

const ok =
  errs.length === 0 &&
  (base.world?.w || 0) >= 16000 &&
  base.engine &&
  base.car &&
  base.robber &&
  (base.robbers || 0) >= 10 &&
  eastCity.length >= 8 &&
  ride.side === 'east' &&
  ride.busy === false &&
  ride.playerX > 10000 &&
  ride.visible === true;

console.log(
  JSON.stringify(
    { errs: errs.slice(0, 5), base: { ...base, eastCity: eastCity.length }, ride, ok },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('TRAIN + EASTPORT + ROBBERS SMOKE PASSED');
