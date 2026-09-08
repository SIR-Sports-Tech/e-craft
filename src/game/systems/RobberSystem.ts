import Phaser from 'phaser';
import { CITY_ZONES } from '../world/WorldLayout';

interface Robber {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  blood?: Phaser.GameObjects.Image;
  wx: number;
  wy: number;
  tx: number;
  ty: number;
  speed: number;
  scareCd: number;
  /** Flattened by police car */
  squished: boolean;
  respawnAt: number;
}

export type RobberUpdateOpts = {
  inPoliceCar: boolean;
  playerSpeed: number;
};

/**
 * Eastport street robbers — flee police cars, get squished on hit (blood pool).
 */
export class RobberSystem {
  private scene: Phaser.Scene;
  private pack: Robber[] = [];
  private outdoor = true;
  private readonly cityIds = [
    'east_plaza',
    'east_tower',
    'east_mall',
    'east_bank',
    'east_police',
    'east_hotel',
    'east_casino',
    'east_docks',
    'east_park',
    'east_market',
    'east_arena',
  ];
  private readonly fleeRadius = 420;
  private readonly squishRadius = 58;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(): void {
    this.clear();
    const zones = this.cityZones();
    if (!zones.length) return;

    const count = 14;
    for (let i = 0; i < count; i++) {
      const z = zones[i % zones.length];
      const x = z.x + 40 + Math.random() * (z.w - 80);
      const y = z.y + 40 + Math.random() * (z.h - 80);
      this.spawnOne(x, y, zones);
    }
  }

  setOutdoorVisible(vis: boolean): void {
    this.outdoor = vis;
    for (const r of this.pack) {
      const show = vis && !r.squished;
      r.sprite.setVisible(show);
      r.label.setVisible(show);
      if (!vis) r.sprite.setVelocity(0, 0);
    }
  }

