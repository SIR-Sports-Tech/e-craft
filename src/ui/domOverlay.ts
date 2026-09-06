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
(window as unknown as { __ecraftMove: { x: number; y: number } }).__ecraftMove = move;

function recomputeMove(): void {
  let x = 0;
  let y = 0;
  if (pressed.has('KeyA') || pressed.has('ArrowLeft')) x -= 1;
  if (pressed.has('KeyD') || pressed.has('ArrowRight')) x += 1;
  if (pressed.has('KeyW') || pressed.has('ArrowUp')) y -= 1;
  if (pressed.has('KeyS') || pressed.has('ArrowDown')) y += 1;
  move.x = x;
  move.y = y;
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
  layBed?: () => void;
  pantherJump?: () => void;
  pigDrop?: () => void;
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
      tip.textContent = 'You are in a car — HOLD ▶ / ▲ / ◀ / ▼ on the D-pad to drive. EXIT / E to leave.';
    } else if (robotOn) {
      tip.textContent = 'Robot is with you! Tap GET IN CAR or RACE, then HOLD the D-pad.';
    } else {
      tip.textContent =
        'Purple ACTIVATE ROBOT is at the TOP LEFT. Cars also work without the robot — tap GET IN CAR anytime.';
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
    #ecraft-actions .exit { background: #006064; color: #e0f7fa; font-size: 10px; }

    #ecraft-pad {
      pointer-events: auto;
      position: absolute;
      right: max(6px, env(safe-area-inset-right));
      bottom: max(6px, env(safe-area-inset-bottom));
      width: min(160px, 40vw);
      height: min(160px, 40vw);
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr 1fr;
      gap: 5px;
      touch-action: none;
      z-index: 3;
    }
    #ecraft-pad button {
      width: 100%; height: 100%; min-width: 0; min-height: 0;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,.45);
      background: rgba(13,71,161,.95); color: #fff;
      font-weight: 900; font-size: clamp(14px, 4.2vw, 18px);
      box-shadow: 0 6px 14px rgba(0,0,0,.4);
      -webkit-user-select: none; user-select: none;
      touch-action: none;
      padding: 0;
    }
    #ecraft-pad .pad-dead { pointer-events: none; visibility: hidden; }

    @media (max-width: 400px) {
      #ecraft-actions { width: min(148px, 39vw); gap: 4px; }
      #ecraft-actions button { height: 36px; font-size: 10px; }
      #ecraft-actions .rec { height: 30px; }
      #ecraft-pad { width: min(136px, 36vw); height: min(136px, 36vw); }
    }
    @media (max-width: 340px) {
      #ecraft-actions { width: min(124px, 38vw); }
      #ecraft-pad { width: min(118px, 36vw); height: min(118px, 36vw); }
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
      <div class="step" data-coach="drive">③ HOLD right D-pad <b>▶</b> to drive (don’t just tap)</div>
      <div class="tip" id="ecraft-coach-tip">Cars work without the robot — drive anytime.</div>
    </div>
    <div id="ecraft-actions" aria-label="action buttons">
      <button type="button" class="actv wide" id="btn-activate">① ACTIVATE ROBOT</button>
      <button type="button" class="car" id="btn-car">② GET IN CAR</button>
      <button type="button" class="race" id="btn-race">② RACE</button>
      <button type="button" class="act" id="btn-e">E</button>
      <button type="button" class="cap" id="btn-cap">CAPTURE</button>
      <button type="button" class="trk" id="btn-tracker">TRACKER</button>
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
      <button type="button" class="pan" id="btn-panther">PANTHER!</button>
      <button type="button" class="pig" id="btn-pig">PIG!</button>
      <button type="button" class="rec wide" id="btn-recover">UNFREEZE / SAVE</button>
      <button type="button" class="rst wide" id="btn-restart">RESTART</button>
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
      <button type="button" data-block="0" title="DIRT" style="background:#8d6e63">1</button>
      <button type="button" data-block="1" title="GRASS" style="background:#43a047">2</button>
      <button type="button" data-block="2" title="STONE" style="background:#78909c">3</button>
      <button type="button" data-block="3" title="WOOD" style="background:#a1887f">4</button>
      <button type="button" data-block="4" title="BRICK" style="background:#c62828">5</button>
      <button type="button" data-block="5" title="GOLD" style="background:#ffd54f;color:#111">6</button>
      <button type="button" data-block="6" title="WATER" style="background:#29b6f6">7</button>
      <button type="button" data-block="7" title="SAND" style="background:#fdd835;color:#111">8</button>
      <button type="button" data-block="8" title="LEAF" style="background:#66bb6a">9</button>
      <button type="button" data-block="9" title="GLASS" style="background:#b3e5fc;color:#111">0</button>
      <button type="button" data-block="10" title="IRON" style="background:#90a4ae">-</button>
      <button type="button" data-block="11" title="WOOL" style="background:#f5f5f5;color:#111">=</button>
      <button type="button" id="ecraft-hotbar-place">PLACE</button>
      <span id="ecraft-hotbar-count">0 blocks</span>
    </div>
    <div id="ecraft-pad" aria-label="movement pad">
      <span class="pad-dead"></span>
      <button type="button" data-dir="up">▲</button>
      <span class="pad-dead"></span>
      <button type="button" data-dir="left">◀</button>
      <span class="pad-dead"></span>
      <button type="button" data-dir="right">▶</button>
      <span class="pad-dead"></span>
      <button type="button" data-dir="down">▼</button>
      <span class="pad-dead"></span>
    </div>
  `;
  document.body.appendChild(root);

  (window as unknown as { __ecraftToast: (m: string) => void }).__ecraftToast = showToast;
  showToast('① ACTIVATE ROBOT · ② GET IN CAR · ③ HOLD ▶ to drive');
  startCoachLoop();

  // D-pad
  root.querySelectorAll<HTMLButtonElement>('#ecraft-pad [data-dir]').forEach((btn) => {
    const dir = btn.dataset.dir!;
    const map: Record<string, string> = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    const code = map[dir];
    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      api()?.unpause?.();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pressed.add(code);
      recomputeMove();
      flash(btn);
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pressed.delete(code);
      recomputeMove();
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  });

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
  document.querySelectorAll<HTMLButtonElement>('#ecraft-hotbar [data-block]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = Number(btn.dataset.block);
      api()?.selectBlock?.(i);
      flash(btn);
    });
  });
  document.getElementById('ecraft-hotbar-place')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    callApi('placeBlock', 'Placed block');
  });
  bindAction('btn-panther', 'pantherJump', 'Panther!');
  bindAction('btn-pig', 'pigDrop', 'Oink!');
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
    recomputeMove();
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
