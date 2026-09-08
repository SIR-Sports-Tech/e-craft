/**
 * Direct-wired controls for phone/Chrome.
 * Layout law: LEFT = actions only · RIGHT = D-pad only · never overlap.
 * Button law: every tap must hit a live API (no silent no-ops).
 */

export type DomInputState = {
  x: number;
  y: number;
  interact: boolean;
  capture: boolean;
  map: boolean;
  pause: boolean;
  radio: boolean;
};

const pressed = new Set<string>();
const move = { x: 0, y: 0 };
/** Finger virtual stick — wins over keyboard while active. */
const stick = { active: false, x: 0, y: 0, pointerId: null as number | null };
(window as unknown as { __ecraftMove: { x: number; y: number } }).__ecraftMove = move;

function recomputeMove(): void {
  if (stick.active) {
    move.x = stick.x;
    move.y = stick.y;
    return;
  }
  let x = 0;
  let y = 0;
  if (pressed.has('KeyA') || pressed.has('ArrowLeft')) x -= 1;
  if (pressed.has('KeyD') || pressed.has('ArrowRight')) x += 1;
  if (pressed.has('KeyW') || pressed.has('ArrowUp')) y -= 1;
  if (pressed.has('KeyS') || pressed.has('ArrowDown')) y += 1;
  move.x = x;
  move.y = y;
}

function clearStick(): void {
  stick.active = false;
  stick.pointerId = null;
  stick.x = 0;
  stick.y = 0;
  recomputeMove();
  const knob = document.getElementById('ecraft-stick-knob');
  if (knob) knob.style.transform = 'translate(-50%, -50%)';
  const base = document.getElementById('ecraft-stick');
  base?.classList.remove('active');
}

type EcraftApi = {
  interact?: () => void;
  capture?: () => void;
  activate?: () => void;
  activateRobot?: () => void;
  enterCar?: () => void;
  enterRaceCar?: () => void;
  recover?: () => void;
  holdTracker?: () => void;
  sleep?: () => void;
  enterHouse?: () => void;
  visitJail?: () => void;
  toggleBuild?: () => void;
  cycleBlock?: () => void;
  breakBlock?: () => void;
  placeBlock?: () => void;
  selectBlock?: (i: number) => void;
  toggleFloorMode?: () => void;
  cycleCraftView?: () => void;
  placeHouse?: () => void;
  getCraftPalette?: () => Array<{ name: string; color: string }>;
  layBed?: () => void;
  pantherJump?: () => void;
  tigerAmbush?: () => void;
  pigDrop?: () => void;
  boardTrain?: () => void;
  callPolice?: () => void;
  putInJail?: () => void;
  goTigerKingdom?: () => void;
  toggleBackpack?: () => void;
  usePhone?: () => void;
  closePhone?: () => void;
  callContact?: (id: string) => void;
  connectFreeVoice?: () => void;
  phoneTalk?: () => void;
  phoneSendText?: (text: string) => void;
  getFreeVoiceStatus?: () => { connected: boolean; line: string; voices: Array<{ uri: string; name: string }> };
  setFreeVoiceUri?: (uri: string) => void;
  equipWhip?: () => void;
  useWhip?: () => void;
  pickupItem?: () => void;
  dropItem?: () => void;
  useComputer?: () => void;
  closeComputer?: () => void;
  getBackpack?: () => {
    open: boolean;
    phoneOpen: boolean;
    whipEquipped: boolean;
    atComputer?: boolean;
    items: Array<{ id: string; name: string; icon: string; qty?: number }>;
    inventory: string;
    gold?: number;
    bankGoldLeft?: number;
  };
  exitIndoor?: () => void;
  unpause?: () => void;
  getState?: () => { flags?: Record<string, boolean>; prompt?: string; status?: string; hour?: number; dayPhase?: string };
};

function api(): EcraftApi | undefined {
  return (window as unknown as { __ecraft?: EcraftApi }).__ecraft;
}

function keyToAxis(): { x: number; y: number } {
  recomputeMove();
  return { x: move.x, y: move.y };
}

function flash(btn: HTMLElement): void {
  btn.style.filter = 'brightness(1.4)';
  setTimeout(() => {
    btn.style.filter = '';
  }, 120);
}

