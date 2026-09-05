import Phaser from 'phaser';

/**
 * Family-friendly scare: a black panther randomly leaps near the player,
 * snarls (toast), then sprints away into the trees.
 */
export class PantherSystem {
  private scene: Phaser.Scene;
  private panther?: Phaser.Physics.Arcade.Sprite;
  private cooldown = 8000; // first encounter after ~8s outdoors
  private active = false;
  private fleeTimer = 0;
  private readonly minGap = 18000;
  private readonly maxGap = 42000;
  private lastToast = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Call each frame when player is outdoors on foot (or in car). */
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

    if (this.active && this.panther) {
      this.fleeTimer -= delta;
      this.updateFleeAnim();
      if (this.fleeTimer <= 0) {
        this.hide();
        this.scheduleNext();
      }
      return;
    }

    this.cooldown -= delta;
    if (this.cooldown > 0) return;
    this.trigger(player, onScare);
  }

  /** Force a panther jump (tests / debug). */
  forceJump(player: Phaser.Physics.Arcade.Sprite, onScare?: (msg: string) => void): void {
    this.cooldown = 0;
    this.trigger(player, onScare);
  }

  isActive(): boolean {
    return this.active;
  }

  private scheduleNext(): void {
    this.cooldown = Phaser.Math.Between(this.minGap, this.maxGap);
  }

  private trigger(player: Phaser.Physics.Arcade.Sprite, onScare?: (msg: string) => void): void {
    if (!this.panther) {
      this.panther = this.scene.physics.add.sprite(0, 0, 'panther_sheet', 0);
      this.panther.setDepth(12).setScale(1.15);
      this.panther.body!.setSize(40, 24).setOffset(8, 16);
      this.panther.setVisible(false);
    }

    // Leap in from a random side near the player
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

    this.panther.setPosition(sx, sy);
    this.panther.setVisible(true);
    this.panther.setAlpha(1);
    this.panther.setFlipX(sx > player.x);
    this.panther.play('panther-pounce', true);
    this.active = true;
    this.fleeTimer = 2200;

    // Dash toward player, then veer away
    const midX = player.x + Phaser.Math.Between(-30, 30);
    const midY = player.y + Phaser.Math.Between(-20, 20);
    const awayX = player.x + (player.x - sx) * 1.8 + Phaser.Math.Between(-80, 80);
    const awayY = player.y + (player.y - sy) * 1.8 + Phaser.Math.Between(-80, 80);

    this.scene.tweens.killTweensOf(this.panther);
    this.scene.tweens.add({
      targets: this.panther,
      x: midX,
      y: midY,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!this.panther) return;
        this.panther.play('panther-run', true);
        this.panther.setFlipX(awayX < midX);
        this.scene.tweens.add({
          targets: this.panther,
          x: awayX,
          y: awayY,
          alpha: 0.15,
          duration: 1100,
          ease: 'Quad.easeIn',
        });
      },
    });

    const msg = '🐆 BLACK PANTHER!! It leaps out — then races into the trees!';
    this.lastToast = msg;
    onScare?.(msg);
  }

  private updateFleeAnim(): void {
    if (!this.panther || !this.panther.visible) return;
    const body = this.panther.body as Phaser.Physics.Arcade.Body | undefined;
    // Tweens move position; keep run anim if fleeing
    if (this.fleeTimer < 1700 && this.panther.anims.currentAnim?.key !== 'panther-run') {
      this.panther.play('panther-run', true);
    }
    void body;
  }

  private hide(): void {
    this.active = false;
    if (this.panther) {
      this.scene.tweens.killTweensOf(this.panther);
      this.panther.setVisible(false);
      this.panther.setVelocity(0, 0);
      this.panther.anims.stop();
    }
  }

  getLastToast(): string {
    return this.lastToast;
  }
}
