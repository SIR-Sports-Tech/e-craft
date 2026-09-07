import Phaser from 'phaser';
import { CITY_ZONES } from '../world/WorldLayout';

interface Robber {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  wx: number;
  wy: number;
  tx: number;
  ty: number;
  speed: number;
  scareCd: number;
}

/**
 * Eastport street robbers — run around the mega-city (family-friendly chase scare).
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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(): void {
    this.clear();
    const zones = this.cityIds
      .map((id) => CITY_ZONES.find((z) => z.id === id))
      .filter(Boolean) as Array<{ x: number; y: number; w: number; h: number }>;
    if (!zones.length) return;

    const count = 14;
    for (let i = 0; i < count; i++) {
      const z = zones[i % zones.length];
      const x = z.x + 40 + Math.random() * (z.w - 80);
      const y = z.y + 40 + Math.random() * (z.h - 80);
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
      });
    }
  }

  setOutdoorVisible(vis: boolean): void {
    this.outdoor = vis;
    for (const r of this.pack) {
      r.sprite.setVisible(vis);
      r.label.setVisible(vis);
      if (!vis) r.sprite.setVelocity(0, 0);
    }
  }

  update(
    delta: number,
    player: Phaser.Physics.Arcade.Sprite,
    outdoors: boolean,
    onScare?: (msg: string) => void,
  ): void {
    if (!outdoors || !this.outdoor) {
      this.setOutdoorVisible(false);
      return;
    }
    // Only active when player is in/near Eastport
    if (player.x < 10800) {
      for (const r of this.pack) {
        r.sprite.setVelocity(0, 0);
        r.sprite.setAlpha(0.35);
        r.label.setAlpha(0.35);
      }
      return;
    }

    const zones = this.cityIds
      .map((id) => CITY_ZONES.find((z) => z.id === id))
      .filter(Boolean) as Array<{ x: number; y: number; w: number; h: number }>;

    for (const r of this.pack) {
      r.sprite.setAlpha(1);
      r.label.setAlpha(1);
      r.scareCd = Math.max(0, r.scareCd - delta);
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

      // Near player — comic scare (no damage)
      const pd = Phaser.Math.Distance.Between(player.x, player.y, r.sprite.x, r.sprite.y);
      if (pd < 70 && r.scareCd <= 0) {
        r.scareCd = 4000;
        onScare?.('💰 A robber dashes past — “Gimme the gold!” (He runs off.)');
        // Flee away from player briefly
        const fx = r.sprite.x - player.x;
        const fy = r.sprite.y - player.y;
        const fl = Math.hypot(fx, fy) || 1;
        r.tx = r.sprite.x + (fx / fl) * 220;
        r.ty = r.sprite.y + (fy / fl) * 220;
      }
    }
  }

  count(): number {
    return this.pack.length;
  }

  getSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.pack.map((r) => r.sprite);
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
    }
    this.pack = [];
  }
}
