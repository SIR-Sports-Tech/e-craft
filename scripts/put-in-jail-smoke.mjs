import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2800);
await page.waitForFunction(() => !!window.__ecraft?.putInJail);

const hasBtn = await page.locator('#btn-put-jail').count();

// Without Sasquatch — refuse
await page.locator('#btn-put-jail').dispatchEvent('pointerdown');
await page.waitForTimeout(400);
const noSq = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  return { jailed: !!st.flags?.sasquatchJailed, status: st.status || '' };
});

// With captured Sasquatch — lock him up
await page.evaluate(() => {
  const s = window.__phaserGame.scene.getScene('Game');
  s.flags.sasquatchCaptured = true;
  s.flags.sasquatchJailed = false;
  s.sasquatchDragging = true;
  s.sasquatch.setPosition(s.player.x + 30, s.player.y);
});
await page.locator('#btn-put-jail').dispatchEvent('pointerdown');
await page.waitForTimeout(700);
const locked = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  return {
    jailed: !!st.flags?.sasquatchJailed,
    inJail: !!st.flags?.inJailBuilding,
    status: st.status || '',
  };
});

const ok =
  errs.length === 0 &&
  hasBtn === 1 &&
  noSq.jailed === false &&
  /Capture|first/i.test(noSq.status) &&
  locked.jailed === true &&
  /JAIL|secured|locked/i.test(locked.status);

console.log(JSON.stringify({ errs: errs.slice(0, 5), hasBtn, noSq, locked, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('PUT IN JAIL SMOKE PASSED');
