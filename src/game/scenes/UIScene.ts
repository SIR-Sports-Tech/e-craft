import Phaser from 'phaser';
import type { GameScene } from './GameScene';


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

    // Hint sits under the DOM coach banner
    this.hintText = this.add
      .text(12, 118, '', {
        fontSize: '13px',
        color: '#fff9c4',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 5 },
        wordWrap: { width: Math.min(420, w - 24) },
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0.95);

    // Live status strip — always visible so players know what to do next
    this.statusText = this.add
      .text(12, h - 78, '', {
        fontSize: '12px',
        color: '#e3f2fd',
        backgroundColor: '#0d47a1cc',
        padding: { x: 8, y: 4 },
        wordWrap: { width: Math.min(340, w - 180) },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.promptText = this.add
      .text(w / 2, h - 108, '', {
        fontSize: '14px',
        color: '#ffecb3',
        backgroundColor: '#e65100dd',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100);

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
    // Intentionally empty + always hidden — full-screen MISSION COMPLETE blocked play.
    this.rewardOverlay = this.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false).setActive(false);
  }

  private buildTouchControls(): void {
    // DOM overlay owns ALL phone controls (left actions + right D-pad).
    // Phaser stick/buttons used to sit on top of them and overlap — keep hidden forever.
    this.touchRoot = this.add.container(0, 0).setDepth(150).setScrollFactor(0);
    this.stickBase = this.add.circle(0, 0, 1, 0xffffff, 0).setVisible(false);
    this.stickKnob = this.add.circle(0, 0, 1, 0xffffff, 0).setVisible(false);
    this.touchRoot.setVisible(false);
    this.touchRoot.setActive(false);
    this.gameScene.setTouchVector(0, 0);
  }

  private layoutTouch(_w: number, _h: number): void {
    // no-op — DOM layout handles phone controls without overlap
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
      this.hintText.setText(hud.hint || '');
      this.statusText.setText(hud.status ? `NOW: ${hud.status}` : '');
      this.promptText.setText(hud.prompt ? hud.prompt : '');
      this.promptText.setVisible(!!hud.prompt);
      this.statusText.setVisible(!!hud.status);
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

    // Never show the full-screen MISSION COMPLETE sign — it blocks play.
    // Reward still unlocks quietly in GameScene; keep overlay hidden forever.
    if (this.rewardOverlay.visible) this.rewardOverlay.setVisible(false);

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
