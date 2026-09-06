import Phaser from 'phaser';
import { CITY_ZONES } from '../world/WorldLayout';

type Phase = 'idle' | 'emerge' | 'chase' | 'retreat';

interface Tiger {
  sprite: Phaser.Physics.Arcade.Sprite;
  homeX: number;
  homeY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * 10 jungle tigers: when you get too close to the forest edge they burst out,
 * chase you toward the city, then peel back into the jungle.
 */
export class TigerPackSystem {
  private scene: Phaser.Scene;
  private pack: Tiger[] = [];
  private phase: Phase = 'idle';
  private cooldown = 4000;
  private phaseTimer = 0;
  private readonly packSize = 10;
  private readonly triggerDist = 240;
  private readonly safeCityX = 1980;
  private readonly minGap = 16000;
  private readonly maxGap = 36000;
  private forest = CITY_ZONES.find((z) => z.id === 'forest')!;
  private lastToast = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(
    delta: number,
    player: Phaser.Physics.Arcade.Sprite,
    outdoors: boolean,
    onScare?: (msg: string) => void,
  ): void {
    if (!outdoors) {
      if (this.phase !== 'idle') this.forceHide();
      return;
    }

    if (this.phase === 'idle') {
      this.cooldown -= delta;
      if (this.cooldown <= 0 && this.nearJungle(player)) {
        this.beginEmerge(player, onScare);
      }
      return;
    }

    this.phaseTimer -= delta;

    if (this.phase === 'emerge') {
      this.driveTowardPlayer(player, 340, 0.35);
      if (this.phaseTimer <= 0) {
        this.phase = 'chase';
        this.phaseTimer = 9000;
        onScare?.('🐅 The tiger pack is chasing you — run west to the city!');
      }
      return;
    }

    if (this.phase === 'chase') {
      // Herd / chase — push player toward city (west)
      this.driveTowardPlayer(player, 420, 0.55);
      const playerSafe = player.x <= this.safeCityX;
      const timedOut = this.phaseTimer <= 0;
      if (playerSafe || timedOut) {
        this.beginRetreat(onScare, playerSafe ? 'city' : 'timeout');
      }
      return;
    }

    if (this.phase === 'retreat') {
      this.driveHome(520);
      if (this.phaseTimer <= 0 || this.allHome()) {
        this.forceHide();
        this.cooldown = Phaser.Math.Between(this.minGap, this.maxGap);
      }
    }
  }

  /** Debug / button: force the pack to rush out. */
  forceAmbush(player: Phaser.Physics.Arcade.Sprite, onScare?: (msg: string) => void): void {
    this.cooldown = 0;
    if (this.phase !== 'idle') this.forceHide();
    this.beginEmerge(player, onScare);
  }

  isActive(): boolean {
    return this.phase !== 'idle';
  }

  getLastToast(): string {
    return this.lastToast;
  }

  countVisible(): number {
    return this.pack.filter((t) => t.sprite.visible).length;
  }

  private nearJungle(player: Phaser.Physics.Arcade.Sprite): boolean {
    const edge = this.forest.x;
    const inY =
      player.y >= this.forest.y - 80 && player.y <= this.forest.y + this.forest.h + 80;
    // Close to the west face of the jungle (or just inside it)
    return inY && player.x >= edge - this.triggerDist && player.x <= edge + 420;
  }

  private ensurePack(): void {
    if (this.pack.length >= this.packSize) return;
    for (let i = this.pack.length; i < this.packSize; i++) {
      const s = this.scene.physics.add.sprite(0, 0, 'tiger_sheet', 0);
      s.setDepth(12).setScale(1.05);
      s.body!.setSize(42, 24).setOffset(10, 16);
      s.setVisible(false);
      s.setActive(false);
      this.pack.push({
        sprite: s,
        homeX: 0,
        homeY: 0,
        offsetX: Phaser.Math.Between(-50, 90),
        offsetY: Phaser.Math.Between(-110, 110),
      });
    }
  }

  private beginEmerge(player: Phaser.Physics.Arcade.Sprite, onScare?: (msg: string) => void): void {
    this.ensurePack();
    const edge = this.forest.x;
    for (let i = 0; i < this.pack.length; i++) {
      const t = this.pack[i];
      const homeX = edge + 80 + (i % 5) * 36 + Phaser.Math.Between(0, 40);
      const homeY = player.y + t.offsetY + Phaser.Math.Between(-20, 20);
      t.homeX = homeX + 220;
      t.homeY = Phaser.Math.Clamp(homeY, this.forest.y + 40, this.forest.y + this.forest.h - 40);
      t.sprite.setPosition(homeX + 160, t.homeY);
      t.sprite.setVisible(true);
      t.sprite.setActive(true);
      t.sprite.setAlpha(1);
      t.sprite.setFlipX(true); // facing west toward city/player
      t.sprite.play('tiger-run', true);
      t.sprite.setVelocity(0, 0);
    }
    this.phase = 'emerge';
    this.phaseTimer = 900;
    const msg = '🐅 TEN TIGERS burst from the jungle!! Run back to the city!';
    this.lastToast = msg;
    onScare?.(msg);
  }

  private beginRetreat(onScare?: (msg: string) => void, reason: 'city' | 'timeout' = 'city'): void {
    this.phase = 'retreat';
    this.phaseTimer = 2800;
    for (const t of this.pack) {
      if (!t.sprite.visible) continue;
      t.sprite.setFlipX(false); // face jungle (east)
      t.sprite.play('tiger-run', true);
    }
    const msg =
      reason === 'city'
        ? '🐅 The tigers peel off — racing back into the jungle!'
        : '🐅 The tiger pack loses interest and returns to the trees.';
    this.lastToast = msg;
    onScare?.(msg);
  }

  private driveTowardPlayer(player: Phaser.Physics.Arcade.Sprite, speed: number, westBias: number): void {
    for (const t of this.pack) {
      if (!t.sprite.visible) continue;
      // Aim slightly west of the player so the pack herds toward the city
      const tx = player.x + t.offsetX * 0.35 - 40;
      const ty = player.y + t.offsetY * 0.45;
      const dx = tx - t.sprite.x;
      const dy = ty - t.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      let vx = (dx / len) * speed - westBias * speed; // extra push west
      let vy = (dy / len) * speed;
      // Don't flood deep into downtown — soft west clamp
      if (t.sprite.x < this.safeCityX - 80) vx = Math.max(vx, 40);
      t.sprite.setVelocity(vx, vy);
      t.sprite.setFlipX(vx < 0);
      if (t.sprite.anims.currentAnim?.key !== 'tiger-run') t.sprite.play('tiger-run', true);
    }
  }

  private driveHome(speed: number): void {
    for (const t of this.pack) {
      if (!t.sprite.visible) continue;
      const dx = t.homeX - t.sprite.x;
      const dy = t.homeY - t.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      t.sprite.setVelocity((dx / len) * speed, (dy / len) * speed);
      t.sprite.setFlipX(dx < 0);
      if (len < 40) {
        t.sprite.setAlpha(Math.max(0.15, t.sprite.alpha - 0.08));
      }
    }
  }

  private allHome(): boolean {
    return this.pack.every((t) => !t.sprite.visible || t.sprite.alpha < 0.2 || t.sprite.x > this.forest.x + 100);
  }

  private forceHide(): void {
    this.phase = 'idle';
    this.phaseTimer = 0;
    for (const t of this.pack) {
      t.sprite.setVisible(false);
      t.sprite.setActive(false);
      t.sprite.setVelocity(0, 0);
      t.sprite.setAlpha(1);
      t.sprite.anims.stop();
    }
  }
}
