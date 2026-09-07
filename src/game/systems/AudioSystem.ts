/** Tiny original WebAudio SFX + real spoken voices (SpeechSynthesis). */

import { speakNow, unlockVoices } from './VoiceUnlock';

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

  /** Unlock speakers from a tap (iOS). */
  unlock(): void {
    unlockVoices();
    this.ensure();
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
    void this.voicesReady;
    this.ensure();
    unlockVoices();
    let voiceURI: string | null = null;
    try {
      const uri = localStorage.getItem('ecraft_free_voice_uri');
      const on = localStorage.getItem('ecraft_free_voice_on') === '1';
      if (on && uri) voiceURI = uri;
    } catch {
      /* ignore */
    }
    return speakNow(text, {
      pitch: opts?.pitch,
      rate: opts?.rate,
      prefer: opts?.prefer ?? 'mid',
      voiceURI,
      onend: opts?.onend,
    });
  }
}

export const audio = new AudioSystem();
