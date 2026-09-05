import type { GameFlags, MissionPhase } from '../data/MissionState';

const KEY = 'ecraft_save_v02';

export interface SaveBlob {
  version: 2;
  phase: MissionPhase;
  flags: GameFlags;
  player: { x: number; y: number };
  builds: Array<{ id: string; progress: number; done: boolean }>;
  savedAt: string;
}

export function saveGame(blob: Omit<SaveBlob, 'version' | 'savedAt'>): void {
  const full: SaveBlob = { ...blob, version: 2, savedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(full));
}

export function loadGame(): SaveBlob | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveBlob;
    if (data.version !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}

export function hasSave(): boolean {
  return !!localStorage.getItem(KEY);
}
