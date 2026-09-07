/** Tiny original WebAudio SFX + real spoken voices (SpeechSynthesis). */

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private muted = false;
  private voicesReady = false;

  constructor() {
    // iPad/Chrome load voices async
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const warm = () => {
        void window.speechSynthesis.getVoices();
        this.voicesReady = true;
      };
      warm();
      window.speechSynthesis.onvoiceschanged = warm;
    }
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.stopSpeaking();
  }

  beep(freq: number, dur = 0.08, type: OscillatorType = 'square', gain = 0.04): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur);
  }

  /** Classic phone ring before someone answers. */
  dialTone(): void {
    this.beep(440, 0.18, 'sine', 0.05);
    setTimeout(() => this.beep(480, 0.18, 'sine', 0.05), 220);
    setTimeout(() => this.beep(440, 0.18, 'sine', 0.045), 480);
  }

  interact(): void {
    this.beep(520, 0.07, 'triangle', 0.05);
  }
  pickup(): void {
    this.beep(740, 0.09, 'sine', 0.05);
    setTimeout(() => this.beep(980, 0.1, 'sine', 0.04), 70);
  }
  capture(): void {
    this.beep(220, 0.12, 'sawtooth', 0.035);
    setTimeout(() => this.beep(440, 0.15, 'square', 0.04), 100);
  }
  success(): void {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.12, 'sine', 0.05), i * 90));
  }
  drive(): void {
    this.beep(90, 0.05, 'sawtooth', 0.015);
  }
  talk(): void {
    this.beep(360, 0.06, 'triangle', 0.035);
  }

  stopSpeaking(): void {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }

  /**
   * Speak real words through the device/iPad speaker (Web Speech API).
   * Must be called from a user tap for iOS.
   */
  speak(
    text: string,
    opts?: { pitch?: number; rate?: number; prefer?: 'low' | 'mid' | 'high'; onend?: () => void },
  ): boolean {
    if (this.muted) return false;
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
    this.stopSpeaking();
    void this.voicesReady;
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = opts?.pitch ?? 1;
    u.rate = opts?.rate ?? 1;
    u.volume = 1;
    // Prefer user-connected Free AI Voice if set
    let voice: SpeechSynthesisVoice | null = null;
    try {
      const uri = localStorage.getItem('ecraft_free_voice_uri');
      const on = localStorage.getItem('ecraft_free_voice_on') === '1';
      if (on && uri) voice = synth.getVoices().find((v) => v.voiceURI === uri) || null;
    } catch {
      /* ignore */
    }
    if (!voice) voice = this.pickVoice(opts?.prefer ?? 'mid');
    if (voice) u.voice = voice;
    if (opts?.onend) u.onend = () => opts.onend?.();
    // Resume AudioContext so SFX + speech share unlocked gesture on iPad
    this.ensure();
    try {
      synth.speak(u);
      return true;
    } catch {
      return false;
    }
  }

  private pickVoice(prefer: 'low' | 'mid' | 'high'): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (!voices.length) return null;
    const en = voices.filter((v) => /en(-|_|$)/i.test(v.lang) || /english/i.test(v.name));
    const pool = en.length ? en : voices;
    const score = (v: SpeechSynthesisVoice): number => {
      const n = v.name.toLowerCase();
      let s = 0;
      if (prefer === 'low' && /(male|daniel|alex|fred|david|bruce|tom|aaron)/i.test(n)) s += 3;
      if (prefer === 'high' && /(female|samantha|karen|moira|victoria|zira|siri|fiona)/i.test(n)) s += 3;
      if (prefer === 'mid' && /(samantha|google|microsoft|natural)/i.test(n)) s += 2;
      if (/google|microsoft|premium|enhanced/i.test(n)) s += 1;
      return s;
    };
    return [...pool].sort((a, b) => score(b) - score(a))[0] || pool[0];
  }
}

export const audio = new AudioSystem();
