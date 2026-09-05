/**
 * Chrome-reliable DOM overlay: always-on keyboard capture + on-screen pad.
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
      position: fixed; inset: 0; pointer-events: none; z-index: 20;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    #ecraft-dom-root .panel {
      pointer-events: none;
      position: absolute; left: 12px; top: 12px;
      background: rgba(0,0,0,.72); color: #e8f5e9;
      border: 1px solid rgba(79,195,247,.45); border-radius: 12px;
      padding: 10px 14px; max-width: min(520px, 70vw);
      backdrop-filter: blur(6px);
      box-shadow: 0 8px 28px rgba(0,0,0,.35);
    }
    #ecraft-dom-root .panel h1 {
      margin: 0 0 4px; font-size: 15px; color: #4fc3f7; letter-spacing: .04em;
    }
    #ecraft-dom-root .panel p { margin: 0; font-size: 13px; line-height: 1.35; color: #fff9c4; }
    #ecraft-dom-root .hint { margin-top: 6px; font-size: 12px; color: #b0bec5; }
    #ecraft-pad {
      pointer-events: auto;
      position: absolute; right: 16px; bottom: 16px;
      display: grid; grid-template-columns: 56px 56px 56px; gap: 8px;
    }
    #ecraft-pad button, #ecraft-actions button {
      width: 56px; height: 56px; border-radius: 14px; border: 1px solid rgba(255,255,255,.25);
      background: rgba(21,101,192,.85); color: #fff; font-weight: 700; font-size: 14px;
      box-shadow: 0 4px 14px rgba(0,0,0,.35); cursor: pointer;
    }
    #ecraft-pad button:active, #ecraft-actions button:active { transform: scale(.96); background: #1b5e20; }
    #ecraft-actions {
      pointer-events: auto;
      position: absolute; left: 16px; bottom: 16px;
      display: flex; gap: 8px; flex-wrap: wrap; max-width: 420px;
    }
    #ecraft-actions .cap { background: rgba(198,40,40,.9); }
    #ecraft-actions .go { background: rgba(46,125,50,.9); width: auto; padding: 0 14px; }
    #ecraft-actions .rad { background: rgba(0,151,167,.9); width: auto; padding: 0 12px; }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'ecraft-dom-root';
  root.innerHTML = `
    <div class="panel">
      <h1>E-CRAFT v1.0 · Sasquatch Mission</h1>
      <p id="ecraft-dom-status">Click the game, then use WASD or the pad to move.</p>
      <div class="hint">WASD · E interact · Space capture · R robot tip · M map · Esc pause</div>
      <div class="hint" id="ecraft-dom-inv" style="margin-top:4px;color:#b2dfdb"></div>
      <div class="hint" id="ecraft-dom-job" style="margin-top:2px;color:#ffe082"></div>
    </div>
    <div id="ecraft-actions">
      <button type="button" class="go" data-act="interact">E · Interact</button>
      <button type="button" class="cap" data-act="capture">Space · Capture</button>
      <button type="button" class="rad" data-act="radio">R · Robot Tip</button>
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
      pressed.add(code);
    };
    const up = (e: Event) => {
      e.preventDefault();
      pressed.delete(code);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  };

  root.querySelectorAll<HTMLButtonElement>('#ecraft-pad [data-dir]').forEach((btn) => {
    const dir = btn.dataset.dir;
    const map: Record<string, string> = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    if (dir && map[dir]) bindHold(btn, map[dir]);
  });

  root.querySelectorAll<HTMLButtonElement>('#ecraft-actions [data-act]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const act = btn.dataset.act;
      if (act === 'interact') interactPulse = true;
      if (act === 'capture') capturePulse = true;
      if (act === 'radio') radioPulse = true;
    });
  });

  window.addEventListener('keydown', (e) => {
    pressed.add(e.code);
    if (e.code === 'KeyE') interactPulse = true;
    if (e.code === 'Space') {
      e.preventDefault();
      capturePulse = true;
    }
    if (e.code === 'KeyM') mapPulse = true;
    if (e.code === 'Escape') pausePulse = true;
    if (e.code === 'KeyR') radioPulse = true;
  });
  window.addEventListener('keyup', (e) => {
    pressed.delete(e.code);
  });
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

export function setDomStatus(text: string): void {
  const el = document.getElementById('ecraft-dom-status');
  if (el) el.textContent = text;
}

export function setDomMeta(inv: string, job: string): void {
  const i = document.getElementById('ecraft-dom-inv');
  const j = document.getElementById('ecraft-dom-job');
  if (i) i.textContent = inv;
  if (j) j.textContent = job;
}
