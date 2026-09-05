import { chromium } from 'playwright';

function overlaps(a, b, pad = 4) {
  return !(
    a.right + pad <= b.left ||
    b.right + pad <= a.left ||
    a.bottom + pad <= b.top ||
    b.bottom + pad <= a.top
  );
}

const viewports = [
  { name: 'iPhoneSE', width: 375, height: 667 },
  { name: 'iPhone14', width: 390, height: 844 },
  { name: 'narrow', width: 320, height: 568 },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto('http://127.0.0.1:5173/?skiptitle=1&new=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.waitForSelector('#ecraft-pad');
  await page.waitForSelector('#ecraft-actions');

  const measure = await page.evaluate(() => {
    const actions = document.getElementById('ecraft-actions').getBoundingClientRect();
    const pad = document.getElementById('ecraft-pad').getBoundingClientRect();
    const toast = document.getElementById('ecraft-toast').getBoundingClientRect();
    // Phaser canvas may still have old stick — ensure DOM is the only interactive bottom UI
    return {
      actions: { left: actions.left, right: actions.right, top: actions.top, bottom: actions.bottom, w: actions.width },
      pad: { left: pad.left, right: pad.right, top: pad.top, bottom: pad.bottom, w: pad.width },
      toast: { left: toast.left, right: toast.right, top: toast.top, bottom: toast.bottom },
      vw: window.innerWidth,
    };
  });

  const gap = measure.pad.left - measure.actions.right;
  const noOverlap = !overlaps(measure.actions, measure.pad, 2);
  const padOnRight = measure.pad.left > measure.vw * 0.45;
  const actionsOnLeft = measure.actions.right < measure.vw * 0.45;
  const ok = noOverlap && gap >= 8 && padOnRight && actionsOnLeft;

  results.push({
    viewport: vp.name,
    gap: Math.round(gap),
    noOverlap,
    padOnRight,
    actionsOnLeft,
    actionsW: Math.round(measure.actions.w),
    padW: Math.round(measure.pad.w),
    ok,
  });
  await page.close();
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(JSON.stringify({ results, allOk }, null, 2));
if (!allOk) process.exit(1);
console.log('LAYOUT NO-OVERLAP SMOKE PASSED');
