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
  const scene = window.__phaserGame.scene.getScene('Game');
  const attached = [];
  for (const id of st.building?.enterable ?? []) {
    const facade = scene.buildingFacades?.[id];
    const door = scene.outdoorDoors?.[id];
    if (!facade || !door) {
      attached.push({ id, ok: false, reason: 'missing' });
      continue;
    }
    // Door must be a child of the building facade container
    const parented = door.parentContainer === facade;
    const localY = Math.abs(door.y);
    const expected = 43 * (id === 'security_hq' || id === 'super_jail' ? 1.6 : 1.2);
    const onFacade = Math.abs(localY - expected) < 8;
    attached.push({
      id,
      ok: parented && onFacade,
      parented,
      onFacade,
      localY: Math.round(localY),
      expected: Math.round(expected),
      facadeX: Math.round(facade.x),
      facadeY: Math.round(facade.y),
    });
  }
  return {
    doors: st.building?.doors ?? 0,
    enterable: st.building?.enterable ?? [],
    attached,
    allAttached: attached.length > 0 && attached.every((a) => a.ok),
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
const attachedOk = !!catalog.allAttached;
const ok = errs.length === 0 && allEnter && catalogOk && attachedOk && !afterExit.indoors;

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      catalog: {
        doors: catalog.doors,
        enterable: catalog.enterable,
        allAttached: catalog.allAttached,
        attached: catalog.attached,
      },
      results,
      afterExit,
      allEnter,
      catalogOk,
      attachedOk,
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('ALL BUILDING DOORS SMOKE PASSED');
