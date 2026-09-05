import Phaser from 'phaser';

/** Generate original placeholder textures (no third-party game assets). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeCircle('player', 18, 0x4fc3f7);
    this.makeCircle('robot', 14, 0x90caf9);
    this.makeCircle('sasquatch', 22, 0x6d4c41);
    this.makeRect('vehicle', 56, 32, 0x43a047);
    this.makeRect('tracker', 20, 20, 0xffeb3b);
    this.makeRect('cell_bars', 8, 40, 0xb0bec5);
    this.scene.start('Game');
  }

  private makeCircle(key: string, r: number, color: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeCircle(r, r, r);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }

  private makeRect(key: string, w: number, h: number, color: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, w, h, 6);
    g.lineStyle(2, 0xffffff, 0.4);
    g.strokeRoundedRect(0, 0, w, h, 6);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
