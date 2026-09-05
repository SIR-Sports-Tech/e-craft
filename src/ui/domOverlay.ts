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

/** Call game API — never silent-fail if game is still booting. */
function callApi(fnName: keyof EcraftApi, fallbackToast: string): void {
  const a = api();
  if (!a) {
    showToast('Game loading… tap again');
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

    /* Compact LEFT grid — all buttons visible without scroll on phones */
    #ecraft-actions {
      pointer-events: auto;
      position: absolute;
      left: max(6px, env(safe-area-inset-left));
      bottom: max(6px, env(safe-area-inset-bottom));
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      width: min(158px, 40vw);
      max-height: min(62vh, 460px);
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
    #ecraft-actions .trk { background: #00695c; color: #b9f6ca; font-size: 10px; }
    #ecraft-actions .home { background: #ad1457; color: #fff; font-size: 10px; }
    #ecraft-actions .sleep { background: #283593; color: #e8eaf6; font-size: 10px; }
    #ecraft-actions .pan { background: #212121; color: #ffeb3b; font-size: 10px; }
    #ecraft-actions .pig { background: #ad1457; color: #fce4ec; font-size: 10px; }
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
    <div id="ecraft-toast">All buttons live — LEFT actions · RIGHT D-pad</div>
    <div id="ecraft-actions" aria-label="action buttons">
      <button type="button" class="act" id="btn-e">E</button>
      <button type="button" class="cap" id="btn-cap">CAPTURE</button>
      <button type="button" class="trk" id="btn-tracker">TRACKER</button>
      <button type="button" class="bot" id="btn-robot">ROBOT</button>
      <button type="button" class="actv wide" id="btn-activate">ACTIVATE ROBOT</button>
      <button type="button" class="exit wide" id="btn-exit">EXIT</button>
      <button type="button" class="home" id="btn-house">GO HOME</button>
      <button type="button" class="sleep" id="btn-sleep">SLEEP</button>
      <button type="button" class="car" id="btn-car">PATROL</button>
      <button type="button" class="race" id="btn-race">RACE</button>
      <button type="button" class="pan" id="btn-panther">PANTHER!</button>
      <button type="button" class="pig" id="btn-pig">PIG!</button>
      <button type="button" class="rec wide" id="btn-recover">UNFREEZE / SAVE</button>
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
  showToast('Controls ready — every button works');

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
  bindAction('btn-sleep', 'sleep', 'Sleeping…');
  bindAction('btn-panther', 'pantherJump', 'Panther!');
  bindAction('btn-pig', 'pigDrop', 'Oink!');
  bindAction('btn-car', 'enterCar', 'Patrol Car');
  bindAction('btn-race', 'enterRaceCar', 'Race Car');
  bindAction('btn-recover', 'recover', 'Recovered');

  window.addEventListener(
    'keydown',
    (e) => {
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
      if (e.code === 'KeyB') callApi('activateRobot', 'Robot ON');
      if (e.code === 'KeyT') callApi('holdTracker', 'Holding Tracker');
      if (e.code === 'KeyH') callApi('enterHouse', 'Welcome home');
      if (e.code === 'KeyZ') callApi('sleep', 'Sleeping…');
      if (e.code === 'KeyX') callApi('exitIndoor', 'Exited');
      if (e.code === 'KeyP') callApi('pigDrop', 'Oink!');
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
}

export function setDomMeta(_inv: string, _job: string): void {
  // no-op
}
