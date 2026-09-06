import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.tigerAmbush);

const tex = await page.evaluate(() => {
  const t = window.__phaserGame.textures;
  return t.exists('tiger_sheet') && t.exists('tiger_sheet_img');
});
const anim = await page.evaluate(() => !!window.__phaserGame.anims.exists('tiger-run'));

await page.locator('#btn-tigers').dispatchEvent('pointerdown');
await page.waitForTimeout(400);
let st = await page.evaluate(() => window.__ecraft.getState());
const emerged = st.tigersActive === true && (st.tigerCount || 0) >= 10;

// Let emerge → chase, then flee west into city
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.player.setPosition(1900, s.player.y);
  window.__ecraftSetStick?.(-1, 0);
});
await page.waitForTimeout(3500);
await page.evaluate(() => window.__ecraftSetStick?.(0, 0));
await page.waitForTimeout(3200);
st = await page.evaluate(() => window.__ecraft.getState());
const retreated = st.tigersActive === false || (st.tigerCount || 0) === 0;

const ok = errs.length === 0 && tex && anim && emerged && retreated;
console.log(
  JSON.stringify(
    { errs: errs.slice(0, 5), tex, anim, emerged, retreated, tigerCount: st.tigerCount, tigersActive: st.tigersActive, ok },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('TIGER PACK SMOKE PASSED');
