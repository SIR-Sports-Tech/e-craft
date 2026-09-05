import { chromium } from 'playwright';

const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/?skiptitle=1';
const pageErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(2500);
await page.locator('#app').click();

// Wait for API
for (let i = 0; i < 30; i++) {
  const ready = await page.evaluate(() => !!window.__ecraft?.runFullAcceptance);
  if (ready) break;
  await page.waitForTimeout(200);
}

const result = await page.evaluate(async () => {
  const api = window.__ecraft;
  if (!api?.runFullAcceptance) return { error: 'no api' };
  const hud = await api.runFullAcceptance();
  return {
    phase: hud.phase,
    flags: hud.flags,
    checklist: hud.checklist,
    reward: hud.reward,
  };
});

const required = [
  'hasTracker',
  'robotActive',
  'sasquatchCaptured',
  'sasquatchJailed',
  'rewardClaimed',
];
const flagsOk = required.every((k) => result?.flags?.[k] === true);
const checklistOk = Array.isArray(result?.checklist)
  ? result.checklist.every((c) => c.done)
  : false;
const ok =
  pageErrors.length === 0 &&
  flagsOk &&
  (result?.phase === 'Rewarded' || result?.phase === 'FreeExplore') &&
  (result?.reward != null || result?.flags?.rewardClaimed);

console.log(JSON.stringify({ pageErrors, result, flagsOk, checklistOk, ok }, null, 2));
await page.screenshot({ path: 'docs/ecraft-v1-acceptance.png' });
await browser.close();
if (!ok) process.exit(1);
console.log('V1 ACCEPTANCE PASSED');
