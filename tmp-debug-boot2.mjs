import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 800)));
page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 400)); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
for (const ms of [3000, 6000, 10000, 15000, 20000]) {
  await page.waitForTimeout(ms === 3000 ? 3000 : ms - (ms === 6000 ? 3000 : ms === 10000 ? 6000 : ms === 15000 ? 10000 : 15000));
  const info = await page.evaluate(() => {
    const g = window.Phaser?.GAMES?.[0];
    const scenes = g?.scene?.scenes?.map((s) => ({ key: s.sys?.settings?.key, status: s.sys?.settings?.status, active: s.sys?.isActive?.(), visible: s.sys?.isVisible?.() })) || [];
    return { hasEcraft: !!window.__ecraft, scenes, gameCount: window.Phaser?.GAMES?.length || 0 };
  });
  console.log('t~', ms, JSON.stringify(info));
  if (info.hasEcraft) break;
}
await browser.close();
