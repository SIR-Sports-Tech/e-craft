import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { REWARD_TEXT } from '../data/MissionState';

export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private hintText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private mapOverlay!: Phaser.GameObjects.Container;
  private rewardOverlay!: Phaser.GameObjects.Container;
  private touchRoot!: Phaser.GameObjects.Container;
  private stickBase!: Phaser.GameObjects.Arc;
  private stickKnob!: Phaser.GameObjects.Arc;
  private stickPointerId: number | null = null;
  private rewardedShown = false;
  private checklistText!: Phaser.GameObjects.Text;
  private hudTick = 0;
  private lastHudKey = '';
  private mapOpenCached = false;

  constructor() {
    super('UI');
  }

  init(data: { game: GameScene }): void {
    this.gameScene = data.game;
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // subtle vignette for polish
    const vig = this.add.graphics().setScrollFactor(0).setDepth(90).setAlpha(0.35);
    vig.fillStyle(0x000000, 1);
    vig.fillRect(0, 0, w, 28);
    vig.fillRect(0, h - 28, w, 28);

    this.phaseText = this.add.text(0, 0, '').setVisible(false);

    this.hintText = this.add
      .text(12, 36, '', {
        fontSize: '12px',
        color: '#fff9c4',
        backgroundColor: '#00000066',
        padding: { x: 6, y: 3 },
        wordWrap: { width: Math.min(360, w - 24) },
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0.85);

    this.statusText = this.add.text(0, 0, '').setVisible(false);

    this.promptText = this.add.text(0, 0, '').setVisible(false);

    this.checklistText = this.add.text(0, 0, '').setVisible(false);

    this.add
      .text(w - 12, 10, '', {
        fontSize: '11px',
        color: '#b0bec5',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.buildPauseOverlay();
    this.buildMapOverlay();
    this.buildRewardOverlay();
    this.buildTouchControls();

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.statusText.setY(gameSize.height - 70);
      this.promptText.setPosition(gameSize.width / 2, gameSize.height - 110);
      this.checklistText.setX(gameSize.width - 12);
      this.layoutTouch(gameSize.width, gameSize.height);
    });
  }

  private buildPauseOverlay(): void {
    this.pauseOverlay = this.add.container(0, 0).setDepth(200).setScrollFactor(0).setVisible(false);
    const bg = this.add.rectangle(0, 0, 4000, 4000, 0x000000, 0.65).setOrigin(0);
    const title = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 20, 'PAUSED', {
        fontSize: '42px',
        color: '#fff',
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 30, 'Press Esc or Pause to resume', {
        fontSize: '16px',
        color: '#bbb',
      })
      .setOrigin(0.5);
    this.pauseOverlay.add([bg, title, sub]);
  }

  private buildMapOverlay(): void {
    this.mapOverlay = this.add.container(0, 0).setDepth(190).setScrollFactor(0).setVisible(false);
    const bg = this.add.rectangle(0, 0, 4000, 4000, 0x0a1220, 0.82).setOrigin(0);
    const title = this.add
      .text(this.scale.width / 2, 40, 'E-CRAFT CITY MAP', {
        fontSize: '28px',
        color: '#90caf9',
      })
      .setOrigin(0.5, 0);
    const legend = this.add
      .text(
        this.scale.width / 2,
        90,
        'Blue = Security HQ · Red = Super Jail · Green = Forest · Gray = City\nYou = cyan dot · Sasquatch trail = yellow',
        {
          fontSize: '14px',
          color: '#cfd8dc',
          align: 'center',
        },
      )
      .setOrigin(0.5, 0);
    this.mapOverlay.add([bg, title, legend]);
  }

  private buildRewardOverlay(): void {
    this.rewardOverlay = this.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);
    const bg = this.add.rectangle(0, 0, 4000, 4000, 0x000000, 0.75).setOrigin(0);
    const title = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 60, 'MISSION COMPLETE!', {
        fontSize: '36px',
        color: '#ffe082',
      })
      .setOrigin(0.5);
    const reward = this.add
      .text(this.scale.width / 2, this.scale.height / 2, REWARD_TEXT, {
        fontSize: '28px',
        color: '#69f0ae',
        backgroundColor: '#004d40',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 70, 'Keep exploring the living city!', {
        fontSize: '16px',
        color: '#eee',
      })
      .setOrigin(0.5);
    this.rewardOverlay.add([bg, title, reward, sub]);
  }

  private buildTouchControls(): void {
    this.touchRoot = this.add.container(0, 0).setDepth(150).setScrollFactor(0);
    this.stickBase = this.add.circle(0, 0, 54, 0xffffff, 0.15).setStrokeStyle(2, 0xffffff, 0.35);
    this.stickKnob = this.add.circle(0, 0, 24, 0x4fc3f7, 0.7);
    this.touchRoot.add([this.stickBase, this.stickKnob]);

    const mkBtn = (label: string, color: number, action: string) => {
      const c = this.add.container(0, 0);
      const r = this.add.circle(0, 0, 32, color, 0.55).setStrokeStyle(2, 0xffffff, 0.4);
      const t = this.add.text(0, 0, label, { fontSize: '13px', color: '#fff' }).setOrigin(0.5);
      c.add([r, t]);
      c.setSize(64, 64);
      c.setInteractive(
        new Phaser.Geom.Circle(0, 0, 32),
        Phaser.Geom.Circle.Contains,
      );
      c.on('pointerdown', () => {
        this.gameScene.queueTouchAction(action as 'interact' | 'capture' | 'map' | 'pause');
      });
      this.touchRoot.add(c);
      return c;
    };

    const btnE = mkBtn('E', 0x2e7d32, 'interact');
    const btnSpace = mkBtn('CAP', 0xc62828, 'capture');
    const btnM = mkBtn('MAP', 0x1565c0, 'map');
    const btnP = mkBtn('II', 0x6a1b9a, 'pause');
    (this as unknown as { touchBtns: Phaser.GameObjects.Container[] }).touchBtns = [
      btnE,
      btnSpace,
      btnM,
      btnP,
    ];

    this.stickBase.setInteractive(
      new Phaser.Geom.Circle(0, 0, 54),
      Phaser.Geom.Circle.Contains,
    );
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const local = this.stickBase.getBounds();
      if (Phaser.Geom.Rectangle.Contains(local, p.x, p.y)) {
        this.stickPointerId = p.id;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.stickPointerId !== p.id) return;
      const dx = p.x - this.stickBase.x;
      const dy = p.y - this.stickBase.y;
      const max = 42;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (dx / len) * Math.min(len, max);
      const ny = (dy / len) * Math.min(len, max);
      this.stickKnob.setPosition(this.stickBase.x + nx, this.stickBase.y + ny);
      this.gameScene.setTouchVector(nx / max, ny / max);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.stickPointerId === p.id) {
        this.stickPointerId = null;
        this.stickKnob.setPosition(this.stickBase.x, this.stickBase.y);
        this.gameScene.setTouchVector(0, 0);
      }
    });

    this.layoutTouch(this.scale.width, this.scale.height);
    // Desktop keyboard play: hide touch overlay so it cannot steal input
    const touchDevice =
      this.sys.game.device.os.android ||
      this.sys.game.device.os.iOS ||
      (this.sys.game.device.input.touch && this.scale.width < 900);
    this.touchRoot.setVisible(!!touchDevice);
    this.touchRoot.setActive(!!touchDevice);
    if (!touchDevice) {
      // Ensure no residual stick vector on desktop
      this.gameScene.setTouchVector(0, 0);
    }
  }

  private layoutTouch(w: number, h: number): void {
    this.stickBase.setPosition(90, h - 90);
    this.stickKnob.setPosition(90, h - 90);
    const btns = (this as unknown as { touchBtns: Phaser.GameObjects.Container[] }).touchBtns || [];
    const positions = [
      { x: w - 90, y: h - 90 },
      { x: w - 90, y: h - 170 },
      { x: w - 170, y: h - 90 },
      { x: w - 170, y: h - 170 },
    ];
    btns.forEach((b, i) => b.setPosition(positions[i].x, positions[i].y));
  }

  update(_t: number, delta: number): void {
    if (!this.gameScene) return;
    this.hudTick += delta;
    // Throttle HUD string rebuilds — every-frame text was freezing phones
    if (this.hudTick < 250 && !this.mapOpenCached) return;
    this.hudTick = 0;
    const hud = this.gameScene.getHud();
    this.mapOpenCached = hud.mapOpen;
    const key = `${hud.phase}|${hud.status}|${hud.dayPhase}|${hud.jobTitle}|${hud.paused}|${hud.mapOpen}|${hud.reward ? 1 : 0}|${hud.checklist?.map((c) => (c.done ? 1 : 0)).join('')}`;
    if (key !== this.lastHudKey) {
      this.lastHudKey = key;
      this.phaseText.setText(`E-CRAFT v1 · ${hud.phase}`);
      this.hintText.setText(hud.hint);
      this.statusText.setText(hud.status);
      if (hud.checklist) {
        const police = (hud.policeLines || []).join('\n');
        this.checklistText.setText(
          `E-CRAFT · ${hud.dayPhase || ''}\nJob: ${hud.jobTitle || ''}\n\nMISSION\n` +
            hud.checklist
              .map((c: { done: boolean; label: string }) => `${c.done ? '✓' : '○'} ${c.label}`)
              .join('\n') +
            (police ? `\n\nPOLICE\n${police}` : '') +
            '\n\nAutosave ON · UNFREEZE if stuck',
        );
      }
    }

    this.pauseOverlay.setVisible(hud.paused);
    this.mapOverlay.setVisible(hud.mapOpen);

    if (hud.reward && !this.rewardedShown) {
      this.rewardedShown = true;
      this.rewardOverlay.setVisible(true);
      this.time.delayedCall(3500, () => this.rewardOverlay.setVisible(false));
    }

    // Mini-map dots when map open
    if (hud.mapOpen) {
      this.drawMiniMap(hud);
    }
  }

  private mapPlayerDot?: Phaser.GameObjects.Arc;
  private drawMiniMap(hud: ReturnType<GameScene['getHud']>): void {
    const mapW = 520;
    const mapH = 360;
    const ox = this.scale.width / 2 - mapW / 2;
    const oy = 150;
    if (!(this as unknown as { mapFrame?: Phaser.GameObjects.Rectangle }).mapFrame) {
      const frame = this.add
        .rectangle(ox + mapW / 2, oy + mapH / 2, mapW, mapH, 0x1b3d24, 1)
        .setStrokeStyle(2, 0x90caf9)
        .setScrollFactor(0)
        .setDepth(191);
      // zone pretends
      const hq = this.add.rectangle(ox + 80, oy + 60, 70, 50, 0x2a4a7a).setScrollFactor(0).setDepth(192);
      const jail = this.add.rectangle(ox + 160, oy + 60, 55, 50, 0x5a2a2a).setScrollFactor(0).setDepth(192);
      const forest = this.add.rectangle(ox + 400, oy + 180, 160, 220, 0x1a4a28).setScrollFactor(0).setDepth(192);
      this.mapOverlay.add([frame, hq, jail, forest]);
      (this as unknown as { mapFrame: Phaser.GameObjects.Rectangle }).mapFrame = frame;
    }
    if (!this.mapPlayerDot) {
      this.mapPlayerDot = this.add.circle(0, 0, 6, 0x4fc3f7).setScrollFactor(0).setDepth(193);
      this.mapOverlay.add(this.mapPlayerDot);
    }
    const sx = ox + (hud.player.x / hud.world.w) * mapW;
    const sy = oy + (hud.player.y / hud.world.h) * mapH;
    this.mapPlayerDot.setPosition(sx, sy).setVisible(hud.mapOpen);
  }
}