  update(
    delta: number,
    player: Phaser.Physics.Arcade.Sprite,
    outdoors: boolean,
    onScare?: (msg: string) => void,
    opts?: RobberUpdateOpts,
  ): void {
    if (!outdoors || !this.outdoor) {
      this.setOutdoorVisible(false);
      return;
    }
    if (player.x < 10800) {
      for (const r of this.pack) {
        if (r.squished) continue;
        r.sprite.setVelocity(0, 0);
        r.sprite.setAlpha(0.35);
        r.label.setAlpha(0.35);
      }
      return;
    }

    const zones = this.cityZones();
    const now = this.scene.time.now;
    const police = !!opts?.inPoliceCar;

    for (const r of this.pack) {
      // Respawn after squish
      if (r.squished) {
        if (now >= r.respawnAt) this.respawn(r, zones);
        continue;
      }

      r.sprite.setAlpha(1);
      r.label.setAlpha(1);
      r.scareCd = Math.max(0, r.scareCd - delta);

      const pd = Phaser.Math.Distance.Between(player.x, player.y, r.sprite.x, r.sprite.y);

      // Police car hit → SQUISH + blood pool
      if (police && pd < this.squishRadius && (opts?.playerSpeed ?? 0) > 80) {
        this.squish(r, onScare);
        continue;
      }

      // Flee from police car (chaseable)
      if (police && pd < this.fleeRadius) {
        const fx = r.sprite.x - player.x;
        const fy = r.sprite.y - player.y;
        const fl = Math.hypot(fx, fy) || 1;
        const fleeSpeed = 260 + Math.min(180, (opts?.playerSpeed ?? 0) * 0.35);
        r.sprite.setVelocity((fx / fl) * fleeSpeed, (fy / fl) * fleeSpeed);
        r.sprite.setFlipX(fx < 0);
        r.tx = r.sprite.x + (fx / fl) * 280;
        r.ty = r.sprite.y + (fy / fl) * 280;
        r.label.setPosition(r.sprite.x, r.sprite.y - 28);
        r.label.setText('😱 RUN!!');
        if (r.scareCd <= 0) {
          r.scareCd = 2500;
          onScare?.('😱 Burglar panics — “Cops!!” He runs! Chase him in the Cybertruck!');
        }
        continue;
      }

      // Normal wander / on-foot scare
      r.label.setText('💰 ROBBER');
      const dx = r.tx - r.sprite.x;
      const dy = r.ty - r.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 18) {
        const t = this.pickTarget(zones);
        r.tx = t.x;
        r.ty = t.y;
      } else {
        r.sprite.setVelocity((dx / dist) * r.speed, (dy / dist) * r.speed);
        r.sprite.setFlipX(dx < 0);
      }
      r.label.setPosition(r.sprite.x, r.sprite.y - 28);

      if (!police && pd < 70 && r.scareCd <= 0) {
        r.scareCd = 4000;
        onScare?.('💰 A robber dashes past — “Gimme the gold!” (He runs off.)');
        const fx = r.sprite.x - player.x;
        const fy = r.sprite.y - player.y;
        const fl = Math.hypot(fx, fy) || 1;
        r.tx = r.sprite.x + (fx / fl) * 220;
        r.ty = r.sprite.y + (fy / fl) * 220;
      }
    }
  }

  count(): number {
    return this.pack.filter((r) => !r.squished).length;
  }

  squishedCount(): number {
    return this.pack.filter((r) => r.squished).length;
  }

  getSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.pack.map((r) => r.sprite);
  }

  private squish(r: Robber, onScare?: (msg: string) => void): void {
    r.squished = true;
    r.respawnAt = this.scene.time.now + Phaser.Math.Between(8000, 14000);
    r.sprite.setVelocity(0, 0);
    r.sprite.setScale(1.6, 0.28);
    r.sprite.setTint(0xff8a80);
    r.sprite.setAngle(Phaser.Math.Between(-20, 20));
    r.label.setText('💥 SQUISHED');
    r.label.setPosition(r.sprite.x, r.sprite.y - 18);

    if (r.blood) r.blood.destroy();
    r.blood = this.scene.add
      .image(r.sprite.x, r.sprite.y + 8, 'blood_pool')
      .setDepth(7)
      .setAlpha(0.95)
      .setScale(0.35);
    this.scene.tweens.add({
      targets: r.blood,
      scale: 1.25,
      alpha: 0.9,
      duration: 280,
      ease: 'Back.easeOut',
    });

    for (let i = 0; i < 4; i++) {
      const star = this.scene.add
        .star(r.sprite.x, r.sprite.y - 8, 5, 3, 6, 0xffe082, 1)
        .setDepth(20);
      this.scene.tweens.add({
        targets: star,
        x: r.sprite.x + Phaser.Math.Between(-50, 50),
        y: r.sprite.y - Phaser.Math.Between(25, 60),
        alpha: 0,
        duration: 480,
        delay: i * 20,
        onComplete: () => star.destroy(),
      });
    }

    this.scene.cameras.main.shake(140, 0.008);
    onScare?.('🚔 SQUISH!! Police Cybertruck flattened a burglar — blood pool!');
  }

  private respawn(r: Robber, zones: Array<{ x: number; y: number; w: number; h: number }>): void {
    const t = this.pickTarget(zones);
    r.squished = false;
    r.respawnAt = 0;
    r.sprite.clearTint();
    r.sprite.setAngle(0);
    r.sprite.setScale(1.05);
    r.sprite.setPosition(t.x, t.y);
    r.sprite.setVisible(true);
    r.label.setVisible(true);
    r.label.setText('💰 ROBBER');
    r.tx = t.x;
    r.ty = t.y;
    if (r.blood) {
      r.blood.destroy();
      r.blood = undefined;
    }
  }

  private spawnOne(
    x: number,
    y: number,
    zones: Array<{ x: number; y: number; w: number; h: number }>,
  ): void {
    const sprite = this.scene.physics.add.sprite(x, y, 'robber');
    sprite.setDepth(8).setScale(1.05);
    sprite.setImmovable(false);
    sprite.body!.setSize(28, 40).setOffset(10, 16);
    const label = this.scene.add
      .text(x, y - 28, '💰 ROBBER', {
        fontSize: '10px',
        color: '#ffcdd2',
        backgroundColor: '#00000099',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(9);
    const t = this.pickTarget(zones);
    this.pack.push({
      sprite,
      label,
      wx: x,
      wy: y,
      tx: t.x,
      ty: t.y,
      speed: 120 + Math.random() * 80,
      scareCd: 0,
      squished: false,
      respawnAt: 0,
    });
  }

  private cityZones(): Array<{ x: number; y: number; w: number; h: number }> {
    return this.cityIds
      .map((id) => CITY_ZONES.find((z) => z.id === id))
      .filter(Boolean) as Array<{ x: number; y: number; w: number; h: number }>;
  }

  private pickTarget(zones: Array<{ x: number; y: number; w: number; h: number }>): {
    x: number;
    y: number;
  } {
    const z = zones[Phaser.Math.Between(0, zones.length - 1)];
    return {
      x: z.x + 30 + Math.random() * (z.w - 60),
      y: z.y + 30 + Math.random() * (z.h - 60),
    };
  }

  private clear(): void {
    for (const r of this.pack) {
      r.sprite.destroy();
      r.label.destroy();
      r.blood?.destroy();
    }
    this.pack = [];
  }
}
