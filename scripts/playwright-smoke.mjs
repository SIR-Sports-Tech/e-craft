import { chromium } from 'playwright';

const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/';
const pageErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (err) => pageErrors.push(String(err)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Title screen → New Game (click canvas center-ish where button is)
const canvas = page.locator('canvas');
await canvas.click({ position: { x: 640, y: 310 } });
await page.waitForTimeout(1500);

const before = await page.evaluate(() => window.__ecraft?.getState?.()?.phase ?? null);
await page.evaluate(() => window.__ecraft?.complete?.());
await page.waitForTimeout(1500);
const after = await page.evaluate(() => {
  const s = window.__ecraft?.getState?.();
  return s ? { phase: s.phase, jailed: s.flags.sasquatchJailed, reward: s.flags.rewardClaimed } : null;
});

const ok = pageErrors.length === 0 && after?.jailed === true && after?.reward === true;
console.log(JSON.stringify({ pageErrors, before, after, ok }, null, 2));
await page.screenshot({ path: 'docs/ecraft-v02-title-or-game.png' });
await browser.close();
if (!ok) process.exit(1);
