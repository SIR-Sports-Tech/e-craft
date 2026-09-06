import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.enterBuilding && !!window.__ecraft?.exitIndoor);

const catalog = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  return {
    doors: st.building?.doors ?? 0,
    enterable: st.building?.enterable ?? [],
  };
});

const need = [
  'security_hq',
  'super_jail',
  'player_house',
  'clinic',
  'shop',
  'police_desk',
  'school',
  'library',
  'market_row',
  'docks',
  'airfield',
  'city_plaza',
  'park',
];

const results = {};
for (const id of need) {
  await page.evaluate((bid) => {
    window.__ecraft.exitIndoor?.();
    window.__ecraft.enterBuilding(bid);
  }, id);
  await page.waitForTimeout(180);
  const st = await page.evaluate(() => window.__ecraft.getState());
  const indoors =
    !!st.flags?.inLair ||
    !!st.flags?.inJailBuilding ||
    !!st.flags?.inHouse ||
    !!st.building?.civicId ||
    !!st.building?.indoors;
  results[id] = {
    indoors,
    civicId: st.building?.civicId ?? null,
    inLair: !!st.flags?.inLair,
    inJail: !!st.flags?.inJailBuilding,
    inHouse: !!st.flags?.inHouse,
  };
  await page.evaluate(() => window.__ecraft.exitIndoor());
  await page.waitForTimeout(80);
}

const afterExit = await page.evaluate(() => {
  const st = window.__ecraft.getState();
  return { indoors: !!st.building?.indoors, civicId: st.building?.civicId };
});

const allEnter = need.every((id) => results[id]?.indoors);
const catalogOk = need.every((id) => catalog.enterable.includes(id)) && catalog.doors >= need.length;
const ok = errs.length === 0 && allEnter && catalogOk && !afterExit.indoors;

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      catalog,
      results,
      afterExit,
      allEnter,
      catalogOk,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('ALL BUILDING DOORS SMOKE PASSED');
