import Phaser from 'phaser';

type Phase = 'idle' | 'pounce' | 'flee';

/**
 * Family-friendly scare: a black panther randomly leaps near the player,
 * snarls (toast), then sprints away into the trees.
 * Uses velocity (not tweens) so WALL LAW solids stop it.
 */
export class PantherSystem {
  private scene: Phaser.Scene;
  private panther?: Phaser.Physics.Arcade.Sprite;
  private cooldown = 8000;
  private phase: Phase = 'idle';
  private phaseTimer = 0;
  private awayX = 0;
  private awayY = 0;
  private readonly minGap = 18000;
  private readonly maxGap = 42000;
  private lastToast = '';
  private onSpawn?: (sprite: Phaser.Physics.Arcade.Sprite) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Bind WALL LAW when the panther sprite is first created. */
  setOnSpawn(cb: (sprite: Phaser.Physics.Arcade.Sprite) => void): void {
    this.onSpawn = cb;
    if (this.panther) cb(this.panther);
  }

  getSprite(): Phaser.Physics.Arcade.Sprite | undefined {
    return this.panther;
  }

  update(
    delta: number,
    player: Phaser.Physics.Arcade.Sprite,
    outdoors: boolean,
    onScare?: (msg: string) => void,
  ): void {
    if (!outdoors) {
      this.hide();
      return;
    }

    if (this.phase !== 'idle' && this.panther) {
      this.phaseTimer -= delta;
      this.drivePhase(player);
      if (this.phaseTimer <= 0) {
        if (this.phase === 'pounce') {
          this.phase = 'flee';
          this.phaseTimer = 1200;
          this.panther.play('panther-run', true);
          this.panther.setFlipX(this.awayX < this.panther.x);
        } else {
          this.hide();
          this.scheduleNext();
        }
      }
      return;
    }

    this.cooldown -= delta;
    if (this.cooldown > 0) return;
    this.trigger(player, onScare);
  }

  forceJump(player: Phaser.Physics.Arcade.Sprite, onScare?: (msg: string) => void): void {
    this.cooldown = 0;
    this.trigger(player, onScare);
  }

  isActive(): boolean {
    return this.phase !== 'idle';
  }

  private scheduleNext(): void {
    this.cooldown = Phaser.Math.Between(this.minGap, this.maxGap);
  }

  private ensureSprite(): Phaser.Physics.Arcade.Sprite {
    if (!this.panther) {
      this.panther = this.scene.physics.add.sprite(0, 0, 'panther_sheet', 0);
      this.panther.setDepth(12).setScale(1.15);
      this.panther.body!.setSize(40, 24).setOffset(8, 16);
      this.panther.setVisible(false);
      this.panther.setImmovable(false);
      this.onSpawn?.(this.panther);
    }
    return this.panther;
  }

  private trigger(player: Phaser.Physics.Arcade.Sprite, onScare?: (msg: string) => void): void {
    const p = this.ensureSprite();

    const side = Phaser.Math.Between(0, 3);
    const dist = 220;
    let sx = player.x;
    let sy = player.y;
    if (side === 0) {
      sx = player.x - dist;
      sy = player.y + Phaser.Math.Between(-40, 40);
    } else if (side === 1) {
      sx = player.x + dist;
      sy = player.y + Phaser.Math.Between(-40, 40);
    } else if (side === 2) {
      sx = player.x + Phaser.Math.Between(-40, 40);
      sy = player.y - dist;
    } else {
      sx = player.x + Phaser.Math.Between(-40, 40);
      sy = player.y + dist;
    }

    p.setPosition(sx, sy);
    p.setVisible(true);
    p.setAlpha(1);
    p.setFlipX(sx > player.x);
    p.play('panther-pounce', true);
    p.body!.enable = true;

    this.awayX = player.x + (player.x - sx) * 1.8 + Phaser.Math.Between(-80, 80);
    this.awayY = player.y + (player.y - sy) * 1.8 + Phaser.Math.Between(-80, 80);
    this.phase = 'pounce';
    this.phaseTimer = 420;

    const msg = '🐆 BLACK PANTHER!! It leaps out — then races into the trees!';
    this.lastToast = msg;
    onScare?.(msg);
  }

  private drivePhase(player: Phaser.Physics.Arcade.Sprite): void {
    if (!this.panther) return;
    if (this.phase === 'pounce') {
      const tx = player.x + Phaser.Math.Between(-8, 8);
      const ty = player.y + Phaser.Math.Between(-6, 6);
      const dx = tx - this.panther.x;
      const dy = ty - this.panther.y;
      const len = Math.hypot(dx, dy) || 1;
      this.panther.setVelocity((dx / len) * 520, (dy / len) * 520);
      this.panther.setFlipX(dx < 0);
      return;
    }
    // flee
    const dx = this.awayX - this.panther.x;
    const dy = this.awayY - this.panther.y;
    const len = Math.hypot(dx, dy) || 1;
    this.panther.setVelocity((dx / len) * 480, (dy / len) * 480);
    this.panther.setFlipX(dx < 0);
    this.panther.setAlpha(Math.max(0.15, this.panther.alpha - 0.012));
    if (this.panther.anims.currentAnim?.key !== 'panther-run') {
      this.panther.play('panther-run', true);
    }
  }

  private hide(): void {
    this.phase = 'idle';
    this.phaseTimer = 0;
    if (this.panther) {
      this.scene.tweens.killTweensOf(this.panther);
      this.panther.setVisible(false);
      this.panther.setVelocity(0, 0);
      this.panther.setAlpha(1);
      this.panther.anims.stop();
    }
  }

  getLastToast(): string {
    return this.lastToast;
  }
}
