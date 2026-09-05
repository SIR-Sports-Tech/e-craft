import Phaser from 'phaser';
import {
  GameFlags,
  MissionPhase,
  PHASE_HINTS,
  REWARD_TEXT,
} from '../data/MissionState';
import { TrailSystem } from '../systems/TrailSystem';
import { ObjectiveMarker, objectiveFor } from '../systems/ObjectiveSystem';
import {
  CITY_ZONES,
  JAIL_INTERIOR,
  LAIR,
  ROADS,
  SPAWN,
  WORLD,
  pointInRect,
} from '../world/WorldLayout';

type TouchVec = { x: number; y: number };

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private robot!: Phaser.Physics.Arcade.Sprite;
  private vehicle!: Phaser.Physics.Arcade.Sprite;
  private sasquatch!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    M: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    ESC: Phaser.Input.Keyboard.Key;
  };

  private phase: MissionPhase = MissionPhase.AtSecurityHQ;
  private flags: GameFlags = {
    hasTracker: false,
    robotActive: false,
    inVehicle: false,
    inLair: false,
    inJailBuilding: false,
    sasquatchCaptured: false,
    sasquatchInVehicle: false,
    sasquatchJailed: false,
    rewardClaimed: false,
  };

  private trail!: TrailSystem;
  private trailLayer!: Phaser.GameObjects.Container;
  private worldLayer!: Phaser.GameObjects.Container;
  private indoorLayer!: Phaser.GameObjects.Container;
  private labels: Phaser.GameObjects.Text[] = [];

  private interactPrompt = '';
  private statusLine = '';
  private paused = false;
  private mapOpen = false;
  private touchVec: TouchVec = { x: 0, y: 0 };
  private touchAction: 'none' | 'interact' | 'capture' | 'map' | 'pause' = 'none';
  private lostTrailTimer = 0;
  private sasquatchWanderTarget = { x: SPAWN.sasquatchForest.x, y: SPAWN.sasquatchForest.y };
  private cellMarker?: Phaser.GameObjects.Rectangle;
  private jailedSprite?: Phaser.GameObjects.Sprite;
  private hqDoorLabel?: Phaser.GameObjects.Text;
  private lairNodes: Phaser.GameObjects.GameObject[] = [];
  private jailNodes: Phaser.GameObjects.GameObject[] = [];
  private objectiveMarker!: ObjectiveMarker;

  constructor() {
    super('Game');
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBackgroundColor(0x152018);

    this.worldLayer = this.add.container(0, 0);
    this.trailLayer = this.add.container(0, 0).setDepth(5);
    this.indoorLayer = this.add.container(0, 0).setDepth(20).setVisible(false);

    this.buildOutdoorWorld();
    this.buildIndoorLair();
    this.buildIndoorJail();

    this.trail = new TrailSystem(this, this.trailLayer);
    this.objectiveMarker = new ObjectiveMarker(this);

    this.player = this.physics.add.sprite(SPAWN.playerOutdoor.x, SPAWN.playerOutdoor.y, 'player');
    this.player.setCollideWorldBounds(true).setDepth(10);
    this.player.setDrag(800);

    this.robot = this.physics.add.sprite(SPAWN.playerOutdoor.x - 40, SPAWN.playerOutdoor.y, 'robot');
    this.robot.setVisible(false).setDepth(9);
    this.robot.body!.enable = false;

    this.vehicle = this.physics.add.sprite(SPAWN.vehicle.x, SPAWN.vehicle.y, 'vehicle');
    this.vehicle.setImmovable(true).setDepth(8);
    this.vehicle.body!.enable = false;

    this.sasquatch = this.physics.add.sprite(
      SPAWN.sasquatchForest.x,
      SPAWN.sasquatchForest.y,
      'sasquatch',
    );
    this.sasquatch.setDepth(9).setCollideWorldBounds(true);
    this.pickSasquatchWander();
    // Seed trail immediately so player never starts with empty trail
    for (let i = 0; i < 8; i++) {
      this.trail.maybeDrop(
        SPAWN.sasquatchForest.x - i * 70,
        SPAWN.sasquatchForest.y + (i % 2) * 30,
        true,
      );
    }

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      M: Phaser.Input.Keyboard.KeyCodes.M,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
      F9: Phaser.Input.Keyboard.KeyCodes.F9,
      F10: Phaser.Input.Keyboard.KeyCodes.F10,
    }) as typeof this.keys;

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1);

    this.scene.launch('UI', { game: this });
    this.setPhase(MissionPhase.AtSecurityHQ);
    this.statusLine = 'Welcome to E-CRAFT Security Division. Find Sasquatch!';
    (window as unknown as { __ecraft: unknown }).__ecraft = {
      getState: () => this.getHud(),
      advance: () => this.debugAdvance(),
      complete: () => this.debugCompleteMission(),
    };
  }

  private buildOutdoorWorld(): void {
    const grass = this.add.rectangle(
      WORLD.width / 2,
      WORLD.height / 2,
      WORLD.width,
      WORLD.height,
      0x1b3d24,
    );
    this.worldLayer.add(grass);

    for (const road of ROADS) {
      const r = this.add.rectangle(road.x + road.w / 2, road.y + road.h / 2, road.w, road.h, road.color);
      this.worldLayer.add(r);
    }

    for (const z of CITY_ZONES) {
      const r = this.add
        .rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, z.color)
        .setStrokeStyle(3, 0xffffff, 0.25);
      this.worldLayer.add(r);
      const t = this.add
        .text(z.x + z.w / 2, z.y + 18, z.label, {
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#00000066',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5, 0);
      this.worldLayer.add(t);
      this.labels.push(t);
    }

    // Trees (placeholder circles) in forest
    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    for (let i = 0; i < 40; i++) {
      const tx = forest.x + 40 + Math.random() * (forest.w - 80);
      const ty = forest.y + 40 + Math.random() * (forest.h - 80);
      const tree = this.add.circle(tx, ty, 14 + Math.random() * 10, 0x0d3b1e, 0.9);
      this.worldLayer.add(tree);
    }

    
    // Placeholder citizens (living-city seed — original shapes only)
    const plaza = CITY_ZONES.find((z) => z.id === 'city_plaza')!;
    const citizenNames = ['Officer Pike', 'Builder Jun', 'Nurse Ada', 'Pilot Remy'];
    for (let i = 0; i < citizenNames.length; i++) {
      const cx = plaza.x + 60 + i * 90;
      const cy = plaza.y + 120 + (i % 2) * 40;
      const body = this.add.circle(cx, cy, 12, 0xffcc80).setDepth(7);
      const name = this.add
        .text(cx, cy + 16, citizenNames[i], {
          fontSize: '10px',
          color: '#fff',
          backgroundColor: '#00000066',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 0)
        .setDepth(7);
      this.worldLayer.add(body);
      this.worldLayer.add(name);
    }

    this.hqDoorLabel = this.add
      .text(390, 430, '[E] Enter HQ → Underground Lair', {
        fontSize: '13px',
        color: '#ffe082',
        backgroundColor: '#00000099',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);
    this.worldLayer.add(this.hqDoorLabel);
  }

  private buildIndoorLair(): void {
    const floor = this.add.rectangle(
      LAIR.x + LAIR.w / 2,
      LAIR.y + LAIR.h / 2,
      LAIR.w,
      LAIR.h,
      LAIR.color,
    );
    floor.setStrokeStyle(4, 0x4fc3f7, 0.6);
    const title = this.add
      .text(LAIR.x + LAIR.w / 2, LAIR.y + 24, LAIR.label, {
        fontSize: '18px',
        color: '#90caf9',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0);
    const tracker = this.add.image(LAIR.trackerX, LAIR.trackerY, 'tracker');
    const trackerLbl = this.add
      .text(LAIR.trackerX, LAIR.trackerY + 24, 'Sasquatch Tracker [E]', {
        fontSize: '12px',
        color: '#fff59d',
      })
      .setOrigin(0.5, 0);
    const robotPad = this.add.circle(LAIR.robotX, LAIR.robotY, 28, 0x1565c0, 0.5);
    const robotLbl = this.add
      .text(LAIR.robotX, LAIR.robotY + 36, 'Robot Partner [E]', {
        fontSize: '12px',
        color: '#bbdefb',
      })
      .setOrigin(0.5, 0);
    const exit = this.add
      .text(LAIR.exitX, LAIR.exitY, '[E] Exit to surface', {
        fontSize: '13px',
        color: '#a5d6a7',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0, 0);

    this.lairNodes = [floor, title, tracker, trackerLbl, robotPad, robotLbl, exit];
    for (const n of this.lairNodes) this.indoorLayer.add(n);
  }

  private buildIndoorJail(): void {
    const floor = this.add
      .rectangle(
        JAIL_INTERIOR.x + JAIL_INTERIOR.w / 2,
        JAIL_INTERIOR.y + JAIL_INTERIOR.h / 2,
        JAIL_INTERIOR.w,
        JAIL_INTERIOR.h,
        JAIL_INTERIOR.color,
      )
      .setStrokeStyle(4, 0xef9a9a, 0.6)
      .setVisible(false);
    const title = this.add
      .text(JAIL_INTERIOR.x + JAIL_INTERIOR.w / 2, JAIL_INTERIOR.y + 24, JAIL_INTERIOR.label, {
        fontSize: '18px',
        color: '#ef9a9a',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.cellMarker = this.add
      .rectangle(
        JAIL_INTERIOR.cellX,
        JAIL_INTERIOR.cellY,
        JAIL_INTERIOR.cellW,
        JAIL_INTERIOR.cellH,
        0x111111,
        0.9,
      )
      .setStrokeStyle(3, 0xb0bec5)
      .setVisible(false);
    const cellLbl = this.add
      .text(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY - 90, 'Holding Cell [E]', {
        fontSize: '14px',
        color: '#fff',
      })
      .setOrigin(0.5)
      .setVisible(false);
    const exit = this.add
      .text(JAIL_INTERIOR.exitX, JAIL_INTERIOR.exitY, '[E] Exit Super Jail', {
        fontSize: '13px',
        color: '#a5d6a7',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 3 },
      })
      .setVisible(false);
    this.jailNodes = [floor, title, this.cellMarker, cellLbl, exit];
    for (const n of this.jailNodes) this.indoorLayer.add(n);
  }

  // —— Public API for UIScene ——
  getHud() {
    const advanced = [
      MissionPhase.Tracking,
      MissionPhase.FoundSasquatch,
      MissionPhase.Captured,
      MissionPhase.Transporting,
      MissionPhase.AtSuperJail,
      MissionPhase.Jailed,
      MissionPhase.Rewarded,
      MissionPhase.FreeExplore,
    ].includes(this.phase);
    const checklist = [
      { id: 'lair', label: 'Enter underground lair', done: this.flags.hasTracker || this.flags.inLair || this.phase !== MissionPhase.AtSecurityHQ },
      { id: 'tracker', label: 'Get Sasquatch Tracker', done: this.flags.hasTracker },
      { id: 'robot', label: 'Activate robot', done: this.flags.robotActive },
      { id: 'vehicle', label: 'Drive security vehicle', done: this.flags.robotActive && (this.flags.inVehicle || this.flags.sasquatchCaptured || advanced) },
      { id: 'trail', label: 'Follow Sasquatch trail', done: this.flags.sasquatchCaptured || this.phase === MissionPhase.FoundSasquatch || this.phase === MissionPhase.Tracking },
      { id: 'capture', label: 'Capture Sasquatch', done: this.flags.sasquatchCaptured },
      { id: 'transport', label: 'Transport in vehicle', done: this.flags.sasquatchInVehicle || this.flags.sasquatchJailed },
      { id: 'jail', label: 'Lock in SUPER JAIL', done: this.flags.sasquatchJailed },
      { id: 'reward', label: 'Claim reward', done: this.flags.rewardClaimed },
    ];
    return {
      phase: this.phase,
      hint: PHASE_HINTS[this.phase],
      status: this.statusLine,
      prompt: this.interactPrompt,
      paused: this.paused,
      mapOpen: this.mapOpen,
      flags: { ...this.flags },
      reward: this.flags.rewardClaimed ? REWARD_TEXT : null,
      player: { x: this.player.x, y: this.player.y },
      world: { w: WORLD.width, h: WORLD.height },
      checklist,
    };
  }

  setTouchVector(x: number, y: number): void {
    this.touchVec = { x, y };
  }

  queueTouchAction(action: typeof this.touchAction): void {
    this.touchAction = action;
  }

  togglePauseFromUI(): void {
    this.paused = !this.paused;
  }

  toggleMapFromUI(): void {
    this.mapOpen = !this.mapOpen;
  }

  update(_time: number, delta: number): void {
    if (this.paused || this.mapOpen) {
      this.player.setVelocity(0);
      return;
    }

    this.handleMovement();
    this.handleHotkeys();
    this.updateRobotFollow();
    this.updateSasquatch(delta);
    this.updateTrailHelp(delta);
    this.updateInteractPrompt();
    this.consumeTouchActions();
    this.syncIndoorVisibility();
    this.updateObjectiveMarker();
  }

  private updateObjectiveMarker(): void {
    const target = objectiveFor(this.phase, this.flags, {
      sasquatch: { x: this.sasquatch.x, y: this.sasquatch.y },
      vehicle: { x: this.vehicle.x, y: this.vehicle.y },
      player: { x: this.player.x, y: this.player.y },
    });
    this.objectiveMarker.update(this.player.x, this.player.y, target);
  }

  private handleMovement(): void {
    const speed = this.flags.inVehicle ? 280 : 170;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
    vx += this.touchVec.x;
    vy += this.touchVec.y;
    const len = Math.hypot(vx, vy) || 1;
    this.player.setVelocity((vx / len) * speed, (vy / len) * speed);

    if (this.flags.inVehicle) {
      this.vehicle.setPosition(this.player.x, this.player.y);
      this.player.setTexture('vehicle');
    } else if (this.player.texture.key !== 'player') {
      this.player.setTexture('player');
    }

    if (this.flags.sasquatchInVehicle && this.flags.inVehicle) {
      this.sasquatch.setPosition(this.player.x - 28, this.player.y);
      this.sasquatch.setVisible(true).setAlpha(0.85);
    }
  }

  private handleHotkeys(): void {
    const just = Phaser.Input.Keyboard.JustDown;
    if (just(this.keys.E)) this.tryInteract();
    if (just(this.keys.SPACE)) this.tryCapture();
    if (just(this.keys.M)) this.mapOpen = !this.mapOpen;
    if (just(this.keys.ESC)) this.paused = !this.paused;
    if (just((this.keys as any).F9)) this.debugAdvance();
    if (just((this.keys as any).F10)) this.debugCompleteMission();
  }

  /** QA: advance critical flags toward next gate */
  private debugAdvance(): void {
    if (!this.flags.hasTracker) {
      this.flags.hasTracker = true;
      this.setPhase(MissionPhase.HasTracker);
      this.statusLine = '[DEBUG] Tracker granted';
      return;
    }
    if (!this.flags.robotActive) {
      this.flags.robotActive = true;
      this.robot.setVisible(true);
      this.setPhase(MissionPhase.RobotActive);
      this.statusLine = '[DEBUG] Robot online';
      return;
    }
    if (!this.flags.sasquatchCaptured) {
      this.flags.sasquatchCaptured = true;
      this.sasquatch.setTint(0x88ff88);
      this.setPhase(MissionPhase.Captured);
      this.statusLine = '[DEBUG] Sasquatch captured';
      return;
    }
    if (!this.flags.sasquatchInVehicle) {
      this.flags.sasquatchInVehicle = true;
      this.flags.inVehicle = true;
      this.vehicle.setVisible(false);
      this.setPhase(MissionPhase.Transporting);
      this.statusLine = '[DEBUG] Loaded in vehicle';
      return;
    }
    if (!this.flags.sasquatchJailed) {
      this.jailSasquatch();
      this.statusLine = '[DEBUG] Jailed';
      return;
    }
    this.grantReward();
  }

  private debugCompleteMission(): void {
    this.flags.hasTracker = true;
    this.flags.robotActive = true;
    this.flags.sasquatchCaptured = true;
    this.flags.sasquatchInVehicle = true;
    this.jailSasquatch();
    this.grantReward();
    this.statusLine = '[DEBUG] Mission force-complete';
  }

  private consumeTouchActions(): void {
    if (this.touchAction === 'interact') this.tryInteract();
    if (this.touchAction === 'capture') this.tryCapture();
    if (this.touchAction === 'map') this.mapOpen = !this.mapOpen;
    if (this.touchAction === 'pause') this.paused = !this.paused;
    this.touchAction = 'none';
  }

  private updateRobotFollow(): void {
    if (!this.flags.robotActive || this.flags.inLair || this.flags.inJailBuilding) {
      return;
    }
    this.robot.setVisible(true);
    this.robot.body!.enable = true;
    const tx = this.player.x - 36;
    const ty = this.player.y + 10;
    this.physics.moveTo(this.robot, tx, ty, 150);
    if (Phaser.Math.Distance.Between(this.robot.x, this.robot.y, tx, ty) < 12) {
      this.robot.setVelocity(0);
    }
  }

  private updateSasquatch(delta: number): void {
    if (this.flags.sasquatchJailed) {
      this.sasquatch.setVisible(false);
      return;
    }
    if (this.flags.sasquatchCaptured) {
      if (this.flags.sasquatchInVehicle && this.flags.inVehicle) {
        this.sasquatch.setPosition(this.player.x - 28, this.player.y);
        this.sasquatch.setVelocity(0);
        return;
      }
      if (this.flags.sasquatchInVehicle && !this.flags.inVehicle) {
        // On foot with "loaded" cargo — keep beside player for jail walk-in
        this.physics.moveTo(this.sasquatch, this.player.x + 36, this.player.y + 8, 160);
        return;
      }
      // Follow player to the vehicle
      this.physics.moveTo(this.sasquatch, this.player.x + 40, this.player.y + 10, 140);
      return;
    }

    // Wander in forest
    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    const dist = Phaser.Math.Distance.Between(
      this.sasquatch.x,
      this.sasquatch.y,
      this.sasquatchWanderTarget.x,
      this.sasquatchWanderTarget.y,
    );
    if (dist < 30) this.pickSasquatchWander();
    this.physics.moveTo(
      this.sasquatch,
      this.sasquatchWanderTarget.x,
      this.sasquatchWanderTarget.y,
      70,
    );
    // Clamp to forest
    this.sasquatch.x = Phaser.Math.Clamp(this.sasquatch.x, forest.x + 40, forest.x + forest.w - 40);
    this.sasquatch.y = Phaser.Math.Clamp(this.sasquatch.y, forest.y + 40, forest.y + forest.h - 40);

    // ALWAYS leave a trail
    this.trail.maybeDrop(this.sasquatch.x, this.sasquatch.y);

    if (
      !this.flags.sasquatchCaptured &&
      this.flags.hasTracker &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.sasquatch.x, this.sasquatch.y) <
        70
    ) {
      if (this.phase === MissionPhase.Tracking || this.phase === MissionPhase.CanDrive) {
        this.setPhase(MissionPhase.FoundSasquatch);
        this.statusLine = 'Sasquatch spotted! Press Space to capture.';
      }
    }

    void delta;
  }

  private pickSasquatchWander(): void {
    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    this.sasquatchWanderTarget = {
      x: forest.x + 60 + Math.random() * (forest.w - 120),
      y: forest.y + 60 + Math.random() * (forest.h - 120),
    };
  }

  private updateTrailHelp(delta: number): void {
    if (!this.flags.hasTracker || this.flags.sasquatchCaptured || this.flags.inLair) {
      this.trail.clearFallback();
      return;
    }
    this.trail.markNearbyDiscovered(this.player.x, this.player.y);
    this.redrawTrailPath();
    const nearest = this.trail.nearestUndiscovered(this.player.x, this.player.y);
    if (nearest) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, nearest.x, nearest.y);
      if (d > 320) this.lostTrailTimer += delta;
      else this.lostTrailTimer = 0;
    }
    const robotHelps = this.flags.robotActive && this.lostTrailTimer > 1800;
    const msg = this.trail.updateFallbackHelp(this.player.x, this.player.y, robotHelps);
    if (msg && robotHelps) this.statusLine = msg;

    // Advance to tracking once player reaches forest with tracker
    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    if (
      this.flags.hasTracker &&
      this.flags.robotActive &&
      pointInRect(this.player.x, this.player.y, forest) &&
      (this.phase === MissionPhase.CanDrive || this.phase === MissionPhase.RobotActive)
    ) {
      this.setPhase(MissionPhase.Tracking);
      this.statusLine = 'Trail found — follow footprints, fur, mud, branches…';
    }
  }

  private updateInteractPrompt(): void {
    this.interactPrompt = this.describeInteract() ?? '';
  }

  private describeInteract(): string | null {
    if (this.flags.inLair) {
      if (!this.flags.hasTracker && this.near(LAIR.trackerX, LAIR.trackerY, 50)) {
        return '[E] Pick up Sasquatch Tracker';
      }
      if (this.flags.hasTracker && !this.flags.robotActive && this.near(LAIR.robotX, LAIR.robotY, 55)) {
        return '[E] Activate robot partner';
      }
      if (this.near(LAIR.exitX + 40, LAIR.exitY + 10, 70)) return '[E] Exit to surface';
      return null;
    }
    if (this.flags.inJailBuilding) {
      if (
        this.flags.sasquatchInVehicle ||
        this.flags.sasquatchCaptured
      ) {
        if (this.near(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY, 80) && !this.flags.sasquatchJailed) {
          return '[E] Lock Sasquatch in cell';
        }
      }
      if (this.near(JAIL_INTERIOR.exitX + 40, JAIL_INTERIOR.exitY + 10, 70)) {
        return '[E] Exit Super Jail';
      }
      return null;
    }

    const hq = CITY_ZONES.find((z) => z.id === 'security_hq')!;
    const jail = CITY_ZONES.find((z) => z.id === 'super_jail')!;
    if (!this.flags.hasTracker && pointInRect(this.player.x, this.player.y, hq)) {
      return '[E] Enter underground gadget lair';
    }
    if (
      this.flags.sasquatchCaptured &&
      !this.flags.sasquatchJailed &&
      pointInRect(this.player.x, this.player.y, jail)
    ) {
      return '[E] Enter SUPER JAIL with Sasquatch';
    }
    if (!this.flags.inVehicle && this.near(this.vehicle.x, this.vehicle.y, 60)) {
      if (this.flags.robotActive) return '[E] Enter security vehicle';
      return 'Activate robot first (in the lair)';
    }
    if (this.flags.inVehicle) return '[E] Exit vehicle';
    if (
      this.flags.sasquatchCaptured &&
      !this.flags.sasquatchInVehicle &&
      this.flags.inVehicle === false &&
      this.near(this.sasquatch.x, this.sasquatch.y, 55)
    ) {
      return 'Enter vehicle near Sasquatch to load (E on vehicle)';
    }
    return null;
  }

  private tryInteract(): void {
    if (this.flags.inLair) {
      if (!this.flags.hasTracker && this.near(LAIR.trackerX, LAIR.trackerY, 50)) {
        this.flags.hasTracker = true;
        this.setPhase(MissionPhase.HasTracker);
        this.statusLine = 'Sasquatch Tracker acquired!';
        return;
      }
      if (this.flags.hasTracker && !this.flags.robotActive && this.near(LAIR.robotX, LAIR.robotY, 55)) {
        this.flags.robotActive = true;
        this.robot.setPosition(this.player.x - 30, this.player.y);
        this.robot.setVisible(true);
        this.setPhase(MissionPhase.RobotActive);
        this.statusLine = 'Robot online! Exit lair and take the security vehicle.';
        return;
      }
      if (this.near(LAIR.exitX + 40, LAIR.exitY + 10, 70)) {
        this.exitLair();
        return;
      }
      return;
    }

    if (this.flags.inJailBuilding) {
      if (
        !this.flags.sasquatchJailed &&
        this.near(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY, 80) &&
        (this.flags.sasquatchInVehicle || this.flags.sasquatchCaptured)
      ) {
        this.jailSasquatch();
        return;
      }
      if (this.near(JAIL_INTERIOR.exitX + 40, JAIL_INTERIOR.exitY + 10, 70)) {
        this.exitJail();
        return;
      }
      return;
    }

    const hq = CITY_ZONES.find((z) => z.id === 'security_hq')!;
    const jail = CITY_ZONES.find((z) => z.id === 'super_jail')!;

    if (!this.flags.hasTracker && pointInRect(this.player.x, this.player.y, hq)) {
      this.enterLair();
      return;
    }

    if (
      this.flags.sasquatchCaptured &&
      !this.flags.sasquatchJailed &&
      pointInRect(this.player.x, this.player.y, jail)
    ) {
      this.enterJail();
      return;
    }

    // Vehicle enter/exit
    if (!this.flags.inVehicle && this.near(this.vehicle.x, this.vehicle.y, 80)) {
      if (!this.flags.robotActive) {
        this.statusLine = 'Activate your robot partner first!';
        return;
      }
      this.flags.inVehicle = true;
      this.player.setPosition(this.vehicle.x, this.vehicle.y);
      this.vehicle.setVisible(false);
      const sasqNear =
        this.flags.sasquatchCaptured &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, this.sasquatch.x, this.sasquatch.y) < 140;
      if (sasqNear) {
        this.flags.sasquatchInVehicle = true;
        this.setPhase(MissionPhase.Transporting);
        this.statusLine = 'Sasquatch loaded! Drive to SUPER JAIL (follow the yellow arrow).';
      } else if (this.flags.sasquatchCaptured) {
        this.statusLine = 'Sasquatch is following you — get closer to the vehicle, then press E again.';
        this.flags.inVehicle = false;
        this.vehicle.setVisible(true);
        this.player.setTexture('player');
      } else if (this.phase === MissionPhase.RobotActive || this.phase === MissionPhase.CanDrive) {
        this.setPhase(MissionPhase.CanDrive);
        this.statusLine = 'Vehicle engaged. Drive east to the forest (yellow arrow)!';
      }
      return;
    }

    // Load sasquatch while already driving
    if (
      this.flags.inVehicle &&
      this.flags.sasquatchCaptured &&
      !this.flags.sasquatchInVehicle &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.sasquatch.x, this.sasquatch.y) < 120
    ) {
      this.flags.sasquatchInVehicle = true;
      this.setPhase(MissionPhase.Transporting);
      this.statusLine = 'Sasquatch loaded mid-drive! Head to SUPER JAIL.';
      return;
    }

    if (this.flags.inVehicle) {
      this.flags.inVehicle = false;
      this.vehicle.setPosition(this.player.x, this.player.y);
      this.vehicle.setVisible(true);
      this.player.setTexture('player');
      if (this.flags.sasquatchInVehicle) {
        this.sasquatch.setPosition(this.player.x + 40, this.player.y);
        // Keep in vehicle inventory conceptually while transporting on foot near jail
      }
      this.statusLine = 'Exited vehicle.';
    }
  }

  private tryCapture(): void {
    if (this.flags.sasquatchCaptured || this.flags.sasquatchJailed) return;
    if (!this.flags.hasTracker) {
      this.statusLine = 'You need the Sasquatch Tracker first!';
      return;
    }
    const d = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.sasquatch.x,
      this.sasquatch.y,
    );
    if (d > 80) {
      this.statusLine = 'Get closer to Sasquatch to capture (Space).';
      return;
    }
    this.flags.sasquatchCaptured = true;
    this.sasquatch.setVelocity(0);
    this.sasquatch.setTint(0x88ff88);
    this.setPhase(MissionPhase.Captured);
    this.statusLine = 'Captured! Load Sasquatch into the security vehicle (E).';
    this.trail.clearFallback();
  }

  private enterLair(): void {
    this.flags.inLair = true;
    this.indoorLayer.setVisible(true);
    this.lairNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(true));
    this.jailNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    this.worldLayer.setVisible(false);
    this.trailLayer.setVisible(false);
    this.vehicle.setVisible(false);
    this.sasquatch.setVisible(false);
    this.robot.setVisible(false);
    this.player.setPosition(LAIR.exitX + 80, LAIR.exitY + 80);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(LAIR.x + LAIR.w / 2, LAIR.y + LAIR.h / 2);
    this.setPhase(MissionPhase.InUndergroundLair);
    this.statusLine = 'Secret gadget lair. Grab the tracker!';
  }

  private exitLair(): void {
    this.flags.inLair = false;
    this.indoorLayer.setVisible(false);
    this.worldLayer.setVisible(true);
    this.trailLayer.setVisible(true);
    this.vehicle.setVisible(!this.flags.inVehicle);
    this.sasquatch.setVisible(!this.flags.sasquatchJailed);
    if (this.flags.robotActive) this.robot.setVisible(true);
    this.player.setPosition(SPAWN.playerOutdoor.x, SPAWN.playerOutdoor.y);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (this.flags.robotActive) {
      this.setPhase(MissionPhase.CanDrive);
      this.statusLine = 'Back outside. Enter the security vehicle.';
    } else if (this.flags.hasTracker) {
      this.setPhase(MissionPhase.HasTracker);
    } else {
      this.setPhase(MissionPhase.AtSecurityHQ);
    }
  }

  private enterJail(): void {
    this.flags.inJailBuilding = true;
    this.flags.inVehicle = false;
    this.player.setTexture('player');
    this.indoorLayer.setVisible(true);
    this.lairNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    this.jailNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(true));
    this.worldLayer.setVisible(false);
    this.trailLayer.setVisible(false);
    this.vehicle.setVisible(false);
    this.sasquatch.setVisible(false);
    this.robot.setVisible(false);
    this.player.setPosition(JAIL_INTERIOR.exitX + 100, JAIL_INTERIOR.exitY + 100);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(JAIL_INTERIOR.x + JAIL_INTERIOR.w / 2, JAIL_INTERIOR.y + JAIL_INTERIOR.h / 2);
    this.setPhase(MissionPhase.AtSuperJail);
    this.statusLine = 'Inside SUPER JAIL. Lock Sasquatch in the cell!';
  }

  private exitJail(): void {
    this.flags.inJailBuilding = false;
    this.indoorLayer.setVisible(false);
    this.cellMarker?.setVisible(this.flags.sasquatchJailed);
    this.worldLayer.setVisible(true);
    this.trailLayer.setVisible(true);
    this.vehicle.setVisible(!this.flags.inVehicle);
    if (this.flags.robotActive) this.robot.setVisible(true);
    this.player.setPosition(800, 420);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (this.flags.rewardClaimed) this.setPhase(MissionPhase.FreeExplore);
  }

  private jailSasquatch(): void {
    this.flags.sasquatchJailed = true;
    this.flags.sasquatchInVehicle = false;
    this.flags.sasquatchCaptured = true;
    this.sasquatch.setVisible(false);
    if (!this.jailedSprite) {
      this.jailedSprite = this.add
        .sprite(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY, 'sasquatch')
        .setDepth(23)
        .setTint(0xffab91);
      const bars = this.add
        .text(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY + 50, '║ JAILED ║', {
          fontSize: '14px',
          color: '#ffe082',
          backgroundColor: '#000000cc',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(24);
      void bars;
    }
    this.jailedSprite.setVisible(true);
    this.cellMarker?.setVisible(true);
    this.setPhase(MissionPhase.Jailed);
    this.statusLine = 'Sasquatch secured in SUPER JAIL!';
    this.time.delayedCall(600, () => this.grantReward());
  }

  private grantReward(): void {
    if (this.flags.rewardClaimed) return;
    this.flags.rewardClaimed = true;
    this.setPhase(MissionPhase.Rewarded);
    this.statusLine = `MISSION COMPLETE! Reward: ${REWARD_TEXT}`;
    this.time.delayedCall(2500, () => {
      this.setPhase(MissionPhase.FreeExplore);
      this.statusLine = 'Free explore unlocked. The city remembers your heroics.';
    });
  }

  private syncIndoorVisibility(): void {
    // Keep outdoor entities hidden while indoors
    if (this.flags.inLair || this.flags.inJailBuilding) {
      this.worldLayer.setVisible(false);
      this.trailLayer.setVisible(false);
    }
  }

  private setPhase(phase: MissionPhase): void {
    this.phase = phase;
  }

  private trailPath?: Phaser.GameObjects.Graphics;
  private redrawTrailPath(): void {
    if (!this.trailPath) {
      this.trailPath = this.add.graphics().setDepth(4);
      this.trailLayer.add(this.trailPath);
    }
    this.trailPath.clear();
    const clues = this.trail.getClues();
    if (clues.length < 2) return;
    this.trailPath.lineStyle(2, 0xffe082, 0.35);
    this.trailPath.beginPath();
    this.trailPath.moveTo(clues[0].x, clues[0].y);
    for (let i = 1; i < clues.length; i++) this.trailPath.lineTo(clues[i].x, clues[i].y);
    this.trailPath.strokePath();
  }

  private near(x: number, y: number, r: number): boolean {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) <= r;
  }
}
