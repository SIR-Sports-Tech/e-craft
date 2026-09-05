import Phaser from 'phaser';
import { MissionPhase } from '../data/MissionState';
import { CITY_ZONES, JAIL_INTERIOR, LAIR, SPAWN } from '../world/WorldLayout';

export interface ObjectiveTarget {
  x: number;
  y: number;
  label: string;
}

/** Always points the player at the next v0.1 mission step. */
export function objectiveFor(
  phase: MissionPhase,
  flags: {
    hasTracker: boolean;
    robotActive: boolean;
    inVehicle: boolean;
    inLair: boolean;
    inJailBuilding: boolean;
    sasquatchCaptured: boolean;
    sasquatchInVehicle: boolean;
    sasquatchJailed: boolean;
  },
  live?: { sasquatch?: { x: number; y: number }; vehicle?: { x: number; y: number }; player?: { x: number; y: number } },
): ObjectiveTarget {
  const hq = CITY_ZONES.find((z) => z.id === 'security_hq')!;
  const jail = CITY_ZONES.find((z) => z.id === 'super_jail')!;
  const forest = CITY_ZONES.find((z) => z.id === 'forest')!;

  if (flags.inLair) {
    if (!flags.hasTracker) return { x: LAIR.trackerX, y: LAIR.trackerY, label: 'Get Tracker' };
    if (!flags.robotActive) return { x: LAIR.robotX, y: LAIR.robotY, label: 'Activate Robot' };
    return { x: LAIR.exitX + 40, y: LAIR.exitY + 20, label: 'Exit Lair' };
  }
  if (flags.inJailBuilding) {
    if (!flags.sasquatchJailed) {
      return { x: JAIL_INTERIOR.cellX, y: JAIL_INTERIOR.cellY, label: 'Lock Cell' };
    }
    return { x: JAIL_INTERIOR.exitX + 40, y: JAIL_INTERIOR.exitY + 20, label: 'Exit Jail' };
  }
  if (!flags.hasTracker) {
    return { x: hq.x + hq.w / 2, y: hq.y + hq.h - 20, label: 'Enter HQ Lair' };
  }
  if (!flags.robotActive) {
    return { x: hq.x + hq.w / 2, y: hq.y + hq.h - 20, label: 'Return to Lair' };
  }
  if (!flags.inVehicle && !flags.sasquatchCaptured) {
    const v = live?.vehicle ?? SPAWN.vehicle;
    return { x: v.x, y: v.y, label: 'Enter Vehicle' };
  }
  if (flags.sasquatchCaptured && !flags.sasquatchInVehicle) {
    const v = live?.vehicle ?? SPAWN.vehicle;
    return { x: v.x, y: v.y, label: 'Load Sasquatch' };
  }
  if (flags.sasquatchInVehicle && !flags.sasquatchJailed) {
    return { x: jail.x + jail.w / 2, y: jail.y + jail.h / 2, label: 'SUPER JAIL' };
  }
  if (!flags.sasquatchCaptured) {
    if (live?.sasquatch) {
      return { x: live.sasquatch.x, y: live.sasquatch.y, label: 'Find Sasquatch' };
    }
    return { x: forest.x + 200, y: forest.y + 400, label: 'Forest Trail' };
  }
  if (phase === MissionPhase.FreeExplore || flags.sasquatchJailed) {
    return { x: hq.x + hq.w / 2, y: hq.y + hq.h / 2, label: 'Explore' };
  }
  return { x: forest.x + 200, y: forest.y + 400, label: 'Continue' };
}

export class ObjectiveMarker {
  private scene: Phaser.Scene;
  private arrow: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.arrow = scene.add.container(0, 0).setDepth(60);
    const tri = scene.add.triangle(0, 0, 0, -20, 14, 12, -14, 12, 0xffee58);
    const ring = scene.add.circle(0, 0, 22, 0xffee58, 0.2).setStrokeStyle(2, 0xffee58, 0.8);
    const label = scene.add
      .text(0, 28, '', {
        fontSize: '12px',
        color: '#fffde7',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0);
    this.arrow.add([ring, tri, label]);
    (this.arrow as unknown as { label: Phaser.GameObjects.Text }).label = label;
  }

  update(playerX: number, playerY: number, target: ObjectiveTarget): void {
    const dist = Phaser.Math.Distance.Between(playerX, playerY, target.x, target.y);
    // Place marker toward objective; snap onto target when close
    const t = dist < 120 ? 1 : 0.72;
    const x = Phaser.Math.Linear(playerX, target.x, t);
    const y = Phaser.Math.Linear(playerY, target.y, t);
    this.arrow.setPosition(x, y);
    const angle = Phaser.Math.Angle.Between(playerX, playerY, target.x, target.y);
    this.arrow.setRotation(angle + Math.PI / 2);
    const label = (this.arrow as unknown as { label: Phaser.GameObjects.Text }).label;
    label.setRotation(-(angle + Math.PI / 2));
    label.setText(`${target.label} (${Math.round(dist)}m)`);
    this.arrow.setVisible(true);
  }
}
