import Phaser from 'phaser';
import { TRAIL_LABELS, type TrailKind } from '../data/MissionState';

export interface TrailClue {
  id: number;
  kind: TrailKind;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Container;
  discovered: boolean;
}

const KINDS: TrailKind[] = ['footprint', 'branch', 'fur', 'mud', 'scratch'];
const COLORS: Record<TrailKind, number> = {
  footprint: 0x8b5a2b,
  branch: 0x6b4423,
  fur: 0xc4a484,
  mud: 0x4a3728,
  scratch: 0xaa3333,
};

/**
 * NON-NEGOTIABLE: Sasquatch ALWAYS leaves a trail.
 * Player must never permanently lose the trail — robot / fallback marker help.
 */
export class TrailSystem {
  private scene: Phaser.Scene;
  private clues: TrailClue[] = [];
  private nextId = 1;
  private lastDropDist = 0;
  private readonly dropEvery = 90;
  private fallbackMarker?: Phaser.GameObjects.Container;
  private layer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
  }

  getClues(): TrailClue[] {
    return this.clues;
  }

  /** Drop a clue at Sasquatch position if far enough from last. */
  maybeDrop(x: number, y: number, force = false): void {
    if (!force && this.clues.length > 0) {
      const last = this.clues[this.clues.length - 1];
      const d = Phaser.Math.Distance.Between(x, y, last.x, last.y);
      this.lastDropDist += d;
      if (this.lastDropDist < this.dropEvery) return;
      this.lastDropDist = 0;
    }
    const kind = KINDS[this.clues.length % KINDS.length];
    this.addClue(kind, x, y);
  }

  addClue(kind: TrailKind, x: number, y: number): TrailClue {
    const jitterX = x + Phaser.Math.Between(-18, 18);
    const jitterY = y + Phaser.Math.Between(-18, 18);
    const g = this.scene.add.container(jitterX, jitterY);
    const iconKey = `trail_${kind}` as const;
    const blob = this.scene.textures.exists(iconKey)
      ? this.scene.add.image(0, 0, iconKey).setScale(1.4)
      : this.scene.add.circle(0, 0, 10, COLORS[kind], 0.95);
    const glow = this.scene.add.circle(0, 0, 16, COLORS[kind], 0.2);
    const label = this.scene.add
      .text(0, 18, TRAIL_LABELS[kind], {
        fontSize: '11px',
        color: '#fffde7',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0);
    g.add([glow, blob, label]);
    this.layer.add(g);

    const clue: TrailClue = {
      id: this.nextId++,
      kind,
      x: jitterX,
      y: jitterY,
      sprite: g,
      discovered: false,
    };
    this.clues.push(clue);
    return clue;
  }

  nearestUndiscovered(px: number, py: number): TrailClue | null {
    let best: TrailClue | null = null;
    let bestD = Infinity;
    for (const c of this.clues) {
      if (c.discovered) continue;
      const d = Phaser.Math.Distance.Between(px, py, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    // If all discovered, point at newest
    if (!best && this.clues.length) {
      return this.clues[this.clues.length - 1];
    }
    return best;
  }

  /** Never permanently lose the trail — show fallback arrow to nearest clue. */
  updateFallbackHelp(playerX: number, playerY: number, robotHelps: boolean): string | null {
    const target = this.nearestUndiscovered(playerX, playerY);
    if (!target) {
      this.clearFallback();
      return null;
    }
    const dist = Phaser.Math.Distance.Between(playerX, playerY, target.x, target.y);
    const needsHelp = dist > 280 || robotHelps;

    if (!needsHelp) {
      this.clearFallback();
      return null;
    }

    if (!this.fallbackMarker) {
      const g = this.scene.add.container(0, 0);
      const ring = this.scene.add.circle(0, 0, 16, 0xffcc00, 0.35);
      const arrow = this.scene.add.triangle(0, 0, 0, -18, 12, 10, -12, 10, 0xffdd44);
      const tip = this.scene.add
        .text(0, 22, 'TRACKING', {
          fontSize: '11px',
          color: '#fff',
          backgroundColor: '#000000aa',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0);
      g.add([ring, arrow, tip]);
      g.setDepth(50);
      this.scene.add.existing(g);
      this.fallbackMarker = g;
    }

    // Place marker between player and clue (or on clue if robot reveal)
    const t = robotHelps ? 1 : 0.55;
    const mx = Phaser.Math.Linear(playerX, target.x, t);
    const my = Phaser.Math.Linear(playerY, target.y, t);
    this.fallbackMarker.setPosition(mx, my);
    const angle = Phaser.Math.Angle.Between(playerX, playerY, target.x, target.y);
    this.fallbackMarker.setRotation(angle + Math.PI / 2);

    if (robotHelps) {
      return `Robot: nearest clue is ${TRAIL_LABELS[target.kind]} ahead!`;
    }
    return `Tracking marker → ${TRAIL_LABELS[target.kind]}`;
  }

  clearFallback(): void {
    this.fallbackMarker?.destroy();
    this.fallbackMarker = undefined;
  }

  markNearbyDiscovered(px: number, py: number, radius = 55): number {
    let n = 0;
    for (const c of this.clues) {
      if (c.discovered) continue;
      if (Phaser.Math.Distance.Between(px, py, c.x, c.y) <= radius) {
        c.discovered = true;
        c.sprite.setAlpha(0.55);
        n++;
      }
    }
    return n;
  }
}
