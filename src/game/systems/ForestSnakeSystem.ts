import Phaser from 'phaser';
import { CITY_ZONES } from '../world/WorldLayout';

interface TreeSnake {
  treeX: number;
  treeY: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  state: 'hiding' | 'falling' | 'on_ground' | 'done';
  cooldown: number;
}

/**
 * Snakes hide in forest canopy, drop when you walk under a tree, and bite.
 */
export class ForestSnakeSystem {
  private scene: Phaser.Scene;
  private snakes: TreeSnake[] = [];
  private outdoor = true;
  private readonly dropDist = 58;
  private readonly biteDist = 34;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawnInTrees(trees: Array<{ x: number; y: number }>): void {
    this.clear();
    const forest = CITY_ZONES.find((z) => z.id === 'forest');
    if (!forest || trees.length < 10) return;

    const count = Math.min(36, Math.max(18, Math.floor(trees.length / 22)));
    const picks = [...trees].sort(() => Math.random() - 0.5).slice(0, count);

    for (const t of picks) {
      const sprite = this.scene.physics.add.sprite(t.x, t.y - 42, 'snake');
      sprite.setDepth(6).setScale(0.9).setVisible(false).setAlpha(0);
      // Never block the player — snakes are VFX + bite trigger only
      sprite.body!.enable = false;
      sprite.body!.checkCollision.none = true;
      this.snakes.push({
        treeX: t.x,
        treeY: t.y,
        sprite,
        state: 'hiding',
        cooldown: Phaser.Math.Between(0, 1500),
      });
    }
  }

  setOutdoorVisible(vis: boolean): void {
    this.outdoor = vis;
    if (!vis) {
      for (const s of this.snakes) {
        s.sprite.setVisible(false).setAlpha(0);
        s.sprite.setVelocity(0, 0);
        if (s.state === 'falling' || s.state === 'on_ground') {
          s.state = 'hiding';
          s.cooldown = 2000;
        }
      }
    }
  }

  /**
   * Returns bite message when a snake hits the player this frame.
   */
  update(
    delta: number,
    player: Phaser.Physics.Arcade.Sprite,
    outdoors: boolean,
    alreadyBitten = false,
  ): string | null {
    if (!outdoors || !this.outdoor) {
      this.setOutdoorVisible(false);
      return null;
    }

    let biteMsg: string | null = null;

    for (const s of this.snakes) {
      if (s.cooldown > 0) s.cooldown -= delta;

      if (s.state === 'hiding') {
        // Don't rain snakes while already limping — keep woods walkable
        if (alreadyBitten) continue;
        const d = Phaser.Math.Distance.Between(player.x, player.y, s.treeX, s.treeY);
        if (d < this.dropDist && s.cooldown <= 0) {
          this.drop(s);
        }
        continue;
      }

      if (s.state === 'falling') {
        // Tween handles motion; check arrival near ground
        if (s.sprite.y >= s.treeY + 8) {
          s.state = 'on_ground';
          s.sprite.setVelocity(0, 0);
          s.sprite.play('snake-slither', true);
        }
      }

      if (s.state === 'on_ground' || s.state === 'falling') {
        const d = Phaser.Math.Distance.Between(player.x, player.y, s.sprite.x, s.sprite.y);
        if (d < this.biteDist && s.sprite.visible && s.sprite.alpha > 0.5) {
          biteMsg = '🐍 SNAKE BITE!! It fell from the tree and bit you!';
          this.finish(s);
        }
      }

      if (s.state === 'on_ground') {
        // Slither briefly toward player then vanish
        const dx = player.x - s.sprite.x;
        const dy = player.y - s.sprite.y;
        const len = Math.hypot(dx, dy) || 1;
        s.sprite.setVelocity((dx / len) * 90, (dy / len) * 90);
        s.sprite.setFlipX(dx < 0);
        s.cooldown -= delta;
        if (s.cooldown < -2200) this.finish(s);
      }
    }

    return biteMsg;
  }

  count(): number {
    return this.snakes.length;
  }

  getDropTrees(): Array<{ x: number; y: number }> {
    return this.snakes.map((s) => ({ x: s.treeX, y: s.treeY }));
  }

  private drop(s: TreeSnake): void {
    s.state = 'falling';
    s.sprite.setVisible(true);
    s.sprite.setAlpha(1);
    s.sprite.setPosition(s.treeX + Phaser.Math.Between(-6, 6), s.treeY - 48);
    s.sprite.setAngle(Phaser.Math.Between(-40, 40));
    this.scene.tweens.killTweensOf(s.sprite);
    this.scene.tweens.add({
      targets: s.sprite,
      y: s.treeY + 12,
      angle: 0,
      duration: 380,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        if (s.state === 'falling') {
          s.state = 'on_ground';
          s.cooldown = 0;
          s.sprite.play('snake-slither', true);
        }
      },
    });
  }

  private finish(s: TreeSnake): void {
    this.scene.tweens.killTweensOf(s.sprite);
    s.sprite.setVelocity(0, 0);
    s.sprite.setVisible(false).setAlpha(0);
    s.sprite.anims.stop();
    s.state = 'hiding';
    s.cooldown = Phaser.Math.Between(9000, 18000);
    s.sprite.setPosition(s.treeX, s.treeY - 42);
  }

  private clear(): void {
    for (const s of this.snakes) {
      this.scene.tweens.killTweensOf(s.sprite);
      s.sprite.destroy();
    }
    this.snakes = [];
  }
}
