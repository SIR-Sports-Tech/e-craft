import Phaser from 'phaser';
import { TRAIN } from '../world/WorldLayout';

export type TrainSide = 'west' | 'east';
type Phase = 'idle' | 'boarding' | 'riding' | 'alighting';

/**
 * Cross-forest passenger train: board → ride → get off (animated).
 */
export class TrainSystem {
  private scene: Phaser.Scene;
  private train!: Phaser.GameObjects.Container;
  private loco!: Phaser.GameObjects.Image;
  private car!: Phaser.GameObjects.Image;
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  private phase: Phase = 'idle';
  /** Which station the train is parked at */
  private at: TrainSide = 'west';
  private passenger?: Phaser.Physics.Arcade.Sprite;
  private onStatus?: (msg: string) => void;
  private onArrived?: (side: TrainSide) => void;
  private rideTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(): void {
    const y = TRAIN.trackY;
    this.loco = this.scene.add.image(0, 0, 'train_engine').setOrigin(0.5, 0.85);
    this.car = this.scene.add.image(-110, 4, 'train_car').setOrigin(0.5, 0.85);
    const door = this.scene.add
      .rectangle(-40, -8, 18, 28, 0xffee58, 0.9)
      .setStrokeStyle(2, 0xf57f17, 1);
    this.train = this.scene.add.container(TRAIN.west.x, y, [this.car, this.loco, door]).setDepth(12);

    // Platform markers
    for (const side of ['west', 'east'] as TrainSide[]) {
      const p = TRAIN[side];
      const pad = this.scene.add
        .rectangle(p.x, p.y + 36, 160, 28, 0x78909c, 0.85)
        .setStrokeStyle(2, 0xffe082, 0.9)
        .setDepth(3);
      const sign = this.scene.add
        .text(p.x, p.y - 50, `🚂 ${p.label}\n[E] BOARD TRAIN`, {
          fontSize: '12px',
          color: '#fffde7',
          backgroundColor: '#00000099',
          align: 'center',
          padding: { x: 6, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(6);
      void pad;
      void sign;
    }

    // Rails visual along corridor
    const rails = this.scene.add.graphics().setDepth(2);
    rails.lineStyle(4, 0x90a4ae, 0.85);
    rails.lineBetween(2100, y + 18, 13000, y + 18);
    rails.lineStyle(4, 0x90a4ae, 0.85);
    rails.lineBetween(2100, y + 28, 13000, y + 28);
    rails.lineStyle(2, 0x5d4037, 0.5);
    for (let x = 2100; x < 13000; x += 40) {
      rails.lineBetween(x, y + 14, x, y + 32);
    }
  }

  setHandlers(onStatus: (msg: string) => void, onArrived: (side: TrainSide) => void): void {
    this.onStatus = onStatus;
    this.onArrived = onArrived;
  }

  isBusy(): boolean {
    return this.phase !== 'idle';
  }

  currentSide(): TrainSide {
    return this.at;
  }

  nearPlatform(px: number, py: number, range = 110): TrainSide | null {
    for (const side of ['west', 'east'] as TrainSide[]) {
      const p = TRAIN[side];
      if (Phaser.Math.Distance.Between(px, py, p.x, p.y) <= range) return side;
    }
    return null;
  }

  /**
   * Board from the platform the player is standing on (must match parked side).
   */
  tryBoard(player: Phaser.Physics.Arcade.Sprite): boolean {
    if (this.phase !== 'idle') {
      this.onStatus?.('Train is moving — wait for it to stop.');
      return false;
    }
    const side = this.nearPlatform(player.x, player.y, 120);
    if (!side) {
      this.onStatus?.('Walk to a train station platform first.');
      return false;
    }
    if (side !== this.at) {
      this.onStatus?.(`Train is at the ${this.at === 'west' ? 'Westline' : 'Eastport'} station right now.`);
      return false;
    }
    this.beginBoard(player, side);
    return true;
  }

  update(): void {
    // riding handled by tweens
  }

  private beginBoard(player: Phaser.Physics.Arcade.Sprite, from: TrainSide): void {
    this.phase = 'boarding';
    this.passenger = player;
    player.setVelocity(0, 0);
    const doorX = this.train.x - 40;
    const doorY = this.train.y - 8;
    this.onStatus?.(
      from === 'west'
        ? '🚂 Boarding Westline train to Eastport…'
        : '🚂 Boarding train back to Westline…',
    );

    // Walk to door → hop in
    this.scene.tweens.add({
      targets: player,
      x: doorX,
      y: doorY + 10,
      duration: 550,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Climb aboard (scale pop + hide)
        this.scene.tweens.add({
          targets: player,
          y: doorY - 6,
          scaleX: 0.55,
          scaleY: 0.55,
          alpha: 0.15,
          duration: 320,
          ease: 'Back.easeIn',
          onComplete: () => {
            player.setVisible(false);
            player.setAlpha(1);
            player.setScale(1);
            const body = player.body as Phaser.Physics.Arcade.Body | undefined;
            if (body) body.enable = false;
            this.beginRide(from);
          },
        });
      },
    });
  }

  private beginRide(from: TrainSide): void {
    this.phase = 'riding';
    const to: TrainSide = from === 'west' ? 'east' : 'west';
    const dest = TRAIN[to];
    const dist = Math.abs(dest.x - this.train.x);
    const duration = Phaser.Math.Clamp(dist * 0.55, 2800, 6500);
    this.onStatus?.(
      to === 'east'
        ? '🚂 Choo-choo! Crossing the wilderness to Eastport…'
        : '🚂 Riding west through the forest toward home…',
    );

    // Camera follow train while passenger is hidden
    this.scene.cameras.main.startFollow(this.train, true, 0.12, 0.12);

    this.rideTween?.stop();
    this.rideTween = this.scene.tweens.add({
      targets: this.train,
      x: dest.x,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        // Little bounce
        this.train.y = TRAIN.trackY + Math.sin(this.scene.time.now / 90) * 1.5;
      },
      onComplete: () => {
        this.train.y = TRAIN.trackY;
        this.at = to;
        this.beginAlight(to);
      },
    });
  }

  private beginAlight(at: TrainSide): void {
    this.phase = 'alighting';
    const player = this.passenger;
    if (!player) {
      this.phase = 'idle';
      return;
    }
    const doorX = this.train.x - 40;
    const doorY = this.train.y + 28;
    player.setPosition(doorX, doorY - 20);
    player.setVisible(true);
    player.setAlpha(0.2);
    player.setScale(0.55);
    const body = player.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.enable = true;
      body.setVelocity(0, 0);
    }

    this.onStatus?.(
      at === 'east'
        ? '🚂 Arrived Eastport! Getting off the train…'
        : '🚂 Back at Westline! Getting off…',
    );

    this.scene.tweens.add({
      targets: player,
      y: doorY + 18,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.phase = 'idle';
        this.passenger = undefined;
        this.scene.cameras.main.startFollow(player, true, 0.08, 0.08);
        this.onStatus?.(
          at === 'east'
            ? '🌆 Welcome to EASTPORT! Watch for robbers in the streets.'
            : '🏠 Back on the west side — forest & home city.',
        );
        this.onArrived?.(at);
      },
    });
  }
}
