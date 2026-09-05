import Phaser from 'phaser';

type Pt = { x: number; y: number };

/** Closed loops along city roads — police cars drive these forever. */
const ROUTES: Pt[][] = [
  // Main Road ↔ Park Road rectangle
  [
    { x: 280, y: 760 },
    { x: 1100, y: 760 },
    { x: 1850, y: 760 },
    { x: 1940, y: 900 },
    { x: 1940, y: 1035 },
    { x: 1100, y: 1035 },
    { x: 280, y: 1035 },
    { x: 240, y: 900 },
  ],
  // Market Ave / plaza loop
  [
    { x: 1485, y: 480 },
    { x: 1485, y: 760 },
    { x: 1485, y: 1035 },
    { x: 1700, y: 1035 },
    { x: 1940, y: 1035 },
    { x: 1940, y: 760 },
    { x: 1700, y: 760 },
    { x: 1485, y: 620 },
  ],
  // HQ Drive + Main Road short patrol
  [
    { x: 240, y: 520 },
    { x: 240, y: 640 },
    { x: 240, y: 760 },
    { x: 600, y: 760 },
    { x: 900, y: 760 },
    { x: 900, y: 1035 },
    { x: 500, y: 1035 },
    { x: 240, y: 1035 },
    { x: 240, y: 860 },
  ],
];

interface PatrolCar {
  sprite: Phaser.Physics.Arcade.Sprite;
  route: Pt[];
  idx: number;
  speed: number;
  lightT: number;
}

/**
 * Living-city police cars that cruise the streets on fixed road loops.
 */
export class PatrolCarsSystem {
  private scene: Phaser.Scene;
  private cars: PatrolCar[] = [];
  private outdoor = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(): void {
    for (let i = 0; i < ROUTES.length; i++) {
      const route = ROUTES[i];
      const start = route[0];
      const sprite = this.scene.physics.add.sprite(start.x, start.y, 'police_car');
      sprite.setDepth(8).setScale(0.95);
      sprite.setImmovable(true);
      sprite.body!.enable = false; // visual traffic only — no blocking player
      const light = this.scene.add.circle(0, -18, 5, 0x2979ff, 0.9).setDepth(9);
      (sprite as unknown as { light: Phaser.GameObjects.Arc }).light = light;
      this.cars.push({
        sprite,
        route,
        idx: 1 % route.length,
        speed: 140 + i * 25,
        lightT: i * 200,
      });
    }
  }

  setOutdoorVisible(vis: boolean): void {
    this.outdoor = vis;
    for (const c of this.cars) {
      c.sprite.setVisible(vis);
      const light = (c.sprite as unknown as { light?: Phaser.GameObjects.Arc }).light;
      light?.setVisible(vis);
    }
  }

  update(delta: number): void {
    if (!this.outdoor) return;
    const dt = delta / 1000;
    for (const c of this.cars) {
      const target = c.route[c.idx];
      const dx = target.x - c.sprite.x;
      const dy = target.y - c.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 12) {
        c.idx = (c.idx + 1) % c.route.length;
        continue;
      }
      const step = Math.min(c.speed * dt, dist);
      c.sprite.x += (dx / dist) * step;
      c.sprite.y += (dy / dist) * step;
      // Face travel direction (cars are side-view-ish / top-down oval)
      if (Math.abs(dx) > Math.abs(dy)) {
        c.sprite.setFlipX(dx < 0);
        c.sprite.setAngle(0);
      } else {
        c.sprite.setFlipX(false);
        c.sprite.setAngle(dy > 0 ? 90 : -90);
      }

      // Flashing light
      c.lightT += delta;
      const light = (c.sprite as unknown as { light?: Phaser.GameObjects.Arc }).light;
      if (light) {
        light.setPosition(c.sprite.x, c.sprite.y - 16);
        const blink = Math.floor(c.lightT / 280) % 2 === 0;
        light.setFillStyle(blink ? 0x2979ff : 0xff1744, 0.95);
        light.setVisible(true);
      }
    }
  }

  count(): number {
    return this.cars.length;
  }

  /** Snapshot for tests — all cars should be near a road centerline band. */
  snapshots(): Array<{ x: number; y: number }> {
    return this.cars.map((c) => ({ x: c.sprite.x, y: c.sprite.y }));
  }
}
