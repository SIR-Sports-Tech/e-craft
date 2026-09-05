import Phaser from 'phaser';

/**
 * Original E-CRAFT art — all procedurally drawn (no third-party game assets).
 * Still simple, but readable characters/buildings instead of bare blocks.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeGrassTile();
    this.makeRoadTile();
    this.makePlayer();
    this.makeRobot();
    this.makeSasquatch();
    this.makeVehicle();
    this.makeTracker();
    this.makeTree();
    this.makeCitizen();
    this.makeBuilding('bldg_hq', 0x1e3a5f, 0x4fc3f7, true);
    this.makeBuilding('bldg_jail', 0x4a1c1c, 0xef9a9a, true);
    this.makeBuilding('bldg_plaza', 0x37474f, 0xffcc80, false);
    this.makeBuilding('bldg_forest_cabin', 0x3e2723, 0xa5d6a7, false);
    this.makeDoor();
    this.makeTrailIcons();
    this.scene.start('Title');
  }

  private g(): Phaser.GameObjects.Graphics {
    return this.make.graphics({ x: 0, y: 0 });
  }

  private makeGrassTile(): void {
    const s = 64;
    const g = this.g();
    g.fillStyle(0x2e7d32, 1);
    g.fillRect(0, 0, s, s);
    g.fillStyle(0x388e3c, 1);
    for (let i = 0; i < 18; i++) {
      const x = (i * 17) % s;
      const y = (i * 29) % s;
      g.fillRect(x, y, 3, 6);
    }
    g.fillStyle(0x66bb6a, 0.35);
    g.fillCircle(20, 22, 4);
    g.fillCircle(48, 40, 3);
    g.generateTexture('tile_grass', s, s);
    g.destroy();
  }

  private makeRoadTile(): void {
    const s = 64;
    const g = this.g();
    g.fillStyle(0x37474f, 1);
    g.fillRect(0, 0, s, s);
    g.fillStyle(0x263238, 1);
    g.fillRect(0, 0, s, 4);
    g.fillRect(0, s - 4, s, 4);
    g.fillStyle(0xffee58, 1);
    g.fillRect(s / 2 - 2, 8, 4, 16);
    g.fillRect(s / 2 - 2, 40, 4, 16);
    g.generateTexture('tile_road', s, s);
    g.destroy();
  }

  private makePlayer(): void {
    const g = this.g();
    // body
    g.fillStyle(0x1565c0, 1);
    g.fillRoundedRect(10, 22, 28, 30, 6);
    // head
    g.fillStyle(0xffcc80, 1);
    g.fillCircle(24, 16, 12);
    // hair / helmet
    g.fillStyle(0x0d47a1, 1);
    g.fillCircle(24, 12, 10);
    g.fillStyle(0xffcc80, 1);
    g.fillRect(14, 14, 20, 8);
    // visor
    g.fillStyle(0x4fc3f7, 1);
    g.fillRoundedRect(16, 14, 16, 6, 2);
    // badge
    g.fillStyle(0xffe082, 1);
    g.fillCircle(24, 34, 4);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeRoundedRect(10, 22, 28, 30, 6);
    g.generateTexture('player', 48, 56);
    g.destroy();
  }

  private makeRobot(): void {
    const g = this.g();
    g.fillStyle(0x90a4ae, 1);
    g.fillRoundedRect(8, 18, 28, 26, 4);
    g.fillStyle(0xb0bec5, 1);
    g.fillCircle(22, 14, 10);
    g.fillStyle(0x00e5ff, 1);
    g.fillCircle(18, 13, 3);
    g.fillCircle(26, 13, 3);
    g.fillStyle(0x455a64, 1);
    g.fillRect(4, 24, 8, 6);
    g.fillRect(32, 24, 8, 6);
    g.fillStyle(0xff8a65, 1);
    g.fillRect(18, 28, 8, 4);
    g.generateTexture('robot', 44, 48);
    g.destroy();
  }

  private makeSasquatch(): void {
    const g = this.g();
    // fur body
    g.fillStyle(0x5d4037, 1);
    g.fillEllipse(28, 40, 36, 44);
    // head
    g.fillStyle(0x6d4c41, 1);
    g.fillCircle(28, 16, 14);
    // face
    g.fillStyle(0xa1887f, 1);
    g.fillEllipse(28, 18, 14, 12);
    // eyes
    g.fillStyle(0xfffde7, 1);
    g.fillCircle(23, 16, 3);
    g.fillCircle(33, 16, 3);
    g.fillStyle(0x212121, 1);
    g.fillCircle(23, 16, 1.5);
    g.fillCircle(33, 16, 1.5);
    // arms
    g.fillStyle(0x5d4037, 1);
    g.fillEllipse(8, 38, 12, 28);
    g.fillEllipse(48, 38, 12, 28);
    g.generateTexture('sasquatch', 56, 64);
    g.destroy();
  }

  private makeVehicle(): void {
    const g = this.g();
    // chassis
    g.fillStyle(0x2e7d32, 1);
    g.fillRoundedRect(4, 14, 72, 28, 8);
    // cabin
    g.fillStyle(0x1b5e20, 1);
    g.fillRoundedRect(28, 4, 30, 18, 4);
    // windows
    g.fillStyle(0x81d4fa, 1);
    g.fillRoundedRect(32, 6, 10, 10, 2);
    g.fillRoundedRect(46, 6, 10, 10, 2);
    // light bar
    g.fillStyle(0xf44336, 1);
    g.fillRect(34, 2, 8, 4);
    g.fillStyle(0x2196f3, 1);
    g.fillRect(44, 2, 8, 4);
    // wheels
    g.fillStyle(0x212121, 1);
    g.fillCircle(18, 42, 8);
    g.fillCircle(62, 42, 8);
    g.fillStyle(0x9e9e9e, 1);
    g.fillCircle(18, 42, 3);
    g.fillCircle(62, 42, 3);
    // SECURITY text stripe
    g.fillStyle(0xffee58, 1);
    g.fillRect(8, 24, 18, 6);
    g.generateTexture('vehicle', 80, 52);
    g.destroy();
  }

  private makeTracker(): void {
    const g = this.g();
    g.fillStyle(0x263238, 1);
    g.fillRoundedRect(4, 8, 36, 28, 4);
    g.fillStyle(0x00e676, 1);
    g.fillCircle(22, 22, 10);
    g.fillStyle(0x69f0ae, 1);
    g.fillCircle(22, 22, 5);
    g.lineStyle(2, 0xffee58, 1);
    g.strokeCircle(22, 22, 12);
    g.fillStyle(0xffee58, 1);
    g.fillTriangle(22, 4, 18, 12, 26, 12);
    g.generateTexture('tracker', 44, 40);
    g.destroy();
  }

  private makeTree(): void {
    const g = this.g();
    g.fillStyle(0x5d4037, 1);
    g.fillRect(20, 36, 8, 20);
    g.fillStyle(0x1b5e20, 1);
    g.fillCircle(24, 28, 16);
    g.fillStyle(0x2e7d32, 1);
    g.fillCircle(16, 22, 12);
    g.fillCircle(32, 22, 12);
    g.fillStyle(0x43a047, 1);
    g.fillCircle(24, 14, 10);
    g.generateTexture('tree', 48, 56);
    g.destroy();
  }

  private makeCitizen(): void {
    const g = this.g();
    g.fillStyle(0xffcc80, 1);
    g.fillCircle(16, 10, 8);
    g.fillStyle(0x8d6e63, 1);
    g.fillRoundedRect(8, 18, 16, 20, 4);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(10, 38, 5, 10);
    g.fillRect(17, 38, 5, 10);
    g.generateTexture('citizen', 32, 48);
    g.destroy();
  }

  private makeBuilding(key: string, wall: number, accent: number, isHqStyle: boolean): void {
    const w = 160;
    const h = 120;
    const g = this.g();
    // wall
    g.fillStyle(wall, 1);
    g.fillRoundedRect(0, 24, w, h - 24, 6);
    // roof
    g.fillStyle(accent, 1);
    g.fillTriangle(0, 28, w / 2, 0, w, 28);
    // door
    g.fillStyle(0x212121, 1);
    g.fillRoundedRect(w / 2 - 14, h - 36, 28, 36, 3);
    g.fillStyle(0xffe082, 1);
    g.fillCircle(w / 2 + 8, h - 18, 2);
    // windows
    g.fillStyle(0x81d4fa, 1);
    g.fillRoundedRect(18, 48, 28, 22, 3);
    g.fillRoundedRect(w - 46, 48, 28, 22, 3);
    if (isHqStyle) {
      g.fillRoundedRect(18, 78, 28, 18, 3);
      g.fillRoundedRect(w - 46, 78, 28, 18, 3);
      // antenna
      g.lineStyle(3, 0xb0bec5, 1);
      g.lineBetween(w / 2, 0, w / 2, -16);
      g.fillStyle(0xf44336, 1);
      g.fillCircle(w / 2, -18, 4);
    }
    // outline
    g.lineStyle(2, 0xffffff, 0.25);
    g.strokeRoundedRect(0, 24, w, h - 24, 6);
    g.generateTexture(key, w, h + 8);
    g.destroy();
  }

  private makeDoor(): void {
    const g = this.g();
    g.fillStyle(0x4e342e, 1);
    g.fillRoundedRect(0, 0, 36, 48, 4);
    g.fillStyle(0xffe082, 1);
    g.fillCircle(28, 24, 3);
    g.generateTexture('door', 36, 48);
    g.destroy();
  }

  private makeTrailIcons(): void {
    const kinds: Array<[string, number, (g: Phaser.GameObjects.Graphics) => void]> = [
      [
        'trail_footprint',
        0x6d4c41,
        (g) => {
          g.fillStyle(0x6d4c41, 1);
          g.fillEllipse(12, 10, 14, 10);
          g.fillCircle(6, 18, 3);
          g.fillCircle(12, 20, 3);
          g.fillCircle(18, 18, 3);
        },
      ],
      [
        'trail_branch',
        0x8d6e63,
        (g) => {
          g.lineStyle(4, 0x8d6e63, 1);
          g.lineBetween(4, 18, 22, 6);
          g.lineBetween(12, 12, 20, 16);
        },
      ],
      [
        'trail_fur',
        0xbcaaa4,
        (g) => {
          g.fillStyle(0xbcaaa4, 1);
          g.fillCircle(12, 12, 8);
          g.fillStyle(0x8d6e63, 1);
          g.fillCircle(10, 10, 3);
        },
      ],
      [
        'trail_mud',
        0x4e342e,
        (g) => {
          g.fillStyle(0x4e342e, 0.9);
          g.fillEllipse(12, 14, 18, 10);
          g.fillCircle(8, 10, 4);
        },
      ],
      [
        'trail_scratch',
        0xbf360c,
        (g) => {
          g.lineStyle(3, 0xbf360c, 1);
          g.lineBetween(6, 6, 10, 20);
          g.lineBetween(12, 4, 16, 20);
          g.lineBetween(18, 8, 20, 18);
        },
      ],
    ];
    for (const [key, , draw] of kinds) {
      const g = this.g();
      draw(g);
      g.generateTexture(key, 24, 24);
      g.destroy();
    }
  }
}
