import { chromium } from 'playwright';

const url = process.env.ECRAFT_URL || 'http://127.0.0.1:5173/';
const pageErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => pageErrors.push(String(err)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const canvas = await page.locator('canvas').count();

// Use debug API if available
const before = await page.evaluate(() => window.__ecraft?.getState?.()?.phase ?? null);
await page.evaluate(() => window.__ecraft?.complete?.());
await page.waitForTimeout(1500);
const after = await page.evaluate(() => {
  const s = window.__ecraft?.getState?.();
  return s ? { phase: s.phase, jailed: s.flags.sasquatchJailed, reward: s.flags.rewardClaimed } : null;
});

const ok = canvas >= 1 && pageErrors.length === 0 && after?.jailed === true && after?.reward === true;
console.log(JSON.stringify({ canvas, pageErrors, before, after, ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
