import Phaser from 'phaser';

/**
 * Family-friendly gag: a pig falls from the sky and bonks the player on the head,
 * then runs away oinking — WALL LAW stops it at solid walls (velocity flee, not tween ghost).
 */
export class PigDropSystem {
  private scene: Phaser.Scene;
  private pig?: Phaser.Physics.Arcade.Sprite;
  private cooldown = 12000;
  private active = false;
  private fleeing = false;
  private fleeTimer = 0;
  private readonly minGap = 22000;
  private readonly maxGap = 50000;
  private onSpawn?: (sprite: Phaser.Physics.Arcade.Sprite) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setOnSpawn(cb: (sprite: Phaser.Physics.Arcade.Sprite) => void): void {
    this.onSpawn = cb;
  }

  getSprite(): Phaser.Physics.Arcade.Sprite | undefined {
    return this.pig;
  }

  update(
    delta: number,
    player: Phaser.Physics.Arcade.Sprite,
    outdoors: boolean,
    onHit?: (msg: string) => void,
  ): void {
    if (!outdoors) return;

    if (this.fleeing && this.pig) {
      this.fleeTimer -= delta;
      this.pig.setAlpha(Math.max(0.1, this.pig.alpha - 0.015));
      if (this.fleeTimer <= 0 || this.pig.alpha <= 0.12) {
        this.cleanup();
        this.scheduleNext();
      }
      return;
    }

    if (this.active) return;
    this.cooldown -= delta;
    if (this.cooldown > 0) return;
    this.dropOn(player, onHit);
  }

  forceDrop(player: Phaser.Physics.Arcade.Sprite, onHit?: (msg: string) => void): void {
    this.cooldown = 0;
    if (this.active || this.fleeing) {
      this.cleanup();
    }
    this.dropOn(player, onHit);
  }

  isActive(): boolean {
    return this.active || this.fleeing;
  }

  private scheduleNext(): void {
    this.cooldown = Phaser.Math.Between(this.minGap, this.maxGap);
  }

  private cleanup(): void {
    this.active = false;
    this.fleeing = false;
    this.fleeTimer = 0;
    if (this.pig) {
      this.scene.tweens.killTweensOf(this.pig);
      this.pig.destroy();
      this.pig = undefined;
    }
  }

  private dropOn(player: Phaser.Physics.Arcade.Sprite, onHit?: (msg: string) => void): void {
    this.active = true;
    this.fleeing = false;
    const startX = player.x + Phaser.Math.Between(-20, 20);
    const startY = player.y - 420;

    this.pig = this.scene.physics.add.sprite(startX, startY, 'pig');
    this.pig.setDepth(25).setScale(1.15);
    this.pig.setImmovable(false);
    // Falling from sky — body off until impact (don't snag rooftops mid-air)
    this.pig.body!.enable = false;
    this.onSpawn?.(this.pig);

    const shadow = this.scene.add
      .ellipse(player.x, player.y + 22, 10, 4, 0x000000, 0.25)
      .setDepth(8);

    this.scene.tweens.add({
      targets: shadow,
      scaleX: 3.2,
      scaleY: 2.2,
      alpha: 0.45,
      duration: 700,
      ease: 'Quad.easeIn',
    });

    // Fall onto head (sky drop — walls ignored until land)
    this.scene.tweens.add({
      targets: this.pig,
      x: player.x,
      y: player.y - 28,
      angle: 360,
      duration: 700,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        shadow.destroy();
        onHit?.('🐷 OINK!!! A pig fell on your head!');
        if (!this.pig) return;
        this.scene.tweens.add({
          targets: this.pig,
          scaleX: 1.45,
          scaleY: 0.7,
          duration: 90,
          yoyo: true,
        });
        for (let i = 0; i < 4; i++) {
          const star = this.scene.add
            .star(player.x, player.y - 40, 5, 3, 6, 0xffe082, 1)
            .setDepth(26);
          this.scene.tweens.add({
            targets: star,
            x: player.x + Phaser.Math.Between(-50, 50),
            y: player.y - Phaser.Math.Between(50, 90),
            alpha: 0,
            duration: 500,
            delay: i * 30,
            onComplete: () => star.destroy(),
          });
        }
        // Velocity flee — walls stop the pig
        this.active = false;
        this.fleeing = true;
        this.fleeTimer = 1100;
        this.pig.body!.enable = true;
        this.pig.body!.setSize(36, 28);
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.pig.setVelocity(dir * Phaser.Math.Between(260, 360), Phaser.Math.Between(-40, 40));
        this.pig.setFlipX(dir < 0);
      },
    });
  }
}