function showToast(msg: string): void {
  const el = document.getElementById('ecraft-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  window.setTimeout(() => el.classList.remove('show'), 2500);
}

function updateCoachFromState(): void {
  const coach = document.getElementById('ecraft-coach');
  if (!coach) return;
  const st = api()?.getState?.();
  const flags = st?.flags || {};
  const robotOn = !!flags.robotActive;
  const inCar = !!flags.inVehicle;
  const mark = (key: string, done: boolean, next: boolean) => {
    const el = coach.querySelector(`[data-coach="${key}"]`);
    if (!el) return;
    el.classList.toggle('done', done);
    el.classList.toggle('next', next && !done);
  };
  // Highlight BOTH early steps until done — cars do not require robot
  mark('robot', robotOn, !robotOn);
  mark('car', inCar, !inCar);
  mark('drive', false, inCar);
  const tip = document.getElementById('ecraft-coach-tip');
  if (tip) {
    if (!api()) {
      tip.textContent =
        'FIRST: tap green NEW GAME in the middle of the screen (or tap ACTIVATE ROBOT — it will start for you).';
    } else if (inCar) {
      tip.textContent = 'You are in a car — DRAG the right stick with your finger to drive. EXIT / E to leave.';
    } else if (robotOn) {
      tip.textContent = 'Robot is with you! Tap GET IN CAR or RACE, then DRAG the stick to drive.';
    } else {
      tip.textContent =
        'DRAG the big stick (bottom-right) with your finger to walk. Purple ACTIVATE ROBOT is top-left.';
    }
    // Also surface live game status under tip when available
    if (st?.status) tip.textContent = `${tip.textContent} · ${st.status}`;
  }
}

let coachTimer: number | null = null;
function startCoachLoop(): void {
  if (coachTimer != null) window.clearInterval(coachTimer);
  updateCoachFromState();
  coachTimer = window.setInterval(updateCoachFromState, 700);
}

type PendingAction = { fnName: keyof EcraftApi; label: string };
let pendingAction: PendingAction | null = null;
let pendingWatch: number | null = null;

function startMissionFromTitle(): void {
  const game = (window as unknown as {
    __phaserGame?: {
      scene?: {
        getScene?: (key: string) => { registry: { set: (k: string, v: unknown) => void }; scene: { isActive?: () => boolean; start: (k: string) => void } } | undefined;
        start?: (key: string) => void;
      };
    };
  }).__phaserGame;
  try {
    // Prefer Phaser scene hop so we don't full-reload
    const title = game?.scene?.getScene?.('Title');
    if (title?.scene?.isActive?.()) {
      title.registry.set('loadSave', false);
      title.scene.start('Game');
      showToast('Starting mission… then your button will fire');
      return;
    }
    // Already past title / boot — soft jump
    game?.scene?.start?.('Game');
  } catch {
    const url = new URL(location.href);
    url.searchParams.set('skiptitle', '1');
    url.searchParams.set('new', '1');
    location.href = url.toString();
  }
}

function flushPendingWhenReady(): void {
  if (!pendingAction) return;
  if (pendingWatch != null) return;
  pendingWatch = window.setInterval(() => {
    const queued = pendingAction;
    if (!queued) return;
    const a = api();
    if (!a || typeof a[queued.fnName] !== 'function') return;
    if (pendingWatch != null) {
      window.clearInterval(pendingWatch);
      pendingWatch = null;
    }
    pendingAction = null;
    window.setTimeout(() => callApi(queued.fnName, queued.label), 250);
  }, 200);
}

/** Call game API — never silent-fail if game is still booting. */
function callApi(fnName: keyof EcraftApi, fallbackToast: string): void {
  const a = api();
  if (!a) {
    // On title screen / boot: start mission, then replay this action
    pendingAction = { fnName, label: fallbackToast };
    showToast('Start mission first — launching NEW GAME…');
    startMissionFromTitle();
    flushPendingWhenReady();
    return;
  }
  const fn = a[fnName];
  if (typeof fn !== 'function') {
    showToast('Button not ready — tap again');
    return;
  }
  a.unpause?.();
  try {
    (fn as () => void).call(a);
    // Prefer live game status over generic label
    const st = a.getState?.();
    const live = st?.status || st?.prompt;
    showToast(live || fallbackToast);
    updateCoachFromState();
  } catch (err) {
    showToast('Control error — try again');
    console.error('[E-CRAFT] button', fnName, err);
  }
}

export function installDomOverlay(): void {
  document.getElementById('ecraft-dom-root')?.remove();
  document.getElementById('ecraft-dom-style')?.remove();

  const style = document.createElement('style');
  style.id = 'ecraft-dom-style';
  style.textContent = `
    #ecraft-dom-root {
      position: fixed; inset: 0; pointer-events: none; z-index: 99999 !important;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    #ecraft-toast {
      pointer-events: none;
      position: absolute; left: 50%; top: max(8px, env(safe-area-inset-top));
      transform: translateX(-50%);
      background: rgba(0,0,0,.72); color: #fffde7;
      border-radius: 999px; padding: 7px 12px;
      font-size: 12px; max-width: min(88vw, 420px); text-align: center;
      opacity: 0; transition: opacity .15s ease;
      z-index: 5;
    }
    #ecraft-toast.show { opacity: 1; }

    /* Persistent how-to coach — always readable on phone */
    #ecraft-coach {
      pointer-events: none;
      position: absolute;
      left: 50%;
      top: max(42px, calc(env(safe-area-inset-top) + 36px));
      transform: translateX(-50%);
      width: min(94vw, 440px);
      background: rgba(0, 20, 40, .88);
      border: 2px solid #ffd54f;
      border-radius: 12px;
      padding: 8px 10px;
      color: #fffde7;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.35;
      text-align: left;
      z-index: 6;
      box-shadow: 0 8px 20px rgba(0,0,0,.45);
    }
    #ecraft-coach .title {
      color: #ffd54f;
      font-size: 11px;
      letter-spacing: .04em;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    #ecraft-coach .step { margin: 2px 0; }
    #ecraft-coach .step.done { color: #69f0ae; text-decoration: line-through; opacity: .85; }
    #ecraft-coach .step.next { color: #fff59d; }
    #ecraft-coach .tip {
      margin-top: 5px;
      color: #90caf9;
      font-weight: 700;
      font-size: 11px;
    }

    /* Compact LEFT grid — priority actions FIRST so Activate/Car never hide */
    #ecraft-actions {
      pointer-events: auto;
      position: absolute;
      left: max(6px, env(safe-area-inset-left));
      bottom: max(6px, env(safe-area-inset-bottom));
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      width: min(168px, 42vw);
      max-height: min(58vh, 440px);
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
      z-index: 3;
      padding: 2px;
    }
    #ecraft-actions button {
      height: 40px;
      border-radius: 10px;
      border: 2px solid rgba(255,255,255,.4);
      background: rgba(13,71,161,.95); color: #fff;
      font-weight: 900; font-size: 11px;
      box-shadow: 0 5px 12px rgba(0,0,0,.4);
      -webkit-user-select: none; user-select: none;
      touch-action: manipulation;
      width: 100%;
      line-height: 1.05;
      padding: 0 3px;
    }
    #ecraft-actions .wide { grid-column: 1 / -1; }
    #ecraft-actions .act { background: #1b5e20; }
    #ecraft-actions .cap { background: #b71c1c; font-size: 10px; }
    #ecraft-actions .car { background: #ef6c00; color: #111; }
    #ecraft-actions .actv { background: #6a1b9a; }
    #ecraft-actions .bot { background: #00838f; color: #e0f7fa; font-size: 10px; }
    #ecraft-actions .race { background: #d50000; color: #fff; }
    #ecraft-actions .rec { background: #455a64; color: #fff; font-size: 10px; height: 34px; }
    #ecraft-actions .rst { background: #b71c1c; color: #fff; font-size: 11px; height: 36px; }
    #ecraft-actions .pack { background: #4e342e; color: #ffe0b2; }
    #ecraft-actions .whip {
      background: #bf360c; color: #fffde7; display: none;
    }
    #ecraft-actions .whip.show { display: block; }
    #ecraft-backpack .bp-row {
      color: #ffe0b2; font-size: 13px; font-weight: 700;
      padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,.12);
    }
    #ecraft-computer {
      pointer-events: auto;
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.75);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 49;
      padding: 16px;
    }
    #ecraft-computer.show { display: flex; }

    /* Backpack panel */
    #ecraft-backpack {
      pointer-events: auto;
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.68);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 48;
      padding: 16px;
    }
    #ecraft-backpack.show { display: flex; }
    #ecraft-backpack .box {
      background: linear-gradient(160deg, #3e2723, #1b100e);
      border: 3px solid #ffcc80;
      border-radius: 16px;
      padding: 16px 14px;
      width: min(92vw, 340px);
      text-align: center;
      box-shadow: 0 12px 40px rgba(0,0,0,.55);
    }
    #ecraft-backpack h2 {
      margin: 0 0 6px;
      color: #ffe0b2;
      font-size: 18px;
    }
    #ecraft-backpack p {
      margin: 0 0 12px;
      color: #bcaaa4;
      font-size: 13px;
      line-height: 1.35;
    }
    #ecraft-backpack .items {
      display: grid;
      gap: 8px;
      margin-bottom: 10px;
    }
    #ecraft-backpack .items button {
      height: 52px;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,.35);
      font-weight: 900;
      font-size: 15px;
      touch-action: manipulation;
      color: #fff;
    }
    #ecraft-backpack #bp-phone { background: #1565c0; }
    #ecraft-backpack #bp-whip { background: #e65100; }
    #ecraft-backpack #bp-close {
      width: 100%;
      height: 44px;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,.3);
      background: #455a64;
      color: #fff;
      font-weight: 900;
      font-size: 14px;
      touch-action: manipulation;
    }

    /* Field phone screen */
    #ecraft-phone {
      pointer-events: auto;
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.72);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 49;
      padding: 16px;
    }
    #ecraft-phone.show { display: flex; }
    #ecraft-phone .device {
      width: min(88vw, 300px);
      background: #111;
      border: 4px solid #37474f;
      border-radius: 28px;
      padding: 14px 12px 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,.6), inset 0 0 0 2px #90a4ae;
    }
    #ecraft-phone .notch {
      width: 72px; height: 8px; border-radius: 8px;
      background: #263238; margin: 0 auto 10px;
    }
    #ecraft-phone .screen {
      background: #0d47a1;
      border-radius: 14px;
      min-height: 220px;
      padding: 10px;
      color: #e3f2fd;
      font-size: 13px;
      line-height: 1.4;
      text-align: left;
    }
    #ecraft-phone .phone-ask {
      font-weight: 900;
      font-size: 14px;
      margin: 0 0 8px;
      color: #fffde7;
    }
    #ecraft-phone .phone-status {
      font-size: 12px;
      color: #bbdefb;
      margin-bottom: 8px;
      white-space: pre-wrap;
      min-height: 36px;
    }
    #ecraft-phone .call-list {
      display: grid;
      gap: 6px;
      max-height: min(42vh, 320px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    #ecraft-phone .call-list button {
      height: 40px;
      border-radius: 10px;
      border: 2px solid rgba(255,255,255,.35);
      background: #1565c0;
      color: #fff;
      font-weight: 900;
      font-size: 12px;
      touch-action: manipulation;
      text-align: left;
      padding: 0 10px;
    }
    #ecraft-phone .call-list button.calling {
      background: #2e7d32;
      animation: phonePulse 0.8s ease infinite alternate;
    }
    #ecraft-phone .phone-phrase {
      height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.35);
      background: #00695c;
      color: #e0f2f1;
      font-weight: 800;
      font-size: 11px;
      touch-action: manipulation;
    }
    @keyframes phonePulse {
      from { filter: brightness(1); }
      to { filter: brightness(1.25); }
    }
    #ecraft-phone #phone-close {
      margin-top: 10px;
      width: 100%;
      height: 44px;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,.35);
      background: #c62828;
      color: #fff;
      font-weight: 900;
      font-size: 14px;
      touch-action: manipulation;
    }

    /* Restart confirm modal */
    #ecraft-confirm {
      pointer-events: auto;
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.72);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 50;
      padding: 16px;
    }
    #ecraft-confirm.show { display: flex; }
    #ecraft-confirm .box {
      background: #0d1b2a;
      border: 3px solid #ffd54f;
      border-radius: 16px;
      padding: 18px 16px;
      width: min(92vw, 340px);
      text-align: center;
      box-shadow: 0 12px 40px rgba(0,0,0,.55);
    }
    #ecraft-confirm h2 {
      margin: 0 0 8px;
      color: #fffde7;
      font-size: 18px;
    }
    #ecraft-confirm p {
      margin: 0 0 16px;
      color: #b0bec5;
      font-size: 14px;
      line-height: 1.4;
    }
    #ecraft-confirm .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    #ecraft-confirm button {
      height: 48px;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,.35);
      font-weight: 900;
      font-size: 16px;
      touch-action: manipulation;
    }
    #ecraft-confirm #btn-yes {
      background: #c62828;
      color: #fff;
    }
    #ecraft-confirm #btn-no {
      background: #37474f;
      color: #fff;
    }
    #ecraft-actions .trk { background: #00695c; color: #b9f6ca; font-size: 10px; }
    #ecraft-actions .home { background: #ad1457; color: #fff; font-size: 10px; }
    #ecraft-actions .sleep { background: #283593; color: #e8eaf6; font-size: 10px; }
    #ecraft-actions .pan { background: #212121; color: #ffeb3b; font-size: 10px; }
    #ecraft-actions .pig { background: #ad1457; color: #fce4ec; font-size: 10px; }
    #ecraft-actions .jail { background: #4a148c; color: #e1bee7; font-size: 10px; }
    #ecraft-actions .bld { background: #2e7d32; color: #e8f5e9; font-size: 10px; }
    #ecraft-actions .brk { background: #bf360c; color: #fff; font-size: 10px; }
    #ecraft-actions .bed { background: #1565c0; color: #e3f2fd; font-size: 10px; }

    /* Craft Build hotbar (Minecraft-style, original Craft Blocks) */
    #ecraft-hotbar {
      pointer-events: auto;
      position: absolute;
      left: 50%;
      bottom: max(178px, calc(env(safe-area-inset-bottom) + 170px));
      transform: translateX(-50%);
      display: none;
      flex-wrap: wrap;
      justify-content: center;
      max-width: min(420px, 92vw);
      gap: 4px;
      padding: 6px 8px;
      background: rgba(0,0,0,.8);
      border: 2px solid #ffd54f;
      border-radius: 12px;
      z-index: 8;
      align-items: center;
    }
    #ecraft-hotbar.show { display: flex; }
    #ecraft-hotbar button {
      width: 32px; height: 32px;
      border-radius: 8px;
      border: 2px solid #546e7a;
      font-size: 8px; font-weight: 900;
      color: #fff; padding: 0;
      touch-action: manipulation;
    }
    #ecraft-hotbar button.sel { border-color: #ffd54f; box-shadow: 0 0 0 2px #ffd54f; }
    #ecraft-hotbar #ecraft-hotbar-place {
      width: auto; min-width: 52px; padding: 0 8px;
      background: #2e7d32; border-color: #81c784; font-size: 10px;
    }
    #ecraft-hotbar #ecraft-hotbar-count {
      color: #ffe082; font-size: 10px; font-weight: 800; margin-left: 4px; white-space: nowrap;
    }
    #ecraft-palette {
      pointer-events: auto;
      position: absolute;
      left: 50%;
      bottom: max(250px, calc(env(safe-area-inset-bottom) + 240px));
      transform: translateX(-50%);
      display: none;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px;
      max-width: min(460px, 94vw);
      padding: 8px;
      background: rgba(0,0,0,.85);
      border: 2px solid #81c784;
      border-radius: 12px;
      z-index: 9;
    }
    #ecraft-palette.show { display: flex; }
    #ecraft-palette button {
      width: 36px; height: 36px; border-radius: 6px;
      border: 2px solid #546e7a; color: #fff; font-size: 8px; font-weight: 900;
      padding: 0; touch-action: manipulation;
    }
    #ecraft-palette button.sel { border-color: #69f0ae; box-shadow: 0 0 0 2px #69f0ae; }
    #ecraft-actions .exit { background: #006064; color: #e0f7fa; font-size: 10px; }

    /* Virtual finger stick — phone + iPad thumb control */
    #ecraft-stick {
      pointer-events: auto;
      position: absolute;
      right: max(10px, env(safe-area-inset-right));
      bottom: max(10px, env(safe-area-inset-bottom));
      width: min(168px, 42vw);
      height: min(168px, 42vw);
      touch-action: none;
      -webkit-user-select: none; user-select: none;
      z-index: 8;
    }
    #ecraft-stick-base {
      position: absolute; inset: 0;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 35%, rgba(66,165,245,.55), rgba(13,71,161,.92) 70%);
      border: 3px solid rgba(255,255,255,.55);
      box-shadow: 0 10px 24px rgba(0,0,0,.45), inset 0 0 24px rgba(0,0,0,.25);
      touch-action: none;
    }
    #ecraft-stick.active #ecraft-stick-base {
      border-color: #ffd54f;
      box-shadow: 0 0 0 3px rgba(255,213,79,.35), 0 10px 24px rgba(0,0,0,.5);
    }
    #ecraft-stick-knob {
      position: absolute;
      left: 50%; top: 50%;
      width: 42%; height: 42%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #e3f2fd, #1565c0 65%, #0d47a1);
      border: 3px solid #fff;
      box-shadow: 0 6px 14px rgba(0,0,0,.45);
      pointer-events: none;
      transition: none;
    }
    #ecraft-stick-hint {
      position: absolute;
      left: 50%; bottom: -22px;
      transform: translateX(-50%);
      white-space: nowrap;
      font-size: 10px; font-weight: 900;
      color: #ffe082;
      text-shadow: 0 1px 3px #000;
      pointer-events: none;
    }
    /* Keep tiny D-pad hits for smoke / accessibility (under stick, same zone) */
    #ecraft-pad-legacy {
      position: absolute; inset: 0;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr 1fr;
      opacity: 0;
      pointer-events: none;
    }

    @media (max-width: 400px) {
      #ecraft-actions { width: min(148px, 39vw); gap: 4px; }
      #ecraft-actions button { height: 36px; font-size: 10px; }
      #ecraft-actions .rec { height: 30px; }
      #ecraft-stick { width: min(152px, 44vw); height: min(152px, 44vw); }
    }
    @media (max-width: 340px) {
      #ecraft-actions { width: min(124px, 38vw); }
      #ecraft-stick { width: min(136px, 46vw); height: min(136px, 46vw); }
    }
    /* iPad / tablet — bigger thumb stick */
    @media (min-width: 768px) {
      #ecraft-stick {
        width: min(220px, 28vw);
        height: min(220px, 28vw);
        right: max(18px, env(safe-area-inset-right));
        bottom: max(18px, env(safe-area-inset-bottom));
      }
      #ecraft-stick-hint { font-size: 12px; bottom: -26px; }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'ecraft-dom-root';
  root.innerHTML = `
    <div id="ecraft-toast">① ACTIVATE ROBOT · ② GET IN CAR · ③ HOLD ▶</div>
    <div id="ecraft-coach" aria-live="polite">
      <div class="title">How to play — do these in order</div>
      <div class="step next" data-coach="robot">① Tap purple <b>ACTIVATE ROBOT</b></div>
      <div class="step" data-coach="car">② Tap orange <b>GET IN CAR</b> (or red RACE)</div>
      <div class="step" data-coach="drive">③ <b>DRAG</b> the right stick with your finger to walk/drive</div>
      <div class="tip" id="ecraft-coach-tip">Cars work without the robot — drive anytime.</div>
    </div>
    <div id="ecraft-actions" aria-label="action buttons">
      <button type="button" class="actv wide" id="btn-activate">① ACTIVATE ROBOT</button>
      <button type="button" class="car" id="btn-car">② GET IN CAR</button>
      <button type="button" class="race" id="btn-race">② RACE</button>
      <button type="button" class="act" id="btn-e">E</button>
      <button type="button" class="cap" id="btn-cap">CAPTURE</button>
      <button type="button" class="trk" id="btn-tracker">TRACKER</button>
      <button type="button" class="pack" id="btn-pack">🎒 PACK</button>
      <button type="button" class="whip" id="btn-whip">🪢 WHIP</button>
      <button type="button" class="act" id="btn-pickup" style="background:#2e7d32">PICK UP</button>
      <button type="button" class="act" id="btn-drop" style="background:#6d4c41">DROP</button>
      <button type="button" class="bot" id="btn-computer" style="background:#1565c0">💻 COMPUTER</button>
      <button type="button" class="bot" id="btn-robot">ROBOT</button>
      <button type="button" class="exit wide" id="btn-exit">EXIT</button>
      <button type="button" class="home" id="btn-house">GO HOME</button>
      <button type="button" class="jail" id="btn-jail">VISIT JAIL</button>
      <button type="button" class="bed" id="btn-bed">LAY BED</button>
      <button type="button" class="sleep" id="btn-sleep">SLEEP</button>
      <button type="button" class="bld" id="btn-build">BUILD</button>
      <button type="button" class="bld" id="btn-block">NEXT</button>
      <button type="button" class="bld" id="btn-place">PLACE</button>
      <button type="button" class="brk" id="btn-break">BREAK</button>
      <button type="button" class="bld" id="btn-floor">FLOOR/STACK</button>
      <button type="button" class="bld" id="btn-craft-view" style="background:#00695c">VIEW 3D</button>
      <button type="button" class="bld" id="btn-house-build" style="background:#6a1b9a">BUILD HOUSE</button>
      <button type="button" class="pan" id="btn-panther">PANTHER!</button>
      <button type="button" class="pan" id="btn-tigers" style="background:#e65100">TIGERS!</button>
      <button type="button" class="pig" id="btn-pig">PIG!</button>
      <button type="button" class="act" id="btn-train" style="background:#37474f;color:#ffe082">🚂 TRAIN</button>
      <button type="button" class="cap wide" id="btn-call-police" style="background:#0d47a1;color:#fff;border-color:#90caf9">🚓 CALL POLICE</button>
      <button type="button" class="jail wide" id="btn-put-jail" style="background:#4a148c;color:#ffe082;border-color:#ce93d8">🔒 PUT IN JAIL</button>
      <button type="button" class="pan wide" id="btn-tiger-kingdom" style="background:#e65100;color:#fffde7">🐅 TIGER KINGDOM</button>
      <button type="button" class="rec wide" id="btn-recover">UNFREEZE / SAVE</button>
      <button type="button" class="rst wide" id="btn-restart">RESTART</button>
    </div>
    <div id="ecraft-backpack" role="dialog" aria-modal="true" aria-label="backpack">
      <div class="box">
        <h2>🎒 Field Backpack</h2>
        <p>Collected loot lives here. Use phone / whip, or DROP to put items down.</p>
        <div id="bp-loot-list" class="items" style="text-align:left;max-height:120px;overflow:auto;margin-bottom:8px"></div>
        <div class="items">
          <button type="button" id="bp-phone">📱 Use Phone</button>
          <button type="button" id="bp-whip">🪢 Take Out Whip</button>
        </div>
        <button type="button" id="bp-close">Close backpack</button>
      </div>
    </div>
    <div id="ecraft-phone" role="dialog" aria-modal="true" aria-label="field phone">
      <div class="device">
        <div class="notch"></div>
        <div class="screen" id="phone-screen">
          <div class="phone-ask">📱 Want to call somebody?</div>
          <div class="phone-status" id="phone-status">Connect Free AI Voice, then tap a contact. Talk with the mic!</div>
          <button type="button" id="btn-free-voice" style="width:100%;height:40px;margin-bottom:8px;border-radius:10px;border:2px solid #69f0ae;background:#1b5e20;color:#b9f6ca;font-weight:900;font-size:12px;touch-action:manipulation">🔌 Connect Free AI Voice</button>
          <select id="phone-voice-pick" style="width:100%;margin-bottom:8px;height:34px;border-radius:8px;background:#0d47a1;color:#fff;border:1px solid #90caf9;font-size:11px"></select>
          <div class="call-list" id="phone-call-list"></div>
          <div id="phone-talk-row" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
            <button type="button" id="btn-phone-talk" style="height:42px;border-radius:10px;border:0;background:#c62828;color:#fff;font-weight:900;font-size:12px;touch-action:manipulation">🎙️ TAP TO TALK</button>
            <button type="button" id="btn-phone-send" style="height:42px;border-radius:10px;border:0;background:#1565c0;color:#fff;font-weight:900;font-size:12px;touch-action:manipulation">SEND TEXT</button>
          </div>
          <input id="phone-text-in" type="text" placeholder="Or type what you want to say…" style="width:100%;box-sizing:border-box;margin-top:6px;height:36px;border-radius:8px;border:1px solid #90caf9;background:#e3f2fd;color:#0d47a1;padding:0 8px;font-size:12px" />
          <div id="phone-phrases" style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px">
            <button type="button" data-phrase="Hello! How are you?" class="phone-phrase">👋 Hello</button>
            <button type="button" data-phrase="Where are the tigers?" class="phone-phrase">🐯 Tigers?</button>
            <button type="button" data-phrase="Tell me about the gold bank." class="phone-phrase">🥇 Gold?</button>
            <button type="button" data-phrase="How do I get to Eastport?" class="phone-phrase">🚂 Eastport?</button>
          </div>
        </div>
        <button type="button" id="phone-close">HANG UP / CLOSE</button>
      </div>
    </div>
    <div id="ecraft-computer" role="dialog" aria-modal="true" aria-label="computer">
      <div class="device" style="width:min(94vw,420px);background:#1b5e20;border-radius:12px;padding:12px;border:4px solid #263238">
        <div style="color:#b9f6ca;font-weight:900;margin-bottom:6px">💻 BUILDING COMPUTER</div>
        <textarea id="computer-input" rows="8" placeholder="Type here… notes, passwords, city tips…"
          style="width:100%;box-sizing:border-box;background:#003300;color:#69f0ae;border:2px solid #00c853;border-radius:8px;padding:8px;font-family:ui-monospace,monospace;font-size:13px"></textarea>
        <button type="button" id="computer-close" style="margin-top:10px;width:100%;height:44px;border-radius:10px;border:0;background:#c62828;color:#fff;font-weight:900">STAND UP / CLOSE</button>
      </div>
    </div>
    <div id="ecraft-confirm" role="dialog" aria-modal="true" aria-labelledby="ecraft-confirm-title">
      <div class="box">
        <h2 id="ecraft-confirm-title">Restart game?</h2>
        <p>Are you sure?<br/>This erases your save and starts over.<br/><b>Y</b> = Yes · <b>N</b> = No</p>
        <div class="row">
          <button type="button" id="btn-yes">Y — YES</button>
          <button type="button" id="btn-no">N — NO</button>
        </div>
      </div>
    </div>
    <div id="ecraft-hotbar" aria-label="craft block hotbar">
      <!-- slots filled by JS from Craft palette -->
      <button type="button" id="ecraft-hotbar-place">PLACE</button>
      <span id="ecraft-hotbar-count">0 blocks</span>
    </div>
    <div id="ecraft-palette" aria-label="craft creative inventory"></div>
    <div id="ecraft-stick" aria-label="finger move stick" role="application">
      <div id="ecraft-stick-base">
        <div id="ecraft-stick-knob"></div>
        <div id="ecraft-pad-legacy" aria-hidden="true">
          <span></span><button type="button" data-dir="up" tabindex="-1"></button><span></span>
          <button type="button" data-dir="left" tabindex="-1"></button><span></span>
          <button type="button" data-dir="right" tabindex="-1"></button>
          <span></span><button type="button" data-dir="down" tabindex="-1"></button><span></span>
        </div>
      </div>
      <div id="ecraft-stick-hint">DRAG TO MOVE</div>
    </div>
  `;
  document.body.appendChild(root);

  (window as unknown as { __ecraftToast: (m: string) => void }).__ecraftToast = showToast;
  showToast('DRAG the blue stick (bottom-right) with your finger to move');
  startCoachLoop();

  // —— Virtual finger stick (phone + iPad) ——
  const stickEl = document.getElementById('ecraft-stick')!;
  const stickBase = document.getElementById('ecraft-stick-base')!;
  const stickKnob = document.getElementById('ecraft-stick-knob')!;

  const updateStickFromEvent = (e: PointerEvent) => {
    const rect = stickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = Math.min(rect.width, rect.height) * 0.36;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    const nx = dx / maxR;
    const ny = dy / maxR;
    // Dead zone so resting finger doesn't drift
    const dead = 0.12;
    stick.x = Math.abs(nx) < dead ? 0 : nx;
    stick.y = Math.abs(ny) < dead ? 0 : ny;
    stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    recomputeMove();
  };

  const onStickDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    api()?.unpause?.();
    stick.active = true;
    stick.pointerId = e.pointerId;
    stickEl.classList.add('active');
    try {
      stickBase.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    updateStickFromEvent(e);
  };
  const onStickMove = (e: PointerEvent) => {
    if (!stick.active || stick.pointerId !== e.pointerId) return;
    e.preventDefault();
    updateStickFromEvent(e);
  };
  const onStickUp = (e: PointerEvent) => {
    if (stick.pointerId != null && e.pointerId !== stick.pointerId) return;
    e.preventDefault();
    try {
      stickBase.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    clearStick();
  };

  stickBase.addEventListener('pointerdown', onStickDown);
  stickBase.addEventListener('pointermove', onStickMove);
  stickBase.addEventListener('pointerup', onStickUp);
  stickBase.addEventListener('pointercancel', onStickUp);
  stickBase.addEventListener('lostpointercapture', () => clearStick());
  // iOS Safari: also block native gestures on the stick
  stickEl.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
    },
    { passive: false },
  );

  // Legacy D-pad API for smokes / programmatic nudges (sets stick axis)
  root.querySelectorAll<HTMLButtonElement>('#ecraft-pad-legacy [data-dir]').forEach((btn) => {
    const dir = btn.dataset.dir!;
    const apply = (on: boolean) => {
      if (dir === 'left') stick.x = on ? -1 : stick.x < 0 ? 0 : stick.x;
      if (dir === 'right') stick.x = on ? 1 : stick.x > 0 ? 0 : stick.x;
      if (dir === 'up') stick.y = on ? -1 : stick.y < 0 ? 0 : stick.y;
      if (dir === 'down') stick.y = on ? 1 : stick.y > 0 ? 0 : stick.y;
      stick.active = on || Math.abs(stick.x) > 0.01 || Math.abs(stick.y) > 0.01;
      if (!stick.active) {
        stick.x = 0;
        stick.y = 0;
      }
      recomputeMove();
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      apply(true);
    });
    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      apply(false);
    });
  });

  (window as unknown as { __ecraftSetStick?: (x: number, y: number) => void }).__ecraftSetStick = (
    x: number,
    y: number,
  ) => {
    stick.active = Math.abs(x) > 0.01 || Math.abs(y) > 0.01;
    stick.x = Math.max(-1, Math.min(1, x));
    stick.y = Math.max(-1, Math.min(1, y));
    const maxR = (stickBase.getBoundingClientRect().width || 160) * 0.36;
    stickKnob.style.transform = `translate(calc(-50% + ${stick.x * maxR}px), calc(-50% + ${stick.y * maxR}px))`;
    recomputeMove();
  };

  const bindAction = (id: string, fnName: keyof EcraftApi, label: string) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    let last = 0;
    const fire = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - last < 140) return;
      last = now;
      flash(btn);
      callApi(fnName, label);
    };
    // pointerdown only — click duplicate was skipping / double-toggling on phones
    btn.addEventListener('pointerdown', fire);
  };

  bindAction('btn-e', 'interact', 'Interact');
  bindAction('btn-cap', 'capture', 'Capture');
  bindAction('btn-tracker', 'holdTracker', 'Holding Tracker');
  bindAction('btn-pack', 'toggleBackpack', 'Backpack');
  bindAction('btn-whip', 'useWhip', 'Whip crack!');
  bindAction('btn-pickup', 'pickupItem', 'Picked up');
  bindAction('btn-drop', 'dropItem', 'Dropped');
  bindAction('btn-computer', 'useComputer', 'Computer');
  bindAction('btn-robot', 'activateRobot', 'Robot ON');
  bindAction('btn-activate', 'activateRobot', 'Robot ON');
  bindAction('btn-exit', 'exitIndoor', 'Exited');
  bindAction('btn-house', 'enterHouse', 'Welcome home');
  bindAction('btn-jail', 'visitJail', 'Visiting jail');
  bindAction('btn-bed', 'layBed', 'Bed');
  bindAction('btn-sleep', 'sleep', 'Sleeping…');
  bindAction('btn-build', 'toggleBuild', 'Build mode');
  bindAction('btn-block', 'cycleBlock', 'Next block');
  bindAction('btn-place', 'placeBlock', 'Placed block');
  bindAction('btn-break', 'breakBlock', 'Broke block');
  bindAction('btn-floor', 'toggleFloorMode', 'Floor/Stack');
  bindAction('btn-craft-view', 'cycleCraftView', 'Craft view');
  bindAction('btn-house-build', 'placeHouse', 'Craft house built');

  const backpackEl = document.getElementById('ecraft-backpack');
  const phoneEl = document.getElementById('ecraft-phone');
  const whipBtn = document.getElementById('btn-whip');
  const setBackpackOpen = (open: boolean) => {
    backpackEl?.classList.toggle('show', open);
  };
  const fillCallList = () => {
    const list = document.getElementById('phone-call-list');
    if (!list || list.dataset.ready === '1') return;
    const contacts = [
      { id: 'robot', label: '🤖 Call Robot' },
      { id: 'sasquatch', label: '🦍 Call Sasquatch' },
      { id: 'bigfoot', label: '🦶 Call Bigfoot' },
      { id: 'police', label: '🚓 Call Police' },
      { id: 'fire', label: '🚒 Call Fire Dept' },
      { id: 'ambulance', label: '🚑 Call Ambulance' },
      { id: 'zookeeper', label: '🐯 Call Zookeeper' },
      { id: 'bank', label: '🏦 Call Bank Teller' },
    ];
    list.innerHTML = contacts
      .map((c) => `<button type="button" data-call="${c.id}">${c.label}</button>`)
      .join('');
    list.dataset.ready = '1';
    list.querySelectorAll<HTMLButtonElement>('button[data-call]').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        flash(btn);
        list.querySelectorAll('button').forEach((b) => b.classList.remove('calling'));
        btn.classList.add('calling');
        const id = btn.dataset.call || '';
        // Call on this tap so the voice speaks out loud (iOS gesture)
        api()?.callContact?.(id);
        showToast('Calling — turn volume UP!');
      });
    });
  };
  const refreshVoicePick = () => {
    const sel = document.getElementById('phone-voice-pick') as HTMLSelectElement | null;
    if (!sel) return;
    const st = api()?.getFreeVoiceStatus?.();
    const voices = st?.voices || [];
    sel.innerHTML =
      `<option value="">Free voices (${voices.length})</option>` +
      voices.map((v) => `<option value="${v.uri}">${v.name}</option>`).join('');
  };
  const setPhoneOpen = (open: boolean, lines?: string[]) => {
    phoneEl?.classList.toggle('show', open);
    if (open) {
      fillCallList();
      refreshVoicePick();
      const st = document.getElementById('phone-status');
      if (st && lines?.length) st.textContent = lines.join('\n');
      else if (st && !lines?.length) {
        st.textContent = 'Connect Free AI Voice, pick a contact, then talk.';
      }
    } else {
      document.querySelectorAll('#phone-call-list button').forEach((b) => b.classList.remove('calling'));
    }
  };
  (window as unknown as { __ecraftPhoneStatus?: (msg: string) => void }).__ecraftPhoneStatus = (msg: string) => {
    const st = document.getElementById('phone-status');
    if (st) st.textContent = msg;
  };
  (window as unknown as { __ecraftRefreshVoices?: () => void }).__ecraftRefreshVoices = refreshVoicePick;

  document.getElementById('btn-free-voice')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    flash(e.currentTarget as HTMLElement);
    callApi('connectFreeVoice', 'Free AI Voice');
    window.setTimeout(refreshVoicePick, 200);
  });
  document.getElementById('phone-voice-pick')?.addEventListener('change', (e) => {
    const uri = (e.target as HTMLSelectElement).value;
    if (uri) api()?.setFreeVoiceUri?.(uri);
  });
  document.getElementById('btn-phone-talk')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    flash(e.currentTarget as HTMLElement);
    // Must call talk on this same gesture so mic + speakers unlock on iOS
    api()?.phoneTalk?.();
    showToast('Listening… speak now!');
  });
  document.getElementById('btn-phone-send')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const inp = document.getElementById('phone-text-in') as HTMLInputElement | null;
    const text = inp?.value || '';
    if (!text.trim()) {
      showToast('Type a message first');
      return;
    }
    api()?.phoneSendText?.(text);
    if (inp) inp.value = '';
    showToast('Sent — listen for the reply!');
  });
  document.getElementById('phone-text-in')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inp = e.currentTarget as HTMLInputElement;
    api()?.phoneSendText?.(inp.value);
    inp.value = '';
  });
  document.querySelectorAll<HTMLButtonElement>('#phone-phrases .phone-phrase').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      flash(btn);
      const phrase = btn.dataset.phrase || btn.textContent || '';
      api()?.phoneSendText?.(phrase);
      showToast('Sent — listen!');
    });
  });
  (window as unknown as { __ecraftShowPhonePhrases?: () => void }).__ecraftShowPhonePhrases = () => {
    const el = document.getElementById('phone-phrases');
    el?.scrollIntoView?.({ block: 'nearest' });
  };
  const setWhipEquipped = (eq: boolean) => {
    whipBtn?.classList.toggle('show', eq);
  };
  const computerEl = document.getElementById('ecraft-computer');
  const setComputerOpen = (open: boolean) => {
    computerEl?.classList.toggle('show', open);
    if (open) {
      const ta = document.getElementById('computer-input') as HTMLTextAreaElement | null;
      window.setTimeout(() => ta?.focus(), 50);
    }
  };
  (window as unknown as { __ecraftBackpackUi?: (o: boolean) => void }).__ecraftBackpackUi = (o: boolean) => {
    setBackpackOpen(o);
    if (o) {
      const bp = api()?.getBackpack?.();
      const list = document.getElementById('bp-loot-list');
      if (list && bp?.items) {
        list.innerHTML =
          bp.items
            .map(
              (i) =>
                `<div class="bp-row">${i.icon} ${i.name}${i.qty && i.qty > 1 ? ` ×${i.qty}` : ''}</div>`,
            )
            .join('') || '<div class="bp-row">Empty pockets</div>';
      }
    }
  };
  (window as unknown as { __ecraftPhoneUi?: (o: boolean, lines?: string[]) => void }).__ecraftPhoneUi = setPhoneOpen;
  (window as unknown as { __ecraftWhipUi?: (eq: boolean) => void }).__ecraftWhipUi = setWhipEquipped;
  (window as unknown as { __ecraftComputerUi?: (o: boolean) => void }).__ecraftComputerUi = setComputerOpen;

  document.getElementById('computer-close')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setComputerOpen(false);
    callApi('closeComputer', 'Stood up');
  });

  document.getElementById('bp-phone')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBackpackOpen(false);
    callApi('usePhone', 'Phone out');
  });
  document.getElementById('bp-whip')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBackpackOpen(false);
    callApi('equipWhip', 'Whip equipped');
  });
  document.getElementById('bp-close')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBackpackOpen(false);
    // Only toggle game state if backpack was open (avoid accidental re-open)
    const bp = api()?.getBackpack?.();
    if (bp?.open) callApi('toggleBackpack', 'Backpack closed');
    else showToast('Backpack closed');
  });
  document.getElementById('phone-close')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPhoneOpen(false);
    callApi('closePhone', 'Hung up');
  });

  const fillCraftUi = () => {
    const palette = api()?.getCraftPalette?.() || [];
    const hotbar = document.getElementById('ecraft-hotbar');
    const grid = document.getElementById('ecraft-palette');
    if (!hotbar || !grid) return;
    // Clear old slot buttons
    hotbar.querySelectorAll('[data-block]').forEach((n) => n.remove());
    grid.innerHTML = '';
    const placeBtn = document.getElementById('ecraft-hotbar-place');
    const count = document.getElementById('ecraft-hotbar-count');
    palette.forEach((b, i) => {
      const mk = (parent: HTMLElement, label: string) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.block = String(i);
        btn.title = b.name;
        btn.textContent = label;
        btn.style.background = b.color;
        if (/#(f|e|d|c|b|a|9)/i.test(b.color)) btn.style.color = '#111';
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          api()?.selectBlock?.(i);
          flash(btn);
          parent.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
          btn.classList.add('sel');
        });
        parent.insertBefore(btn, placeBtn || null);
      };
      // Hotbar shows first 12; full palette shows all
      if (i < 12) mk(hotbar, String((i + 1) % 10));
      const pbtn = document.createElement('button');
      pbtn.type = 'button';
      pbtn.dataset.block = String(i);
      pbtn.title = b.name;
      pbtn.textContent = b.name.slice(0, 3);
      pbtn.style.background = b.color;
      if (/#(f|e|d|c|b|a|9)/i.test(b.color)) pbtn.style.color = '#111';
      pbtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        api()?.selectBlock?.(i);
        flash(pbtn);
        grid.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
        pbtn.classList.add('sel');
      });
      grid.appendChild(pbtn);
    });
    if (count && placeBtn) {
      hotbar.appendChild(placeBtn);
      hotbar.appendChild(count);
    }
  };
  // Retry until GameScene exposes palette
  let tries = 0;
  const waitPal = window.setInterval(() => {
    tries++;
    if (api()?.getCraftPalette || tries > 40) {
      window.clearInterval(waitPal);
      fillCraftUi();
    }
  }, 200);

  document.getElementById('ecraft-hotbar-place')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    callApi('placeBlock', 'Placed block');
  });
  bindAction('btn-panther', 'pantherJump', 'Panther!');
  bindAction('btn-tigers', 'tigerAmbush', 'Tigers!');
  bindAction('btn-pig', 'pigDrop', 'Oink!');
  bindAction('btn-train', 'boardTrain', 'Boarding train…');
  bindAction('btn-call-police', 'callPolice', 'Calling police…');
  bindAction('btn-put-jail', 'putInJail', 'Putting Sasquatch in jail…');
  bindAction('btn-tiger-kingdom', 'goTigerKingdom', 'Tiger Kingdom');
  bindAction('btn-car', 'enterCar', 'Patrol Car');
  bindAction('btn-race', 'enterRaceCar', 'Race Car');
  bindAction('btn-recover', 'recover', 'Recovered');

  // Restart with Are you sure? Y/N
  const confirmEl = document.getElementById('ecraft-confirm');
  const openRestartConfirm = () => {
    confirmEl?.classList.add('show');
    showToast('Are you sure? Y / N');
  };
  const closeRestartConfirm = () => {
    confirmEl?.classList.remove('show');
  };
  const doRestart = () => {
    closeRestartConfirm();
    showToast('Restarting…');
    try {
      localStorage.removeItem('ecraft_save_v02');
      localStorage.removeItem('ecraft_craft_blocks_v1');
      localStorage.removeItem('ecraft_craft_blocks_v2');
      localStorage.removeItem('ecraft_craft_blocks_v3');
      localStorage.removeItem('ecraft_craft_blocks_v4');
      localStorage.removeItem('ecraft_craft_houses_v1');
    } catch {
      /* ignore */
    }
    // Soft reload fresh game
    const url = new URL(location.href);
    url.searchParams.set('skiptitle', '1');
    url.searchParams.set('new', '1');
    url.searchParams.delete('continue');
    location.href = url.toString();
  };
  document.getElementById('btn-restart')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openRestartConfirm();
  });
  document.getElementById('btn-yes')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    doRestart();
  });
  document.getElementById('btn-no')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeRestartConfirm();
    showToast('Restart cancelled');
  });
  (window as unknown as { __ecraftRestartConfirm: { open: () => void; close: () => void; yes: () => void } }).__ecraftRestartConfirm = {
    open: openRestartConfirm,
    close: closeRestartConfirm,
    yes: doRestart,
  };

  window.addEventListener(
    'keydown',
    (e) => {
      // Confirm dialog captures Y/N first
      if (confirmEl?.classList.contains('show')) {
        if (e.code === 'KeyY' || e.code === 'Enter') {
          e.preventDefault();
          doRestart();
          return;
        }
        if (e.code === 'KeyN' || e.code === 'Escape') {
          e.preventDefault();
          closeRestartConfirm();
          showToast('Restart cancelled');
          return;
        }
      }
      pressed.add(e.code);
      recomputeMove();
      api()?.unpause?.();
      if (e.code === 'KeyE') callApi('interact', 'Interact');
      if (e.code === 'Space') {
        e.preventDefault();
        callApi('capture', 'Capture');
      }
      if (e.code === 'KeyC') callApi('enterCar', 'Patrol Car');
      if (e.code === 'KeyF') callApi('activateRobot', 'Robot ON');
      if (e.code === 'KeyT') callApi('holdTracker', 'Holding Tracker');
      if (e.code === 'KeyB') callApi('toggleBackpack', 'Backpack');
      if (e.code === 'KeyV') callApi('useWhip', 'Whip crack!');
      if (e.code === 'KeyH') callApi('enterHouse', 'Welcome home');
      if (e.code === 'KeyZ') callApi('sleep', 'Sleeping…');
      if (e.code === 'KeyX') callApi('exitIndoor', 'Exited');
      if (e.code === 'KeyP') callApi('pigDrop', 'Oink!');
      if (e.code === 'KeyG') callApi('toggleBuild', 'Build mode');
      if (e.code === 'KeyQ') callApi('breakBlock', 'Broke block');
      if (e.code === 'KeyR') callApi('placeBlock', 'Placed block');
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.replace('Digit', ''));
        if (n >= 1 && n <= 9) api()?.selectBlock?.(n - 1);
        if (n === 0) api()?.selectBlock?.(9); // glass
      }
      if (e.code === 'Minus') api()?.selectBlock?.(10); // iron
      if (e.code === 'Equal') api()?.selectBlock?.(11); // wool
    },
    { passive: false },
  );
  window.addEventListener('keyup', (e) => {
    pressed.delete(e.code);
    recomputeMove();
  });
  window.addEventListener('blur', () => {
    pressed.clear();
    clearStick();
  });
}

export function pollDomInput(): DomInputState {
  const axis = keyToAxis();
  return {
    x: axis.x,
    y: axis.y,
    interact: false,
    capture: false,
    map: false,
    pause: false,
    radio: false,
  };
}

export function setDomStatus(text: string): void {
  const toast = (window as unknown as { __ecraftToast?: (m: string) => void }).__ecraftToast;
  if (toast && text) toast(text);
  updateCoachFromState();
}

export function setDomMeta(_inv: string, _job: string): void {
  // no-op
}
