import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const logs = [];
page.on('console', (m) => logs.push(['console', m.type(), m.text().slice(0, 300)]));
page.on('pageerror', (e) => logs.push(['pageerror', String(e).slice(0, 500)]));
page.on('requestfailed', (r) => logs.push(['fail', r.url().slice(0, 120), r.failure()?.errorText]));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => ({
  hasEcraft: !!window.__ecraft,
  keys: window.__ecraft ? Object.keys(window.__ecraft) : [],
  canvas: !!document.querySelector('canvas'),
  appHtml: document.getElementById('app')?.innerHTML?.slice(0, 200) || null,
}));
console.log(JSON.stringify({ info, logs: logs.slice(0, 40) }, null, 2));
await browser.close();
