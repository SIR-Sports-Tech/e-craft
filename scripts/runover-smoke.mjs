import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.forceFlatten);

const hasBlood = await page.evaluate(() => !!window.__phaserGame?.textures?.exists?.('blood_pool'));

await page.evaluate(() => window.__ecraft.forceFlatten());
await page.waitForTimeout(300);
let st = await page.evaluate(() => window.__ecraft.getState());
const flat = st.flattened === true;
const toast = await page.evaluate(() => document.getElementById('ecraft-toast')?.textContent || '');
const msgOk = /squash|blood|police|ran you over/i.test(toast);

// Player shouldn't move while flat
const x0 = st.player.x;
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerdown');
await page.waitForTimeout(400);
await page.locator('#ecraft-pad [data-dir="right"]').dispatchEvent('pointerup');
st = await page.evaluate(() => window.__ecraft.getState());
const stuck = Math.abs(st.player.x - x0) < 8 && st.flattened === true;

// UNFREEZE gets you up
await page.locator('#btn-recover').dispatchEvent('pointerdown');
await page.waitForTimeout(300);
st = await page.evaluate(() => window.__ecraft.getState());
const up = st.flattened === false;

const ok = errs.length === 0 && hasBlood && flat && msgOk && stuck && up;
console.log(JSON.stringify({ errs: errs.slice(0, 5), hasBlood, flat, msgOk, stuck, up, toast, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('POLICE RUN-OVER SMOKE PASSED');
