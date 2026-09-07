/**
 * Free AI Voice — device Speech Synthesis + Speech Recognition (no paid voice API).
 * Optional Grok chat when /e-craft/api is online; otherwise free local persona replies.
 */

import { getContact } from './PhoneCallSystem';

const VOICE_KEY = 'ecraft_free_voice_uri';
const CONNECTED_KEY = 'ecraft_free_voice_on';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

type RecogCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function apiBase(): string {
  if (typeof window === 'undefined') return '/e-craft/api';
  const { origin, pathname } = window.location;
  if (pathname.startsWith('/e-craft')) return `${origin}/e-craft/api`;
  return `${origin}/api`;
}

export class FreeVoiceSystem {
  connected = false;
  voiceURI: string | null = null;
  listening = false;
  private recog: InstanceType<RecogCtor> | null = null;
  private histories = new Map<string, ChatTurn[]>();

  constructor() {
    try {
      this.voiceURI = localStorage.getItem(VOICE_KEY);
      this.connected = localStorage.getItem(CONNECTED_KEY) === '1';
    } catch {
      /* ignore */
    }
  }

  isSpeechAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  }

  isMicAvailable(): boolean {
    const w = window as unknown as { SpeechRecognition?: RecogCtor; webkitSpeechRecognition?: RecogCtor };
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  listVoices(): SpeechSynthesisVoice[] {
    const all = window.speechSynthesis?.getVoices?.() || [];
    const en = all.filter((v) => /en/i.test(v.lang) || /english/i.test(v.name));
    return (en.length ? en : all).slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  connect(voiceURI?: string): { ok: boolean; msg: string; voiceName?: string } {
    if (!this.isSpeechAvailable()) {
      return { ok: false, msg: 'This device has no free speech voices.' };
    }
    const voices = this.listVoices();
    if (!voices.length) {
      window.speechSynthesis.getVoices();
      return { ok: false, msg: 'Loading free voices… tap Connect again in a second.' };
    }
    const pick =
      (voiceURI && voices.find((v) => v.voiceURI === voiceURI)) ||
      (this.voiceURI && voices.find((v) => v.voiceURI === this.voiceURI)) ||
      voices.find((v) => /samantha|google|microsoft|enhanced|natural/i.test(v.name)) ||
      voices[0];
    this.voiceURI = pick.voiceURI;
    this.connected = true;
    try {
      localStorage.setItem(VOICE_KEY, this.voiceURI);
      localStorage.setItem(CONNECTED_KEY, '1');
    } catch {
      /* ignore */
    }
    return { ok: true, msg: `Connected free AI voice: ${pick.name}`, voiceName: pick.name };
  }

  disconnect(): void {
    this.connected = false;
    this.stopListening();
    try {
      localStorage.setItem(CONNECTED_KEY, '0');
    } catch {
      /* ignore */
    }
  }

  statusLine(): string {
    if (!this.isSpeechAvailable()) return 'Free AI Voice: not supported on this browser.';
    if (!this.connected) return 'Free AI Voice: OFF — tap Connect Free AI Voice.';
    const v = this.listVoices().find((x) => x.voiceURI === this.voiceURI);
    return `Free AI Voice: ON · ${v?.name || 'default'} · mic ${this.isMicAvailable() ? 'ready' : 'type instead'}`;
  }

  speak(text: string, opts?: { pitch?: number; rate?: number; onend?: () => void; prefer?: string }): boolean {
    if (!this.connected && !this.connect().ok) return false;
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = opts?.pitch ?? 1;
    u.rate = opts?.rate ?? 1;
    u.volume = 1;
    const voice =
      this.listVoices().find((v) => v.voiceURI === this.voiceURI) || this.listVoices()[0];
    if (voice) u.voice = voice;
    if (opts?.onend) u.onend = () => opts.onend?.();
    synth.speak(u);
    return true;
  }

  stopSpeaking(): void {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }

  listenOnce(timeoutMs = 8000): Promise<string | null> {
    return new Promise((resolve) => {
      const w = window as unknown as { SpeechRecognition?: RecogCtor; webkitSpeechRecognition?: RecogCtor };
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SR) {
        resolve(null);
        return;
      }
      this.stopListening();
      const r = new SR();
      this.recog = r;
      this.listening = true;
      r.lang = 'en-US';
      r.interimResults = false;
      r.maxAlternatives = 1;
      let done = false;
      const finish = (text: string | null) => {
        if (done) return;
        done = true;
        this.listening = false;
        try {
          r.stop();
        } catch {
          /* ignore */
        }
        resolve(text);
      };
      r.onresult = (ev) => {
        const t = ev.results?.[0]?.[0]?.transcript?.trim() || '';
        finish(t || null);
      };
      r.onerror = () => finish(null);
      r.onend = () => finish(null);
      try {
        r.start();
      } catch {
        finish(null);
        return;
      }
      window.setTimeout(() => finish(null), timeoutMs);
    });
  }

  stopListening(): void {
    this.listening = false;
    try {
      this.recog?.stop();
    } catch {
      /* ignore */
    }
    this.recog = null;
  }

  history(contactId: string): ChatTurn[] {
    return this.histories.get(contactId) || [];
  }

  clearHistory(contactId: string): void {
    this.histories.delete(contactId);
  }

  async chat(
    contactId: string,
    userText: string,
  ): Promise<{ reply: string; source: string }> {
    const hist = this.history(contactId);
    hist.push({ role: 'user', content: userText });
    let reply = '';
    let source = 'local';
    try {
      const r = await fetch(`${apiBase()}/phone/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, message: userText, history: hist.slice(0, -1) }),
      });
      if (r.ok) {
        const data = (await r.json()) as { reply?: string; source?: string };
        // Only use live Grok text; API fallbacks → free local persona (still spoken)
        if (data.reply && (data.source === 'xai' || data.source === undefined)) {
          reply = data.reply;
          source = data.source || 'xai';
        }
      }
    } catch {
      /* offline */
    }
    if (!reply) {
      reply = this.localReply(contactId, userText);
      source = 'free-local';
    }
    hist.push({ role: 'assistant', content: reply });
    this.histories.set(contactId, hist.slice(-12));
    const contact = getContact(contactId);
    this.speak(reply, { pitch: contact?.pitch ?? 1, rate: contact?.rate ?? 1 });
    return { reply, source };
  }

  private localReply(contactId: string, userText: string): string {
    const t = userText.toLowerCase();
    const contact = getContact(contactId);
    const name = contact?.label.replace(/^Call /, '') || 'Friend';
    if (/hello|hi |hey|howdy/.test(t))
      return `Hey! This is ${name}. I hear you on the free AI voice line.`;
    if (/tiger|panther|zoo|whip/.test(t)) {
      if (contactId === 'zookeeper')
        return 'Keep the whip handy near the jungle — scare the cats gently, then they run home!';
      return `${name} here. Watch the jungle edge — tigers love to chase toward the city!`;
    }
    if (/gold|bank|money|vault/.test(t)) {
      if (contactId === 'bank') return 'The vault is full of gold piles — no safe. Scoop them into your backpack!';
      return `${name}: The City Gold Bank is stuffed with piles. Go pick some up!`;
    }
    if (/sasquatch|bigfoot|forest|capture/.test(t)) {
      if (contactId === 'sasquatch' || contactId === 'bigfoot')
        return 'I am in the trees. Bring snacks if you want to find me…';
      return `${name}: Follow the gold trail with the Tracker into the forest.`;
    }
    if (/help|lost|where/.test(t))
      return `${name}: Try the map, cars, BUILD mode, or visit buildings for loot and computers.`;
    if (/thank|bye|goodbye/.test(t))
      return `Anytime! ${name} signing off. Call again on Free AI Voice.`;
    return `${name}: Got it — "${userText.slice(0, 80)}". Ask me about tigers, gold, the forest, or cars!`;
  }
}

export const freeVoice = new FreeVoiceSystem();
