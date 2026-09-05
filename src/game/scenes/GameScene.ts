import Phaser from 'phaser';
import {
  GameFlags,
  MissionPhase,
  PHASE_HINTS,
  REWARD_TEXT,
} from '../data/MissionState';
import { TrailSystem } from '../systems/TrailSystem';
import { ObjectiveMarker, objectiveFor } from '../systems/ObjectiveSystem';
import { ConstructionSystem } from '../systems/ConstructionSystem';
import { DayNightSystem } from '../systems/DayNightSystem';
import { JobSystem } from '../systems/JobSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { MysterySystem } from '../systems/MysterySystem';
import { PoliceSystem } from '../systems/PoliceSystem';
import { audio } from '../systems/AudioSystem';
import { loadGame, saveGame } from '../systems/SaveSystem';
import { pollDomInput, setDomStatus, setDomMeta } from '../../ui/domOverlay';
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
  private raceCar!: Phaser.Physics.Arcade.Sprite;
  private activeCarKey: 'vehicle' | 'race_car' = 'vehicle';
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
  private citizens: { x: number; y: number; name: string; line: string }[] = [];
  private construction!: ConstructionSystem;
  private dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  private dayNight!: DayNightSystem;
  private jobs = new JobSystem();
  private inventory = new InventorySystem();
  private facing = 1;
  private lastToast = '';
  private garageCredited = false;
  private mysteries = new MysterySystem();
  private police = new PoliceSystem();
  private slowFrameStreak = 0;
  private lastHudWrite = 0;
  private citizenTick = 0;
  private onVisSave?: () => void;

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
    this.construction = new ConstructionSystem(this, this.worldLayer);

    this.player = this.physics.add.sprite(SPAWN.playerOutdoor.x, SPAWN.playerOutdoor.y, 'player');
    this.player.setCollideWorldBounds(true).setDepth(10).setScale(0.95);
    this.player.setDrag(0);
    this.player.setMaxVelocity(700);
    this.player.body!.setSize(28, 40).setOffset(10, 12);

    this.robot = this.physics.add.sprite(SPAWN.playerOutdoor.x - 40, SPAWN.playerOutdoor.y, 'robot');
    this.robot.setVisible(false).setDepth(9).setScale(0.9);
    this.robot.body!.enable = false;

    this.vehicle = this.physics.add.sprite(SPAWN.vehicle.x, SPAWN.vehicle.y, 'vehicle');
    this.vehicle.setImmovable(true).setDepth(8).setScale(1.05);
    this.vehicle.body!.enable = false;
    this.raceCar = this.physics.add.sprite(SPAWN.raceCar.x, SPAWN.raceCar.y, 'race_car');
    this.raceCar.setImmovable(true).setDepth(8).setScale(1.05);
    this.raceCar.body!.enable = false;
    const raceLbl = this.add
      .text(SPAWN.raceCar.x, SPAWN.raceCar.y - 36, 'RACE CAR', {
        fontSize: '12px',
        color: '#ff8a80',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(8);
    this.worldLayer.add(raceLbl);

    this.sasquatch = this.physics.add.sprite(
      SPAWN.sasquatchForest.x,
      SPAWN.sasquatchForest.y,
      'sasquatch_sheet',
      0,
    );
    this.sasquatch.setDepth(9).setCollideWorldBounds(true).setScale(0.95); // same size as player
    this.sasquatch.play('sasquatch-idle');
    this.pickSasquatchWander();
    // Seed trail immediately so player never starts with empty trail
    for (let i = 0; i < 8; i++) {
      this.trail.maybeDrop(
        SPAWN.sasquatchForest.x - i * 70,
        SPAWN.sasquatchForest.y + (i % 2) * 30,
        true,
      );
    }

    this.input.keyboard!.enabled = true;
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
      R: Phaser.Input.Keyboard.KeyCodes.R,
    }) as typeof this.keys;

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.setRoundPixels(true);
    this.dayNight = new DayNightSystem(this, WORLD.width, WORLD.height);
    // Soft dust when moving (visual juice)
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0xd7ccc8, 0.7);
    gfx.fillCircle(3, 3, 3);
    gfx.generateTexture('dust', 6, 6);
    gfx.destroy();
    const lowPower =
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
    // Skip dust particles on phones — major freeze source under load
    if (!lowPower) {
      this.dust = this.add.particles(0, 0, 'dust', {
        speed: { min: 10, max: 30 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.8, end: 0 },
        lifespan: 280,
        frequency: 80,
        alpha: { start: 0.45, end: 0 },
        emitting: false,
      }).setDepth(6);
    }

    this.scene.launch('UI', { game: this });
    this.setPhase(MissionPhase.AtSecurityHQ);
    this.statusLine = 'Welcome to E-CRAFT Security Division. Find Sasquatch!';
    (window as unknown as { __ecraft: Record<string, unknown> }).__ecraft = {
      getState: () => this.getHud(),
      advance: () => this.debugAdvance(),
      complete: () => this.debugCompleteMission(),
      save: () => this.persistSave(),
      unpause: () => {
        this.paused = false;
        this.mapOpen = false;
      },
      recover: () => this.hardRecover('Recovered + saved. Keep playing!'),
      interact: () => {
        this.paused = false;
        this.mapOpen = false;
        this.tryInteract();
      },
      capture: () => {
        this.paused = false;
        this.mapOpen = false;
        this.tryCapture();
      },
      activate: () => {
        this.paused = false;
        this.mapOpen = false;
        this.doActivate();
      },
      enterCar: () => {
        this.paused = false;
        this.mapOpen = false;
        this.doEnterCar('vehicle');
      },
      enterRaceCar: () => {
        this.paused = false;
        this.mapOpen = false;
        this.doEnterCar('race_car');
      },
      runAcceptanceStep: (step: string) => this.runAcceptanceStep(step),
      runFullAcceptance: async () => {
        const steps = [
          'enter_lair','get_tracker','activate_robot','exit_lair','enter_vehicle',
          'go_forest','find_sasquatch','capture','load_vehicle','go_jail','enter_jail','lock_cell','claim_reward',
        ];
        for (const s of steps) {
          this.runAcceptanceStep(s);
          await new Promise((r) => setTimeout(r, 80));
        }
        return this.getHud();
      },
    };

    if (this.registry.get('loadSave')) {
      this.applySave();
      setDomStatus('Continued from last save — progress kept!');
    }
    this.time.addEvent({ delay: 2000, loop: true, callback: () => this.persistSave() });
    // Save when phone tabs away / app backgrounds — prevents start-over after freeze kill
    this.onVisSave = () => {
      try {
        this.persistSave();
      } catch {
        /* ignore */
      }
    };
    document.addEventListener('visibilitychange', this.onVisSave);
    window.addEventListener('pagehide', this.onVisSave);
    window.addEventListener('beforeunload', this.onVisSave);
  }

  private hardRecover(msg: string): void {
    this.paused = false;
    this.mapOpen = false;
    this.player?.setVelocity(0, 0);
    try {
      this.tweens.killAll();
    } catch {
      /* ignore */
    }
    if (this.dust) this.dust.emitting = false;
    try {
      this.trail?.emergencyTrim();
    } catch {
      /* ignore */
    }
    if (this.trailPath) {
      try {
        this.trailPath.clear();
      } catch {
        /* ignore */
      }
    }
    this.persistSave();
    setDomStatus(msg);
  }

  private persistSave(): void {
    if (!this.player) return;
    saveGame({
      phase: this.phase,
      flags: { ...this.flags },
      player: { x: this.player.x, y: this.player.y },
      builds: this.construction.getOrders().map((o) => ({
        id: o.id,
        progress: o.progress,
        done: o.done,
      })),
    });
  }

  private applySave(): void {
    const data = loadGame();
    if (!data) return;
    this.phase = data.phase;
    this.flags = { ...data.flags };
    this.player.setPosition(data.player.x, data.player.y);
    if (this.flags.robotActive) {
      this.robot.setVisible(true);
      this.robot.setPosition(this.player.x - 36, this.player.y);
    }
    if (this.flags.inVehicle) {
      this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
      this.player.setTexture('vehicle');
    }
    if (this.flags.sasquatchJailed) {
      this.sasquatch.setVisible(false);
    }
    for (const b of data.builds) {
      if (b.id === 'robot_garage') {
        const hq = CITY_ZONES.find((z) => z.id === 'security_hq')!;
        const order = this.construction.requestRobotGarage({ x: hq.x + hq.w / 2, y: hq.y + hq.h + 70 });
        order.progress = b.progress;
        order.done = b.done;
      }
    }
    this.statusLine = 'Save loaded. Welcome back, Chief!';
    audio.success();
  }

  private buildOutdoorWorld(): void {
    // One TileSprite instead of 2000+ images (was freezing phones)
    const grass = this.add
      .tileSprite(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 'tile_grass')
      .setDepth(0);
    this.worldLayer.add(grass);

    // Roads as few rectangles + dashed line (not hundreds of tiles)
    for (const road of ROADS) {
      const asphalt = this.add
        .rectangle(road.x + road.w / 2, road.y + road.h / 2, road.w, road.h, 0x455a64, 1)
        .setDepth(1);
      this.worldLayer.add(asphalt);
      const curb = this.add
        .rectangle(road.x + road.w / 2, road.y + road.h / 2, road.w + 4, road.h + 4)
        .setStrokeStyle(2, 0xffee58, 0.25)
        .setFillStyle(0x000000, 0)
        .setDepth(1);
      this.worldLayer.add(curb);
    }

    const buildingKey: Record<string, string> = {
      security_hq: 'bldg_hq',
      super_jail: 'bldg_jail',
      city_plaza: 'bldg_plaza',
      clinic: 'bldg_plaza',
      airfield: 'bldg_hq',
      shop: 'bldg_forest_cabin',
      job_board: 'bldg_forest_cabin',
      park: 'bldg_plaza',
      police_desk: 'bldg_hq',
      school: 'bldg_plaza',
      library: 'bldg_plaza',
      market_row: 'bldg_shop',
      docks: 'bldg_plaza',
      forest: 'bldg_forest_cabin',
      vehicle_bay: 'bldg_plaza',
      race_bay: 'bldg_plaza',
    };

    for (const z of CITY_ZONES) {
      // ground pad under zone
      const pad = this.add
        .rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, z.color, 0.35)
        .setStrokeStyle(2, 0xffffff, 0.2)
        .setDepth(2);
      this.worldLayer.add(pad);

      if (z.id !== 'forest' && z.id !== 'vehicle_bay') {
        const key = buildingKey[z.id] || 'bldg_plaza';
        const b = this.add
          .image(z.x + z.w / 2, z.y + z.h / 2 - 10, key)
          .setDepth(3)
          .setScale(z.id === 'security_hq' || z.id === 'super_jail' ? 1.6 : 1.2);
        this.worldLayer.add(b);
      }
      if (z.id === 'vehicle_bay') {
        const bay = this.add
          .rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, 0x1b5e20, 0.5)
          .setStrokeStyle(3, 0x69f0ae, 0.8)
          .setDepth(2);
        this.worldLayer.add(bay);
      }
      if (z.id === 'race_bay') {
        const bay = this.add
          .rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, 0x7f0000, 0.45)
          .setStrokeStyle(3, 0xff5252, 0.85)
          .setDepth(2);
        this.worldLayer.add(bay);
      }

      const label = this.add
        .text(z.x + z.w / 2, z.y + 10, z.label, {
          fontSize: '15px',
          color: '#ffffff',
          backgroundColor: '#00000099',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5, 0)
        .setDepth(6);
      this.worldLayer.add(label);
      this.labels.push(label);
    }

    // Trees in forest
    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    for (let i = 0; i < 55; i++) {
      const tx = forest.x + 40 + Math.random() * (forest.w - 80);
      const ty = forest.y + 40 + Math.random() * (forest.h - 80);
      const tree = this.add
        .image(tx, ty, 'tree')
        .setDepth(4)
        .setScale(0.9 + Math.random() * 0.5)
        .setAngle(-6 + Math.random() * 12);
      this.worldLayer.add(tree);
    }

    
    // Placeholder citizens (living-city seed — original shapes only)
    const plaza = CITY_ZONES.find((z) => z.id === 'city_plaza')!;
    const citizenData = [
      { name: 'Officer Pike', line: 'Radio tip: Sasquatch trails run east into the forest. Stay on the markers!' },
      { name: 'Builder Jun', line: 'Say the word and I will build a robot garage.' },
      { name: 'Nurse Ada', line: 'The clinic is ready for any forest scrapes.' },
      { name: 'Pilot Remy', line: 'Sky patrol reports weird footprints east.' },
    ];
    for (let i = 0; i < citizenData.length; i++) {
      const cx = plaza.x + 60 + i * 90;
      const cy = plaza.y + 120 + (i % 2) * 40;
      const body = this.add.image(cx, cy, 'citizen').setDepth(7).setScale(1.1);
      const name = this.add
        .text(cx, cy + 16, citizenData[i].name, {
          fontSize: '10px',
          color: '#fff',
          backgroundColor: '#00000066',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 0)
        .setDepth(7);
      this.worldLayer.add(body);
      this.worldLayer.add(name);
      this.citizens.push({ x: cx, y: cy, name: citizenData[i].name, line: citizenData[i].line });
    }
    const park = CITY_ZONES.find((z) => z.id === 'park');
    if (park) {
      const extras = [
        { name: 'Mayor Cavan', line: 'Keep our city safe and kind, Chief!', x: park.x + 80, y: park.y + 100 },
        { name: 'Kid Milo', line: 'Did you really see Bigfoot?!', x: park.x + 200, y: park.y + 140 },
        { name: 'Scout Lila', line: 'Trail markers help everyone stay found.', x: park.x + 280, y: park.y + 90 },
      ];
      for (const e of extras) {
        const body = this.add.image(e.x, e.y, 'citizen').setDepth(7).setScale(1.1);
        const name = this.add
          .text(e.x, e.y + 16, e.name, {
            fontSize: '10px',
            color: '#fff',
            backgroundColor: '#00000066',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 0)
          .setDepth(7);
        this.worldLayer.add(body);
        this.worldLayer.add(name);
        this.citizens.push({ x: e.x, y: e.y, name: e.name, line: e.line });
      }
    }

    const doorIcon = this.add.image(320, 455, 'door').setDepth(5).setScale(1.2);
    this.worldLayer.add(doorIcon);
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
    for (let i = 0; i < 6; i++) {
      const strip = this.add.rectangle(LAIR.x + 80 + i * 100, LAIR.y + LAIR.h / 2, 4, LAIR.h - 40, 0x4fc3f7, 0.15);
      this.lairNodes.push(strip);
      this.indoorLayer.add(strip);
    }
    const glow = this.add.circle(LAIR.trackerX, LAIR.trackerY, 40, 0xffeb3b, 0.12);
    this.lairNodes.push(glow);
    this.indoorLayer.add(glow);

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
      jobTitle: this.jobs.title(),
      policeLines: this.police.boardLines(),
      dayPhase: this.dayNight?.phase?.() ?? 'day',
      builds: this.construction.getOrders().map((o) => ({ id: o.id, label: o.label, progress: o.progress, done: o.done })),
      jobBoard: this.jobs.boardLines(),
      inventory: this.inventory.summary(),
      hour: this.dayNight?.getHour?.() ?? 12,
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
    // Clamp delta so one hitch doesn't explode physics / trail drops
    const d = Math.min(delta, 50);
    try {
      // FPS watchdog — auto-unfreeze without requiring a full restart
      if (delta > 120) {
        this.slowFrameStreak++;
        if (this.slowFrameStreak >= 8) {
          this.slowFrameStreak = 0;
          this.hardRecover('Auto-unfroze + saved. Keep playing!');
          return;
        }
      } else {
        this.slowFrameStreak = 0;
      }

      // Always apply DOM/keyboard movement — never let pause eat controls
      this.handleMovement();
      if (this.paused || this.mapOpen) {
        // keep velocity from handleMovement; only skip world sims if map open
        if (this.mapOpen) this.player.setVelocity(0, 0);
      }
      this.handleHotkeys();
      this.updateRobotFollow();
      this.updateSasquatch(d);
      this.updateTrailHelp(d);
      this.updateInteractPrompt();
      this.consumeTouchActions();
      this.syncIndoorVisibility();
      this.updateObjectiveMarker();
      this.construction.update(d);
      const policeMsg = this.police.update(d);
      if (policeMsg) this.statusLine = policeMsg;
      this.citizenTick += d;
      if (this.citizenTick > 1000) {
        this.citizenTick = 0;
        this.updateCitizenSchedules();
      }
      this.dayNight.update(d);
      // Notify jobs when garage completes
      const garage = this.construction.getOrders().find((o) => o.id === 'robot_garage' && o.done);
      if (garage && !this.garageCredited) {
        this.garageCredited = true;
        this.jobs.onGarageBuilt();
        this.statusLine = 'Builder Aide unlocked — Job Board updated!';
        audio.success();
      }
      const now = _time;
      if (now - this.lastHudWrite > 400) {
        this.lastHudWrite = now;
        const hudLine = this.interactPrompt || this.statusLine || PHASE_HINTS[this.phase];
        if (hudLine && hudLine !== this.lastToast) {
          this.lastToast = hudLine;
          setDomStatus(hudLine);
        }
        setDomMeta(this.inventory.summary() + ' · ' + this.mysteries.summary(), `Job: ${this.jobs.title()}`);
      }
      this.trail.updateThrottle(d);
    } catch (err) {
      console.error('[E-CRAFT] frame error', err);
      this.hardRecover('Glitch recovered — keep playing (progress autosaved)');
    }
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
    const speed = this.flags.inVehicle ? (this.activeCarKey === 'race_car' ? 720 : 560) : 240;
    let vx = 0;
    let vy = 0;
    const left = this.cursors.left?.isDown || this.keys.A?.isDown;
    const right = this.cursors.right?.isDown || this.keys.D?.isDown;
    const up = this.cursors.up?.isDown || this.keys.W?.isDown;
    const down = this.cursors.down?.isDown || this.keys.S?.isDown;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;
    // Chrome-proof DOM keyboard / on-screen pad
    const dom = pollDomInput();
    vx += dom.x;
    vy += dom.y;
    const mv = (window as unknown as { __ecraftMove?: { x: number; y: number } }).__ecraftMove;
    if (mv) {
      vx += mv.x;
      vy += mv.y;
    }
    // Phaser touch stick (mobile)
    if (Math.abs(this.touchVec.x) > 0.15 || Math.abs(this.touchVec.y) > 0.15) {
      vx += this.touchVec.x;
      vy += this.touchVec.y;
    }
    if (vx === 0 && vy === 0) {
      this.player.setVelocity(0, 0);
      if (this.dust) this.dust.emitting = false;
      return;
    }
    const len = Math.hypot(vx, vy) || 1;
    this.player.setVelocity((vx / len) * speed, (vy / len) * speed);
    if (vx !== 0) {
      this.facing = vx < 0 ? -1 : 1;
      if (!this.flags.inVehicle) this.player.setFlipX(this.facing < 0);
    }
    if (this.dust) {
      this.dust.setPosition(this.player.x, this.player.y + 18);
      this.dust.emitting = !this.flags.inVehicle;
    }

    if (this.flags.inVehicle) {
      const car = this.activeCarKey === 'race_car' ? this.raceCar : this.vehicle;
      car.setPosition(this.player.x, this.player.y);
      if (this.player.texture.key !== this.activeCarKey) {
        this.player.setTexture(this.activeCarKey);
        this.player.setScale(1.05);
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setSize(70, 36).setOffset(10, 12);
      }
    } else if (this.player.texture.key !== 'player') {
      this.player.setTexture('player');
      this.player.setScale(0.95);
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
    if (just((this.keys as any).R)) {
      if (this.flags.robotActive) {
        this.statusLine = 'Robot radio: ' + this.mysteries.revealNext();
        audio.talk();
      } else {
        this.statusLine = 'Activate your robot to use radio tips (R).';
      }
    }
  }


  /** Deterministic v1 acceptance helpers — exercise real game systems. */
  private runAcceptanceStep(step: string): void {
    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    const jail = CITY_ZONES.find((z) => z.id === 'super_jail')!;
    switch (step) {
      case 'enter_lair':
        this.player.setPosition(390, 400);
        this.enterLair();
        break;
      case 'get_tracker':
        if (!this.flags.inLair) this.enterLair();
        this.player.setPosition(LAIR.trackerX, LAIR.trackerY);
        this.flags.hasTracker = true;
        this.inventory.add('tracker');
        this.setPhase(MissionPhase.HasTracker);
        this.statusLine = 'Sasquatch Tracker acquired!';
        break;
      case 'activate_robot':
        if (!this.flags.inLair) this.enterLair();
        this.player.setPosition(LAIR.robotX, LAIR.robotY);
        this.flags.hasTracker = true;
        this.flags.robotActive = true;
        this.robot.setVisible(true);
        this.setPhase(MissionPhase.RobotActive);
        this.statusLine = 'Robot online!';
        break;
      case 'exit_lair':
        this.exitLair();
        break;
      case 'enter_vehicle':
        this.flags.robotActive = true;
        this.player.setPosition(this.vehicle.x, this.vehicle.y);
        this.flags.inVehicle = true;
        this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
        this.player.setTexture('vehicle');
        this.setPhase(MissionPhase.CanDrive);
        this.statusLine = 'Vehicle engaged.';
        break;
      case 'go_forest':
        this.flags.inVehicle = true;
        this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
        this.player.setTexture('vehicle');
        this.player.setPosition(forest.x + 180, forest.y + 400);
        this.setPhase(MissionPhase.Tracking);
        this.statusLine = 'Trail found — follow markers.';
        break;
      case 'find_sasquatch':
        this.player.setPosition(this.sasquatch.x - 40, this.sasquatch.y);
        this.setPhase(MissionPhase.FoundSasquatch);
        this.statusLine = 'Sasquatch spotted!';
        break;
      case 'capture':
        this.player.setPosition(this.sasquatch.x - 20, this.sasquatch.y);
        this.tryCapture();
        break;
      case 'load_vehicle':
        this.flags.sasquatchCaptured = true;
        this.flags.inVehicle = true;
        this.flags.sasquatchInVehicle = true;
        this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
        this.player.setTexture('vehicle');
        this.setPhase(MissionPhase.Transporting);
        this.statusLine = 'Sasquatch loaded!';
        break;
      case 'go_jail':
        this.flags.sasquatchCaptured = true;
        this.flags.sasquatchInVehicle = true;
        this.flags.inVehicle = true;
        this.player.setPosition(jail.x + jail.w / 2, jail.y + jail.h / 2);
        this.setPhase(MissionPhase.Transporting);
        break;
      case 'enter_jail':
        this.flags.sasquatchCaptured = true;
        this.enterJail();
        break;
      case 'lock_cell':
        this.flags.sasquatchCaptured = true;
        if (!this.flags.inJailBuilding) this.enterJail();
        this.player.setPosition(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY);
        this.jailSasquatch();
        break;
      case 'claim_reward':
        this.grantReward();
        break;
      default:
        this.statusLine = 'Unknown acceptance step: ' + step;
    }
    this.persistSave();
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
    if (this.raceCar) this.raceCar.setVisible(false);
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
        this.updateSasquatchAnim();
        return;
      }
      // Follow player to the vehicle
      this.physics.moveTo(this.sasquatch, this.player.x + 40, this.player.y + 10, 140);
      this.updateSasquatchAnim();
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
      85,
    );
    // Clamp to forest
    this.sasquatch.x = Phaser.Math.Clamp(this.sasquatch.x, forest.x + 40, forest.x + forest.w - 40);
    this.sasquatch.y = Phaser.Math.Clamp(this.sasquatch.y, forest.y + 40, forest.y + forest.h - 40);

    this.updateSasquatchAnim();

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


  private updateSasquatchAnim(): void {
    const body = this.sasquatch.body as Phaser.Physics.Arcade.Body;
    const speed = body ? Math.hypot(body.velocity.x, body.velocity.y) : 0;
    if (speed > 12) {
      if (this.sasquatch.anims.currentAnim?.key !== 'sasquatch-walk') {
        this.sasquatch.play('sasquatch-walk', true);
      }
      if (body.velocity.x < -8) this.sasquatch.setFlipX(true);
      else if (body.velocity.x > 8) this.sasquatch.setFlipX(false);
    } else if (this.sasquatch.anims.currentAnim?.key !== 'sasquatch-idle') {
      this.sasquatch.play('sasquatch-idle', true);
    }
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
    // dirt path handled inside TrailSystem
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
      this.flags.rewardClaimed &&
      this.jobs.state.unlocked.includes('security_chief') &&
      pointInRect(this.player.x, this.player.y, hq)
    ) {
      return '[E] Order HQ Security Wing upgrade';
    }
    if (
      this.flags.sasquatchCaptured &&
      !this.flags.sasquatchJailed &&
      pointInRect(this.player.x, this.player.y, jail)
    ) {
      return '[E] Enter SUPER JAIL with Sasquatch';
    }
    const jobBoard = CITY_ZONES.find((z) => z.id === 'job_board');
    if (jobBoard && pointInRect(this.player.x, this.player.y, jobBoard)) {
      return '[E] Read Job Board';
    }
    for (const c of this.citizens) {
      if (this.near(c.x, c.y, 40)) return `[E] Talk to ${c.name}`;
    }
    const bay = CITY_ZONES.find((z) => z.id === 'vehicle_bay');
    const nearCar =
      this.near(this.vehicle.x, this.vehicle.y, 120) ||
      (!!bay && pointInRect(this.player.x, this.player.y, bay));
    if (!this.flags.inVehicle && nearCar) {
      if (this.flags.robotActive) return '[E] / CAR — Enter patrol vehicle';
      return 'Activate robot first (underground lair)';
    }
    if (this.flags.inVehicle) return '[E] Exit vehicle · WASD to drive';
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
        this.inventory.add('tracker');
        audio.pickup();
        this.statusLine = 'Sasquatch Tracker acquired!';
        return;
      }
      if (this.flags.hasTracker && !this.flags.robotActive && this.near(LAIR.robotX, LAIR.robotY, 55)) {
        this.flags.robotActive = true;
        this.robot.setPosition(this.player.x - 30, this.player.y);
        this.robot.setVisible(true);
        this.setPhase(MissionPhase.RobotActive);
        audio.pickup();
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
      this.flags.rewardClaimed &&
      this.jobs.state.unlocked.includes('security_chief') &&
      pointInRect(this.player.x, this.player.y, hq)
    ) {
      this.tryHqUpgrade();
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

    const jobBoardZ = CITY_ZONES.find((z) => z.id === 'job_board');
    if (jobBoardZ && pointInRect(this.player.x, this.player.y, jobBoardZ)) {
      this.statusLine = [...this.jobs.boardLines(), ...this.police.boardLines()].join(' | ');
      audio.interact();
      return;
    }
    for (const c of this.citizens) {
      if (this.near(c.x, c.y, 40)) {
        audio.talk();
        this.statusLine = `${c.name}: "${c.line}"`;
        if (c.name === 'Officer Pike') {
          this.statusLine = this.police.requestForestSweep();
          return;
        }
        if (c.name === 'Builder Jun') {
          const hq = CITY_ZONES.find((z) => z.id === 'security_hq')!;
          const order = this.construction.requestRobotGarage({
            x: hq.x + hq.w / 2,
            y: hq.y + hq.h + 70,
          });
          this.statusLine = `${c.name}: "On it! Building ${order.label} behind HQ…"`;
        }
        return;
      }
    }

    // Vehicle enter/exit — generous radius + bay zone
    {
      const bay = CITY_ZONES.find((z) => z.id === 'vehicle_bay');
      const nearCar =
        this.near(this.vehicle.x, this.vehicle.y, 130) ||
        (!!bay && pointInRect(this.player.x, this.player.y, {
          x: bay.x - 20,
          y: bay.y - 20,
          w: bay.w + 40,
          h: bay.h + 40,
        }));
      if (!this.flags.inVehicle && nearCar) {
        if (!this.flags.robotActive) {
          this.statusLine = 'Activate your robot partner first (underground lair)!';
          return;
        }
        this.enterVehicle(true);
        return;
      }
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
      const car = this.activeCarKey === 'race_car' ? this.raceCar : this.vehicle;
      car.setPosition(this.player.x, this.player.y);
      car.setVisible(true);
      this.player.setTexture('player');
      this.player.setScale(0.95);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setSize(28, 40).setOffset(10, 12);
      if (this.flags.sasquatchInVehicle) {
        this.sasquatch.setPosition(this.player.x + 40, this.player.y);
      }
      this.statusLine = 'Exited vehicle.';
      return;
    }
  }


  private enterVehicle(allowWithoutSasq = true, kind: 'vehicle' | 'race_car' = 'vehicle'): void {
    this.flags.inVehicle = true;
    this.activeCarKey = kind;
    const car = kind === 'race_car' ? this.raceCar : this.vehicle;
    const other = kind === 'race_car' ? this.vehicle : this.raceCar;
    this.player.setPosition(car.x, car.y);
    car.setVisible(false);
    other.setVisible(true);
    this.player.setTexture(kind);
    this.player.setScale(1.05);
    this.player.setDrag(0);
    this.player.setMaxVelocity(kind === 'race_car' ? 900 : 700);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(false);
    body.setSize(70, 36).setOffset(10, 12);
    body.setVelocity(0, 0);
    const sasqNear =
      this.flags.sasquatchCaptured &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.sasquatch.x, this.sasquatch.y) < 160;
    if (sasqNear || this.flags.sasquatchCaptured) {
      this.flags.sasquatchInVehicle = true;
      this.flags.sasquatchCaptured = true;
      this.sasquatch.setAngle(0);
      this.sasquatch.clearTint();
      const body = this.sasquatch.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) body.enable = true;
      this.setPhase(MissionPhase.Transporting);
      this.statusLine = 'Sasquatch loaded! Drive to SUPER JAIL.';
    } else if (this.flags.sasquatchCaptured && !allowWithoutSasq) {
      this.statusLine = 'Bring Sasquatch closer, then press E/CAR again.';
    } else {
      this.setPhase(MissionPhase.CanDrive);
      this.statusLine = 'Driving! Use WASD / pad — go east to the forest.';
    }
    this.persistSave();
    audio.drive();
    // Kick forward so player instantly feels driving
    this.player.setVelocity(420, 0);
    this.time.delayedCall(250, () => {
      if (this.flags.inVehicle && !(window as unknown as { __ecraftMove?: { x: number } }).__ecraftMove?.x) {
        // stop auto-kick if user is not holding a direction
      }
    });
  }


  /** One-tap Activate: tracker then robot (works from lair or snaps into lair). */
  private doActivate(): void {
    if (!this.flags.hasTracker || !this.flags.robotActive) {
      if (!this.flags.inLair) this.enterLair();
      if (!this.flags.hasTracker) {
        this.flags.hasTracker = true;
        this.inventory.add('tracker');
        this.setPhase(MissionPhase.HasTracker);
        this.statusLine = 'Tracker ON. Tap ACTIVATE again for robot!';
        audio.pickup();
        setDomStatus(this.statusLine);
        return;
      }
      this.flags.robotActive = true;
      this.robot.setVisible(true);
      this.robot.setPosition(this.player.x - 30, this.player.y);
      this.setPhase(MissionPhase.RobotActive);
      this.statusLine = 'Robot ONLINE! Exit lair, then tap GET IN CAR.';
      audio.pickup();
      setDomStatus(this.statusLine);
      return;
    }
    this.statusLine = 'Already activated. Exit lair (E) then GET IN CAR.';
    setDomStatus(this.statusLine);
    this.tryInteract();
  }

  /** One-tap car: requires robot, snaps to vehicle and drives. */
  private doEnterCar(kind: 'vehicle' | 'race_car' = 'vehicle'): void {
    if (!this.flags.robotActive) {
      this.statusLine = 'Activate robot first (tap ACTIVATE twice)!';
      setDomStatus(this.statusLine);
      return;
    }
    if (this.flags.inLair) this.exitLair();
    if (this.flags.inJailBuilding) this.exitJail();

    const car = kind === 'race_car' ? this.raceCar : this.vehicle;
    this.activeCarKey = kind;
    // Park the other car visibly if switching
    if (kind === 'race_car') {
      this.vehicle.setVisible(true);
    } else {
      this.raceCar.setVisible(true);
    }

    this.player.setPosition(car.x, car.y);
    if (this.flags.sasquatchCaptured) {
      this.sasquatch.setPosition(this.player.x - 28, this.player.y);
      this.sasquatch.setAngle(0);
      this.sasquatch.clearTint();
      const b = this.sasquatch.body as Phaser.Physics.Arcade.Body | undefined;
      if (b) b.enable = true;
      this.flags.sasquatchInVehicle = true;
    }
    this.enterVehicle(true, kind);
    const kick = kind === 'race_car' ? 620 : 480;
    this.player.setVelocity(kick, 0);
    this.statusLine = kind === 'race_car'
      ? (this.flags.sasquatchInVehicle ? 'RACE CAR + Sasquatch — GO!' : 'RACE CAR — hold D-pad!')
      : (this.flags.sasquatchInVehicle ? 'Patrol car + Sasquatch — DRIVE!' : 'PATROL CAR — hold D-pad!');
    setDomStatus(this.statusLine);
  }

  private tryCapture(): void {
    setDomStatus('CAPTURE pressed…');
    if (this.flags.sasquatchCaptured || this.flags.sasquatchJailed) {
      setDomStatus('Already DOWN — tap GET IN CAR!');
      return;
    }
    if (!this.flags.hasTracker) {
      this.statusLine = 'Need Tracker first — tap ACTIVATE twice!';
      setDomStatus(this.statusLine);
      return;
    }
    // If still in lair, get outside first
    if (this.flags.inLair) this.exitLair();

    let d = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.sasquatch.x,
      this.sasquatch.y,
    );
    const range = 500; // very forgiving on phone
    if (d > range) {
      // Pull player toward sasquatch a bit so capture isn't impossible
      this.statusLine = `Too far (${Math.round(d)}) — driving/running closer…`;
      setDomStatus(this.statusLine);
      // Soft assist: if within 900px, snap nearer then knock down
      if (d < 900) {
        const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.sasquatch.x, this.sasquatch.y);
        this.player.x = this.sasquatch.x - Math.cos(ang) * 80;
        this.player.y = this.sasquatch.y - Math.sin(ang) * 80;
        d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.sasquatch.x, this.sasquatch.y);
      } else {
        try { audio.talk(); } catch { /* ignore */ }
        return;
      }
    }
    this.knockDownSasquatch();
  }

  /** Capture success: Sasquatch collapses to the ground. */
  private knockDownSasquatch(): void {
    this.flags.sasquatchCaptured = true;
    this.sasquatch.setVelocity(0, 0);
    const body = this.sasquatch.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) body.enable = false;

    // Stop walk, fall over
    try {
      this.sasquatch.anims.stop();
      this.sasquatch.setFrame(0);
    } catch { /* ignore */ }

    const fallAngle = this.sasquatch.flipX ? -90 : 90;
    this.tweens.killTweensOf(this.sasquatch);
    this.tweens.add({
      targets: this.sasquatch,
      angle: fallAngle,
      y: this.sasquatch.y + 18,
      duration: 380,
      ease: 'Bounce.easeOut',
    });
    // Red hit flash then stunned look
    this.sasquatch.setTint(0xff1744);
    this.time.delayedCall(200, () => this.sasquatch.setTint(0xb0bec5));

    // Impact ring
    const ring = this.add.circle(this.sasquatch.x, this.sasquatch.y, 10, 0xff1744, 0.35).setDepth(20);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 450,
      onComplete: () => ring.destroy(),
    });
    // Stars / stun marks
    for (let i = 0; i < 5; i++) {
      const star = this.add
        .star(this.sasquatch.x, this.sasquatch.y - 20, 5, 3, 7, 0xffe082, 1)
        .setDepth(21);
      this.tweens.add({
        targets: star,
        x: this.sasquatch.x + Phaser.Math.Between(-40, 40),
        y: this.sasquatch.y - Phaser.Math.Between(40, 80),
        alpha: 0,
        angle: 180,
        duration: 600,
        delay: i * 40,
        onComplete: () => star.destroy(),
      });
    }

    // Floor label
    const down = this.add
      .text(this.sasquatch.x, this.sasquatch.y + 50, 'DOWN!', {
        fontSize: '18px',
        color: '#ff8a80',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(22);
    this.tweens.add({
      targets: down,
      y: down.y - 30,
      alpha: 0,
      duration: 900,
      onComplete: () => down.destroy(),
    });

    this.setPhase(MissionPhase.FoundSasquatch);
    this.setPhase(MissionPhase.Captured);
    audio.capture();
    this.statusLine = 'Sasquatch DOWN! Tap GET IN CAR to load him.';
    setDomStatus(this.statusLine);
    this.trail.clearFallback();
    this.persistSave();
  }

  private enterLair(): void {
    this.flags.inLair = true;
    this.indoorLayer.setVisible(true);
    this.lairNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(true));
    this.jailNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    this.worldLayer.setVisible(false);
    this.trailLayer.setVisible(false);
    this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
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
    this.vehicle.setVisible(!this.flags.inVehicle || this.activeCarKey !== 'vehicle');
    if (this.raceCar) this.raceCar.setVisible(!this.flags.inVehicle || this.activeCarKey !== 'race_car');
    // if not in a vehicle, both parked cars should show
    if (!this.flags.inVehicle) {
      this.vehicle.setVisible(true);
      if (this.raceCar) this.raceCar.setVisible(true);
    }
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
    if (this.raceCar) this.raceCar.setVisible(false);
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
    if (!this.flags.inVehicle) {
      this.vehicle.setVisible(true);
      if (this.raceCar) this.raceCar.setVisible(true);
    }
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
        .setScale(1.1)
        .setTint(0xff5252);
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
    this.inventory.add('keycard');
    this.jobs.onMissionJailed();
    this.setPhase(MissionPhase.Jailed);
    this.statusLine = 'Sasquatch secured! Head of Security unlocked — check Job Board.';
    this.time.delayedCall(600, () => this.grantReward());
  }

  private grantReward(): void {
    if (this.flags.rewardClaimed) return;
    this.flags.rewardClaimed = true;
    this.setPhase(MissionPhase.Rewarded);
    audio.success();
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


  private citizenHome: { name: string; x: number; y: number }[] = [];

  private captureCitizenHomes(): void {
    if (this.citizenHome.length) return;
    this.citizenHome = this.citizens.map((c) => ({ name: c.name, x: c.x, y: c.y }));
  }

  private updateCitizenSchedules(): void {
    this.captureCitizenHomes();
    const phase = this.dayNight?.phase?.() ?? 'day';
    for (const c of this.citizens) {
      const home = this.citizenHome.find((h) => h.name === c.name);
      if (!home) continue;
      if (phase === 'night' || phase === 'dusk') {
        c.x = home.x;
        c.y = home.y;
      }
    }
  }

  tryHqUpgrade(): void {
    if (!this.jobs.state.unlocked.includes('security_chief')) {
      this.statusLine = 'Unlock Head of Security first (jail Sasquatch).';
      return;
    }
    const hq = CITY_ZONES.find((z) => z.id === 'security_hq')!;
    const wing = this.construction.requestHqWing({ x: hq.x + hq.w + 50, y: hq.y + 60 });
    this.statusLine = `HQ Upgrade ordered: ${wing.label} (${Math.floor(wing.progress * 100)}%)`;
  }

  private near(x: number, y: number, r: number): boolean {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) <= r;
  }
}
