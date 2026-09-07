import Phaser from 'phaser';
import { CITY_ZONES } from '../world/WorldLayout';

type BearKind = 'brown' | 'black';

interface PeekBear {
  kind: BearKind;
  treeX: number;
  treeY: number;
  /** Head peeking from behind trunk */
  head: Phaser.GameObjects.Image;
  /** Side of tree they hide on (−1 left, +1 right) */
  side: number;
  peeking: boolean;
  cooldown: number;
}

/**
 * Brown + black bears hide behind forest trees and poke their heads out
 * when the player walks past.
 */
export class ForestBearSystem {
  private scene: Phaser.Scene;
  private bears: PeekBear[] = [];
  private outdoor = true;
  private readonly peekDist = 160;
  private readonly hideDist = 260;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Place bears behind a subset of tree positions (call after trees spawn).
   */
  spawnBehindTrees(trees: Array<{ x: number; y: number }>): void {
    this.clear();
    const forest = CITY_ZONES.find((z) => z.id === 'forest');
    if (!forest || trees.length < 8) return;

    // Spread bears through the woods — mix brown / black
    const count = Math.min(28, Math.max(14, Math.floor(trees.length / 18)));
    const picks = [...trees].sort(() => Math.random() - 0.5).slice(0, count);

    picks.forEach((t, i) => {
      const kind: BearKind = i % 2 === 0 ? 'brown' : 'black';
      const side = i % 3 === 0 ? -1 : 1;
      const tex = kind === 'brown' ? 'bear_brown_head' : 'bear_black_head';
      const head = this.scene.add
        .image(t.x + side * 8, t.y - 10, tex)
        .setDepth(5)
        .setScale(0.85)
        .setAlpha(0)
        .setFlipX(side < 0);
      this.bears.push({
        kind,
        treeX: t.x,
        treeY: t.y,
        head,
        side,
        peeking: false,
        cooldown: Phaser.Math.Between(0, 800),
      });
    });
  }

  setOutdoorVisible(vis: boolean): void {
    this.outdoor = vis;
    for (const b of this.bears) {
      if (!vis) {
        b.head.setAlpha(0);
        b.peeking = false;
      }
    }
  }

  update(delta: number, player: Phaser.Physics.Arcade.Sprite, outdoors: boolean): void {
    if (!outdoors || !this.outdoor) {
      this.setOutdoorVisible(false);
      return;
    }
    for (const b of this.bears) {
      if (b.cooldown > 0) b.cooldown -= delta;
      const d = Phaser.Math.Distance.Between(player.x, player.y, b.treeX, b.treeY);
      if (!b.peeking && d < this.peekDist && b.cooldown <= 0) {
        this.peek(b);
      } else if (b.peeking && d > this.hideDist) {
        this.hide(b);
      }
    }
  }

  count(): number {
    return this.bears.length;
  }

  peekingCount(): number {
    return this.bears.filter((b) => b.peeking).length;
  }

  /** Tree positions where bears hide (for tests / debug). */
  getHideSpots(): Array<{ x: number; y: number }> {
    return this.bears.map((b) => ({ x: b.treeX, y: b.treeY }));
  }

  private peek(b: PeekBear): void {
    b.peeking = true;
    // Slide head out from behind trunk
    const outX = b.treeX + b.side * 28;
    const outY = b.treeY - 18;
    this.scene.tweens.killTweensOf(b.head);
    b.head.setPosition(b.treeX + b.side * 6, b.treeY - 8);
    b.head.setAlpha(0);
    this.scene.tweens.add({
      targets: b.head,
      x: outX,
      y: outY,
      alpha: 1,
      duration: 280,
      ease: 'Back.easeOut',
    });
  }

  private hide(b: PeekBear): void {
    b.peeking = false;
    b.cooldown = Phaser.Math.Between(1200, 3200);
    this.scene.tweens.killTweensOf(b.head);
    this.scene.tweens.add({
      targets: b.head,
      x: b.treeX + b.side * 4,
      y: b.treeY - 6,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeIn',
    });
  }

  private clear(): void {
    for (const b of this.bears) {
      this.scene.tweens.killTweensOf(b.head);
      b.head.destroy();
    }
    this.bears = [];
  }
}
