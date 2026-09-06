import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await page.waitForFunction(() => !!window.__ecraft?.toggleBackpack && !!window.__ecraft?.useWhip);

// —— Backpack opens ——
await page.locator('#btn-pack').dispatchEvent('pointerdown');
await page.waitForTimeout(250);
const packOpen = await page.evaluate(() => {
  const el = document.getElementById('ecraft-backpack');
  const st = window.__ecraft.getBackpack();
  return { ui: el?.classList.contains('show'), open: st.open, items: st.items.map((i) => i.id) };
});

// —— Phone from backpack ——
await page.locator('#bp-phone').dispatchEvent('pointerdown');
await page.waitForTimeout(300);
const phone = await page.evaluate(() => {
  const el = document.getElementById('ecraft-phone');
  const st = window.__ecraft.getState();
  return {
    ui: el?.classList.contains('show'),
    phoneOpen: st.phoneOpen === true,
    screen: document.getElementById('phone-screen')?.textContent || '',
  };
});
await page.locator('#phone-close').dispatchEvent('pointerdown');
await page.waitForTimeout(200);

// —— Equip whip from backpack ——
await page.locator('#btn-pack').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
await page.locator('#bp-whip').dispatchEvent('pointerdown');
await page.waitForTimeout(250);
const whipEq = await page.evaluate(() => {
  const btn = document.getElementById('btn-whip');
  const st = window.__ecraft.getState();
  return { btnShow: btn?.classList.contains('show'), equipped: st.whipEquipped === true };
});

// —— Spawn tigers, then whip them away ——
await page.locator('#btn-tigers').dispatchEvent('pointerdown');
await page.waitForTimeout(500);
let st = await page.evaluate(() => window.__ecraft.getState());
const emerged = st.tigersActive === true && (st.tigerCount || 0) >= 8;

// Move player onto the pack so whip range hits
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const tigers = s.tigers;
  const pack = tigers?.pack || [];
  const t = pack.find((x) => x.sprite?.visible) || pack[0];
  if (t?.sprite) {
    s.player.setPosition(t.sprite.x - 40, t.sprite.y);
  } else {
    // Fallback: jungle edge where ambush spawns
    s.player.setPosition(s.player.x + 80, s.player.y);
  }
});
await page.waitForTimeout(200);
await page.locator('#btn-whip').dispatchEvent('pointerdown');
await page.waitForTimeout(600);
st = await page.evaluate(() => window.__ecraft.getState());
const whipped =
  /whip|CRACK|bolt|jungle/i.test(st.status || '') ||
  st.tigersActive === false ||
  (st.status || '').includes('🪢');

// Wait for retreat to finish
await page.waitForTimeout(2800);
st = await page.evaluate(() => window.__ecraft.getState());
const cleared = st.tigersActive === false || (st.tigerCount || 0) === 0;

const ok =
  errs.length === 0 &&
  packOpen.ui &&
  packOpen.open &&
  packOpen.items.includes('phone') &&
  packOpen.items.includes('whip') &&
  phone.ui &&
  phone.phoneOpen &&
  /FIELD PHONE/i.test(phone.screen) &&
  whipEq.btnShow &&
  whipEq.equipped &&
  emerged &&
  whipped &&
  cleared;

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      packOpen,
      phone: { ui: phone.ui, phoneOpen: phone.phoneOpen, hasTitle: /FIELD PHONE/i.test(phone.screen) },
      whipEq,
      emerged,
      whipped,
      cleared,
      status: st.status,
      tigerCount: st.tigerCount,
      tigersActive: st.tigersActive,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('BACKPACK + WHIP SMOKE PASSED');
