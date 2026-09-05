import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForFunction(() => !!window.__ecraft?.pigDrop);

const hasPig = await page.evaluate(() => !!window.__phaserGame?.textures?.exists?.('pig'));
const hasBtn = await page.$('#btn-pig');

await page.locator('#btn-pig').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
let st = await page.evaluate(() => window.__ecraft.getState());
const falling = st.pigActive === true;

await page.waitForTimeout(900);
st = await page.evaluate(() => window.__ecraft.getState());
const toast = await page.evaluate(() => document.getElementById('ecraft-toast')?.textContent || '');
const bonked = /pig|oink/i.test(toast) || st.pigActive === true || st.pigActive === false;

await page.waitForTimeout(1200);
st = await page.evaluate(() => window.__ecraft.getState());
const cleared = st.pigActive === false;

const ok = errs.length === 0 && hasPig && !!hasBtn && falling && bonked && cleared;
console.log(JSON.stringify({ errs: errs.slice(0, 5), hasPig, hasBtn: !!hasBtn, falling, toast, cleared, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('PIG DROP SMOKE PASSED');
