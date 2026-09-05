import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const results = [];

for (const vp of [
  { name: 'iPhoneSE', width: 375, height: 667 },
  { name: 'iPhone14', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 720 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto('http://127.0.0.1:5173/?skiptitle=1&new=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.waitForFunction(() => !!window.__ecraft?.getState);

  const m = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    const cover = (r.width * r.height) / (window.innerWidth * window.innerHeight);
    const st = window.__ecraft.getState();
    return {
      cw: Math.round(r.width),
      ch: Math.round(r.height),
      vw: window.innerWidth,
      vh: window.innerHeight,
      coverPct: Math.round(cover * 100),
      alive: !!st,
      robotApi: typeof window.__ecraft.activateRobot === 'function',
    };
  });

  // Must fill nearly the whole screen (no tiny letterboxed strip)
  const ok = m.coverPct >= 90 && m.cw >= vp.width - 4 && m.ch >= vp.height - 4 && m.alive;
  results.push({ viewport: vp.name, ...m, ok });
  await page.close();
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(JSON.stringify({ results, allOk }, null, 2));
if (!allOk) process.exit(1);
console.log('FULLSCREEN SCALE SMOKE PASSED');
