/**
 * Direct-wired controls for phone/Chrome.
 * Layout law: LEFT = actions only · RIGHT = D-pad only · never overlap.
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
/** Persistent axis written by pad (survives flaky keyup/pointerleave). */
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
  enterCar?: () => void;
  enterRaceCar?: () => void;
  recover?: () => void;
  holdTracker?: () => void;
  unpause?: () => void;
  getState?: () => { flags?: Record<string, boolean>; prompt?: string };
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

export function installDomOverlay(): void {
  const existing = document.getElementById('ecraft-dom-root');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'ecraft-dom-style';
  document.getElementById('ecraft-dom-style')?.remove();
  style.textContent = `
    #ecraft-dom-root {
      position: fixed; inset: 0; pointer-events: none; z-index: 99999 !important;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    #ecraft-toast {
      pointer-events: none;
      position: absolute; left: 50%; top: max(8px, env(safe-area-inset-top));
      transform: translateX(-50%);
      background: rgba(0,0,0,.65); color: #fffde7;
      border-radius: 999px; padding: 7px 12px;
      font-size: 12px; max-width: min(88vw, 420px); text-align: center;
      opacity: 0; transition: opacity .15s ease;
      z-index: 5;
    }
    #ecraft-toast.show { opacity: 1; }

    /*
      NO-OVERLAP LAYOUT
      - Left column: actions only (max ~36vw)
      - Right column: D-pad only (max ~42vw)
      - Middle gap reserved; columns never share x-space
    */
    #ecraft-actions {
      pointer-events: auto;
      position: absolute;
      left: max(6px, env(safe-area-inset-left));
      bottom: max(6px, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: min(132px, 34vw);
      max-height: min(58vh, 420px);
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      touch-action: none;
      z-index: 3;
      padding-right: 2px;
    }
    #ecraft-actions .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    #ecraft-actions button {
      height: 44px;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,.4);
      background: rgba(13,71,161,.95); color: #fff;
      font-weight: 900; font-size: 12px;
      box-shadow: 0 6px 14px rgba(0,0,0,.4);
      -webkit-user-select: none; user-select: none;
      touch-action: none;
      width: 100%;
      line-height: 1.05;
      padding: 0 4px;
    }
    #ecraft-actions .act { background: #1b5e20; }
    #ecraft-actions .cap { background: #b71c1c; font-size: 11px; }
    #ecraft-actions .car { background: #ef6c00; color: #111; }
    #ecraft-actions .actv { background: #6a1b9a; }
    #ecraft-actions .race { background: #d50000; color: #fff; }
    #ecraft-actions .rec { background: #455a64; color: #fff; font-size: 10px; height: 36px; }
    #ecraft-actions .trk { background: #00695c; color: #b9f6ca; font-size: 11px; }

    /* D-pad: RIGHT only — fixed square, never under left actions */
    #ecraft-pad {
      pointer-events: auto;
      position: absolute;
      right: max(6px, env(safe-area-inset-right));
      bottom: max(6px, env(safe-area-inset-bottom));
      width: min(168px, 42vw);
      height: min(168px, 42vw);
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr 1fr;
      gap: 5px;
      touch-action: none;
      z-index: 3;
    }
    #ecraft-pad button {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,.45);
      background: rgba(13,71,161,.95); color: #fff;
      font-weight: 900; font-size: clamp(14px, 4.2vw, 18px);
      box-shadow: 0 6px 14px rgba(0,0,0,.4);
      -webkit-user-select: none; user-select: none;
      touch-action: none;
      padding: 0;
    }
    #ecraft-pad .pad-dead {
      pointer-events: none;
      visibility: hidden;
    }

    /* Narrow phones: shrink further so columns never collide */
    @media (max-width: 400px) {
      #ecraft-actions { width: min(118px, 32vw); gap: 5px; }
      #ecraft-actions button { height: 40px; font-size: 11px; border-radius: 10px; }
      #ecraft-actions .rec { height: 32px; font-size: 9px; }
      #ecraft-pad { width: min(148px, 40vw); height: min(148px, 40vw); gap: 4px; }
    }
    @media (max-width: 340px) {
      #ecraft-actions { width: 108px; }
      #ecraft-pad { width: 132px; height: 132px; }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'ecraft-dom-root';
  root.innerHTML = `
    <div id="ecraft-toast">Left = actions · Right = D-pad (no overlap)</div>
    <div id="ecraft-actions" aria-label="action buttons">
      <div class="row">
        <button type="button" class="act" id="btn-e">E</button>
        <button type="button" class="cap" id="btn-cap">CAPTURE</button>
      </div>
      <button type="button" class="trk" id="btn-tracker">HOLD TRACKER</button>
      <button type="button" class="actv" id="btn-activate">ACTIVATE</button>
      <button type="button" class="car" id="btn-car">PATROL CAR</button>
      <button type="button" class="race" id="btn-race">RACE CAR</button>
      <button type="button" class="rec" id="btn-recover">UNFREEZE / SAVE</button>
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

  const toast = (msg: string) => {
    const el = document.getElementById('ecraft-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    window.setTimeout(() => el.classList.remove('show'), 2500);
  };
  (window as unknown as { __ecraftToast: (m: string) => void }).__ecraftToast = toast;
  toast('Controls: LEFT actions · RIGHT D-pad');

  // Movement pad
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

  const bindAction = (id: string, fn: () => void, label: string) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    let last = 0;
    const fire = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - last < 280) return;
      last = now;
      api()?.unpause?.();
      flash(btn);
      try {
        fn();
        toast(label);
      } catch (err) {
        toast('Control error — try again');
        console.error(err);
      }
    };
    btn.addEventListener('pointerdown', fire);
    btn.addEventListener('click', fire);
  };

  bindAction('btn-e', () => api()?.interact?.(), 'Interact');
  bindAction('btn-cap', () => api()?.capture?.(), 'Capture');
  bindAction('btn-tracker', () => api()?.holdTracker?.(), 'Holding Tracker');
  bindAction('btn-activate', () => api()?.activate?.(), 'Activate');
  bindAction('btn-car', () => api()?.enterCar?.(), 'Patrol Car');
  bindAction('btn-race', () => api()?.enterRaceCar?.(), 'Race Car');
  bindAction('btn-recover', () => api()?.recover?.(), 'Recovered');

  window.addEventListener(
    'keydown',
    (e) => {
      pressed.add(e.code);
      recomputeMove();
      api()?.unpause?.();
      if (e.code === 'KeyE') api()?.interact?.();
      if (e.code === 'Space') {
        e.preventDefault();
        api()?.capture?.();
      }
      if (e.code === 'KeyC') api()?.enterCar?.();
      if (e.code === 'KeyF') api()?.activate?.();
      if (e.code === 'KeyT') api()?.holdTracker?.();
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

/** Movement only — actions are direct-wired above. */
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
  // no-op: boxes removed on purpose
}
