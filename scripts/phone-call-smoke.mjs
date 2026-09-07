import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?skiptitle=1&new=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.waitForFunction(() => !!window.__ecraft?.usePhone && !!window.__ecraft?.callContact);

// Open phone from backpack
await page.locator('#btn-pack').dispatchEvent('pointerdown');
await page.waitForTimeout(200);
await page.locator('#bp-phone').dispatchEvent('pointerdown');
await page.waitForTimeout(400);

const open = await page.evaluate(() => {
  const el = document.getElementById('ecraft-phone');
  const list = document.getElementById('phone-call-list');
  const btns = [...(list?.querySelectorAll('button[data-call]') || [])].map((b) => b.getAttribute('data-call'));
  return {
    ui: el?.classList.contains('show'),
    contacts: btns,
    ask: document.querySelector('.phone-ask')?.textContent || '',
  };
});

// Call robot
await page.locator('button[data-call="robot"]').dispatchEvent('pointerdown');
await page.waitForTimeout(900);
const robot = await page.evaluate(() => ({
  status: document.getElementById('phone-status')?.textContent || '',
  speaking: window.speechSynthesis?.speaking === true || window.speechSynthesis?.pending === true,
  hasSpeech: typeof window.speechSynthesis !== 'undefined',
}));

// Call bank
await page.locator('button[data-call="bank"]').dispatchEvent('pointerdown');
await page.waitForTimeout(700);
const bank = await page.evaluate(() => document.getElementById('phone-status')?.textContent || '');

const needed = ['robot', 'sasquatch', 'bigfoot', 'police', 'fire', 'ambulance', 'zookeeper', 'bank'];
const hasAll = needed.every((id) => open.contacts.includes(id));

const ok =
  errs.length === 0 &&
  open.ui &&
  /call somebody/i.test(open.ask) &&
  hasAll &&
  /Robot|Beep|online|Calling/i.test(robot.status) &&
  /Bank|gold|Teller|Calling/i.test(bank) &&
  robot.hasSpeech;

console.log(
  JSON.stringify(
    {
      errs: errs.slice(0, 5),
      open,
      robot: { status: robot.status.slice(0, 120), speaking: robot.speaking, hasSpeech: robot.hasSpeech },
      bank: bank.slice(0, 120),
      ok,
    },
    null,
    2,
  ),
);
await browser.close();
if (!ok) process.exit(1);
console.log('PHONE CALL + VOICE SMOKE PASSED');
