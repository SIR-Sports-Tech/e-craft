import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.placeHouse && !!window.__ecraft?.enterBuilding);

await page.evaluate(() => {
  localStorage.removeItem('ecraft_craft_houses_v1');
});

// Place a craft house outdoors
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.player.setPosition(1000, 850);
  s.facing = 1;
  s.facingDir = 'right';
  window.__ecraft.placeHouse();
});
await page.waitForTimeout(300);
let st = await page.evaluate(() => window.__ecraft.getState());
const placed = (st.craft?.houses || 0) >= 1;

// Enter the house
const houseId = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const h = s.craftHouses.list()[0];
  window.__ecraft.enterBuilding(h.id);
  return h.id;
});
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const indoors = !!st.craft?.inCraftHouse;

// Probe all secret props until found (force via mark if needed after trying)
const found = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const rec = s.craftHouses.list()[0];
  const kinds = ['rug', 'cabinet', 'picture', 'table', 'fridge'];
  for (const k of kinds) {
    const img = s.craftSecretProps[k];
    if (!img) continue;
    s.player.setPosition(img.x, img.y);
    s.tryCraftHouseSecret();
  }
  const after = s.craftHouses.list()[0];
  return { secret: rec.secret, found: !!after.secretFound };
});

// Collect gold
const gold = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  if (s.craftGoldPile) {
    s.player.setPosition(s.craftGoldPile.x, s.craftGoldPile.y);
    s.tryCraftHouseSecret();
  }
  return {
    gold: window.__ecraft.getState().craft?.gold ?? 0,
    collected: s.craftHouses.list()[0]?.goldCollected === true,
  };
});

// Exit
await page.evaluate(() => window.__ecraft.exitIndoor());
await page.waitForTimeout(150);
st = await page.evaluate(() => window.__ecraft.getState());
const outside = !st.craft?.inCraftHouse;

const tex = await page.evaluate(() => {
  const t = window.__phaserGame.textures;
  return ['furn_rug', 'furn_cabinet', 'furn_fridge', 'gold_pile'].every((k) => t.exists(k));
});

const ok = errs.length === 0 && placed && indoors && found.found && gold.collected && gold.gold >= 1 && outside && tex;
console.log(
  JSON.stringify(
    { errs: errs.slice(0, 5), placed, indoors, houseId, found, gold, outside, tex, ok },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('CRAFT HOUSE + SECRET GOLD SMOKE PASSED');
