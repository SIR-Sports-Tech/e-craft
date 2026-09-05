import Phaser from 'phaser';

export interface BuildOrder {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  progress: number; // 0..1
  done: boolean;
  requestedBy: string;
}

/**
 * Seed of the long-term "world remembers what you ask for" feature.
 * v0.1: talking to Builder Jun queues a Robot Garage that builds over time.
 */
export class ConstructionSystem {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private orders: BuildOrder[] = [];
  private visuals = new Map<string, Phaser.GameObjects.Container>();

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
  }

  getOrders(): BuildOrder[] {
    return this.orders;
  }

  requestHqWing(pos: { x: number; y: number }): BuildOrder {
    const existing = this.orders.find((o) => o.id === 'hq_wing');
    if (existing) return existing;
    const order: BuildOrder = {
      id: 'hq_wing',
      label: 'Security HQ Wing',
      x: pos.x,
      y: pos.y,
      w: 160,
      h: 100,
      progress: 0,
      done: false,
      requestedBy: 'player',
    };
    this.orders.push(order);
    this.ensureVisual(order);
    return order;
  }

  requestRobotGarage(behindHQ: { x: number; y: number }): BuildOrder {
    const existing = this.orders.find((o) => o.id === 'robot_garage');
    if (existing) return existing;
    const order: BuildOrder = {
      id: 'robot_garage',
      label: 'Robot Garage',
      x: behindHQ.x,
      y: behindHQ.y,
      w: 140,
      h: 90,
      progress: 0,
      done: false,
      requestedBy: 'player',
    };
    this.orders.push(order);
    this.ensureVisual(order);
    return order;
  }

  update(delta: number): void {
    for (const o of this.orders) {
      if (o.done) continue;
      o.progress = Math.min(1, o.progress + delta / 18000); // ~18s to finish
      this.ensureVisual(o);
      if (o.progress >= 1) {
        o.done = true;
        this.ensureVisual(o);
      }
    }
  }

  private ensureVisual(o: BuildOrder): void {
    let g = this.visuals.get(o.id);
    if (!g) {
      g = this.scene.add.container(o.x, o.y);
      const pad = this.scene.add.rectangle(0, 0, o.w, o.h, 0x455a64, 0.35).setStrokeStyle(2, 0x90a4ae);
      const fill = this.scene.add.rectangle(0, 0, o.w * 0.1, o.h, 0x66bb6a, 0.85);
      const label = this.scene.add
        .text(0, -o.h / 2 - 12, '', {
          fontSize: '11px',
          color: '#e8f5e9',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 1);
      g.add([pad, fill, label]);
      this.layer.add(g);
      this.visuals.set(o.id, g);
      (g as unknown as { fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }).fill = fill;
      (g as unknown as { fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }).label = label;
    }
    const parts = g as unknown as { fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
    parts.fill.width = Math.max(8, o.w * o.progress);
    parts.fill.setFillStyle(o.done ? 0x43a047 : 0x66bb6a, 0.9);
    parts.label.setText(
      o.done ? `${o.label} COMPLETE` : `${o.label} ${Math.floor(o.progress * 100)}%`,
    );
  }
}
