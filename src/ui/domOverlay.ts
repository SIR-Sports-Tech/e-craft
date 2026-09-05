/**
 * Minimal Chrome/phone controls — no giant instruction boxes covering the game.
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
let interactPulse = false;
let capturePulse = false;
let mapPulse = false;
let pausePulse = false;
let radioPulse = false;

function keyToAxis(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (pressed.has('KeyA') || pressed.has('ArrowLeft')) x -= 1;
  if (pressed.has('KeyD') || pressed.has('ArrowRight')) x += 1;
  if (pressed.has('KeyW') || pressed.has('ArrowUp')) y -= 1;
  if (pressed.has('KeyS') || pressed.has('ArrowDown')) y += 1;
  return { x, y };
}

export function installDomOverlay(): void {
  if (document.getElementById('ecraft-dom-root')) return;

  const style = document.createElement('style');
  style.textContent = `
    #ecraft-dom-root {
      position: fixed; inset: 0; pointer-events: none; z-index: 30;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    #ecraft-toast {
      pointer-events: none;
      position: absolute; left: 50%; bottom: 118px; transform: translateX(-50%);
      background: rgba(0,0,0,.55); color: #fffde7;
      border-radius: 999px; padding: 8px 14px;
      font-size: 13px; max-width: 90vw; text-align: center;
      opacity: 0; transition: opacity .2s ease;
      backdrop-filter: blur(4px);
    }
    #ecraft-toast.show { opacity: 1; }
    #ecraft-pad {
      pointer-events: auto;
      position: absolute; right: 12px; bottom: 12px;
      display: grid; grid-template-columns: 58px 58px 58px; gap: 6px;
      touch-action: none;
    }
    #ecraft-actions {
      pointer-events: auto;
      position: absolute; left: 12px; bottom: 12px;
      display: flex; flex-direction: column; gap: 8px;
      touch-action: none;
    }
    #ecraft-dom-root button {
      width: 58px; height: 58px; border-radius: 16px;
      border: 2px solid rgba(255,255,255,.35);
      background: rgba(13,71,161,.88); color: #fff;
      font-weight: 800; font-size: 13px;
      box-shadow: 0 6px 16px rgba(0,0,0,.4);
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      touch-action: none;
    }
    #ecraft-actions .go { background: rgba(27,94,32,.92); width: 86px; }
    #ecraft-actions .cap { background: rgba(183,28,28,.92); width: 86px; }
    #ecraft-actions .drive { background: rgba(255,143,0,.95); color: #111; width: 86px; font-size: 12px; }
    #ecraft-pad button:active, #ecraft-actions button:active {
      transform: scale(0.94);
      filter: brightness(1.15);
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'ecraft-dom-root';
  root.innerHTML = `
    <div id="ecraft-toast">Ready</div>
    <div id="ecraft-actions">
      <button type="button" class="go" data-act="interact">E</button>
      <button type="button" class="cap" data-act="capture">CAP</button>
      <button type="button" class="drive" data-act="interact">CAR</button>
    </div>
    <div id="ecraft-pad" aria-label="movement pad">
      <span></span><button type="button" data-dir="up">▲</button><span></span>
      <button type="button" data-dir="left">◀</button>
      <button type="button" data-dir="down">▼</button>
      <button type="button" data-dir="right">▶</button>
    </div>
  `;
  document.body.appendChild(root);

  const bindHold = (btn: HTMLButtonElement, code: string) => {
    const down = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      pressed.add(code);
    };
    const up = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      pressed.delete(code);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  };

  root.querySelectorAll<HTMLButtonElement>('#ecraft-pad [data-dir]').forEach((btn) => {
    const dir = btn.dataset.dir!;
    const map: Record<string, string> = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    bindHold(btn, map[dir]);
  });

  root.querySelectorAll<HTMLButtonElement>('#ecraft-actions [data-act]').forEach((btn) => {
    const fire = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act === 'interact') interactPulse = true;
      if (act === 'capture') capturePulse = true;
      if (act === 'radio') radioPulse = true;
    };
    btn.addEventListener('pointerdown', fire);
    btn.addEventListener('click', fire);
  });

  window.addEventListener(
    'keydown',
    (e) => {
      pressed.add(e.code);
      if (e.code === 'KeyE') interactPulse = true;
      if (e.code === 'Space') {
        e.preventDefault();
        capturePulse = true;
      }
      if (e.code === 'KeyM') mapPulse = true;
      if (e.code === 'Escape') pausePulse = true;
      if (e.code === 'KeyR') radioPulse = true;
    },
    { passive: false },
  );
  window.addEventListener('keyup', (e) => pressed.delete(e.code));
  window.addEventListener('blur', () => pressed.clear());
}

export function pollDomInput(): DomInputState {
  const axis = keyToAxis();
  const state: DomInputState = {
    x: axis.x,
    y: axis.y,
    interact: interactPulse,
    capture: capturePulse,
    map: mapPulse,
    pause: pausePulse,
    radio: radioPulse,
  };
  interactPulse = false;
  capturePulse = false;
  mapPulse = false;
  pausePulse = false;
  radioPulse = false;
  return state;
}

let toastTimer: number | undefined;
export function setDomStatus(text: string): void {
  const el = document.getElementById('ecraft-toast');
  if (!el) return;
  // Keep toast short — no permanent walls of text
  const short = text.length > 90 ? text.slice(0, 87) + '…' : text;
  el.textContent = short;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2800);
}

export function setDomMeta(_inv: string, _job: string): void {
  // Intentionally empty — inventory/job boxes were covering the game.
}
