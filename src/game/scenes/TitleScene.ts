import Phaser from 'phaser';
import { clearSave, hasSave } from '../systems/SaveSystem';
import { audio } from '../systems/AudioSystem';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x0b1a2a);
    // decorative skyline
    for (let i = 0; i < 12; i++) {
      const bw = 40 + Math.random() * 70;
      const bh = 80 + Math.random() * 220;
      this.add.rectangle(60 + i * 110, h - bh / 2, bw, bh, 0x1a3350, 0.9);
    }
    this.add.image(w * 0.2, h * 0.55, 'bldg_hq').setScale(1.4).setAlpha(0.95);
    this.add.image(w * 0.78, h * 0.52, 'bldg_jail').setScale(1.3).setAlpha(0.9);
    this.add.image(w * 0.5, h * 0.62, 'sasquatch').setScale(1.6);
    this.add.image(w * 0.42, h * 0.66, 'player').setScale(1.3);
    this.add.image(w * 0.58, h * 0.68, 'robot').setScale(1.2);
    this.add.image(w * 0.3, h * 0.72, 'vehicle').setScale(1.1);

    this.add
      .text(w / 2, 70, 'E-CRAFT', {
        fontSize: '64px',
        color: '#4fc3f7',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, 130, 'Security Division — Sasquatch Mission', {
        fontSize: '20px',
        color: '#ffe082',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, 165, 'v0.2.2 Chrome Test Build · Family-friendly living world', {
        fontSize: '14px',
        color: '#90a4ae',
      })
      .setOrigin(0.5);

    const mkBtn = (y: number, label: string, color: number, onClick: () => void) => {
      const c = this.add.container(w / 2, y);
      const r = this.add.rectangle(0, 0, 320, 64, color, 0.95).setStrokeStyle(2, 0xffffff, 0.35);
      const t = this.add.text(0, 0, label, { fontSize: '26px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      c.add([r, t]);
      c.setSize(320, 64);
      c.setInteractive(new Phaser.Geom.Rectangle(-160, -32, 320, 64), Phaser.Geom.Rectangle.Contains);
      c.on('pointerover', () => r.setScale(1.04));
      c.on('pointerout', () => r.setScale(1));
      c.on('pointerdown', () => {
        audio.interact();
        onClick();
      });
      return c;
    };

    mkBtn(h * 0.42, 'NEW GAME', 0x2e7d32, () => {
      clearSave();
      this.registry.set('loadSave', false);
      this.scene.start('Game');
    });

    const continueBtn = mkBtn(h * 0.42 + 70, 'CONTINUE', 0x1565c0, () => {
      this.registry.set('loadSave', true);
      this.scene.start('Game');
    });
    if (!hasSave()) {
      continueBtn.setAlpha(0.35);
      continueBtn.disableInteractive();
    }

    this.add
      .text(w / 2, h - 56, 'CLICK NEW GAME  ·  or press ENTER / SPACE', {
        fontSize: '16px',
        color: '#ffe082',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h - 28, 'In-game: WASD move · E interact · Space capture · M map · Esc pause', {
        fontSize: '13px',
        color: '#b0bec5',
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => {
      audio.interact();
      this.registry.set('loadSave', false);
      this.scene.start('Game');
    });
    this.input.keyboard?.once('keydown-SPACE', () => {
      audio.interact();
      this.registry.set('loadSave', false);
      this.scene.start('Game');
    });

    void bg;
  }
}
