import Phaser from 'phaser';

/**
 * Family-friendly gag: a pig falls from the sky and bonks the player on the head,
 * then bounces off / runs away oinking.
 */
export class PigDropSystem {
  private scene: Phaser.Scene;
  private pig?: Phaser.Physics.Arcade.Sprite;
  private cooldown = 12000;
  private active = false;
  private readonly minGap = 22000;
  private readonly maxGap = 50000;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(
    delta: number,
    player: Phaser.Physics.Arcade.Sprite,
    outdoors: boolean,
    onHit?: (msg: string) => void,
  ): void {
    if (!outdoors) return;
    if (this.active) return;
    this.cooldown -= delta;
    if (this.cooldown > 0) return;
    this.dropOn(player, onHit);
  }

  forceDrop(player: Phaser.Physics.Arcade.Sprite, onHit?: (msg: string) => void): void {
    this.cooldown = 0;
    if (this.active && this.pig) {
      this.scene.tweens.killTweensOf(this.pig);
      this.pig.destroy();
      this.pig = undefined;
      this.active = false;
    }
    this.dropOn(player, onHit);
  }

  isActive(): boolean {
    return this.active;
  }

  private scheduleNext(): void {
    this.cooldown = Phaser.Math.Between(this.minGap, this.maxGap);
  }

  private dropOn(player: Phaser.Physics.Arcade.Sprite, onHit?: (msg: string) => void): void {
    this.active = true;
    const startX = player.x + Phaser.Math.Between(-20, 20);
    const startY = player.y - 420;

    this.pig = this.scene.physics.add.sprite(startX, startY, 'pig');
    this.pig.setDepth(25).setScale(1.15);
    this.pig.body!.enable = false;

    // Shadow growing as it falls
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

    // Fall onto head
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
        // Squash on impact
        if (!this.pig) return;
        this.scene.tweens.add({
          targets: this.pig,
          scaleX: 1.45,
          scaleY: 0.7,
          duration: 90,
          yoyo: true,
        });
        // Stars
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
        // Bounce off and flee
        this.scene.tweens.add({
          targets: this.pig,
          x: player.x + Phaser.Math.Between(180, 280) * (Math.random() < 0.5 ? -1 : 1),
          y: player.y - 10,
          angle: 720,
          alpha: 0.2,
          duration: 900,
          delay: 180,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.pig?.destroy();
            this.pig = undefined;
            this.active = false;
            this.scheduleNext();
          },
        });
      },
    });
  }
}
