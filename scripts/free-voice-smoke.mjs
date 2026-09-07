import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.connectFreeVoice && !!window.__ecraft?.usePhone);

await page.locator('#btn-pack').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
await page.locator('#bp-phone').dispatchEvent('pointerdown');
await page.waitForTimeout(400);

const hasConnect = await page.locator('#btn-free-voice').count();
await page.locator('#btn-free-voice').dispatchEvent('pointerdown');
await page.waitForTimeout(500);

const st = await page.evaluate(() => {
  const s = window.__ecraft.getFreeVoiceStatus();
  return {
    connected: s.connected,
    line: s.line,
    voiceCount: s.voices?.length ?? 0,
    btn: !!document.getElementById('btn-free-voice'),
    talk: !!document.getElementById('btn-phone-talk'),
    send: !!document.getElementById('btn-phone-send'),
    pick: !!document.getElementById('phone-voice-pick'),
    status: document.getElementById('phone-status')?.textContent || '',
  };
});

// Call robot then send typed message (mic often blocked in headless)
await page.locator('button[data-call="robot"]').dispatchEvent('pointerdown');
await page.waitForTimeout(600);
await page.fill('#phone-text-in', 'Hello robot, where are the tigers?');
await page.locator('#btn-phone-send').dispatchEvent('pointerdown');
await page.waitForTimeout(1200);
const after = await page.evaluate(() => document.getElementById('phone-status')?.textContent || '');

const ok =
  errs.length === 0 &&
  hasConnect === 1 &&
  st.btn &&
  st.talk &&
  st.send &&
  st.pick &&
  st.connected &&
  /Free AI Voice: ON/i.test(st.line) &&
  /You:|Robot|tiger|whip|jungle|free/i.test(after);

console.log(JSON.stringify({ errs: errs.slice(0, 5), st, after: after.slice(0, 200), ok }, null, 2));
await browser.close();
if (!ok) process.exit(1);
console.log('FREE AI VOICE SMOKE PASSED');
