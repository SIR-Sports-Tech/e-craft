/**
 * Direct-wired controls for phone/Chrome.
 * Buttons call window.__ecraft.* immediately — no fragile pulse queue.
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
      position: absolute; left: 50%; top: 10px; transform: translateX(-50%);
      background: rgba(0,0,0,.6); color: #fffde7;
      border-radius: 999px; padding: 8px 14px;
      font-size: 13px; max-width: 92vw; text-align: center;
      opacity: 0; transition: opacity .15s ease;
    }
    #ecraft-toast.show { opacity: 1; }
    /* Action buttons: LEFT side only */
    #ecraft-actions {
      pointer-events: auto;
      position: absolute; left: 10px; bottom: 10px;
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      width: 168px;
      touch-action: none;
      z-index: 2;
    }
    /* Round/D-pad controller: RIGHT side only — nothing else on the right */
    #ecraft-pad {
      pointer-events: auto;
      position: absolute; right: 12px; bottom: 14px;
      display: grid; grid-template-columns: 70px 70px 70px; gap: 8px;
      touch-action: none;
      z-index: 2;
    }
    #ecraft-pad button {
      width: 70px; height: 70px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.45);
      background: rgba(13,71,161,.95); color: #fff;
      font-weight: 900; font-size: 18px;
      box-shadow: 0 8px 18px rgba(0,0,0,.45);
      -webkit-user-select: none; user-select: none;
      touch-action: none;
    }
    #ecraft-actions button {
      height: 64px; border-radius: 16px;
      border: 2px solid rgba(255,255,255,.4);
      background: rgba(13,71,161,.95); color: #fff;
      font-weight: 900; font-size: 15px;
      box-shadow: 0 8px 18px rgba(0,0,0,.45);
      -webkit-user-select: none; user-select: none;
      touch-action: none;
    }
    #ecraft-actions .act { background: #1b5e20; }
    #ecraft-actions .cap { background: #b71c1c; font-size: 12px; }
    #ecraft-actions .car { background: #ef6c00; color: #111; grid-column: 1 / -1; }
    #ecraft-actions .actv { background: #6a1b9a; grid-column: 1 / -1; }
    #ecraft-actions .race { background: #d50000; color: #fff; grid-column: 1 / -1; }
    #ecraft-actions .rec { background: #455a64; color: #fff; grid-column: 1 / -1; font-size: 11px; }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'ecraft-dom-root';
  root.innerHTML = `
    <div id="ecraft-toast">Tap ACTIVATE / E near objects · CAR to drive</div>
    <div id="ecraft-actions">
      <button type="button" class="act" id="btn-e">E</button>
      <button type="button" class="cap" id="btn-cap">CAPTURE</button>
      <button type="button" class="actv" id="btn-activate">ACTIVATE</button>
      <button type="button" class="car" id="btn-car">PATROL CAR</button>
      <button type="button" class="race" id="btn-race">RACE CAR</button>
      <button type="button" class="rec" id="btn-recover">UNFREEZE / SAVE</button>
    </div>
    <div id="ecraft-pad" aria-label="movement pad">
      <span></span><button type="button" data-dir="up">▲</button><span></span>
      <button type="button" data-dir="left">◀</button>
      <button type="button" data-dir="down">▼</button>
      <button type="button" data-dir="right">▶</button>
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
  toast('Controls ready — use pad + ACTIVATE / CAR');

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
      try { btn.setPointerCapture(e.pointerId); } catch {}
      pressed.add(code);
      recomputeMove();
      flash(btn);
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pressed.delete(code);
      recomputeMove();
      try { btn.releasePointerCapture(e.pointerId); } catch {}
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    // Do NOT clear on pointerleave while captured — that was killing drive input
  });

  const bindAction = (id: string, fn: () => void, label: string) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const fire = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
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
