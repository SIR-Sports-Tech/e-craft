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
  lightRed: Phaser.GameObjects.Arc;
  lightBlue: Phaser.GameObjects.Arc;
  lightGlow: Phaser.GameObjects.Arc;
  /** Stuck against a building — skip to next road point */
  stuckT: number;
  lastX: number;
  lastY: number;
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
      sprite.setDepth(8).setScale(0.92);
      // MUST be movable vs static walls — immovable+static skips separation (ghosting)
      sprite.setImmovable(false);
      sprite.body!.enable = true;
      // Cybertruck footprint (texture 128×72)
      sprite.body!.setSize(88, 40).setOffset(18, 22);
      sprite.body!.setBounce(0, 0);
      sprite.body!.setDrag(0, 0);
      // Dual roof lightbar + soft glow (Cybertruck police)
      const lightGlow = this.scene.add.circle(0, -22, 14, 0xffffff, 0.18).setDepth(8);
      const lightRed = this.scene.add.circle(0, -22, 6, 0xff1744, 0.95).setDepth(9);
      const lightBlue = this.scene.add.circle(0, -22, 6, 0x2979ff, 0.95).setDepth(9);
      this.cars.push({
        sprite,
        route,
        idx: 1 % route.length,
        speed: 140 + i * 25,
        lightT: i * 200,
        lightRed,
        lightBlue,
        lightGlow,
        stuckT: 0,
        lastX: start.x,
        lastY: start.y,
      });
    }
  }

  setOutdoorVisible(vis: boolean): void {
    this.outdoor = vis;
    for (const c of this.cars) {
      c.sprite.setVisible(vis);
      c.lightRed.setVisible(vis);
      c.lightBlue.setVisible(vis);
      c.lightGlow.setVisible(vis);
    }
  }

  getSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.cars.map((c) => c.sprite);
  }

  update(delta: number): void {
    if (!this.outdoor) return;
    for (const c of this.cars) {
      if ((c as PatrolCar & { claimed?: boolean }).claimed) {
        c.sprite.setVelocity(0, 0);
        continue;
      }
      // If pressed into a building wall and barely moving, skip waypoint (stay on roads)
      const moved = Math.hypot(c.sprite.x - c.lastX, c.sprite.y - c.lastY);
      if (moved < 2.5) c.stuckT += delta;
      else c.stuckT = 0;
      c.lastX = c.sprite.x;
      c.lastY = c.sprite.y;
      if (c.stuckT > 900) {
        c.stuckT = 0;
        c.idx = (c.idx + 1) % c.route.length;
        c.sprite.setVelocity(0, 0);
        continue;
      }

      const target = c.route[c.idx];
      const dx = target.x - c.sprite.x;
      const dy = target.y - c.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 12) {
        c.idx = (c.idx + 1) % c.route.length;
        continue;
      }
      // Velocity so Arcade colliders stop cars at building walls (no ghost-through)
      c.sprite.setVelocity((dx / dist) * c.speed, (dy / dist) * c.speed);
      // Face travel direction (cars are side-view-ish / top-down oval)
      if (Math.abs(dx) > Math.abs(dy)) {
        c.sprite.setFlipX(dx < 0);
        c.sprite.setAngle(0);
      } else {
        c.sprite.setFlipX(false);
        c.sprite.setAngle(dy > 0 ? 90 : -90);
      }

      // Flashing Cybertruck roof lightbar (alternating red / blue)
      c.lightT += delta;
      const blink = Math.floor(c.lightT / 220) % 2 === 0;
      const ang = Phaser.Math.DegToRad(c.sprite.angle);
      const roofOx = Math.sin(ang) * -2;
      const roofOy = -22;
      const sideX = Math.cos(ang) * 8;
      const sideY = Math.sin(ang) * 8;
      c.lightGlow.setPosition(c.sprite.x + roofOx, c.sprite.y + roofOy);
      c.lightGlow.setFillStyle(blink ? 0xff1744 : 0x2979ff, 0.22);
      c.lightRed.setPosition(c.sprite.x + roofOx - sideX, c.sprite.y + roofOy - sideY);
      c.lightBlue.setPosition(c.sprite.x + roofOx + sideX, c.sprite.y + roofOy + sideY);
      c.lightRed.setAlpha(blink ? 1 : 0.25);
      c.lightBlue.setAlpha(blink ? 0.25 : 1);
      c.lightRed.setVisible(true);
      c.lightBlue.setVisible(true);
      c.lightGlow.setVisible(true);
    }
  }

  count(): number {
    return this.cars.length;
  }

  /** Snapshot for tests — all cars should be near a road centerline band. */
  snapshots(): Array<{ x: number; y: number }> {
    return this.cars.map((c) => ({ x: c.sprite.x, y: c.sprite.y }));
  }

  /**
   * If player is too close to a moving patrol car, return that car's position
   * so the game can flatten them.
   */
  checkRunOver(
    playerX: number,
    playerY: number,
    hitRadius = 42,
  ): { x: number; y: number; carX: number; carY: number } | null {
    if (!this.outdoor) return null;
    for (const c of this.cars) {
      if (!c.sprite.visible) continue;
      if ((c as PatrolCar & { claimed?: boolean }).claimed) continue;
      const d = Phaser.Math.Distance.Between(playerX, playerY, c.sprite.x, c.sprite.y);
      if (d <= hitRadius) {
        return { x: playerX, y: playerY, carX: c.sprite.x, carY: c.sprite.y };
      }
    }
    return null;
  }

  /** Nearest visible unclaimed patrol cruiser within range (for hopping in). */
  nearestCar(
    playerX: number,
    playerY: number,
    range = 90,
  ): { index: number; x: number; y: number } | null {
    if (!this.outdoor) return null;
    let bestIndex = -1;
    let bestX = 0;
    let bestY = 0;
    let bestD = Infinity;
    for (let index = 0; index < this.cars.length; index++) {
      const c = this.cars[index];
      if (!c.sprite.visible) continue;
      if ((c as PatrolCar & { claimed?: boolean }).claimed) continue;
      const d = Phaser.Math.Distance.Between(playerX, playerY, c.sprite.x, c.sprite.y);
      if (d <= range && d < bestD) {
        bestD = d;
        bestIndex = index;
        bestX = c.sprite.x;
        bestY = c.sprite.y;
      }
    }
    return bestIndex >= 0 ? { index: bestIndex, x: bestX, y: bestY } : null;
  }

  claimCar(index: number): void {
    const c = this.cars[index];
    if (!c) return;
    (c as PatrolCar & { claimed?: boolean }).claimed = true;
    c.sprite.setVisible(false);
    c.sprite.setVelocity(0, 0);
    c.lightRed.setVisible(false);
    c.lightBlue.setVisible(false);
    c.lightGlow.setVisible(false);
  }

  releaseCar(index: number, x: number, y: number): void {
    const c = this.cars[index];
    if (!c) return;
    (c as PatrolCar & { claimed?: boolean }).claimed = false;
    c.sprite.setPosition(x, y);
    c.sprite.setVisible(this.outdoor);
    c.lightRed.setVisible(this.outdoor);
    c.lightBlue.setVisible(this.outdoor);
    c.lightGlow.setVisible(this.outdoor);
  }
}
