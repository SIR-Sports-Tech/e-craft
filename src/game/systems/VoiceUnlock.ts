/**
 * Phone / iPad voice unlock helpers.
 * iOS Safari only allows SpeechSynthesis when kicked off from a user gesture,
 * and often needs an unlock + immediate speak (no setTimeout).
 */

let unlocked = false;

export function isVoiceUnlocked(): boolean {
  return unlocked;
}

/** Call synchronously from pointerdown / click. */
export function unlockVoices(): void {
  unlocked = true;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      void ctx.resume();
      // Tiny silent buffer to unlock WebAudio
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch {
    /* ignore */
  }
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0.01;
    warm.rate = 2;
    synth.speak(warm);
    synth.cancel();
    void synth.getVoices();
  } catch {
    /* ignore */
  }
}

/**
 * Speak text NOW (must be called from tap when possible).
 * Retries briefly for async voice lists / Chrome pause bugs.
 */
export function speakNow(
  text: string,
  opts?: {
    pitch?: number;
    rate?: number;
    voiceURI?: string | null;
    prefer?: 'low' | 'mid' | 'high';
    onend?: () => void;
  },
): boolean {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
  const clean = String(text || '').trim();
  if (!clean) return false;

  try {
    synth.cancel();
  } catch {
    /* ignore */
  }

  const speakOnce = (): boolean => {
    const u = new SpeechSynthesisUtterance(clean);
    u.pitch = opts?.pitch ?? 1;
    u.rate = opts?.rate ?? 1;
    u.volume = 1;
    const voices = synth.getVoices() || [];
    let voice: SpeechSynthesisVoice | undefined;
    if (opts?.voiceURI) voice = voices.find((v) => v.voiceURI === opts.voiceURI);
    if (!voice && opts?.prefer) {
      const prefer = opts.prefer;
      const en = voices.filter((v) => /en/i.test(v.lang));
      const pool = en.length ? en : voices;
      voice = [...pool].sort((a, b) => {
        const score = (n: string) => {
          let s = 0;
          if (prefer === 'low' && /male|daniel|alex|david|fred/i.test(n)) s += 3;
          if (prefer === 'high' && /female|samantha|karen|victoria|siri/i.test(n)) s += 3;
          if (/google|microsoft|enhanced|natural/i.test(n)) s += 1;
          return s;
        };
        return score(b.name) - score(a.name);
      })[0];
    }
    if (!voice && voices.length) voice = voices[0];
    if (voice) u.voice = voice;
    if (opts?.onend) u.onend = () => opts.onend?.();
    try {
      synth.speak(u);
      // Chrome bug: resume if it gets stuck paused
      window.setTimeout(() => {
        try {
          if (synth.paused) synth.resume();
        } catch {
          /* ignore */
        }
      }, 250);
      return true;
    } catch {
      return false;
    }
  };

  const ok = speakOnce();
  // Voices sometimes empty on first tap — retry once when list loads
  if (!synth.getVoices()?.length) {
    const prev = synth.onvoiceschanged;
    synth.onvoiceschanged = () => {
      speakOnce();
      synth.onvoiceschanged = prev;
    };
  }
  return ok;
}
