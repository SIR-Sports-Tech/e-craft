import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2800);
await page.waitForFunction(() => !!window.__ecraft?.callPolice);

const hasBtn = await page.locator('#btn-call-police').count();

// 1) Call without Sasquatch → arrest
await page.locator('#btn-call-police').dispatchEvent('pointerdown');
await page.waitForTimeout(2500);
const arrested = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const st = window.__ecraft.getState();
  return {
    arrested: s.playerArrested === true,
    inJail: !!st.flags?.inJailBuilding,
    status: st.status || '',
  };
});

// Wait for release (arrest → jail @1.8s → free @4.8s)
await page.waitForTimeout(5500);
const released = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const st = window.__ecraft.getState();
  return {
    arrested: s.playerArrested === true,
    outdoors: !s.isIndoors(),
    status: st.status || '',
  };
});

// 2) With Sasquatch captured nearby → help, not arrest
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.playerArrested = false;
  s.flags.sasquatchCaptured = true;
  s.flags.sasquatchJailed = false;
  s.sasquatchDragging = true;
  s.sasquatch.setPosition(s.player.x + 40, s.player.y);
  s.flags.inJailBuilding = false;
  if (s.isIndoors()) s.exitJail?.();
});
await page.waitForTimeout(400);
await page.locator('#btn-call-police').dispatchEvent('pointerdown');
await page.waitForTimeout(800);
const withSq = await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  const st = window.__ecraft.getState();
  return {
    arrested: s.playerArrested === true,
    status: st.status || '',
  };
});

const ok =
  errs.length === 0 &&
  hasBtn === 1 &&
  (arrested.arrested || arrested.inJail) &&
  /arrest|BUSTED|No Sasquatch|SUPER JAIL/i.test(arrested.status) &&
  released.arrested === false &&
  released.outdoors === true &&
  withSq.arrested === false &&
  /backup|JAIL|Police/i.test(withSq.status);

console.log(
  JSON.stringify({ errs: errs.slice(0, 5), hasBtn, arrested, released, withSq, ok }, null, 2),
);
await browser.close();
if (!ok) process.exit(1);
console.log('CALL POLICE ARREST SMOKE PASSED');
