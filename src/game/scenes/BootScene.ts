import Phaser from 'phaser';

/**
 * E-CRAFT v0.2.1 original art pack — cleaner, larger, readable sprites.
 * Still procedural (no third-party IP). Aimed at “cute top-down adventure” readability.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeGrass();
    this.makeRoad();
    this.makePlayer();
    this.makeRobot();
    this.makeSasquatch();
    this.makeVehicle();
    this.makeRaceCar();
    this.makeTracker();
    this.makeTree();
    this.makeCitizen();
    this.makeBuilding('bldg_hq', 0x1a3d6d, 0x5dade2, 0x1abc9c, true);
    this.makeBuilding('bldg_jail', 0x6b2b2b, 0xf5b7b1, 0x922b21, true);
    this.makeBuilding('bldg_plaza', 0x4a5568, 0xf6c28b, 0x718096, false);
    this.makeBuilding('bldg_forest_cabin', 0x5d4037, 0x81c784, 0x3e2723, false);
    this.makeDoor();
    this.makeTrailIcons();
    const params = new URLSearchParams(location.search);
    const skip = params.get('skiptitle') === '1';
    const cont = params.get('continue') === '1';
    const forceNew = params.get('new') === '1';
    // Auto-resume saved progress unless explicitly starting new.
    // This stops "freeze → reload → start over" on phone.
    let hasSave = false;
    try {
      hasSave = !!localStorage.getItem('ecraft_save_v02');
    } catch {
      hasSave = false;
    }
    if (!forceNew && (cont || hasSave)) {
      this.registry.set('loadSave', true);
    }
    if (forceNew) {
      try {
        localStorage.removeItem('ecraft_save_v02');
      } catch {
        /* ignore */
      }
      this.registry.set('loadSave', false);
    }
    this.scene.start(skip || cont || (!forceNew && hasSave) ? 'Game' : 'Title');
  }

  private g(): Phaser.GameObjects.Graphics {
    return this.make.graphics({ x: 0, y: 0 });
  }

  private makeGrass(): void {
    const s = 64;
    const g = this.g();
    g.fillStyle(0x3d8b4f, 1);
    g.fillRect(0, 0, s, s);
    g.fillStyle(0x4caf50, 1);
    for (let i = 0; i < 24; i++) {
      g.fillRect((i * 13) % s, (i * 19) % s, 2, 5);
    }
    g.fillStyle(0x81c784, 0.5);
    g.fillCircle(12, 18, 3);
    g.fillCircle(44, 36, 2);
    g.fillCircle(30, 50, 2);
    g.generateTexture('tile_grass', s, s);
    g.destroy();
  }

  private makeRoad(): void {
    const s = 64;
    const g = this.g();
    g.fillStyle(0x455a64, 1);
    g.fillRect(0, 0, s, s);
    g.fillStyle(0x37474f, 1);
    g.fillRect(0, 0, s, 6);
    g.fillRect(0, s - 6, s, 6);
    g.fillStyle(0xffeb3b, 1);
    g.fillRect(s / 2 - 3, 10, 6, 18);
    g.fillRect(s / 2 - 3, 38, 6, 18);
    g.generateTexture('tile_road', s, s);
    g.destroy();
  }

  private makePlayer(): void {
    // Larger readable security officer (64x64)
    const g = this.g();
    // shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(32, 58, 28, 10);
    // legs
    g.fillStyle(0x1a237e, 1);
    g.fillRoundedRect(22, 42, 8, 14, 2);
    g.fillRoundedRect(34, 42, 8, 14, 2);
    // body / jacket
    g.fillStyle(0x1565c0, 1);
    g.fillRoundedRect(18, 26, 28, 22, 6);
    // arms
    g.fillStyle(0x0d47a1, 1);
    g.fillRoundedRect(10, 28, 10, 16, 3);
    g.fillRoundedRect(44, 28, 10, 16, 3);
    // head
    g.fillStyle(0xffcc80, 1);
    g.fillCircle(32, 18, 12);
    // helmet
    g.fillStyle(0x0d47a1, 1);
    g.fillEllipse(32, 12, 26, 16);
    g.fillStyle(0x4fc3f7, 1);
    g.fillRoundedRect(22, 14, 20, 7, 2);
    // badge
    g.fillStyle(0xffe082, 1);
    g.fillCircle(32, 36, 4);
    g.lineStyle(2, 0xffffff, 0.35);
    g.strokeRoundedRect(18, 26, 28, 22, 6);
    g.generateTexture('player', 64, 64);
    g.destroy();
  }

  private makeRobot(): void {
    const g = this.g();
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(28, 52, 24, 8);
    g.fillStyle(0xb0bec5, 1);
    g.fillRoundedRect(12, 22, 32, 28, 6);
    g.fillStyle(0xeceff1, 1);
    g.fillCircle(28, 16, 12);
    // eyes
    g.fillStyle(0x00e5ff, 1);
    g.fillCircle(23, 15, 4);
    g.fillCircle(33, 15, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(24, 14, 1.5);
    g.fillCircle(34, 14, 1.5);
    // antenna
    g.lineStyle(2, 0x90a4ae, 1);
    g.lineBetween(28, 4, 28, 8);
    g.fillStyle(0xff5252, 1);
    g.fillCircle(28, 3, 3);
    // smile LED
    g.fillStyle(0x69f0ae, 1);
    g.fillRoundedRect(22, 34, 12, 4, 2);
    g.generateTexture('robot', 56, 56);
    g.destroy();
  }

  private makeSasquatch(): void {
    // Player-sized (64x64) walk sheet — 4 frames — cute/classic bigfoot + RED eyes
    const fw = 64;
    const fh = 64;
    const frames = 4;
    const sheet = this.make.graphics({ x: 0, y: 0 });

    const drawFrame = (g: Phaser.GameObjects.Graphics, ox: number, frame: number) => {
      const stride = (frame % 2 === 0 ? -1 : 1) * (3 + (frame % 2));
      const bob = frame % 2 === 0 ? 0 : -2;
      const arm = (frame - 1.5) * 3;

      // shadow
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(ox + 32, fh - 4, 28, 8);

      // legs
      g.fillStyle(0x5d4037, 1);
      g.fillRoundedRect(ox + 20 + stride, 40 + bob, 9, 18, 3);
      g.fillRoundedRect(ox + 35 - stride, 40 + bob, 9, 18, 3);
      // feet
      g.fillStyle(0x4e342e, 1);
      g.fillEllipse(ox + 24 + stride, 58 + bob, 12, 7);
      g.fillEllipse(ox + 40 - stride, 58 + bob, 12, 7);

      // body (furry)
      g.fillStyle(0x6d4c41, 1);
      g.fillRoundedRect(ox + 16, 24 + bob, 32, 24, 8);
      // belly
      g.fillStyle(0x8d6e63, 1);
      g.fillEllipse(ox + 32, 36 + bob, 16, 14);

      // arms
      g.fillStyle(0x5d4037, 1);
      g.fillRoundedRect(ox + 6 - arm, 26 + bob, 12, 20, 4);
      g.fillRoundedRect(ox + 46 + arm, 26 + bob, 12, 20, 4);
      // hands
      g.fillStyle(0x4e342e, 1);
      g.fillCircle(ox + 12 - arm, 46 + bob, 5);
      g.fillCircle(ox + 52 + arm, 46 + bob, 5);

      // head
      g.fillStyle(0x6d4c41, 1);
      g.fillCircle(ox + 32, 16 + bob, 14);
      // face
      g.fillStyle(0xa1887f, 1);
      g.fillEllipse(ox + 32, 18 + bob, 14, 12);
      // RED EYES (requested)
      g.fillStyle(0xff1744, 1);
      g.fillCircle(ox + 27, 15 + bob, 4);
      g.fillCircle(ox + 37, 15 + bob, 4);
      g.fillStyle(0xff8a80, 1);
      g.fillCircle(ox + 27, 15 + bob, 1.6);
      g.fillCircle(ox + 37, 15 + bob, 1.6);
      // glow
      g.fillStyle(0xff1744, 0.22);
      g.fillCircle(ox + 27, 15 + bob, 7);
      g.fillCircle(ox + 37, 15 + bob, 7);
      // brow
      g.fillStyle(0x4e342e, 1);
      g.fillRect(ox + 22, 10 + bob, 20, 3);
      // smile (slightly friendlier but still wild)
      g.lineStyle(2, 0x3e2723, 1);
      g.beginPath();
      g.arc(ox + 32, 22 + bob, 5, 0.15 * Math.PI, 0.85 * Math.PI, false);
      g.strokePath();
    };

    for (let i = 0; i < frames; i++) drawFrame(sheet, i * fw, i);
    sheet.generateTexture('sasquatch_sheet_img', fw * frames, fh);
    sheet.destroy();

    const srcImg = this.textures.get('sasquatch_sheet_img').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    if (this.textures.exists('sasquatch_sheet')) this.textures.remove('sasquatch_sheet');
    this.textures.addSpriteSheet('sasquatch_sheet', srcImg as HTMLImageElement, {
      frameWidth: fw,
      frameHeight: fh,
    });

    const one = this.make.graphics({ x: 0, y: 0 });
    drawFrame(one, 0, 0);
    one.generateTexture('sasquatch', fw, fh);
    one.destroy();

    if (this.anims.exists('sasquatch-walk')) this.anims.remove('sasquatch-walk');
    if (this.anims.exists('sasquatch-idle')) this.anims.remove('sasquatch-idle');
    if (this.anims.exists('sasquatch-down')) this.anims.remove('sasquatch-down');
    this.anims.create({
      key: 'sasquatch-walk',
      frames: this.anims.generateFrameNumbers('sasquatch_sheet', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'sasquatch-idle',
      frames: [{ key: 'sasquatch_sheet', frame: 0 }],
      frameRate: 1,
      repeat: -1,
    });
  }

  private makeVehicle(): void {
    const g = this.g();
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(48, 54, 70, 12);
    // body
    g.fillStyle(0x2e7d32, 1);
    g.fillRoundedRect(6, 18, 84, 30, 10);
    // cabin
    g.fillStyle(0x1b5e20, 1);
    g.fillRoundedRect(34, 6, 34, 20, 5);
    // glass
    g.fillStyle(0x81d4fa, 1);
    g.fillRoundedRect(38, 9, 12, 12, 2);
    g.fillRoundedRect(54, 9, 12, 12, 2);
    // lightbar
    g.fillStyle(0xf44336, 1);
    g.fillRect(40, 2, 10, 5);
    g.fillStyle(0x2196f3, 1);
    g.fillRect(52, 2, 10, 5);
    // stripe
    g.fillStyle(0xffee58, 1);
    g.fillRect(10, 28, 22, 8);
    // wheels
    g.fillStyle(0x212121, 1);
    g.fillCircle(22, 48, 9);
    g.fillCircle(74, 48, 9);
    g.fillStyle(0xbdbdbd, 1);
    g.fillCircle(22, 48, 3);
    g.fillCircle(74, 48, 3);
    g.generateTexture('vehicle', 96, 60);
    g.destroy();
  }

  private makeRaceCar(): void {
    const g = this.g();
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(48, 50, 70, 10);
    // sleek low body
    g.fillStyle(0xd50000, 1);
    g.fillRoundedRect(6, 22, 84, 22, 8);
    // cockpit
    g.fillStyle(0x212121, 1);
    g.fillRoundedRect(38, 10, 28, 16, 4);
    g.fillStyle(0x80d8ff, 1);
    g.fillRoundedRect(42, 12, 20, 10, 2);
    // spoiler
    g.fillStyle(0xb71c1c, 1);
    g.fillRect(8, 14, 18, 5);
    g.fillRect(12, 8, 4, 8);
    // stripe
    g.fillStyle(0xffffff, 1);
    g.fillRect(34, 24, 8, 18);
    // wheels
    g.fillStyle(0x111111, 1);
    g.fillCircle(24, 44, 8);
    g.fillCircle(72, 44, 8);
    g.fillStyle(0xbdbdbd, 1);
    g.fillCircle(24, 44, 3);
    g.fillCircle(72, 44, 3);
    // nose
    g.fillStyle(0xff1744, 1);
    g.fillTriangle(90, 33, 98, 33, 90, 40);
    g.generateTexture('race_car', 100, 56);
    g.destroy();
  }

  private makeTracker(): void {
    const g = this.g();
    g.fillStyle(0x263238, 1);
    g.fillRoundedRect(4, 10, 40, 32, 6);
    g.fillStyle(0x00c853, 1);
    g.fillCircle(24, 26, 12);
    g.fillStyle(0xb9f6ca, 1);
    g.fillCircle(24, 26, 5);
    g.lineStyle(3, 0xffee58, 1);
    g.strokeCircle(24, 26, 14);
    g.fillStyle(0xffee58, 1);
    g.fillTriangle(24, 2, 18, 12, 30, 12);
    g.generateTexture('tracker', 48, 48);
    g.destroy();
  }

  private makeTree(): void {
    const g = this.g();
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(28, 60, 22, 8);
    g.fillStyle(0x6d4c41, 1);
    g.fillRect(24, 40, 8, 22);
    g.fillStyle(0x1b5e20, 1);
    g.fillCircle(28, 32, 18);
    g.fillStyle(0x2e7d32, 1);
    g.fillCircle(18, 26, 13);
    g.fillCircle(38, 26, 13);
    g.fillStyle(0x43a047, 1);
    g.fillCircle(28, 16, 12);
    g.generateTexture('tree', 56, 64);
    g.destroy();
  }

  private makeCitizen(): void {
    const g = this.g();
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(20, 50, 16, 6);
    g.fillStyle(0xffcc80, 1);
    g.fillCircle(20, 12, 9);
    g.fillStyle(0x8d6e63, 1);
    g.fillRoundedRect(11, 20, 18, 22, 4);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(13, 40, 5, 12);
    g.fillRect(22, 40, 5, 12);
    g.generateTexture('citizen', 40, 54);
    g.destroy();
  }

  private makeBuilding(
    key: string,
    wall: number,
    roof: number,
    trim: number,
    fancy: boolean,
  ): void {
    const w = 180;
    const h = 140;
    const g = this.g();
    // shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(w / 2, h + 4, w * 0.9, 16);
    // wall
    g.fillStyle(wall, 1);
    g.fillRoundedRect(4, 36, w - 8, h - 36, 8);
    // roof
    g.fillStyle(roof, 1);
    g.fillTriangle(0, 40, w / 2, 4, w, 40);
    g.fillStyle(trim, 1);
    g.fillTriangle(10, 40, w / 2, 14, w - 10, 40);
    // door
    g.fillStyle(0x212121, 1);
    g.fillRoundedRect(w / 2 - 16, h - 42, 32, 42, 4);
    g.fillStyle(0xffe082, 1);
    g.fillCircle(w / 2 + 10, h - 22, 3);
    // windows
    const win = (x: number, y: number) => {
      g.fillStyle(0xbbdefb, 1);
      g.fillRoundedRect(x, y, 30, 24, 3);
      g.lineStyle(1, 0xffffff, 0.5);
      g.strokeRoundedRect(x, y, 30, 24, 3);
      g.lineBetween(x + 15, y, x + 15, y + 24);
      g.lineBetween(x, y + 12, x + 30, y + 12);
    };
    win(22, 56);
    win(w - 52, 56);
    if (fancy) {
      win(22, 90);
      win(w - 52, 90);
      g.lineStyle(3, 0xcfd8dc, 1);
      g.lineBetween(w / 2, 4, w / 2, -14);
      g.fillStyle(0xf44336, 1);
      g.fillCircle(w / 2, -16, 5);
    }
    g.lineStyle(2, 0xffffff, 0.2);
    g.strokeRoundedRect(4, 36, w - 8, h - 36, 8);
    g.generateTexture(key, w, h + 12);
    g.destroy();
  }

  private makeDoor(): void {
    const g = this.g();
    g.fillStyle(0x5d4037, 1);
    g.fillRoundedRect(0, 0, 40, 56, 4);
    g.fillStyle(0x3e2723, 1);
    g.fillRoundedRect(4, 4, 32, 48, 3);
    g.fillStyle(0xffe082, 1);
    g.fillCircle(30, 28, 3);
    g.generateTexture('door', 40, 56);
    g.destroy();
  }

  private makeTrailIcons(): void {
    const specs: Array<[string, (g: Phaser.GameObjects.Graphics) => void]> = [
      [
        'trail_footprint',
        (g) => {
          g.fillStyle(0x5d4037, 1);
          g.fillEllipse(14, 10, 16, 12);
          g.fillCircle(7, 20, 3.5);
          g.fillCircle(14, 22, 3.5);
          g.fillCircle(21, 20, 3.5);
        },
      ],
      [
        'trail_branch',
        (g) => {
          g.lineStyle(5, 0x8d6e63, 1);
          g.lineBetween(4, 20, 24, 6);
          g.lineBetween(12, 14, 22, 18);
        },
      ],
      [
        'trail_fur',
        (g) => {
          g.fillStyle(0xd7ccc8, 1);
          g.fillCircle(14, 14, 9);
          g.fillStyle(0x8d6e63, 1);
          g.fillCircle(11, 11, 3);
        },
      ],
      [
        'trail_mud',
        (g) => {
          g.fillStyle(0x4e342e, 0.95);
          g.fillEllipse(14, 16, 20, 12);
          g.fillCircle(8, 10, 5);
        },
      ],
      [
        'trail_scratch',
        (g) => {
          g.lineStyle(3, 0xd84315, 1);
          g.lineBetween(6, 5, 10, 24);
          g.lineBetween(14, 3, 18, 24);
          g.lineBetween(22, 7, 24, 22);
        },
      ],
    ];
    for (const [key, draw] of specs) {
      const g = this.g();
      draw(g);
      g.generateTexture(key, 28, 28);
      g.destroy();
    }
  }
}
