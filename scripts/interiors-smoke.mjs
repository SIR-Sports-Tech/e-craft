import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.enterHouse);

const tex = await page.evaluate(() => {
  const t = window.__phaserGame?.textures;
  const keys = [
    'floor_wood',
    'floor_metal',
    'floor_concrete',
    'furn_couch',
    'furn_table',
    'furn_tv',
    'furn_plant',
    'furn_console',
    'furn_server',
    'furn_bars',
    'furn_desk',
    'furn_picture',
    'furn_kitchen',
    'bed',
  ];
  const has = {};
  for (const k of keys) has[k] = !!(t && t.exists(k));
  return has;
});

// Enter house
await page.click('#btn-house');
await page.waitForTimeout(400);
let st = await page.evaluate(() => window.__ecraft.getState());
const inHouse = !!st.flags.inHouse;

// Exit, enter lair via activate
await page.evaluate(() => window.__ecraft.runAcceptanceStep('exit_house'));
await page.waitForTimeout(150);
await page.evaluate(() => window.__ecraft.runAcceptanceStep('enter_lair'));
await page.waitForTimeout(200);
st = await page.evaluate(() => window.__ecraft.getState());
const inLair = !!st.flags.inLair;

await page.evaluate(() => window.__ecraft.runAcceptanceStep('exit_lair'));
await page.waitForTimeout(150);
await page.evaluate(() => {
  window.__ecraft.runAcceptanceStep('enter_jail');
});
await page.waitForTimeout(250);
st = await page.evaluate(() => window.__ecraft.getState());
const inJail = !!st.flags.inJailBuilding;

const texOk = Object.values(tex).every(Boolean);
const ok = errs.length === 0 && texOk && inHouse && inLair && inJail;
console.log(JSON.stringify({ errs: errs.slice(0, 5), texOk, missing: Object.entries(tex).filter(([, v]) => !v).map(([k]) => k), inHouse, inLair, inJail, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('REAL INTERIORS SMOKE PASSED');
