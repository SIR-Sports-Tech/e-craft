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

/**
 * NON-NEGOTIABLE: Sasquatch ALWAYS leaves a trail.
 * Visuals: ground-embedded prints/scuffs — not neon UI stickers.
 */
export class TrailSystem {
  private scene: Phaser.Scene;
  private clues: TrailClue[] = [];
  private nextId = 1;
  private lastDropDist = 0;
  private readonly dropEvery = 70;
  private fallbackMarker?: Phaser.GameObjects.Container;
  private layer: Phaser.GameObjects.Container;
  private pathGfx?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
  }

  getClues(): TrailClue[] {
    return this.clues;
  }

  maybeDrop(x: number, y: number, force = false): void {
    if (!force && this.clues.length > 0) {
      const last = this.clues[this.clues.length - 1];
      const d = Phaser.Math.Distance.Between(x, y, last.x, last.y);
      if (d < this.dropEvery) return;
    }
    const kind = KINDS[this.clues.length % KINDS.length];
    // Alternate left/right foot offset for footprint realism
    const side = this.clues.length % 2 === 0 ? -8 : 8;
    this.addClue(kind, x + side, y + Phaser.Math.Between(-6, 6));
  }

  addClue(kind: TrailKind, x: number, y: number): TrailClue {
    const g = this.scene.add.container(x, y);
    const deco = this.drawGroundClue(kind);
    g.add(deco);
    // Only show tiny label when player gets close (updated externally via alpha)
    const label = this.scene.add
      .text(0, 14, TRAIL_LABELS[kind], {
        fontSize: '9px',
        color: '#efebe9',
        backgroundColor: '#00000055',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    g.add(label);
    (g as unknown as { label: Phaser.GameObjects.Text }).label = label;

    // Older prints fade into the dirt
    const age = Math.min(0.55, this.clues.length * 0.015);
    g.setAlpha(1 - age);
    g.setDepth(3);
    this.layer.add(g);

    const clue: TrailClue = {
      id: this.nextId++,
      kind,
      x,
      y,
      sprite: g,
      discovered: false,
    };
    this.clues.push(clue);
    this.redrawSoftPath();
    return clue;
  }

  private drawGroundClue(kind: TrailKind): Phaser.GameObjects.GameObject {
    const g = this.scene.add.graphics();
    if (kind === 'footprint') {
      // Bigfoot-like elongated print pressed into soil
      g.fillStyle(0x3e2723, 0.55);
      g.fillEllipse(0, 0, 18, 28);
      g.fillStyle(0x4e342e, 0.45);
      g.fillEllipse(-1, -2, 12, 18);
      // toe marks
      g.fillStyle(0x3e2723, 0.5);
      g.fillCircle(-6, -12, 3.2);
      g.fillCircle(-2, -14, 3.5);
      g.fillCircle(3, -14, 3.5);
      g.fillCircle(7, -11, 3);
    } else if (kind === 'mud') {
      g.fillStyle(0x4e342e, 0.5);
      g.fillEllipse(0, 2, 26, 14);
      g.fillCircle(-8, -2, 5);
      g.fillCircle(6, 0, 4);
      g.fillStyle(0x6d4c41, 0.25);
      g.fillEllipse(2, 3, 14, 7);
    } else if (kind === 'fur') {
      g.fillStyle(0x8d6e63, 0.55);
      g.fillCircle(0, 0, 5);
      g.lineStyle(2, 0xa1887f, 0.7);
      g.lineBetween(-6, -4, 5, 3);
      g.lineBetween(-3, 5, 6, -2);
      g.lineBetween(0, -6, 1, 6);
    } else if (kind === 'branch') {
      g.lineStyle(3, 0x5d4037, 0.85);
      g.lineBetween(-12, 4, 11, -6);
      g.lineBetween(0, -2, 8, 6);
      g.fillStyle(0x2e7d32, 0.35);
      g.fillCircle(10, -7, 3);
    } else {
      // scratch on bark/ground
      g.lineStyle(2, 0x5d4037, 0.8);
      g.lineBetween(-8, -8, -4, 8);
      g.lineBetween(-2, -9, 1, 9);
      g.lineBetween(4, -7, 7, 8);
      g.lineStyle(1, 0xd7ccc8, 0.35);
      g.lineBetween(-7, -8, -3, 8);
    }
    return g;
  }

  private redrawSoftPath(): void {
    if (!this.pathGfx) {
      this.pathGfx = this.scene.add.graphics().setDepth(2);
      this.layer.add(this.pathGfx);
    }
    this.pathGfx.clear();
    if (this.clues.length < 2) return;
    // Soft disturbed-earth ribbon under prints
    this.pathGfx.lineStyle(10, 0x5d4037, 0.12);
    this.pathGfx.beginPath();
    this.pathGfx.moveTo(this.clues[0].x, this.clues[0].y);
    for (let i = 1; i < this.clues.length; i++) {
      this.pathGfx.lineTo(this.clues[i].x, this.clues[i].y);
    }
    this.pathGfx.strokePath();
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
    if (!best && this.clues.length) return this.clues[this.clues.length - 1];
    return best;
  }

  updateFallbackHelp(playerX: number, playerY: number, robotHelps: boolean): string | null {
    const target = this.nearestUndiscovered(playerX, playerY);
    if (!target) {
      this.clearFallback();
      return null;
    }
    const dist = Phaser.Math.Distance.Between(playerX, playerY, target.x, target.y);

    // Reveal tiny labels only when close
    for (const c of this.clues) {
      const d = Phaser.Math.Distance.Between(playerX, playerY, c.x, c.y);
      const label = (c.sprite as unknown as { label?: Phaser.GameObjects.Text }).label;
      if (label) label.setAlpha(d < 70 ? 0.9 : 0);
    }

    const needsHelp = dist > 300 || robotHelps;
    if (!needsHelp) {
      this.clearFallback();
      return null;
    }

    if (!this.fallbackMarker) {
      const g = this.scene.add.container(0, 0).setDepth(50);
      const ring = this.scene.add.circle(0, 0, 14, 0xfff59d, 0.2).setStrokeStyle(2, 0xffe082, 0.7);
      const tip = this.scene.add
        .text(0, 18, 'trail', {
          fontSize: '10px',
          color: '#fff8e1',
          backgroundColor: '#00000066',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 0);
      g.add([ring, tip]);
      this.scene.add.existing(g);
      this.fallbackMarker = g;
    }

    const t = robotHelps ? 0.9 : 0.55;
    this.fallbackMarker.setPosition(
      Phaser.Math.Linear(playerX, target.x, t),
      Phaser.Math.Linear(playerY, target.y, t),
    );
    if (robotHelps) return `Robot: ${TRAIL_LABELS[target.kind]} ahead`;
    return null;
  }

  clearFallback(): void {
    this.fallbackMarker?.destroy();
    this.fallbackMarker = undefined;
  }

  markNearbyDiscovered(px: number, py: number, radius = 60): number {
    let n = 0;
    for (const c of this.clues) {
      if (c.discovered) continue;
      if (Phaser.Math.Distance.Between(px, py, c.x, c.y) <= radius) {
        c.discovered = true;
        c.sprite.setAlpha(Math.min(c.sprite.alpha, 0.45));
        n++;
      }
    }
    return n;
  }
}
