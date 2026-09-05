/** Tiny original WebAudio SFX — no external music packs. */

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private muted = false;

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
}

export const audio = new AudioSystem();
