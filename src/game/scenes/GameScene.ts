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
import { PantherSystem } from '../systems/PantherSystem';
import { PigDropSystem } from '../systems/PigDropSystem';
import { PatrolCarsSystem } from '../systems/PatrolCarsSystem';
import { CraftBuildSystem } from '../systems/CraftBuildSystem';
import { audio } from '../systems/AudioSystem';
import { loadGame, saveGame } from '../systems/SaveSystem';
import { pollDomInput, setDomStatus, setDomMeta } from '../../ui/domOverlay';
import {
  CITY_ZONES,
  CROSSWALKS,
  HOUSE_INTERIOR,
  INTERSECTIONS,
  JAIL_INTERIOR,
  LAIR,
  ROADS,
  SPAWN,
  WORLD,
  pointInRect,
} from '../world/WorldLayout';
import {
  CIVIC_INTERIOR,
  CIVIC_THEMES,
  getEnterable,
  listEnterableBuildings,
  type EnterableBuilding,
} from '../world/BuildingCatalog';

type TouchVec = { x: number; y: number };

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private robot!: Phaser.Physics.Arcade.Sprite;
  private vehicle!: Phaser.Physics.Arcade.Sprite;
  private raceCar!: Phaser.Physics.Arcade.Sprite;
  private activeCarKey: 'vehicle' | 'race_car' | 'police_car' = 'vehicle';
  private claimedPatrolIndex: number | null = null;
  private jailedLabel?: Phaser.GameObjects.Text;
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
    inHouse: false,
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
  private houseNodes: Phaser.GameObjects.GameObject[] = [];
  private civicNodes: Phaser.GameObjects.GameObject[] = [];
  /** Non-special building currently entered (clinic/shop/…). */
  private civicId: string | null = null;
  private civicTitle?: Phaser.GameObjects.Text;
  private civicTip?: Phaser.GameObjects.Text;
  private civicWall?: Phaser.GameObjects.Rectangle;
  private civicShell?: Phaser.GameObjects.Rectangle;
  private civicPropA?: Phaser.GameObjects.Text;
  private civicPropB?: Phaser.GameObjects.Text;
  private civicPropC?: Phaser.GameObjects.Text;
  private sleeping = false;
  private lyingInBed = false;
  private tvOn = false;
  private craftBuild!: CraftBuildSystem;
  private houseTv?: Phaser.GameObjects.Image;
  private houseTvScreen?: Phaser.GameObjects.Image;
  private houseKitchen?: Phaser.GameObjects.Image;
  private houseBed?: Phaser.GameObjects.Image;
  private houseFood?: Phaser.GameObjects.Image;
  private cookedMeal = false;
  /** Close to Sasquatch → Siren Head horror form. */
  private sasquatchSirenMode = false;
  /** Flattened by a police car — can't move until recovered. */
  private flattened = false;
  private flattenInvuln = 0;
  private bloodPool?: Phaser.GameObjects.Image;
  private objectiveMarker!: ObjectiveMarker;
  /** Animated traffic lights at intersections */
  private trafficSignals: Array<{
    red: Phaser.GameObjects.Arc;
    yellow: Phaser.GameObjects.Arc;
    green: Phaser.GameObjects.Arc;
    offset: number;
  }> = [];
  private trafficTick = 0;
  private outdoorDoors: Record<string, Phaser.GameObjects.Image> = {};
  private doorBusy = false;
  private citizens: { x: number; y: number; name: string; line: string }[] = [];
  private construction!: ConstructionSystem;
  private dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  private dayNight!: DayNightSystem;
  private panther!: PantherSystem;
  private pigDrop!: PigDropSystem;
  private patrolCars!: PatrolCarsSystem;
  private jobs = new JobSystem();
  private inventory = new InventorySystem();
  private facing = 1; // -1 left, 1 right (for side flip + tracker)
  /** Exact walk facing — always matches movement direction. */
  private facingDir: 'left' | 'right' | 'up' | 'down' = 'right';
  private lastToast = '';
  private garageCredited = false;
  private mysteries = new MysterySystem();
  private police = new PoliceSystem();
  private slowFrameStreak = 0;
  private lastHudWrite = 0;
  private citizenTick = 0;
  private onVisSave?: () => void;
  /** Visible gadget in the player's hand when holding the tracker. */
  private heldTracker?: Phaser.GameObjects.Image;
  private trackerScanGfx?: Phaser.GameObjects.Graphics;
  private trackerArrow?: Phaser.GameObjects.Container;
  private trackerPedestal?: Phaser.GameObjects.Image;
  private trackerHeld = false;
  private trackerScanTick = 0;

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
    this.buildIndoorHouse();
    this.buildIndoorCivic();

    this.trail = new TrailSystem(this, this.trailLayer);
    this.objectiveMarker = new ObjectiveMarker(this);
    this.construction = new ConstructionSystem(this, this.worldLayer);

    this.player = this.physics.add.sprite(SPAWN.playerOutdoor.x, SPAWN.playerOutdoor.y, 'player_sheet', 0);
    this.player.setCollideWorldBounds(true).setDepth(10).setScale(1);
    this.player.setDrag(0);
    this.player.setMaxVelocity(700);
    this.player.body!.setSize(28, 44).setOffset(22, 20);
    this.player.setFlipX(false);
    this.facing = 1;
    this.facingDir = 'right';
    this.player.play('player-idle-side');

    this.robot = this.physics.add.sprite(SPAWN.playerOutdoor.x - 40, SPAWN.playerOutdoor.y, 'robot_sheet', 0);
    this.robot.setVisible(false).setDepth(9).setScale(0.95);
    this.robot.body!.enable = false;
    this.robot.play('robot-idle');

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
    // Classic Bigfoot proportions (taller sheet) — still near player scale
    this.sasquatch.setDepth(9).setCollideWorldBounds(true).setScale(0.92);
    this.sasquatch.body!.setSize(36, 56).setOffset(18, 22);
    this.sasquatch.play('sasquatch-idle'); // idle includes mouth moving
    this.pickSasquatchWander();
    // Seed a clear trail from forest entrance → Sasquatch (so tracking works on arrival)
    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    const trailStartX = forest.x + 80;
    const trailStartY = SPAWN.sasquatchForest.y;
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      this.trail.maybeDrop(
        Phaser.Math.Linear(trailStartX, SPAWN.sasquatchForest.x, t),
        Phaser.Math.Linear(trailStartY, SPAWN.sasquatchForest.y, t) + (i % 2) * 24,
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
    // Phone portrait: a bit more zoom so the world doesn't feel tiny
    const portrait = this.scale.height > this.scale.width;
    this.cameras.main.setZoom(portrait ? 1.35 : 1.15);
    this.cameras.main.setRoundPixels(true);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      const tall = gameSize.height > gameSize.width;
      this.cameras.main.setZoom(tall ? 1.35 : 1.15);
    });
    this.dayNight = new DayNightSystem(this, WORLD.width, WORLD.height);
    this.panther = new PantherSystem(this);
    this.pigDrop = new PigDropSystem(this);
    this.patrolCars = new PatrolCarsSystem(this);
    this.patrolCars.spawn();
    this.craftBuild = new CraftBuildSystem(this, this.worldLayer);
    this.craftBuild.bindPlayer(this.player);
    this.craftBuild.load();
    // Tap/click world to aim + place (Minecraft-style pointer build)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.craftBuild?.isMode() || this.flags.inVehicle || this.paused) return;
      // Ignore UI overlay taps (left/right chrome + hotbar band)
      if (pointer.x < 120 || pointer.x > this.scale.width - 120) return;
      if (pointer.y > this.scale.height - 200) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.craftBuild.aimAtWorld(world.x, world.y);
      if (pointer.rightButtonDown()) this.breakCraftBlock();
      else this.placeCraftBlock();
    });
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
      activateRobot: () => {
        this.paused = false;
        this.mapOpen = false;
        this.doActivateRobot();
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
      holdTracker: () => {
        this.paused = false;
        this.mapOpen = false;
        this.toggleHoldTracker();
      },
      sleep: () => {
        this.paused = false;
        this.mapOpen = false;
        this.doSleep();
      },
      enterHouse: () => {
        this.paused = false;
        this.mapOpen = false;
        this.doEnterHouse();
      },
      visitJail: () => {
        this.paused = false;
        this.mapOpen = false;
        this.doVisitJail();
      },
      toggleBuild: () => {
        this.paused = false;
        this.mapOpen = false;
        this.toggleBuildMode();
      },
      cycleBlock: () => {
        this.paused = false;
        this.mapOpen = false;
        this.cycleBuildBlock();
      },
      breakBlock: () => {
        this.paused = false;
        this.mapOpen = false;
        this.breakCraftBlock();
      },
      placeBlock: () => {
        this.paused = false;
        this.mapOpen = false;
        this.craftBuild.setMode(true);
        this.refreshBuildHotbar();
        this.placeCraftBlock();
      },
      selectBlock: (i: number) => {
        this.paused = false;
        this.mapOpen = false;
        this.craftBuild.select(i);
        this.craftBuild.setMode(true);
        this.statusLine = `Block: ${this.craftBuild.selectedName()} — PLACE / E / tap world · BREAK removes`;
        setDomStatus(this.statusLine);
        this.refreshBuildHotbar();
      },
      layBed: () => {
        this.paused = false;
        this.mapOpen = false;
        if (!this.flags.inHouse) this.enterHouse(true);
        if (this.lyingInBed) this.getOutOfBed();
        else this.layInBed();
      },
      pantherJump: () => {
        this.paused = false;
        this.mapOpen = false;
        if (this.isIndoors()) {
          this.statusLine = 'Go outside for the panther!';
          setDomStatus(this.statusLine);
          return;
        }
        this.panther.forceJump(this.player, (msg) => {
          this.statusLine = msg;
          setDomStatus(msg);
          audio.talk();
        });
      },
      pigDrop: () => {
        this.paused = false;
        this.mapOpen = false;
        if (this.isIndoors()) {
          this.statusLine = 'Go outside for the pig drop!';
          setDomStatus(this.statusLine);
          return;
        }
        this.pigDrop.forceDrop(this.player, (msg) => {
          this.statusLine = msg;
          setDomStatus(msg);
          audio.talk();
        });
      },
      forceFlatten: () => {
        this.paused = false;
        this.mapOpen = false;
        this.forceFlatten();
      },
      unflatten: () => {
        this.paused = false;
        this.mapOpen = false;
        this.unflattenPlayer('Back up!');
      },
      exitIndoor: () => {
        this.paused = false;
        this.mapOpen = false;
        if (this.flags.inHouse) {
          this.exitHouse();
          return;
        }
        if (this.flags.inLair) {
          this.exitLair();
          return;
        }
        if (this.flags.inJailBuilding) {
          this.exitJail();
          return;
        }
        if (this.civicId) {
          this.exitCivic();
          return;
        }
        this.statusLine = 'Already outside.';
        setDomStatus(this.statusLine);
      },
      enterBuilding: (id: string) => {
        this.paused = false;
        this.mapOpen = false;
        this.enterBuilding(id, true);
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
      if (this.flags.hasTracker) this.equipTracker(true);
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
    if (this.flattened) {
      this.unflattenPlayer('Got up after the police smash!');
      this.persistSave();
      return;
    }
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
    // Re-light trail if still holding tracker after trim
    if (this.trackerHeld) this.trail.setTracking(true);
    this.persistSave();
    setDomStatus(msg);
  }

  /** Pick up / hold the Sasquatch Tracker in hand and light the trail. */
  private equipTracker(silent = false): void {
    this.flags.hasTracker = true;
    this.trackerHeld = true;
    this.inventory.add('tracker');
    this.trail.setTracking(true);
    if (this.trackerPedestal) this.trackerPedestal.setVisible(false);

    if (!this.heldTracker) {
      this.heldTracker = this.add.image(0, 0, 'tracker').setDepth(14).setScale(0.7);
    }
    this.heldTracker.setVisible(!this.flags.inVehicle && !this.isIndoors());

    if (!this.trackerScanGfx) {
      this.trackerScanGfx = this.add.graphics().setDepth(13);
    }
    if (!this.trackerArrow) {
      const c = this.add.container(0, 0).setDepth(15);
      const shaft = this.add.triangle(0, 0, 0, -28, -10, 8, 10, 8, 0x00e676).setStrokeStyle(2, 0xffffff, 0.9);
      const tip = this.add
        .text(0, 18, 'HOLD', {
          fontSize: '10px',
          color: '#b9f6ca',
          backgroundColor: '#000000cc',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 0);
      c.add([shaft, tip]);
      this.trackerArrow = c;
    }
    this.trackerArrow.setVisible(true);

    if (!silent) {
      this.statusLine = 'HOLDING Sasquatch Tracker! Follow the glowing gold trail.';
      setDomStatus(this.statusLine);
    }
  }

  /** Phone button: always HOLD the tracker (never accidental double-tap holster). */
  private toggleHoldTracker(): void {
    if (!this.flags.inLair && !this.flags.hasTracker) this.enterLair();
    if (!this.flags.hasTracker || !this.trackerHeld) {
      this.equipTracker();
      if (this.phase === MissionPhase.AtSecurityHQ || this.phase === MissionPhase.InUndergroundLair) {
        this.setPhase(MissionPhase.HasTracker);
      }
      audio.pickup();
      return;
    }
    // Already holding — reinforce + re-light trail (idempotent for double pointer/click)
    this.equipTracker();
    this.statusLine = 'Still HOLDING Tracker — gold trail ON. Follow the arrow!';
    setDomStatus(this.statusLine);
  }

  private updateHeldTracker(delta: number): void {
    if (!this.trackerHeld || !this.flags.hasTracker) {
      if (this.heldTracker) this.heldTracker.setVisible(false);
      if (this.trackerArrow) this.trackerArrow.setVisible(false);
      if (this.trackerScanGfx) this.trackerScanGfx.clear();
      return;
    }
    if (this.isIndoors()) {
      if (this.heldTracker) this.heldTracker.setVisible(false);
      if (this.trackerArrow) this.trackerArrow.setVisible(false);
      if (this.trackerScanGfx) this.trackerScanGfx.clear();
      return;
    }

    const handX = this.player.x + this.facing * (this.flags.inVehicle ? 0 : 22);
    const handY = this.player.y + (this.flags.inVehicle ? -8 : 6);
    if (this.heldTracker) {
      this.heldTracker.setVisible(!this.flags.inVehicle);
      this.heldTracker.setPosition(handX, handY);
      this.heldTracker.setFlipX(this.facing < 0);
    }

    // Point at trail head (newest clue) or Sasquatch if close trail is done
    const latest = this.trail.latestClue();
    const nearTrail = this.trail.nearestUndiscovered(this.player.x, this.player.y);
    let tx = this.sasquatch.x;
    let ty = this.sasquatch.y;
    if (nearTrail && !this.flags.sasquatchCaptured) {
      tx = nearTrail.x;
      ty = nearTrail.y;
    } else if (latest && !this.flags.sasquatchCaptured) {
      tx = latest.x;
      ty = latest.y;
    }
    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, tx, ty);
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, tx, ty);

    if (this.trackerArrow) {
      this.trackerArrow.setVisible(true);
      this.trackerArrow.setPosition(
        this.player.x + Math.cos(ang) * 48,
        this.player.y + Math.sin(ang) * 48,
      );
      this.trackerArrow.setRotation(ang + Math.PI / 2);
    }

    // Pulse scan ring
    this.trackerScanTick += delta;
    if (this.trackerScanGfx) {
      this.trackerScanGfx.clear();
      const pulse = 40 + (this.trackerScanTick % 700) / 700 * 50;
      const strength = Phaser.Math.Clamp(1 - dist / 1400, 0.2, 1);
      this.trackerScanGfx.lineStyle(3, 0x69f0ae, 0.35 + strength * 0.5);
      this.trackerScanGfx.strokeCircle(this.player.x, this.player.y, pulse);
      this.trackerScanGfx.lineStyle(2, 0xffeb3b, 0.55);
      this.trackerScanGfx.lineBetween(
        this.player.x,
        this.player.y,
        this.player.x + Math.cos(ang) * Math.min(120, dist),
        this.player.y + Math.sin(ang) * Math.min(120, dist),
      );
    }
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
    this.flags = {
      ...this.flags,
      ...data.flags,
      inHouse: !!(data.flags as GameFlags).inHouse,
      inLair: false,
      inJailBuilding: !!(data.flags as GameFlags).inJailBuilding && !!(data.flags as GameFlags).sasquatchCaptured,
    };
    // Always wake up outdoors unless intentionally mid-jail transport
    if (this.flags.inHouse) this.flags.inHouse = false;
    this.player.setPosition(data.player.x, data.player.y);
    if (this.flags.robotActive) {
      this.robot.setTexture('robot_sheet', 0);
      this.syncRobotBesidePlayer();
      this.robot.setVisible(true);
      this.robot.play('robot-idle', true);
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

    this.buildLifelikeStreets();

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
      market_row: 'bldg_plaza',
      docks: 'bldg_plaza',
      forest: 'bldg_forest_cabin',
      vehicle_bay: 'bldg_plaza',
      race_bay: 'bldg_plaza',
      player_house: 'bldg_house',
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

      // Professional civic plaque + clean typography
      const signY = z.y + 14;
      const plaque = this.add
        .image(z.x + z.w / 2, signY + 12, 'bldg_sign')
        .setDepth(6)
        .setScale(Math.min(1.15, Math.max(0.75, z.w / 220)));
      const title = this.add
        .text(z.x + z.w / 2, signY + 4, z.label.toUpperCase(), {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: z.w > 300 ? '13px' : '11px',
          fontStyle: 'bold',
          color: '#fffde7',
          stroke: '#0d47a1',
          strokeThickness: 2,
          align: 'center',
        })
        .setOrigin(0.5, 0)
        .setDepth(7);
      const sub = this.add
        .text(z.x + z.w / 2, signY + 20, this.buildingSubtitle(z.id), {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '9px',
          color: '#90caf9',
          align: 'center',
        })
        .setOrigin(0.5, 0)
        .setDepth(7);
      this.worldLayer.add(plaque);
      this.worldLayer.add(title);
      this.worldLayer.add(sub);
      this.labels.push(title);
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

    // Every enterable building gets a working front door
    for (const b of listEnterableBuildings()) {
      const scale = b.kind === 'house' ? 1.2 : b.kind === 'lair' || b.kind === 'jail' ? 1.15 : 1.05;
      const frame = this.add.image(b.doorX, b.doorY - 8, 'door_frame').setDepth(4).setScale(scale);
      const door = this.add.image(b.doorX, b.doorY, 'door').setDepth(5).setScale(scale);
      this.outdoorDoors[b.id] = door;
      // Alias special doors for legacy openDoorThen keys
      if (b.kind === 'lair') this.outdoorDoors.hq = door;
      if (b.kind === 'house') this.outdoorDoors.house = door;
      if (b.kind === 'jail') this.outdoorDoors.jail = door;
      this.worldLayer.add(frame);
      this.worldLayer.add(door);
      const lblColor = b.kind === 'jail' ? '#ffcdd2' : '#ffe082';
      const lbl = this.add
        .text(b.doorX, b.doorY - 48, b.prompt, {
          fontSize: b.kind === 'lair' ? '13px' : '11px',
          color: lblColor,
          backgroundColor: '#00000099',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.worldLayer.add(lbl);
      if (b.kind === 'lair') this.hqDoorLabel = lbl;
    }
  }

  /** Swing the outdoor door open, then enter the building. */
  private openDoorThen(kind: string, enter: () => void): void {
    if (this.doorBusy) return;
    // Already inside that building — just run enter logic
    if (
      ((kind === 'hq' || kind === 'security_hq') && this.flags.inLair) ||
      ((kind === 'house' || kind === 'player_house') && this.flags.inHouse) ||
      ((kind === 'jail' || kind === 'super_jail') && this.flags.inJailBuilding) ||
      (this.civicId != null && (kind === this.civicId || this.outdoorDoors[kind] === this.outdoorDoors[this.civicId]))
    ) {
      enter();
      return;
    }

    const door =
      this.outdoorDoors[kind] ||
      (kind === 'hq' ? this.outdoorDoors.security_hq : undefined) ||
      (kind === 'house' ? this.outdoorDoors.player_house : undefined) ||
      (kind === 'jail' ? this.outdoorDoors.super_jail : undefined);
    if (!door) {
      enter();
      return;
    }

    this.doorBusy = true;
    this.paused = false;
    this.mapOpen = false;
    this.statusLine = 'Door opening…';
    setDomStatus(this.statusLine);
    audio.interact();

    const ox = door.x;
    const oy = door.y;
    const sc = door.scaleX;
    // Hinge on the left edge so it swings open
    door.setOrigin(0.05, 0.5);
    door.setPosition(ox - door.displayWidth * 0.45, oy);

    this.time.delayedCall(240, () => {
      if (door.active) door.setTexture('door_open');
    });
    this.tweens.add({
      targets: door,
      angle: -88,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        door.setTexture('door_open');
        this.time.delayedCall(160, () => {
          enter();
          // Reset door while player is indoors (world hidden)
          this.time.delayedCall(250, () => {
            if (door.active) {
              door.setTexture('door');
              door.setAngle(0);
              door.setOrigin(0.5, 0.5);
              door.setPosition(ox, oy);
              door.setScale(sc);
            }
            this.doorBusy = false;
          });
        });
      },
    });
  }

  /** Realistic asphalt streets with sidewalks, lamps, and traffic signals. */
  private buildingSubtitle(id: string): string {
    const map: Record<string, string> = {
      security_hq: 'CITY SECURITY · HQ',
      super_jail: 'MAXIMUM SECURITY',
      city_plaza: 'PUBLIC SQUARE',
      clinic: 'HEALTH SERVICES',
      airfield: 'SKY PATROL',
      shop: 'GEAR & SUPPLY',
      job_board: 'OPEN CONTRACTS',
      park: 'RECREATION',
      police_desk: 'DISPATCH',
      school: 'EDUCATION',
      library: 'ARCHIVES',
      market_row: 'RETAIL DISTRICT',
      docks: 'WATERFRONT',
      forest: 'RESTRICTED WOODS',
      vehicle_bay: 'FLEET PARKING',
      race_bay: 'HIGH-SPEED UNIT',
      player_house: 'PRIVATE RESIDENCE',
    };
    return map[id] || 'MUNICIPAL';
  }

  private buildLifelikeStreets(): void {
    this.trafficSignals = [];
    const sidewalkW = 28;

    for (const road of ROADS) {
      const horiz = road.w >= road.h;
      // Sidewalks both sides
      if (horiz) {
        const top = this.add
          .tileSprite(road.x + road.w / 2, road.y - sidewalkW / 2, road.w + sidewalkW * 2, sidewalkW, 'tile_sidewalk')
          .setDepth(1);
        const bot = this.add
          .tileSprite(road.x + road.w / 2, road.y + road.h + sidewalkW / 2, road.w + sidewalkW * 2, sidewalkW, 'tile_sidewalk')
          .setDepth(1);
        this.worldLayer.add(top);
        this.worldLayer.add(bot);
      } else {
        const left = this.add
          .tileSprite(road.x - sidewalkW / 2, road.y + road.h / 2, sidewalkW, road.h + sidewalkW * 2, 'tile_sidewalk')
          .setDepth(1);
        const right = this.add
          .tileSprite(road.x + road.w + sidewalkW / 2, road.y + road.h / 2, sidewalkW, road.h + sidewalkW * 2, 'tile_sidewalk')
          .setDepth(1);
        this.worldLayer.add(left);
        this.worldLayer.add(right);
      }

      const asphalt = this.add
        .tileSprite(road.x + road.w / 2, road.y + road.h / 2, road.w, road.h, 'tile_road')
        .setDepth(1);
      this.worldLayer.add(asphalt);

      // Dark curb outline
      const curb = this.add
        .rectangle(road.x + road.w / 2, road.y + road.h / 2, road.w + 8, road.h + 8)
        .setStrokeStyle(4, 0x6d757e, 0.7)
        .setFillStyle(0x000000, 0)
        .setDepth(1);
      this.worldLayer.add(curb);
    }

    for (const ix of INTERSECTIONS) {
      const pad = this.add
        .tileSprite(ix.x + ix.w / 2, ix.y + ix.h / 2, ix.w + 12, ix.h + 12, 'tile_road')
        .setDepth(1);
      this.worldLayer.add(pad);
    }

    // Lane paint
    const paint = this.add.graphics().setDepth(2);
    this.worldLayer.add(paint);
    for (const road of ROADS) {
      const horiz = road.w >= road.h;
      if (horiz) {
        const cy = road.y + road.h / 2;
        // solid white edge lines
        paint.lineStyle(3, 0xffffff, 0.75);
        paint.lineBetween(road.x + 10, road.y + 8, road.x + road.w - 10, road.y + 8);
        paint.lineBetween(road.x + 10, road.y + road.h - 8, road.x + road.w - 10, road.y + road.h - 8);
        // double yellow center
        paint.lineStyle(2, 0xffd600, 0.95);
        for (let x = road.x + 24; x < road.x + road.w - 24; x += 52) {
          paint.lineBetween(x, cy - 3, Math.min(x + 26, road.x + road.w - 24), cy - 3);
          paint.lineBetween(x, cy + 3, Math.min(x + 26, road.x + road.w - 24), cy + 3);
        }
      } else {
        const cx = road.x + road.w / 2;
        paint.lineStyle(3, 0xffffff, 0.75);
        paint.lineBetween(road.x + 8, road.y + 10, road.x + 8, road.y + road.h - 10);
        paint.lineBetween(road.x + road.w - 8, road.y + 10, road.x + road.w - 8, road.y + road.h - 10);
        paint.lineStyle(2, 0xffd600, 0.95);
        for (let y = road.y + 24; y < road.y + road.h - 24; y += 52) {
          paint.lineBetween(cx - 3, y, cx - 3, Math.min(y + 26, road.y + road.h - 24));
          paint.lineBetween(cx + 3, y, cx + 3, Math.min(y + 26, road.y + road.h - 24));
        }
      }
    }

    // Crosswalks
    for (const cw of CROSSWALKS) {
      paint.fillStyle(0xffffff, 0.92);
      if (cw.horiz) {
        for (let i = -4; i <= 4; i++) paint.fillRect(cw.x - 34, cw.y + i * 9 - 3, 68, 5);
        paint.fillRect(cw.x - 48, cw.y - 42, 10, 84);
      } else {
        for (let i = -4; i <= 4; i++) paint.fillRect(cw.x + i * 9 - 3, cw.y - 34, 5, 68);
        paint.fillRect(cw.x - 42, cw.y - 48, 84, 10);
      }
    }

    // Street lights both sides + warm glow pools
    const lampGap = 220;
    for (const road of ROADS) {
      const horiz = road.w >= road.h;
      if (horiz) {
        for (let x = road.x + 50; x < road.x + road.w - 50; x += lampGap) {
          this.placeStreetLamp(x, road.y - 22, false);
          if ((x / lampGap) % 2 < 1) this.placeStreetLamp(x + 110, road.y + road.h + 22, true);
        }
      } else {
        for (let y = road.y + 50; y < road.y + road.h - 50; y += lampGap) {
          this.placeStreetLamp(road.x - 22, y, false);
          if ((y / lampGap) % 2 < 1) this.placeStreetLamp(road.x + road.w + 22, y + 110, true);
        }
      }
    }

    // Traffic signals at every intersection
    let sigI = 0;
    for (const ix of INTERSECTIONS) {
      this.placeTrafficSignal(ix.x - 6, ix.y - 10, sigI++);
      this.placeTrafficSignal(ix.x + ix.w + 6, ix.y + ix.h + 10, sigI++);
    }

    // Manholes
    for (const h of [
      { x: 520, y: 760 },
      { x: 980, y: 760 },
      { x: 1600, y: 760 },
      { x: 700, y: 1035 },
      { x: 1200, y: 1035 },
      { x: 1485, y: 700 },
      { x: 1940, y: 880 },
      { x: 400, y: 760 },
      { x: 1800, y: 1035 },
    ]) {
      const mh = this.add.image(h.x, h.y, 'manhole').setDepth(2).setAlpha(0.92);
      this.worldLayer.add(mh);
    }

    // Street name signs
    for (const n of [
      { x: 340, y: 688, t: 'MAIN STREET' },
      { x: 1540, y: 678, t: 'MARKET AVE' },
      { x: 2000, y: 678, t: 'FOREST RD' },
      { x: 340, y: 968, t: 'PARK ROAD' },
    ]) {
      const sign = this.add
        .text(n.x, n.y, n.t, {
          fontSize: '12px',
          color: '#fffde7',
          backgroundColor: '#0d47a1ee',
          padding: { x: 8, y: 4 },
        })
        .setDepth(6);
      this.worldLayer.add(sign);
    }
  }

  private placeStreetLamp(x: number, y: number, flip: boolean): void {
    const glow = this.add.circle(x + (flip ? -10 : 10), y + 8, 36, 0xffe082, 0.12).setDepth(4);
    const lamp = this.add.image(x, y, 'street_lamp').setDepth(5).setScale(0.9).setFlipX(flip);
    this.worldLayer.add(glow);
    this.worldLayer.add(lamp);
  }

  private placeTrafficSignal(x: number, y: number, index: number): void {
    const pole = this.add.image(x, y, 'traffic_signal').setDepth(6).setScale(0.95);
    // Lens overlays (animated)
    const red = this.add.circle(x, y - 34, 5, 0xff1744, 1).setDepth(7);
    const yellow = this.add.circle(x, y - 18, 5, 0xffea00, 0.15).setDepth(7);
    const green = this.add.circle(x, y - 2, 5, 0x00e676, 0.15).setDepth(7);
    this.worldLayer.add(pole);
    this.worldLayer.add(red);
    this.worldLayer.add(yellow);
    this.worldLayer.add(green);
    this.trafficSignals.push({ red, yellow, green, offset: (index % 3) * 1800 });
  }

  private updateTrafficSignals(delta: number): void {
    this.trafficTick += delta;
    for (const s of this.trafficSignals) {
      const t = (this.trafficTick + s.offset) % 6000;
      // 0-3500 green, 3500-4200 yellow, 4200-6000 red
      const mode = t < 3500 ? 'g' : t < 4200 ? 'y' : 'r';
      s.red.setAlpha(mode === 'r' ? 1 : 0.12);
      s.yellow.setAlpha(mode === 'y' ? 1 : 0.12);
      s.green.setAlpha(mode === 'g' ? 1 : 0.12);
      if (mode === 'r') s.red.setFillStyle(0xff1744, 1);
      if (mode === 'y') s.yellow.setFillStyle(0xffea00, 1);
      if (mode === 'g') s.green.setFillStyle(0x00e676, 1);
    }
  }

  private pushIndoor(nodes: Phaser.GameObjects.GameObject[], ...objs: Phaser.GameObjects.GameObject[]): void {
    for (const o of objs) {
      nodes.push(o);
      this.indoorLayer.add(o);
    }
  }

  private buildIndoorLair(): void {
    this.lairNodes = [];
    const cx = LAIR.x + LAIR.w / 2;
    const cy = LAIR.y + LAIR.h / 2;

    // Outer shell + metal floor
    const shell = this.add.rectangle(cx, cy, LAIR.w + 24, LAIR.h + 24, 0x0d1b2a, 1).setStrokeStyle(6, 0x4fc3f7, 0.7);
    const floor = this.add.tileSprite(cx, cy, LAIR.w, LAIR.h, 'floor_metal');
    // Back wall band
    const wall = this.add.rectangle(cx, LAIR.y + 50, LAIR.w, 100, 0x1a237e, 1).setStrokeStyle(2, 0x90caf9, 0.4);
    // Ceiling lights
    const light1 = this.add.rectangle(LAIR.x + 180, LAIR.y + 20, 80, 10, 0xe3f2fd, 0.9);
    const light2 = this.add.rectangle(LAIR.x + 420, LAIR.y + 20, 80, 10, 0xe3f2fd, 0.9);
    const light3 = this.add.rectangle(LAIR.x + 580, LAIR.y + 20, 80, 10, 0xe3f2fd, 0.9);

    const title = this.add
      .text(cx, LAIR.y + 36, '🔬 Secret Gadget Lair', {
        fontSize: '18px',
        color: '#90caf9',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0);

    // Server racks along left wall
    const server1 = this.add.image(LAIR.x + 70, LAIR.y + 200, 'furn_server').setScale(1.1);
    const server2 = this.add.image(LAIR.x + 70, LAIR.y + 300, 'furn_server').setScale(1.1);
    const server3 = this.add.image(LAIR.x + 70, LAIR.y + 400, 'furn_server').setScale(1.1);

    // Work consoles
    const console1 = this.add.image(LAIR.x + 280, LAIR.y + 180, 'furn_console').setScale(1.05);
    const console2 = this.add.image(LAIR.x + 520, LAIR.y + 180, 'furn_console').setScale(1.05);

    // Tracker pedestal (glowing platform)
    const pedestal = this.add.rectangle(LAIR.trackerX, LAIR.trackerY + 8, 70, 18, 0x263238, 1).setStrokeStyle(2, 0xffe082, 0.8);
    const tracker = this.add.image(LAIR.trackerX, LAIR.trackerY - 10, 'tracker').setScale(1.35);
    this.trackerPedestal = tracker;
    const glow = this.add.circle(LAIR.trackerX, LAIR.trackerY, 46, 0xffeb3b, 0.14);
    const trackerLbl = this.add
      .text(LAIR.trackerX, LAIR.trackerY + 36, 'HOLD Tracker [E]', {
        fontSize: '13px',
        color: '#fff59d',
        backgroundColor: '#00000099',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0);

    // Robot charging bay
    const robotPad = this.add.circle(LAIR.robotX, LAIR.robotY, 36, 0x0d47a1, 0.55).setStrokeStyle(3, 0x40c4ff, 0.9);
    const chargeRing = this.add.circle(LAIR.robotX, LAIR.robotY, 48, 0x00e5ff, 0.12);
    const robotLbl = this.add
      .text(LAIR.robotX, LAIR.robotY + 48, 'Robot Partner [E]', {
        fontSize: '12px',
        color: '#bbdefb',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0);

    // Exit door frame
    const doorFrame = this.add.rectangle(LAIR.exitX + 30, LAIR.exitY + 40, 50, 70, 0x1b5e20, 0.5).setStrokeStyle(3, 0x69f0ae, 0.8);
    const doorImg = this.add.image(LAIR.exitX + 30, LAIR.exitY + 40, 'door').setScale(1.1);
    const exit = this.add
      .text(LAIR.exitX, LAIR.exitY - 8, '[E] Exit to surface', {
        fontSize: '13px',
        color: '#a5d6a7',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0, 0);

    const tip = this.add
      .text(cx, LAIR.y + LAIR.h - 28, 'Grab the tracker · activate robot · then exit upstairs', {
        fontSize: '12px',
        color: '#b3e5fc',
        backgroundColor: '#00000066',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0);

    this.pushIndoor(
      this.lairNodes,
      shell,
      floor,
      wall,
      light1,
      light2,
      light3,
      title,
      server1,
      server2,
      server3,
      console1,
      console2,
      pedestal,
      glow,
      tracker,
      trackerLbl,
      chargeRing,
      robotPad,
      robotLbl,
      doorFrame,
      doorImg,
      exit,
      tip,
    );
  }

  private buildIndoorJail(): void {
    this.jailNodes = [];
    const cx = JAIL_INTERIOR.x + JAIL_INTERIOR.w / 2;
    const cy = JAIL_INTERIOR.y + JAIL_INTERIOR.h / 2;

    const shell = this.add
      .rectangle(cx, cy, JAIL_INTERIOR.w + 24, JAIL_INTERIOR.h + 24, 0x1a0a0a, 1)
      .setStrokeStyle(6, 0xef9a9a, 0.7)
      .setVisible(false);
    const floor = this.add.tileSprite(cx, cy, JAIL_INTERIOR.w, JAIL_INTERIOR.h, 'floor_concrete').setVisible(false);
    const wall = this.add
      .rectangle(cx, JAIL_INTERIOR.y + 48, JAIL_INTERIOR.w, 96, 0x3e2723, 1)
      .setStrokeStyle(2, 0xbcaaa4, 0.35)
      .setVisible(false);
    const light1 = this.add.rectangle(JAIL_INTERIOR.x + 200, JAIL_INTERIOR.y + 18, 70, 8, 0xffecb3, 0.85).setVisible(false);
    const light2 = this.add.rectangle(JAIL_INTERIOR.x + 500, JAIL_INTERIOR.y + 18, 70, 8, 0xffecb3, 0.85).setVisible(false);

    const title = this.add
      .text(cx, JAIL_INTERIOR.y + 32, '🔒 SUPER JAIL Interior', {
        fontSize: '18px',
        color: '#ef9a9a',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    // Booking desk
    const desk = this.add.image(JAIL_INTERIOR.x + 220, JAIL_INTERIOR.y + 220, 'furn_desk').setScale(1.15).setVisible(false);
    const cam = this.add.circle(JAIL_INTERIOR.x + 100, JAIL_INTERIOR.y + 100, 8, 0xff1744, 0.9).setVisible(false);
    const camLbl = this.add
      .text(JAIL_INTERIOR.x + 100, JAIL_INTERIOR.y + 118, 'CAM', {
        fontSize: '10px',
        color: '#ff8a80',
        backgroundColor: '#00000088',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    // Holding cell
    this.cellMarker = this.add
      .rectangle(
        JAIL_INTERIOR.cellX,
        JAIL_INTERIOR.cellY,
        JAIL_INTERIOR.cellW,
        JAIL_INTERIOR.cellH,
        0x111111,
        0.92,
      )
      .setStrokeStyle(3, 0xb0bec5)
      .setVisible(false);
    const bars = this.add.image(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY, 'furn_bars').setScale(1.35).setVisible(false);
    const bench = this.add
      .rectangle(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY + 40, 90, 16, 0x455a64, 1)
      .setVisible(false);
    const cellLbl = this.add
      .text(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY - 95, 'Holding Cell [E]', {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#b71c1ccc',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    const doorFrame = this.add
      .rectangle(JAIL_INTERIOR.exitX + 30, JAIL_INTERIOR.exitY + 40, 50, 70, 0x5d4037, 0.55)
      .setStrokeStyle(3, 0xa5d6a7, 0.8)
      .setVisible(false);
    const doorImg = this.add.image(JAIL_INTERIOR.exitX + 30, JAIL_INTERIOR.exitY + 40, 'door').setScale(1.1).setVisible(false);
    const exit = this.add
      .text(JAIL_INTERIOR.exitX, JAIL_INTERIOR.exitY - 8, '[E] Exit Super Jail', {
        fontSize: '13px',
        color: '#a5d6a7',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 3 },
      })
      .setVisible(false);

    const tip = this.add
      .text(cx, JAIL_INTERIOR.y + JAIL_INTERIOR.h - 28, 'Bring Sasquatch to the cell and lock him in', {
        fontSize: '12px',
        color: '#ffcdd2',
        backgroundColor: '#00000066',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.pushIndoor(
      this.jailNodes,
      shell,
      floor,
      wall,
      light1,
      light2,
      title,
      desk,
      cam,
      camLbl,
      this.cellMarker,
      bars,
      bench,
      cellLbl,
      doorFrame,
      doorImg,
      exit,
      tip,
    );
  }

  private buildIndoorHouse(): void {
    this.houseNodes = [];
    const cx = HOUSE_INTERIOR.x + HOUSE_INTERIOR.w / 2;
    const cy = HOUSE_INTERIOR.y + HOUSE_INTERIOR.h / 2;

    const shell = this.add
      .rectangle(cx, cy, HOUSE_INTERIOR.w + 24, HOUSE_INTERIOR.h + 24, 0x3e2723, 1)
      .setStrokeStyle(6, 0xffcc80, 0.75)
      .setVisible(false);
    const floor = this.add.tileSprite(cx, cy, HOUSE_INTERIOR.w, HOUSE_INTERIOR.h, 'floor_wood').setVisible(false);
    // Cream wallpaper back wall
    const wall = this.add
      .rectangle(cx, HOUSE_INTERIOR.y + 55, HOUSE_INTERIOR.w, 110, 0xfff3e0, 1)
      .setStrokeStyle(2, 0xffe0b2, 0.8)
      .setVisible(false);
    const baseboard = this.add
      .rectangle(cx, HOUSE_INTERIOR.y + 108, HOUSE_INTERIOR.w, 8, 0x5d4037, 1)
      .setVisible(false);

    const title = this.add
      .text(cx, HOUSE_INTERIOR.y + 28, '🏠 Your House', {
        fontSize: '18px',
        color: '#5d4037',
        backgroundColor: '#ffe082cc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    // Living room
    const couch = this.add.image(HOUSE_INTERIOR.x + 220, HOUSE_INTERIOR.y + 220, 'furn_couch').setScale(1.2).setVisible(false);
    const table = this.add.image(HOUSE_INTERIOR.x + 220, HOUSE_INTERIOR.y + 290, 'furn_table').setScale(1.05).setVisible(false);
    const tv = this.add.image(HOUSE_INTERIOR.x + 220, HOUSE_INTERIOR.y + 150, 'furn_tv').setScale(1.1).setVisible(false);
    this.houseTv = tv;
    const tvScreen = this.add
      .image(HOUSE_INTERIOR.x + 220, HOUSE_INTERIOR.y + 142, 'tv_on')
      .setScale(0.95)
      .setVisible(false)
      .setAlpha(0);
    this.houseTvScreen = tvScreen;
    const tvLbl = this.add
      .text(HOUSE_INTERIOR.x + 220, HOUSE_INTERIOR.y + 175, 'TV [E]', {
        fontSize: '11px',
        color: '#e3f2fd',
        backgroundColor: '#0d47a1aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    const plant = this.add.image(HOUSE_INTERIOR.x + 110, HOUSE_INTERIOR.y + 200, 'furn_plant').setScale(1.1).setVisible(false);
    const picture = this.add.image(HOUSE_INTERIOR.x + 340, HOUSE_INTERIOR.y + 140, 'furn_picture').setScale(1.2).setVisible(false);
    const rug = this.add
      .ellipse(HOUSE_INTERIOR.x + 220, HOUSE_INTERIOR.y + 300, 200, 90, 0xc62828, 0.45)
      .setVisible(false);

    // Kitchen
    const kitchen = this.add.image(HOUSE_INTERIOR.x + 480, HOUSE_INTERIOR.y + 200, 'furn_kitchen').setScale(1.15).setVisible(false);
    this.houseKitchen = kitchen;
    const kitchenLbl = this.add
      .text(HOUSE_INTERIOR.x + 480, HOUSE_INTERIOR.y + 240, 'COOK [E]', {
        fontSize: '11px',
        color: '#fff3e0',
        backgroundColor: '#e65100aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    const food = this.add
      .image(HOUSE_INTERIOR.x + 480, HOUSE_INTERIOR.y + 270, 'food_plate')
      .setScale(0.9)
      .setVisible(false)
      .setAlpha(0);
    this.houseFood = food;

    // Bedroom / sleep area
    const bed = this.add.image(HOUSE_INTERIOR.bedX, HOUSE_INTERIOR.bedY, 'bed').setScale(1.4).setVisible(false);
    this.houseBed = bed;
    const nightstand = this.add
      .rectangle(HOUSE_INTERIOR.bedX - 70, HOUSE_INTERIOR.bedY + 10, 28, 24, 0x6d4c41, 1)
      .setVisible(false);
    const lamp = this.add.circle(HOUSE_INTERIOR.bedX - 70, HOUSE_INTERIOR.bedY - 10, 9, 0xffe082, 0.95).setVisible(false);
    const lampGlow = this.add.circle(HOUSE_INTERIOR.bedX - 70, HOUSE_INTERIOR.bedY - 10, 22, 0xfff59d, 0.2).setVisible(false);
    const bedLbl = this.add
      .text(HOUSE_INTERIOR.bedX, HOUSE_INTERIOR.bedY + 48, 'BED — Lay down [E] · SLEEP overnight', {
        fontSize: '12px',
        color: '#fffde7',
        backgroundColor: '#1565c0cc',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    const buildLbl = this.add
      .text(cx, HOUSE_INTERIOR.y + HOUSE_INTERIOR.h - 56, 'BUILD MODE: place Craft Blocks (original cubes)', {
        fontSize: '11px',
        color: '#1b5e20',
        backgroundColor: '#c8e6c9cc',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    // Window with curtains
    const window = this.add
      .rectangle(HOUSE_INTERIOR.x + HOUSE_INTERIOR.w - 100, HOUSE_INTERIOR.y + 130, 80, 56, 0x81d4fa, 0.7)
      .setStrokeStyle(4, 0xfff8e1, 0.95)
      .setVisible(false);
    const curtainL = this.add
      .rectangle(HOUSE_INTERIOR.x + HOUSE_INTERIOR.w - 140, HOUSE_INTERIOR.y + 130, 14, 70, 0xef9a9a, 0.85)
      .setVisible(false);
    const curtainR = this.add
      .rectangle(HOUSE_INTERIOR.x + HOUSE_INTERIOR.w - 60, HOUSE_INTERIOR.y + 130, 14, 70, 0xef9a9a, 0.85)
      .setVisible(false);

    const doorFrame = this.add
      .rectangle(HOUSE_INTERIOR.exitX + 30, HOUSE_INTERIOR.exitY + 40, 50, 70, 0x5d4037, 0.5)
      .setStrokeStyle(3, 0xa5d6a7, 0.85)
      .setVisible(false);
    const doorImg = this.add.image(HOUSE_INTERIOR.exitX + 30, HOUSE_INTERIOR.exitY + 40, 'door').setScale(1.1).setVisible(false);
    const exit = this.add
      .text(HOUSE_INTERIOR.exitX, HOUSE_INTERIOR.exitY - 8, '[E] Exit house', {
        fontSize: '13px',
        color: '#a5d6a7',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0, 0)
      .setVisible(false);

    const tip = this.add
      .text(cx, HOUSE_INTERIOR.y + HOUSE_INTERIOR.h - 28, 'Walk around · TV · Cook · Bed · Build Blocks', {
        fontSize: '12px',
        color: '#5d4037',
        backgroundColor: '#ffe08299',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.pushIndoor(
      this.houseNodes,
      shell,
      floor,
      wall,
      baseboard,
      title,
      rug,
      couch,
      table,
      tv,
      tvScreen,
      tvLbl,
      plant,
      picture,
      kitchen,
      kitchenLbl,
      food,
      bed,
      nightstand,
      lampGlow,
      lamp,
      bedLbl,
      buildLbl,
      window,
      curtainL,
      curtainR,
      doorFrame,
      doorImg,
      exit,
      tip,
    );
  }

  /** Shared interior shell for clinic / shop / school / library / etc. */
  private buildIndoorCivic(): void {
    this.civicNodes = [];
    const cx = CIVIC_INTERIOR.x + CIVIC_INTERIOR.w / 2;
    const cy = CIVIC_INTERIOR.y + CIVIC_INTERIOR.h / 2;

    const shell = this.add
      .rectangle(cx, cy, CIVIC_INTERIOR.w + 24, CIVIC_INTERIOR.h + 24, 0x263238, 1)
      .setStrokeStyle(6, 0x90caf9, 0.8)
      .setVisible(false);
    this.civicShell = shell;
    const floor = this.add.tileSprite(cx, cy, CIVIC_INTERIOR.w, CIVIC_INTERIOR.h, 'floor_concrete').setVisible(false);
    const wall = this.add
      .rectangle(cx, CIVIC_INTERIOR.y + 55, CIVIC_INTERIOR.w, 110, 0xe3f2fd, 1)
      .setStrokeStyle(2, 0x90caf9, 0.7)
      .setVisible(false);
    this.civicWall = wall;
    const baseboard = this.add
      .rectangle(cx, CIVIC_INTERIOR.y + 108, CIVIC_INTERIOR.w, 8, 0x455a64, 1)
      .setVisible(false);

    const title = this.add
      .text(cx, CIVIC_INTERIOR.y + 28, 'Building', {
        fontSize: '18px',
        color: '#0d47a1',
        backgroundColor: '#e3f2fdcc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.civicTitle = title;

    const desk = this.add.image(cx, CIVIC_INTERIOR.y + 240, 'furn_desk').setScale(1.25).setVisible(false);
    const plant = this.add.image(CIVIC_INTERIOR.x + 120, CIVIC_INTERIOR.y + 220, 'furn_plant').setScale(1.15).setVisible(false);
    const table = this.add.image(CIVIC_INTERIOR.x + 520, CIVIC_INTERIOR.y + 260, 'furn_table').setScale(1.1).setVisible(false);
    const picture = this.add.image(cx, CIVIC_INTERIOR.y + 150, 'furn_picture').setScale(1.2).setVisible(false);
    const consoleDesk = this.add
      .image(CIVIC_INTERIOR.x + 180, CIVIC_INTERIOR.y + 340, 'furn_console')
      .setScale(1.05)
      .setVisible(false);

    const propA = this.add
      .text(CIVIC_INTERIOR.x + 180, CIVIC_INTERIOR.y + 380, 'Prop A', {
        fontSize: '12px',
        color: '#fffde7',
        backgroundColor: '#1565c0aa',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    const propB = this.add
      .text(cx, CIVIC_INTERIOR.y + 290, 'Prop B', {
        fontSize: '12px',
        color: '#fffde7',
        backgroundColor: '#00695caa',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    const propC = this.add
      .text(CIVIC_INTERIOR.x + 520, CIVIC_INTERIOR.y + 310, 'Prop C', {
        fontSize: '12px',
        color: '#fffde7',
        backgroundColor: '#6a1b9aaa',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.civicPropA = propA;
    this.civicPropB = propB;
    this.civicPropC = propC;

    const doorFrame = this.add
      .rectangle(CIVIC_INTERIOR.exitX + 30, CIVIC_INTERIOR.exitY + 40, 50, 70, 0x37474f, 0.5)
      .setStrokeStyle(3, 0xa5d6a7, 0.85)
      .setVisible(false);
    const doorImg = this.add
      .image(CIVIC_INTERIOR.exitX + 30, CIVIC_INTERIOR.exitY + 40, 'door')
      .setScale(1.1)
      .setVisible(false);
    const exit = this.add
      .text(CIVIC_INTERIOR.exitX, CIVIC_INTERIOR.exitY - 8, '[E] Exit building', {
        fontSize: '13px',
        color: '#a5d6a7',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0, 0)
      .setVisible(false);

    const tip = this.add
      .text(cx, CIVIC_INTERIOR.y + CIVIC_INTERIOR.h - 28, 'Look around · EXIT when ready', {
        fontSize: '12px',
        color: '#263238',
        backgroundColor: '#fff9c4aa',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.civicTip = tip;

    this.pushIndoor(
      this.civicNodes,
      shell,
      floor,
      wall,
      baseboard,
      title,
      desk,
      plant,
      table,
      picture,
      consoleDesk,
      propA,
      propB,
      propC,
      doorFrame,
      doorImg,
      exit,
      tip,
    );
  }

  private applyCivicTheme(themeId: string): void {
    const theme = CIVIC_THEMES[themeId];
    if (!theme) return;
    this.civicTitle?.setText(theme.title);
    this.civicTitle?.setColor('#1a237e');
    this.civicWall?.setFillStyle(theme.wall, 1);
    this.civicShell?.setStrokeStyle(6, theme.accent, 0.85);
    this.civicPropA?.setText(theme.propA);
    this.civicPropB?.setText(theme.propB);
    this.civicPropC?.setText(theme.propC);
    this.civicTip?.setText(theme.tip);
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
      { id: 'vehicle', label: 'Drive a car (GET IN CAR)', done: this.flags.inVehicle || this.flags.sasquatchCaptured || advanced },
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
      flags: { ...this.flags, trackerHeld: this.trackerHeld },
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
      trailClues: this.trail.getClues().length,
      tracking: this.trail.isTracking(),
      playerAnim: this.player?.anims?.currentAnim?.key ?? null,
      onFoot:
        !this.flags.inVehicle &&
        (this.player?.texture?.key === 'player_sheet' ||
          this.player?.texture?.key === 'player_front_sheet' ||
          this.player?.texture?.key === 'player_back_sheet'),
      facing: this.facing,
      facingDir: this.facingDir,
      flipX: !!this.player?.flipX,
      playerSheet: this.player?.texture?.key ?? null,
      pantherActive: this.panther?.isActive?.() ?? false,
      sunVisible: this.dayNight?.phase?.() !== 'night',
      policeCars: this.patrolCars?.count?.() ?? 0,
      policeCarPositions: this.patrolCars?.snapshots?.() ?? [],
      robot: {
        active: this.flags.robotActive,
        visible: !!this.robot?.visible,
        x: this.robot?.x ?? 0,
        y: this.robot?.y ?? 0,
        anim: this.robot?.anims?.currentAnim?.key ?? null,
        dist: this.robot
          ? Math.round(Phaser.Math.Distance.Between(this.robot.x, this.robot.y, this.player.x, this.player.y))
          : null,
      },
      streetLights: true,
      trafficSignals: this.trafficSignals.length,
      pigActive: this.pigDrop?.isActive?.() ?? false,
      flattened: this.flattened,
      sirenMode: this.sasquatchSirenMode,
      buildingSigns: true,
      house: {
        tvOn: this.tvOn,
        lyingInBed: this.lyingInBed,
        cookedMeal: this.cookedMeal,
      },
      craft: {
        mode: this.craftBuild?.isMode?.() ?? false,
        block: this.craftBuild?.selectedName?.() ?? null,
        index: this.craftBuild?.selectedIndex?.() ?? 0,
        count: this.craftBuild?.count?.() ?? 0,
      },
      building: {
        indoors: this.isIndoors(),
        civicId: this.civicId,
        doors: Object.keys(this.outdoorDoors).filter((k) => !['hq', 'house', 'jail'].includes(k)).length,
        enterable: listEnterableBuildings().map((b) => b.id),
      },
    };
  }

  /** Test helper — force a police squash. */
  forceFlatten(): void {
    this.flattenByPolice(this.player.x + 30, this.player.y);
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
      this.updateSasquatchHorrorForm();
      this.updateTrailHelp(d);
      this.updateHeldTracker(d);
      if (this.craftBuild?.isMode()) {
        this.craftBuild.updateGhost(this.player.x, this.player.y, this.facing, this.facingDir);
      }
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
      const outdoors = !this.isIndoors();
      this.dayNight.setOutdoorVisible(outdoors);
      this.patrolCars.setOutdoorVisible(outdoors);
      this.patrolCars.update(d);
      if (outdoors) this.updateTrafficSignals(d);
      if (this.flattenInvuln > 0) this.flattenInvuln -= d;
      if (
        outdoors &&
        !this.flags.inVehicle &&
        !this.flattened &&
        this.flattenInvuln <= 0 &&
        !this.sleeping
      ) {
        const hit = this.patrolCars.checkRunOver(this.player.x, this.player.y, 44);
        if (hit) this.flattenByPolice(hit.carX, hit.carY);
      }
      this.panther.update(d, this.player, outdoors, (msg) => {
        this.statusLine = msg;
        setDomStatus(msg);
        audio.talk();
      });
      this.pigDrop.update(d, this.player, outdoors, (msg) => {
        this.statusLine = msg;
        setDomStatus(msg);
        audio.talk();
      });
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
        // Indoors / sleeping: prefer action status so trail prompts don't bury button feedback
        const indoors = this.isIndoors();
        const hudLine = this.sleeping
          ? this.statusLine || 'Sleeping…'
          : indoors
            ? this.statusLine || this.interactPrompt || PHASE_HINTS[this.phase]
            : this.interactPrompt || this.statusLine || PHASE_HINTS[this.phase];
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

  private flattenByPolice(carX: number, carY: number): void {
    if (this.flattened) return;
    this.flattened = true;
    this.player.setVelocity(0, 0);
    // Knock slightly in car direction
    const dx = this.player.x - carX;
    const dy = this.player.y - carY;
    const len = Math.hypot(dx, dy) || 1;
    this.player.x += (dx / len) * 8;
    this.player.y += (dy / len) * 8;

    // Flatten sprite
    this.player.setScale(1.55, 0.28);
    this.player.setTint(0xff8a80);
    this.player.anims.stop();

    // Blood pool under player
    if (this.bloodPool) this.bloodPool.destroy();
    this.bloodPool = this.add
      .image(this.player.x, this.player.y + 10, 'blood_pool')
      .setDepth(9)
      .setAlpha(0.95)
      .setScale(0.4);
    this.tweens.add({
      targets: this.bloodPool,
      scale: 1.35,
      alpha: 0.9,
      duration: 280,
      ease: 'Back.easeOut',
    });

    // Impact stars
    for (let i = 0; i < 5; i++) {
      const star = this.add.star(this.player.x, this.player.y - 10, 5, 3, 7, 0xffe082, 1).setDepth(20);
      this.tweens.add({
        targets: star,
        x: this.player.x + Phaser.Math.Between(-55, 55),
        y: this.player.y - Phaser.Math.Between(30, 70),
        alpha: 0,
        duration: 550,
        delay: i * 25,
        onComplete: () => star.destroy(),
      });
    }

    this.statusLine = '🚔 SQUASHED! Police ran you over — blood pool! Tap UNFREEZE to get up.';
    setDomStatus(this.statusLine);
    audio.talk();
    this.persistSave();

    // Auto get-up after a few seconds
    this.time.delayedCall(3200, () => {
      if (this.flattened) this.unflattenPlayer('You peeled yourself off the pavement…');
    });
  }

  private unflattenPlayer(msg?: string): void {
    if (!this.flattened && !this.bloodPool) return;
    this.flattened = false;
    this.flattenInvuln = 2500;
    this.player.clearTint();
    this.ensurePlayerOnFootSheet();
    this.player.setScale(1);
    this.updatePlayerAnim(false);
    if (this.bloodPool) {
      const pool = this.bloodPool;
      this.tweens.add({
        targets: pool,
        alpha: 0,
        duration: 600,
        onComplete: () => pool.destroy(),
      });
      this.bloodPool = undefined;
    }
    this.statusLine = msg || 'Back on your feet — watch those police cars!';
    setDomStatus(this.statusLine);
  }

  private layInBed(): void {
    this.lyingInBed = true;
    this.craftBuild.setMode(false);
    this.refreshBuildHotbar();
    this.player.setVelocity(0, 0);
    this.player.setPosition(HOUSE_INTERIOR.bedX, HOUSE_INTERIOR.bedY - 4);
    this.player.anims.stop();
    this.player.setAngle(90);
    this.player.setScale(1, 0.85);
    this.statusLine = 'Lying in bed… Tap E to get up · SLEEP for overnight.';
    setDomStatus(this.statusLine);
    audio.interact();
  }

  private getOutOfBed(): void {
    this.lyingInBed = false;
    this.player.setAngle(0);
    this.player.setScale(1);
    this.player.setPosition(HOUSE_INTERIOR.bedX - 40, HOUSE_INTERIOR.bedY + 20);
    this.updatePlayerAnim(false);
    this.statusLine = 'Out of bed. Walk around the house!';
    setDomStatus(this.statusLine);
  }

  private toggleTv(): void {
    this.tvOn = !this.tvOn;
    if (this.houseTvScreen) {
      this.houseTvScreen.setVisible(true);
      this.tweens.add({
        targets: this.houseTvScreen,
        alpha: this.tvOn ? 1 : 0,
        duration: 250,
      });
    }
    this.statusLine = this.tvOn ? '📺 TV ON — cartoon color bars!' : 'TV off.';
    setDomStatus(this.statusLine);
    audio.interact();
  }

  private cookOrEat(): void {
    if (!this.cookedMeal) {
      this.cookedMeal = true;
      if (this.houseFood) {
        this.houseFood.setVisible(true);
        this.houseFood.setAlpha(0);
        this.tweens.add({ targets: this.houseFood, alpha: 1, y: this.houseFood.y - 8, duration: 400, yoyo: false });
      }
      this.inventory.add('cooked_meal');
      this.statusLine = '🍳 Cooking… Meal ready! Tap E again to eat.';
      setDomStatus(this.statusLine);
      audio.success();
      return;
    }
    this.cookedMeal = false;
    if (this.houseFood) {
      this.tweens.add({
        targets: this.houseFood,
        alpha: 0,
        duration: 300,
        onComplete: () => this.houseFood?.setVisible(false),
      });
    }
    this.statusLine = '😋 Yum! You ate a home-cooked meal.';
    setDomStatus(this.statusLine);
    audio.pickup();
  }

  private toggleBuildMode(): void {
    if (this.lyingInBed) this.getOutOfBed();
    const on = this.craftBuild.toggleMode();
    this.refreshBuildHotbar();
    this.statusLine = on
      ? `🧱 CRAFT BUILD ON — ${this.craftBuild.selectedName()} · PLACE/E/tap · BREAK · hotbar 1-${this.craftBuild.blockCount()}`
      : 'Craft Build off.';
    setDomStatus(this.statusLine);
    if (on) {
      (window as unknown as { __ecraftToast?: (m: string) => void }).__ecraftToast?.(
        'BUILD: tap world or PLACE · hotbar picks block · BREAK digs',
      );
    }
  }

  private cycleBuildBlock(): void {
    this.craftBuild.setMode(true);
    this.craftBuild.cycle(1);
    this.refreshBuildHotbar();
    this.statusLine = `Block: ${this.craftBuild.selectedName()} — PLACE / tap world · BREAK digs`;
    setDomStatus(this.statusLine);
  }

  private placeCraftBlock(): void {
    const msg = this.craftBuild.place(this.player.x, this.player.y, this.facing, this.facingDir);
    this.statusLine = msg;
    setDomStatus(this.statusLine);
    audio.interact();
    this.refreshBuildHotbar();
  }

  private breakCraftBlock(): void {
    this.craftBuild.setMode(true);
    const msg = this.craftBuild.breakAt(this.player.x, this.player.y, this.facing, this.facingDir);
    this.statusLine = msg;
    setDomStatus(this.statusLine);
    audio.interact();
    this.refreshBuildHotbar();
  }

  private refreshBuildHotbar(): void {
    const bar = document.getElementById('ecraft-hotbar');
    if (!bar) return;
    bar.classList.toggle('show', this.craftBuild.isMode());
    bar.querySelectorAll<HTMLButtonElement>('[data-block]').forEach((btn) => {
      const i = Number(btn.dataset.block);
      btn.classList.toggle('sel', i === this.craftBuild.selectedIndex());
    });
    const count = document.getElementById('ecraft-hotbar-count');
    if (count) count.textContent = `${this.craftBuild.count()} blocks`;
  }

  private handleMovement(): void {
    if (this.flattened || this.lyingInBed || this.sleeping) {
      this.player.setVelocity(0, 0);
      return;
    }
    const speed = this.flags.inVehicle
      ? this.activeCarKey === 'race_car'
        ? 720
        : this.activeCarKey === 'police_car'
          ? 640
          : 560
      : 240;
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
      this.updatePlayerAnim(false);
      return;
    }
    const len = Math.hypot(vx, vy) || 1;
    this.player.setVelocity((vx / len) * speed, (vy / len) * speed);

    // Clamp walking inside the house so you can stroll the rooms
    if (this.flags.inHouse) {
      this.player.x = Phaser.Math.Clamp(
        this.player.x,
        HOUSE_INTERIOR.x + 50,
        HOUSE_INTERIOR.x + HOUSE_INTERIOR.w - 50,
      );
      this.player.y = Phaser.Math.Clamp(
        this.player.y,
        HOUSE_INTERIOR.y + 130,
        HOUSE_INTERIOR.y + HOUSE_INTERIOR.h - 50,
      );
    }

    // Always face the direction he walks (dominant axis)
    if (Math.abs(vx) >= Math.abs(vy)) {
      this.facingDir = vx < 0 ? 'left' : 'right';
      this.facing = vx < 0 ? -1 : 1;
    } else {
      this.facingDir = vy < 0 ? 'up' : 'down';
      // keep facing ±1 for tracker hand offset when moving vertically
    }

    if (this.dust) {
      this.dust.setPosition(this.player.x, this.player.y + 18);
      this.dust.emitting = !this.flags.inVehicle;
    }

    if (this.flags.inVehicle) {
      const tex = this.activeCarKey;
      if (this.activeCarKey === 'vehicle') {
        this.vehicle.setPosition(this.player.x, this.player.y);
      } else if (this.activeCarKey === 'race_car') {
        this.raceCar.setPosition(this.player.x, this.player.y);
      }
      if (this.player.texture.key !== tex) {
        this.player.anims.stop();
        this.player.setTexture(tex);
        this.player.setScale(1.05);
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setSize(70, 36).setOffset(10, 12);
      }
    } else {
      this.updatePlayerAnim(true);
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
        this.enterLair(true);
        break;
      case 'get_tracker':
        if (!this.flags.inLair) this.enterLair(true);
        this.player.setPosition(LAIR.trackerX, LAIR.trackerY);
        this.equipTracker(true);
        this.setPhase(MissionPhase.HasTracker);
        this.statusLine = 'Holding Sasquatch Tracker!';
        break;
      case 'activate_robot':
        if (!this.flags.inLair) this.enterLair(true);
        this.player.setPosition(LAIR.robotX, LAIR.robotY);
        this.equipTracker(true);
        this.flags.robotActive = true;
        this.robot.setTexture('robot_sheet', 0);
        this.robot.setVisible(true);
        this.robot.setPosition(this.player.x - 40, this.player.y);
        this.robot.play('robot-idle', true);
        this.setPhase(MissionPhase.RobotActive);
        this.statusLine = 'Robot online!';
        break;
      case 'exit_lair':
        this.exitLair();
        break;
      case 'enter_house':
        this.enterHouse(true);
        break;
      case 'sleep':
        this.doSleep();
        break;
      case 'exit_house':
        if (this.flags.inHouse) this.exitHouse();
        break;
      case 'panther':
        if (this.flags.inLair) this.exitLair();
        if (this.flags.inJailBuilding) this.exitJail();
        if (this.flags.inHouse) this.exitHouse();
        this.panther.forceJump(this.player, (msg) => {
          this.statusLine = msg;
          setDomStatus(msg);
        });
        break;
      case 'sunrise':
        this.dayNight.forceSunrise();
        this.statusLine = 'Sun is rising!';
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
        this.enterJail(true);
        break;
      case 'lock_cell':
        this.flags.sasquatchCaptured = true;
        if (!this.flags.inJailBuilding) this.enterJail(true);
        this.player.setPosition(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY);
        this.jailSasquatch();
        break;
      case 'exit_jail':
        if (this.flags.inJailBuilding) this.exitJail();
        break;
      case 'visit_jail':
        this.flags.sasquatchJailed = true;
        this.doVisitJail();
        // skip door wait in tests by forcing immediate enter
        if (!this.flags.inJailBuilding) this.enterJail(true);
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
    if (!this.flags.hasTracker || !this.trackerHeld) {
      this.equipTracker(true);
      this.setPhase(MissionPhase.HasTracker);
      this.statusLine = '[DEBUG] Tracker held';
      return;
    }
    if (!this.flags.robotActive) {
      this.flags.robotActive = true;
      this.robot.setTexture('robot_sheet', 0);
      this.syncRobotBesidePlayer();
      this.robot.setVisible(true);
      this.robot.play('robot-idle', true);
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
    this.equipTracker(true);
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

  /** Keep robot beside the player — never leave it stranded in lair coords. */
  private syncRobotBesidePlayer(): void {
    if (!this.flags.robotActive) return;
    this.robot.setPosition(this.player.x - 36, this.player.y + 8);
    this.robot.setVelocity(0, 0);
  }

  private updateRobotFollow(): void {
    if (!this.flags.robotActive) {
      this.robot.setVisible(false);
      return;
    }

    // In house/jail/civic: robot waits outside (hidden). In lair: stand with you.
    if (this.flags.inHouse || this.flags.inJailBuilding || this.civicId) {
      this.robot.setVisible(false);
      this.robot.setVelocity(0, 0);
      return;
    }
    if (this.flags.inLair) {
      this.robot.setVisible(true);
      this.robot.body!.enable = false;
      this.robot.setPosition(this.player.x - 40, this.player.y);
      this.robot.setVelocity(0, 0);
      if (this.robot.anims.currentAnim?.key !== 'robot-idle') this.robot.play('robot-idle', true);
      return;
    }

    this.robot.setVisible(true);
    this.robot.body!.enable = true;

    // Riding shotgun while you drive
    if (this.flags.inVehicle) {
      this.robot.setPosition(this.player.x - 42, this.player.y - 22);
      this.robot.setVelocity(0, 0);
      this.robot.setDepth(12);
      this.robot.setFlipX(this.facing < 0);
      if (this.robot.anims.currentAnim?.key !== 'robot-idle') this.robot.play('robot-idle', true);
      return;
    }

    this.robot.setDepth(9);
    const tx = this.player.x - 36;
    const ty = this.player.y + 8;
    const dist = Phaser.Math.Distance.Between(this.robot.x, this.robot.y, tx, ty);
    // Warp if left behind (e.g. after exiting lair / fast travel)
    if (dist > 240) {
      this.syncRobotBesidePlayer();
      if (this.robot.anims.currentAnim?.key !== 'robot-walk') this.robot.play('robot-walk', true);
      return;
    }
    if (dist < 14) {
      this.robot.setVelocity(0, 0);
      if (this.robot.anims.currentAnim?.key !== 'robot-idle') this.robot.play('robot-idle', true);
    } else {
      this.physics.moveTo(this.robot, tx, ty, 280);
      if (this.robot.anims.currentAnim?.key !== 'robot-walk') this.robot.play('robot-walk', true);
    }
    this.robot.setFlipX(this.player.x < this.robot.x - 4);
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
    // Siren-Head close form handled separately
    if (this.sasquatchSirenMode) {
      if (this.sasquatch.anims.currentAnim?.key !== 'sirenhead-lunge') {
        this.sasquatch.play('sirenhead-lunge', true);
      }
      return;
    }
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

  /** When close: morph into towering Siren-Head nightmare. Far: classic Bigfoot. */
  private updateSasquatchHorrorForm(): void {
    if (
      this.flags.sasquatchCaptured ||
      this.flags.sasquatchJailed ||
      this.flags.sasquatchInVehicle ||
      this.isIndoors()
    ) {
      if (this.sasquatchSirenMode) this.setSasquatchForm(false);
      return;
    }
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.sasquatch.x, this.sasquatch.y);
    const close = d < 220;
    if (close && !this.sasquatchSirenMode) this.setSasquatchForm(true);
    else if (!close && this.sasquatchSirenMode) this.setSasquatchForm(false);
  }

  private setSasquatchForm(siren: boolean): void {
    this.sasquatchSirenMode = siren;
    if (siren) {
      this.sasquatch.setTexture('sirenhead_sheet', 0);
      this.sasquatch.setScale(2.35);
      this.sasquatch.setTint(0xffcdd2);
      this.sasquatch.setDepth(18);
      const body = this.sasquatch.body as Phaser.Physics.Arcade.Body;
      body.setSize(40, 120).setOffset(28, 30);
      this.sasquatch.play('sirenhead-lunge', true);
      this.cameras.main.shake(220, 0.01);
      this.statusLine = '⚠ SIREN HEAD!!! The forest monster towers over you!';
      setDomStatus(this.statusLine);
      audio.talk();
    } else {
      this.sasquatch.setTexture('sasquatch_sheet', 0);
      this.sasquatch.setScale(0.92);
      this.sasquatch.clearTint();
      this.sasquatch.setDepth(9);
      const body = this.sasquatch.body as Phaser.Physics.Arcade.Body;
      body.setSize(36, 56).setOffset(18, 22);
      this.sasquatch.play('sasquatch-idle', true);
    }
  }

  /** Pick the sheet/anim that matches the walk facing. */
  private updatePlayerAnim(moving: boolean): void {
    if (this.flags.inVehicle) {
      this.player.anims.stop();
      return;
    }

    let sheet = 'player_sheet';
    let walkKey = 'player-walk-side';
    let idleKey = 'player-idle-side';
    let flip = false;

    if (this.facingDir === 'left') {
      sheet = 'player_sheet';
      walkKey = 'player-walk-side';
      idleKey = 'player-idle-side';
      flip = true;
    } else if (this.facingDir === 'right') {
      sheet = 'player_sheet';
      walkKey = 'player-walk-side';
      idleKey = 'player-idle-side';
      flip = false;
    } else if (this.facingDir === 'down') {
      sheet = 'player_front_sheet';
      walkKey = 'player-walk-front';
      idleKey = 'player-idle-front';
      flip = false;
    } else {
      // up — walking away, back of head
      sheet = 'player_back_sheet';
      walkKey = 'player-walk-back';
      idleKey = 'player-idle-back';
      flip = false;
    }

    if (this.player.texture.key !== sheet) {
      this.player.setTexture(sheet, 0);
      this.player.setScale(1);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setSize(28, 44).setOffset(22, 20);
    }
    this.player.setFlipX(flip);

    const key = moving ? walkKey : idleKey;
    if (this.player.anims.currentAnim?.key !== key) {
      this.player.play(key, true);
    }
  }

  /** Restore on-foot sheet after cars / interiors. */
  private ensurePlayerOnFootSheet(): void {
    if (this.flags.inVehicle) return;
    this.updatePlayerAnim(false);
  }

  private pickSasquatchWander(): void {
    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    this.sasquatchWanderTarget = {
      x: forest.x + 60 + Math.random() * (forest.w - 120),
      y: forest.y + 60 + Math.random() * (forest.h - 120),
    };
  }

  private updateTrailHelp(delta: number): void {
    if (
      !this.flags.hasTracker ||
      !this.trackerHeld ||
      this.flags.sasquatchCaptured ||
      this.isIndoors() ||
      this.sleeping
    ) {
      this.trail.clearFallback();
      return;
    }
    this.trail.markNearbyDiscovered(this.player.x, this.player.y);
    const nearest = this.trail.nearestUndiscovered(this.player.x, this.player.y);
    if (nearest) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, nearest.x, nearest.y);
      if (d > 280) this.lostTrailTimer += delta;
      else this.lostTrailTimer = 0;
    }
    const robotHelps = this.flags.robotActive && this.lostTrailTimer > 1400;
    const msg = this.trail.updateFallbackHelp(this.player.x, this.player.y, robotHelps);
    // Keep tracker readouts on screen so the track feels alive
    if (msg) this.statusLine = msg;

    const forest = CITY_ZONES.find((z) => z.id === 'forest')!;
    if (
      this.flags.hasTracker &&
      this.flags.robotActive &&
      pointInRect(this.player.x, this.player.y, forest) &&
      (this.phase === MissionPhase.CanDrive || this.phase === MissionPhase.RobotActive)
    ) {
      this.setPhase(MissionPhase.Tracking);
      this.statusLine = 'GOLD TRAIL LIVE — hold Tracker and follow footprints!';
    }
  }

  private updateInteractPrompt(): void {
    this.interactPrompt = this.describeInteract() ?? '';
  }

  private describeInteract(): string | null {
    if (this.civicId) {
      if (this.craftBuild?.isMode()) {
        return `[E] Place ${this.craftBuild.selectedName()} · BREAK removes`;
      }
      if (this.near(CIVIC_INTERIOR.exitX + 40, CIVIC_INTERIOR.exitY + 40, 110)) return '[E] Exit building';
      return 'Inside — walk around · EXIT to leave';
    }
    if (this.flags.inHouse) {
      if (this.lyingInBed) return '[E] Get out of bed';
      if (this.craftBuild?.isMode()) {
        return `[E] Place ${this.craftBuild.selectedName()} · BREAK removes`;
      }
      if (this.near(HOUSE_INTERIOR.bedX, HOUSE_INTERIOR.bedY, 100)) return '[E] Lay down in bed';
      if (this.houseTv && this.near(this.houseTv.x, this.houseTv.y, 70)) {
        return this.tvOn ? '[E] Turn TV off' : '[E] Turn TV on';
      }
      if (this.houseKitchen && this.near(this.houseKitchen.x, this.houseKitchen.y, 70)) {
        return this.cookedMeal ? '[E] Eat meal' : '[E] Cook food';
      }
      if (this.near(HOUSE_INTERIOR.exitX + 40, HOUSE_INTERIOR.exitY + 40, 110)) return '[E] Exit house';
      return 'Walk around · TV · Cook · Bed · BUILD blocks';
    }
    if (this.flags.inLair) {
      if (!this.flags.hasTracker && this.near(LAIR.trackerX, LAIR.trackerY, 80)) {
        return '[E] HOLD Sasquatch Tracker';
      }
      if (this.flags.hasTracker && !this.trackerHeld && this.near(LAIR.trackerX, LAIR.trackerY, 80)) {
        return '[E] Hold Tracker again';
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
    if (this.craftBuild?.isMode()) {
      return `[E] Place ${this.craftBuild.selectedName()} · BREAK removes · BUILD off`;
    }
    const nearCop = this.patrolCars?.nearestCar?.(this.player.x, this.player.y, 100);
    if (nearCop) return '[E] Hop in POLICE CAR';
    const nearBldg = this.findNearbyEnterable(95);
    if (nearBldg) {
      if (nearBldg.id === 'super_jail' && this.flags.sasquatchJailed) return '[E] Visit Sasquatch in jail';
      if (
        nearBldg.id === 'security_hq' &&
        this.flags.rewardClaimed &&
        this.jobs.state.unlocked.includes('security_chief') &&
        pointInRect(this.player.x, this.player.y, hq) &&
        !this.near(nearBldg.doorX, nearBldg.doorY, 70)
      ) {
        return '[E] Order HQ Security Wing upgrade';
      }
      return nearBldg.prompt;
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
      return '[E] / CAR — Enter patrol vehicle';
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
    if (this.civicId) {
      if (this.craftBuild?.isMode()) {
        this.placeCraftBlock();
        return;
      }
      if (this.near(CIVIC_INTERIOR.exitX + 40, CIVIC_INTERIOR.exitY + 40, 110)) {
        this.exitCivic();
        return;
      }
      this.statusLine = 'Look around · EXIT to leave';
      setDomStatus(this.statusLine);
      return;
    }

    if (this.flags.inHouse) {
      if (this.lyingInBed) {
        this.getOutOfBed();
        return;
      }
      if (this.craftBuild?.isMode()) {
        this.placeCraftBlock();
        return;
      }
      if (this.near(HOUSE_INTERIOR.bedX, HOUSE_INTERIOR.bedY, 100)) {
        this.layInBed();
        return;
      }
      if (this.houseTv && this.near(this.houseTv.x, this.houseTv.y, 70)) {
        this.toggleTv();
        return;
      }
      if (this.houseKitchen && this.near(this.houseKitchen.x, this.houseKitchen.y, 70)) {
        this.cookOrEat();
        return;
      }
      if (this.near(HOUSE_INTERIOR.exitX + 40, HOUSE_INTERIOR.exitY + 40, 110)) {
        this.exitHouse();
        return;
      }
      this.statusLine = 'TV · Cook · Bed · BUILD · EXIT';
      setDomStatus(this.statusLine);
      return;
    }

    if (this.flags.inLair) {
      if ((!this.flags.hasTracker || !this.trackerHeld) && this.near(LAIR.trackerX, LAIR.trackerY, 80)) {
        this.equipTracker();
        this.setPhase(MissionPhase.HasTracker);
        audio.pickup();
        return;
      }
      if (this.flags.hasTracker && !this.flags.robotActive && this.near(LAIR.robotX, LAIR.robotY, 70)) {
        this.flags.robotActive = true;
        this.robot.setTexture('robot_sheet', 0);
        this.robot.setPosition(this.player.x - 40, this.player.y);
        this.robot.setVisible(true);
        this.robot.play('robot-idle', true);
        this.setPhase(MissionPhase.RobotActive);
        audio.pickup();
        this.statusLine = 'Robot online! It will follow you — EXIT then take a car.';
        setDomStatus(this.statusLine);
        return;
      }
      if (this.near(LAIR.exitX + 40, LAIR.exitY + 10, 70)) {
        this.exitLair();
        return;
      }
      return;
    }

    if (this.flags.inJailBuilding) {
      if (this.flags.sasquatchJailed) {
        if (this.near(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY, 100)) {
          this.statusLine = 'Sasquatch growls behind bars… still locked up.';
          setDomStatus(this.statusLine);
          if (this.jailedSprite?.anims) this.jailedSprite.play('sasquatch-talk', true);
          return;
        }
        if (this.near(JAIL_INTERIOR.exitX + 40, JAIL_INTERIOR.exitY + 40, 90)) {
          this.exitJail();
          return;
        }
        return;
      }
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

    // Craft Build works outdoors too (Minecraft-style place)
    if (this.craftBuild?.isMode() && !this.flags.inVehicle) {
      this.placeCraftBlock();
      return;
    }

    const hq = CITY_ZONES.find((z) => z.id === 'security_hq')!;

    // Any building door / front works — go inside
    const nearBldg = this.findNearbyEnterable(95);
    if (nearBldg && !this.flags.inVehicle) {
      // HQ upgrade when already rewarded + near HQ (not blocking enter)
      if (
        nearBldg.id === 'security_hq' &&
        this.flags.rewardClaimed &&
        this.flags.hasTracker &&
        this.jobs.state.unlocked.includes('security_chief') &&
        pointInRect(this.player.x, this.player.y, hq) &&
        !this.near(nearBldg.doorX, nearBldg.doorY, 70)
      ) {
        this.tryHqUpgrade();
        return;
      }
      this.enterBuilding(nearBldg.id);
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
        // Free entry — robot is optional (GET IN CAR / E both work without it)
        this.enterVehicle(true);
        this.statusLine = 'Security car — hold D-pad ▶ to drive!';
        setDomStatus(this.statusLine);
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
      if (this.activeCarKey === 'police_car' && this.claimedPatrolIndex != null) {
        this.patrolCars.releaseCar(this.claimedPatrolIndex, this.player.x, this.player.y);
        this.claimedPatrolIndex = null;
      } else {
        const car = this.activeCarKey === 'race_car' ? this.raceCar : this.vehicle;
        car.setPosition(this.player.x, this.player.y);
        car.setVisible(true);
      }
      this.activeCarKey = 'vehicle';
      this.ensurePlayerOnFootSheet();
      this.updatePlayerAnim(false);
      if (this.flags.sasquatchInVehicle) {
        this.sasquatch.setPosition(this.player.x + 40, this.player.y);
      }
      this.statusLine = 'Exited vehicle.';
      setDomStatus(this.statusLine);
      return;
    }

    // Hop into nearby police cruiser with E
    const nearCop = this.patrolCars.nearestCar(this.player.x, this.player.y, 100);
    if (nearCop) {
      this.doEnterCar('police_car');
      return;
    }
  }


  private enterVehicle(allowWithoutSasq = true, kind: 'vehicle' | 'race_car' | 'police_car' = 'vehicle'): void {
    this.flags.inVehicle = true;
    this.activeCarKey = kind;
    if (kind === 'police_car') {
      // Driving a claimed city cruiser — park bay cars stay visible
      this.vehicle.setVisible(true);
      this.raceCar.setVisible(true);
      this.player.anims.stop();
      this.player.setTexture('police_car');
      this.player.setScale(1.05);
      this.player.setDrag(0);
      this.player.setMaxVelocity(780);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      body.setAllowGravity(false);
      body.setSize(70, 36).setOffset(10, 12);
      body.setVelocity(0, 0);
    } else {
      const car = kind === 'race_car' ? this.raceCar : this.vehicle;
      const other = kind === 'race_car' ? this.vehicle : this.raceCar;
      this.player.setPosition(car.x, car.y);
      car.setVisible(false);
      other.setVisible(true);
      this.player.anims.stop();
      this.player.setTexture(kind);
      this.player.setScale(1.05);
      this.player.setDrag(0);
      this.player.setMaxVelocity(kind === 'race_car' ? 900 : 700);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      body.setAllowGravity(false);
      body.setSize(70, 36).setOffset(10, 12);
      body.setVelocity(0, 0);
    }
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


  /** Power up robot + tracker, then stand outside with robot following. */
  private doActivateRobot(): void {
    // Ensure gear
    if (!this.flags.hasTracker || !this.trackerHeld) {
      this.equipTracker(true);
    }
    this.flags.robotActive = true;
    this.robot.setTexture('robot_sheet', 0);
    this.robot.play('robot-idle', true);

    // Always end outdoors so the player SEES the robot working
    if (this.flags.inHouse) this.exitHouse();
    if (this.flags.inJailBuilding) this.exitJail();
    if (this.flags.inLair) this.exitLair();
    if (this.civicId) this.exitCivic();
    // If still somehow indoors, force outdoor spawn
    this.flags.inLair = false;
    this.flags.inHouse = false;
    this.flags.inJailBuilding = false;
    this.civicId = null;
    this.indoorLayer.setVisible(false);
    this.worldLayer.setVisible(true);
    this.trailLayer.setVisible(true);

    if (!this.flags.inVehicle) {
      this.player.setPosition(SPAWN.playerOutdoor.x, SPAWN.playerOutdoor.y);
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      this.vehicle.setVisible(true);
      if (this.raceCar) this.raceCar.setVisible(true);
    }
    this.sasquatch.setVisible(!this.flags.sasquatchJailed);
    this.syncRobotBesidePlayer();
    this.robot.setVisible(true);
    this.robot.setDepth(9);
    this.robot.play('robot-walk', true);
    this.setPhase(MissionPhase.CanDrive);
    audio.success();
    this.statusLine = '🤖 ROBOT ACTIVATED! It is following you right now.';
    setDomStatus(this.statusLine);
    this.persistSave();
  }

  /** Activate tracker + robot partner (one tap can do both). */
  private doActivate(): void {
    // Prefer the clear “robot online outside” path so activation always feels real
    this.doActivateRobot();
  }

  /** Leave any indoor space so car / outdoor actions can't stack broken flags. */
  private leaveIndoorsIfNeeded(): void {
    if (this.flags.inHouse) this.exitHouse();
    if (this.flags.inLair) this.exitLair();
    if (this.flags.inJailBuilding) this.exitJail();
    if (this.civicId) this.exitCivic();
  }

  /** One-tap car — no robot required. Prefers nearby AI police cruiser if close. */
  private doEnterCar(kind: 'vehicle' | 'race_car' | 'police_car' = 'vehicle'): void {
    if (this.flattened) this.unflattenPlayer();
    this.leaveIndoorsIfNeeded();
    this.flags.inHouse = false;
    this.flags.inLair = false;
    this.flags.inJailBuilding = false;
    this.civicId = null;

    // Hop into a nearby city police car if standing close
    if (kind !== 'race_car') {
      const near = this.patrolCars.nearestCar(this.player.x, this.player.y, 110);
      if (near) {
        this.claimedPatrolIndex = near.index;
        this.patrolCars.claimCar(near.index);
        this.activeCarKey = 'police_car';
        this.player.setPosition(near.x, near.y);
        if (this.flags.sasquatchCaptured && !this.flags.sasquatchJailed) {
          this.sasquatch.setPosition(this.player.x - 28, this.player.y);
          this.sasquatch.setAngle(0);
          this.sasquatch.clearTint();
          this.flags.sasquatchInVehicle = true;
        }
        this.enterVehicle(true, 'police_car');
        this.player.setVelocity(500, 0);
        this.statusLine = '🚔 POLICE CAR — you hopped in! Hold D-pad to drive.';
        setDomStatus(this.statusLine);
        return;
      }
    }

    const car = kind === 'race_car' ? this.raceCar : this.vehicle;
    this.activeCarKey = kind === 'race_car' ? 'race_car' : 'vehicle';
    this.claimedPatrolIndex = null;
    if (kind === 'race_car') {
      this.vehicle.setVisible(true);
    } else {
      this.raceCar.setVisible(true);
    }

    this.player.setPosition(car.x, car.y);
    if (this.flags.sasquatchCaptured && !this.flags.sasquatchJailed) {
      this.sasquatch.setPosition(this.player.x - 28, this.player.y);
      this.sasquatch.setAngle(0);
      this.sasquatch.clearTint();
      const b = this.sasquatch.body as Phaser.Physics.Arcade.Body | undefined;
      if (b) b.enable = true;
      this.flags.sasquatchInVehicle = true;
    }
    this.enterVehicle(true, this.activeCarKey);
    const kick = kind === 'race_car' ? 620 : 480;
    this.player.setVelocity(kick, 0);
    this.statusLine =
      kind === 'race_car'
        ? this.flags.sasquatchInVehicle
          ? 'RACE CAR + Sasquatch — GO!'
          : 'RACE CAR — hold D-pad!'
        : this.flags.sasquatchInVehicle
          ? 'Security car + Sasquatch — DRIVE!'
          : 'Security car — hold D-pad! (Stand near a cruiser to hop in a POLICE CAR)';
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
    if (this.sasquatchSirenMode) this.setSasquatchForm(false);
    this.sasquatch.setVelocity(0, 0);
    const body = this.sasquatch.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) body.enable = false;

    // Stop walk, fall over
    try {
      this.sasquatch.anims.stop();
      this.sasquatch.setTexture('sasquatch_sheet', 0);
      this.sasquatch.setScale(0.92);
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

  private showIndoor(kind: 'lair' | 'jail' | 'house' | 'civic'): void {
    this.indoorLayer.setVisible(true);
    this.lairNodes.forEach((n) =>
      (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(kind === 'lair'),
    );
    this.jailNodes.forEach((n) =>
      (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(kind === 'jail'),
    );
    this.houseNodes.forEach((n) =>
      (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(kind === 'house'),
    );
    this.civicNodes.forEach((n) =>
      (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(kind === 'civic'),
    );
  }

  private isIndoors(): boolean {
    return this.flags.inLair || this.flags.inJailBuilding || this.flags.inHouse || this.civicId != null;
  }

  /** Enter any catalog building by id (door anim for first entry). */
  private enterBuilding(id: string, skipDoorAnim = false): void {
    const b = getEnterable(id);
    if (!b) return;
    if (b.kind === 'lair') {
      this.enterLair(skipDoorAnim);
      return;
    }
    if (b.kind === 'jail') {
      this.enterJail(skipDoorAnim);
      return;
    }
    if (b.kind === 'house') {
      this.enterHouse(skipDoorAnim);
      return;
    }
    this.enterCivic(b, skipDoorAnim);
  }

  private enterCivic(b: EnterableBuilding, skipDoorAnim = false): void {
    if (!skipDoorAnim && this.civicId !== b.id) {
      this.openDoorThen(b.id, () => this.enterCivic(b, true));
      return;
    }
    this.leaveOtherIndoorsExceptCivic();
    this.civicId = b.id;
    this.flags.inHouse = false;
    this.flags.inLair = false;
    this.flags.inJailBuilding = false;
    this.flags.inVehicle = false;
    this.ensurePlayerOnFootSheet();
    this.updatePlayerAnim(false);
    this.applyCivicTheme(b.theme || b.id);
    this.showIndoor('civic');
    this.worldLayer.setVisible(false);
    this.trailLayer.setVisible(false);
    this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
    this.sasquatch.setVisible(false);
    this.robot.setVisible(false);
    if (this.heldTracker) this.heldTracker.setVisible(false);
    this.player.setPosition(CIVIC_INTERIOR.exitX + 100, CIVIC_INTERIOR.exitY + 100);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(CIVIC_INTERIOR.x + CIVIC_INTERIOR.w / 2, CIVIC_INTERIOR.y + CIVIC_INTERIOR.h / 2);
    this.statusLine = `Door opened — ${b.label}. Walk around · EXIT to leave.`;
    setDomStatus(this.statusLine);
  }

  private leaveOtherIndoorsExceptCivic(): void {
    if (this.flags.inHouse) {
      this.flags.inHouse = false;
      this.houseNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    }
    if (this.flags.inLair) {
      this.flags.inLair = false;
      this.lairNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    }
    if (this.flags.inJailBuilding) {
      this.flags.inJailBuilding = false;
      this.jailNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    }
  }

  private exitCivic(): void {
    const id = this.civicId;
    const b = id ? getEnterable(id) : undefined;
    this.civicId = null;
    this.indoorLayer.setVisible(false);
    this.civicNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    this.worldLayer.setVisible(true);
    this.trailLayer.setVisible(true);
    if (!this.flags.inVehicle) {
      this.vehicle.setVisible(true);
      if (this.raceCar) this.raceCar.setVisible(true);
    }
    this.sasquatch.setVisible(!this.flags.sasquatchJailed);
    if (b) this.player.setPosition(b.doorX, b.doorY + 18);
    else this.player.setPosition(SPAWN.playerOutdoor.x, SPAWN.playerOutdoor.y);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (this.flags.hasTracker) this.equipTracker(true);
    if (this.flags.robotActive) {
      this.syncRobotBesidePlayer();
      this.robot.setVisible(true);
    }
    this.statusLine = b ? `Left ${b.label}.` : 'Back outside.';
    setDomStatus(this.statusLine);
  }

  /** Closest enterable door / building front the player can use. */
  private findNearbyEnterable(maxDist = 90): EnterableBuilding | null {
    let best: EnterableBuilding | null = null;
    let bestD = maxDist;
    for (const b of listEnterableBuildings()) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.doorX, b.doorY);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
      // Standing in the lower half of the building footprint also counts
      if (
        pointInRect(this.player.x, this.player.y, b.zone) &&
        this.player.y >= b.zone.y + b.zone.h * 0.45
      ) {
        const footprintBias = d * 0.5;
        if (!best || footprintBias < bestD) {
          best = b;
          bestD = Math.min(bestD, Math.max(40, footprintBias));
        }
      }
    }
    return best;
  }

  private enterLair(skipDoorAnim = false): void {
    if (!skipDoorAnim && !this.flags.inLair) {
      this.openDoorThen('hq', () => this.enterLair(true));
      return;
    }
    this.flags.inLair = true;
    this.flags.inHouse = false;
    this.flags.inJailBuilding = false;
    this.civicId = null;
    this.showIndoor('lair');
    this.worldLayer.setVisible(false);
    this.trailLayer.setVisible(false);
    this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
    this.sasquatch.setVisible(false);
    this.robot.setVisible(false);
    if (this.heldTracker) this.heldTracker.setVisible(false);
    this.player.setPosition(LAIR.exitX + 80, LAIR.exitY + 80);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(LAIR.x + LAIR.w / 2, LAIR.y + LAIR.h / 2);
    this.setPhase(MissionPhase.InUndergroundLair);
    this.statusLine = 'Door opened — secret gadget lair. Grab the tracker!';
    setDomStatus(this.statusLine);
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
    this.player.setPosition(SPAWN.playerOutdoor.x, SPAWN.playerOutdoor.y);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (this.flags.hasTracker) this.equipTracker(true);
    if (this.flags.robotActive) {
      this.syncRobotBesidePlayer();
      this.robot.setVisible(true);
      this.robot.play('robot-walk', true);
      this.setPhase(MissionPhase.CanDrive);
      this.statusLine = 'Robot following you! HOLD TRACKER · take a car to the forest.';
    } else if (this.flags.hasTracker) {
      this.setPhase(MissionPhase.HasTracker);
      this.statusLine = 'Holding Tracker. Activate robot next.';
    } else {
      this.setPhase(MissionPhase.AtSecurityHQ);
    }
  }

  private enterJail(skipDoorAnim = false): void {
    if (!skipDoorAnim && !this.flags.inJailBuilding) {
      this.openDoorThen('jail', () => this.enterJail(true));
      return;
    }
    this.flags.inJailBuilding = true;
    this.flags.inHouse = false;
    this.flags.inLair = false;
    this.civicId = null;
    this.flags.inVehicle = false;
    this.ensurePlayerOnFootSheet();
    this.updatePlayerAnim(false);
    this.showIndoor('jail');
    this.worldLayer.setVisible(false);
    this.trailLayer.setVisible(false);
    this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
    this.robot.setVisible(false);
    if (this.heldTracker) this.heldTracker.setVisible(false);
    this.player.setPosition(JAIL_INTERIOR.exitX + 100, JAIL_INTERIOR.exitY + 100);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(JAIL_INTERIOR.x + JAIL_INTERIOR.w / 2, JAIL_INTERIOR.y + JAIL_INTERIOR.h / 2);

    // Visiting jailed Sasquatch — show him in the cell
    if (this.flags.sasquatchJailed) {
      this.showJailedSasquatchVisit();
      this.statusLine = 'Visiting Sasquatch in his cell. He is locked up!';
      setDomStatus(this.statusLine);
    } else {
      this.sasquatch.setVisible(false);
      this.setPhase(MissionPhase.AtSuperJail);
      this.statusLine = 'Door opened — SUPER JAIL. Lock Sasquatch in the cell!';
      setDomStatus(this.statusLine);
    }
  }

  /** Show Sasquatch behind bars so you can visit him. */
  private showJailedSasquatchVisit(): void {
    this.sasquatch.setVisible(false);
    if (!this.jailedSprite) {
      this.jailedSprite = this.add
        .sprite(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY, 'sasquatch_sheet', 0)
        .setDepth(23)
        .setScale(1.05);
      this.indoorLayer.add(this.jailedSprite);
      this.jailNodes.push(this.jailedSprite);
    }
    this.jailedSprite.setTexture('sasquatch_sheet', 0);
    this.jailedSprite.setPosition(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY);
    this.jailedSprite.setVisible(true);
    this.jailedSprite.clearTint();
    if (this.jailedSprite.anims) {
      this.jailedSprite.play('sasquatch-idle', true); // mouth moves while you visit
    }
    this.cellMarker?.setVisible(true);

    if (!this.jailedLabel) {
      this.jailedLabel = this.add
        .text(JAIL_INTERIOR.cellX, JAIL_INTERIOR.cellY + 58, '║ VISITING SASQUATCH ║', {
          fontSize: '13px',
          color: '#ffe082',
          backgroundColor: '#000000cc',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(24);
      this.indoorLayer.add(this.jailedLabel);
      this.jailNodes.push(this.jailedLabel);
    }
    this.jailedLabel.setVisible(true);
    this.jailedLabel.setText('║ VISITING SASQUATCH ║');
  }

  private doVisitJail(): void {
    if (this.flags.inVehicle) {
      // exit car first so we can walk in
      this.flags.inVehicle = false;
      if (this.claimedPatrolIndex != null) {
        this.patrolCars.releaseCar(this.claimedPatrolIndex, this.player.x, this.player.y);
        this.claimedPatrolIndex = null;
      }
      this.ensurePlayerOnFootSheet();
    }
    this.leaveIndoorsIfNeeded();
    const jail = CITY_ZONES.find((z) => z.id === 'super_jail')!;
    this.player.setPosition(jail.x + jail.w / 2, jail.y + jail.h - 20);
    this.enterJail();
  }

  private doEnterHouse(): void {
    if (this.flags.inLair) this.exitLair();
    if (this.flags.inJailBuilding) this.exitJail();
    if (this.flags.inVehicle) {
      this.flags.inVehicle = false;
      this.ensurePlayerOnFootSheet();
      this.updatePlayerAnim(false);
    }
    this.enterHouse();
  }

  private enterHouse(skipDoorAnim = false): void {
    if (!skipDoorAnim && !this.flags.inHouse) {
      this.openDoorThen('house', () => this.enterHouse(true));
      return;
    }
    this.flags.inHouse = true;
    this.flags.inLair = false;
    this.flags.inJailBuilding = false;
    this.civicId = null;
    this.flags.inVehicle = false;
    this.ensurePlayerOnFootSheet();
    this.updatePlayerAnim(false);
    this.showIndoor('house');
    this.worldLayer.setVisible(false);
    this.trailLayer.setVisible(false);
    this.vehicle.setVisible(false);
    if (this.raceCar) this.raceCar.setVisible(false);
    this.sasquatch.setVisible(false);
    this.robot.setVisible(false);
    if (this.heldTracker) this.heldTracker.setVisible(false);
    this.player.setPosition(HOUSE_INTERIOR.exitX + 100, HOUSE_INTERIOR.exitY + 100);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(HOUSE_INTERIOR.x + HOUSE_INTERIOR.w / 2, HOUSE_INTERIOR.y + HOUSE_INTERIOR.h / 2);
    this.statusLine = 'Door opened — welcome home! Walk to the bed and SLEEP.';
    setDomStatus(this.statusLine);
  }

  private exitHouse(): void {
    if (this.lyingInBed) this.getOutOfBed();
    this.flags.inHouse = false;
    this.indoorLayer.setVisible(false);
    this.houseNodes.forEach((n) => (n as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    this.worldLayer.setVisible(true);
    this.trailLayer.setVisible(true);
    if (!this.flags.inVehicle) {
      this.vehicle.setVisible(true);
      if (this.raceCar) this.raceCar.setVisible(true);
    }
    this.sasquatch.setVisible(!this.flags.sasquatchJailed);
    this.player.setPosition(SPAWN.houseDoor.x, SPAWN.houseDoor.y);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (this.flags.hasTracker) this.equipTracker(true);
    if (this.flags.robotActive) {
      this.syncRobotBesidePlayer();
      this.robot.setVisible(true);
    }
    this.statusLine = this.flags.robotActive
      ? 'Left the house — robot is with you!'
      : 'Left the house. Have a great day!';
    setDomStatus(this.statusLine);
  }

  /** Enter house if needed, then sleep until morning. */
  private doSleep(): void {
    if (this.sleeping) return;
    // Skip door anim so sleep is instant once you're heading to bed
    if (!this.flags.inHouse) this.enterHouse(true);
    // Snap to bed for clarity
    this.player.setPosition(HOUSE_INTERIOR.bedX - 20, HOUSE_INTERIOR.bedY + 10);
    this.sleeping = true;
    this.statusLine = 'Sleeping… zzz';
    setDomStatus(this.statusLine);

    const fade = this.add
      .rectangle(
        HOUSE_INTERIOR.x + HOUSE_INTERIOR.w / 2,
        HOUSE_INTERIOR.y + HOUSE_INTERIOR.h / 2,
        HOUSE_INTERIOR.w + 40,
        HOUSE_INTERIOR.h + 40,
        0x000000,
        0,
      )
      .setDepth(80);
    this.tweens.add({
      targets: fade,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        const { fromHour, toHour } = this.dayNight.sleepUntilMorning();
        this.tweens.add({
          targets: fade,
          alpha: 0,
          duration: 600,
          delay: 350,
          onComplete: () => {
            fade.destroy();
            this.sleeping = false;
            this.statusLine = `Good morning! Slept from ${fromHour}:00 → ${toHour}:00. Exit when ready.`;
            setDomStatus(this.statusLine);
            audio.success();
            this.persistSave();
          },
        });
      },
    });
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
    this.player.setPosition(800, 420);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (this.flags.robotActive) {
      this.syncRobotBesidePlayer();
      this.robot.setVisible(true);
    }
    if (this.flags.rewardClaimed) this.setPhase(MissionPhase.FreeExplore);
  }

  private jailSasquatch(): void {
    this.flags.sasquatchJailed = true;
    this.flags.sasquatchInVehicle = false;
    this.flags.sasquatchCaptured = true;
    this.sasquatch.setVisible(false);
    this.showJailedSasquatchVisit();
    if (this.jailedLabel) this.jailedLabel.setText('║ JAILED ║');
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
    if (this.isIndoors()) {
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
