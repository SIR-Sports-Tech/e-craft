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
 * Sasquatch ALWAYS leaves a trail.
 * Clues stay dim until the player HOLDS the tracker — then they light up
 * with a bright gold path so tracking actually works.
 */
export class TrailSystem {
  private scene: Phaser.Scene;
  private clues: TrailClue[] = [];
  private nextId = 1;
  private readonly dropEvery = 55;
  private readonly MAX_CLUES = 48;
  private pathDirty = false;
  private pathRedrawCooldown = 0;
  private fallbackMarker?: Phaser.GameObjects.Container;
  private layer: Phaser.GameObjects.Container;
  private pathGfx?: Phaser.GameObjects.Graphics;
  /** True when player is holding the Sasquatch Tracker. */
  private tracking = false;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
  }

  getClues(): TrailClue[] {
    return this.clues;
  }

  isTracking(): boolean {
    return this.tracking;
  }

  /** Hold/unequip tracker — lights or dims the whole trail. */
  setTracking(active: boolean): void {
    if (this.tracking === active) return;
    this.tracking = active;
    this.refreshClueVisuals();
    this.pathDirty = true;
    this.pathRedrawCooldown = 0;
  }

  maybeDrop(x: number, y: number, force = false): void {
    if (!force && this.clues.length > 0) {
      const last = this.clues[this.clues.length - 1];
      const d = Phaser.Math.Distance.Between(x, y, last.x, last.y);
      if (d < this.dropEvery) return;
    }
    const kind = KINDS[this.clues.length % KINDS.length];
    const side = this.clues.length % 2 === 0 ? -10 : 10;
    this.addClue(kind, x + side, y + Phaser.Math.Between(-8, 8));
  }

  addClue(kind: TrailKind, x: number, y: number): TrailClue {
    const g = this.scene.add.container(x, y);
    const deco = this.drawGroundClue(kind);
    g.add(deco);
    const label = this.scene.add
      .text(0, 16, TRAIL_LABELS[kind], {
        fontSize: '11px',
        color: '#fffde7',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    g.add(label);
    (g as unknown as { label: Phaser.GameObjects.Text }).label = label;

    g.setDepth(3);
    this.layer.add(g);
    this.applyClueAlpha(g, this.clues.length);

    const clue: TrailClue = {
      id: this.nextId++,
      kind,
      x,
      y,
      sprite: g,
      discovered: false,
    };
    this.clues.push(clue);
    while (this.clues.length > this.MAX_CLUES) {
      const old = this.clues.shift();
      old?.sprite.destroy(true);
    }
    this.pathDirty = true;
    return clue;
  }

  private applyClueAlpha(sprite: Phaser.GameObjects.Container, indexHint: number): void {
    if (!this.tracking) {
      // Without tracker: almost invisible scuffs
      sprite.setAlpha(0.12);
      return;
    }
    const age = Math.min(0.35, indexHint * 0.008);
    sprite.setAlpha(1 - age);
  }

  private refreshClueVisuals(): void {
    this.clues.forEach((c, i) => {
      if (c.discovered && this.tracking) {
        c.sprite.setAlpha(0.55);
      } else {
        this.applyClueAlpha(c.sprite, i);
      }
    });
  }

  private drawGroundClue(kind: TrailKind): Phaser.GameObjects.GameObject {
    const g = this.scene.add.graphics();
    // Bright gold glow ring so prints read on phones
    g.fillStyle(0xffe082, 0.35);
    g.fillCircle(0, 0, 18);
    g.lineStyle(2, 0xfff59d, 0.8);
    g.strokeCircle(0, 0, 16);

    if (kind === 'footprint') {
      g.fillStyle(0x3e2723, 0.95);
      g.fillEllipse(0, 0, 20, 30);
      g.fillStyle(0x5d4037, 0.9);
      g.fillEllipse(-1, -2, 12, 18);
      g.fillStyle(0x212121, 0.95);
      g.fillCircle(-6, -12, 3.5);
      g.fillCircle(-2, -14, 3.8);
      g.fillCircle(3, -14, 3.8);
      g.fillCircle(7, -11, 3.2);
    } else if (kind === 'mud') {
      g.fillStyle(0x4e342e, 0.95);
      g.fillEllipse(0, 2, 28, 16);
      g.fillCircle(-8, -2, 6);
      g.fillCircle(6, 0, 5);
      g.fillStyle(0x8d6e63, 0.5);
      g.fillEllipse(2, 3, 14, 7);
    } else if (kind === 'fur') {
      g.fillStyle(0xd7ccc8, 0.95);
      g.fillCircle(0, 0, 7);
      g.lineStyle(3, 0xa1887f, 1);
      g.lineBetween(-7, -5, 6, 4);
      g.lineBetween(-4, 6, 7, -3);
      g.lineBetween(0, -7, 1, 7);
    } else if (kind === 'branch') {
      g.lineStyle(4, 0x6d4c41, 1);
      g.lineBetween(-14, 5, 13, -7);
      g.lineBetween(0, -2, 9, 7);
      g.fillStyle(0x66bb6a, 0.85);
      g.fillCircle(12, -8, 4);
    } else {
      g.lineStyle(3, 0xbf360c, 1);
      g.lineBetween(-9, -9, -4, 9);
      g.lineBetween(-2, -10, 2, 10);
      g.lineBetween(5, -8, 8, 9);
      g.lineStyle(2, 0xffccbc, 0.7);
      g.lineBetween(-8, -9, -3, 9);
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

    if (this.tracking) {
      // Bright gold ribbon — this is what makes the track "work"
      this.pathGfx.lineStyle(14, 0xffeb3b, 0.35);
      this.pathGfx.beginPath();
      this.pathGfx.moveTo(this.clues[0].x, this.clues[0].y);
      for (let i = 1; i < this.clues.length; i++) {
        this.pathGfx.lineTo(this.clues[i].x, this.clues[i].y);
      }
      this.pathGfx.strokePath();
      this.pathGfx.lineStyle(4, 0xfff176, 0.85);
      this.pathGfx.beginPath();
      this.pathGfx.moveTo(this.clues[0].x, this.clues[0].y);
      for (let i = 1; i < this.clues.length; i++) {
        this.pathGfx.lineTo(this.clues[i].x, this.clues[i].y);
      }
      this.pathGfx.strokePath();
    } else {
      this.pathGfx.lineStyle(8, 0x5d4037, 0.08);
      this.pathGfx.beginPath();
      this.pathGfx.moveTo(this.clues[0].x, this.clues[0].y);
      for (let i = 1; i < this.clues.length; i++) {
        this.pathGfx.lineTo(this.clues[i].x, this.clues[i].y);
      }
      this.pathGfx.strokePath();
    }
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

  /** Newest clue = trail head (closest to living Sasquatch). */
  latestClue(): TrailClue | null {
    return this.clues.length ? this.clues[this.clues.length - 1] : null;
  }

  updateFallbackHelp(playerX: number, playerY: number, robotHelps: boolean): string | null {
    if (!this.tracking) {
      this.clearFallback();
      return null;
    }
    const target = this.nearestUndiscovered(playerX, playerY);
    if (!target) {
      this.clearFallback();
      return null;
    }
    const dist = Phaser.Math.Distance.Between(playerX, playerY, target.x, target.y);

    // Labels visible farther when holding tracker
    const labelRange = 180;
    for (const c of this.clues) {
      const label = (c.sprite as unknown as { label?: Phaser.GameObjects.Text }).label;
      if (!label) continue;
      const dx = playerX - c.x;
      const dy = playerY - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > labelRange * labelRange) {
        if (label.alpha > 0) label.setAlpha(0);
        continue;
      }
      const d = Math.hypot(dx, dy);
      label.setAlpha(d < 110 ? 1 : 0.55);
    }

    if (!this.fallbackMarker) {
      const g = this.scene.add.container(0, 0).setDepth(50);
      const ring = this.scene.add.circle(0, 0, 16, 0xfff59d, 0.25).setStrokeStyle(3, 0xffeb3b, 1);
      const tip = this.scene.add
        .text(0, 20, 'TRACK →', {
          fontSize: '12px',
          color: '#fffde7',
          backgroundColor: '#000000cc',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 0);
      g.add([ring, tip]);
      this.scene.add.existing(g);
      this.fallbackMarker = g;
    }

    // Always show trail pointer when holding tracker
    const t = robotHelps || dist > 220 ? 0.75 : 0.45;
    this.fallbackMarker.setPosition(
      Phaser.Math.Linear(playerX, target.x, t),
      Phaser.Math.Linear(playerY, target.y, t),
    );
    this.fallbackMarker.setVisible(true);

    if (robotHelps) return `Robot: ${TRAIL_LABELS[target.kind]} ahead (${Math.round(dist)}m)`;
    return `Tracker: ${TRAIL_LABELS[target.kind]} — ${Math.round(dist)}m`;
  }

  clearFallback(): void {
    this.fallbackMarker?.destroy();
    this.fallbackMarker = undefined;
  }

  updateThrottle(delta: number): void {
    this.pathRedrawCooldown -= delta;
    if (this.pathDirty && this.pathRedrawCooldown <= 0) {
      this.redrawSoftPath();
      this.pathDirty = false;
      this.pathRedrawCooldown = this.tracking ? 200 : 400;
    }
  }

  emergencyTrim(): void {
    while (this.clues.length > 24) {
      const old = this.clues.shift();
      old?.sprite.destroy(true);
    }
    this.pathGfx?.clear();
    this.pathDirty = true;
    this.clearFallback();
  }

  markNearbyDiscovered(px: number, py: number, radius = 70): number {
    let n = 0;
    for (const c of this.clues) {
      if (c.discovered) continue;
      if (Phaser.Math.Distance.Between(px, py, c.x, c.y) <= radius) {
        c.discovered = true;
        if (this.tracking) c.sprite.setAlpha(0.5);
        n++;
      }
    }
    return n;
  }
}
