import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await page.waitForFunction(() => !!window.__ecraft?.pickupItem && !!window.__ecraft?.enterBuilding);

// Textures
const tex = await page.evaluate(() => {
  const t = window.__phaserGame.textures;
  return {
    computer: t.exists('furn_computer'),
    phone: t.exists('furn_phone'),
    loot: t.exists('loot_bag'),
    gold: t.exists('gold_pile'),
  };
});

// Enter the gold bank
await page.evaluate(() => window.__ecraft.enterBuilding('bank'));
await page.waitForTimeout(900);
const inside = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  const bp = window.__ecraft.getBackpack();
  return {
    civic: st.building?.civicId || null,
    indoors: !!st.building?.indoors,
    bankGoldLeft: bp.bankGoldLeft ?? 0,
  };
});

// Sit at computer
await page.locator('#btn-computer').dispatchEvent('pointerdown');
await page.waitForTimeout(400);
// May need to walk to computer first
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const seat = s.buildingLoot?.computerSeat?.();
  if (seat) s.player.setPosition(seat.x, seat.y);
  window.__ecraft.useComputer();
});
await page.waitForTimeout(300);
const computer = await page.evaluate(() => {
  const el = document.getElementById('ecraft-computer');
  const bp = window.__ecraft.getBackpack();
  return { ui: el?.classList.contains('show'), at: bp.atComputer === true };
});
await page.locator('#computer-close').dispatchEvent('pointerdown');
await page.waitForTimeout(200);

// Pick up gold
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const loot = s.buildingLoot?.nearestLoot?.(s.player.x, s.player.y, 2000);
  if (loot) s.player.setPosition(loot.sprite.x, loot.sprite.y);
});
await page.waitForTimeout(100);
await page.locator('#btn-pickup').dispatchEvent('pointerdown');
await page.waitForTimeout(300);
const afterPick = await page.evaluate(() => window.__ecraft.getBackpack());

// Drop something
await page.locator('#btn-drop').dispatchEvent('pointerdown');
await page.waitForTimeout(250);
const afterDrop = await page.evaluate(() => window.__ecraft.getBackpack());

const ok =
  errs.length === 0 &&
  tex.computer &&
  tex.phone &&
  tex.loot &&
  tex.gold &&
  inside.indoors &&
  inside.bankGoldLeft >= 10 &&
  computer.ui &&
  computer.at &&
  (afterPick.gold ?? 0) >= 1 &&
  (afterDrop.gold ?? 0) === (afterPick.gold ?? 0) - 1;

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      tex,
      inside,
      computer,
      goldAfterPick: afterPick.gold,
      goldAfterDrop: afterDrop.gold,
      bankLeft: afterPick.bankGoldLeft,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('BUILDING LOOT + COMPUTER + BANK SMOKE PASSED');
