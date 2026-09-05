/** E-CRAFT v0.1 mission progression — source of truth for the Sasquatch loop. */

export enum MissionPhase {
  AtSecurityHQ = 'AtSecurityHQ',
  InUndergroundLair = 'InUndergroundLair',
  HasTracker = 'HasTracker',
  RobotActive = 'RobotActive',
  CanDrive = 'CanDrive',
  Tracking = 'Tracking',
  FoundSasquatch = 'FoundSasquatch',
  Captured = 'Captured',
  Transporting = 'Transporting',
  AtSuperJail = 'AtSuperJail',
  Jailed = 'Jailed',
  Rewarded = 'Rewarded',
  FreeExplore = 'FreeExplore',
}

export const REWARD_TEXT = '$10,000 TRILLION BILLION';

export const PHASE_HINTS: Record<MissionPhase, string> = {
  [MissionPhase.AtSecurityHQ]: 'Enter Security HQ, then go underground to the gadget lair. (E)',
  [MissionPhase.InUndergroundLair]: 'Pick up the Sasquatch Tracker, then activate your robot partner. (E)',
  [MissionPhase.HasTracker]: 'Activate your friendly robot partner. (E)',
  [MissionPhase.RobotActive]: 'Exit the lair and enter the security vehicle. (E)',
  [MissionPhase.CanDrive]: 'Drive to the forest and find the Sasquatch trail.',
  [MissionPhase.Tracking]: 'Follow the trail. Your robot will help if you lose it.',
  [MissionPhase.FoundSasquatch]: 'Capture Sasquatch! (Space near Sasquatch)',
  [MissionPhase.Captured]: 'Get Sasquatch into the security vehicle. (E)',
  [MissionPhase.Transporting]: 'Drive Sasquatch back to Security HQ / Super Jail.',
  [MissionPhase.AtSuperJail]: 'Enter Super Jail and lock Sasquatch in a cell. (E)',
  [MissionPhase.Jailed]: 'Mission almost complete…',
  [MissionPhase.Rewarded]: 'You earned the reward! Keep exploring.',
  [MissionPhase.FreeExplore]: 'Free explore mode. The city remembers your mission.',
};

export type TrailKind = 'footprint' | 'branch' | 'fur' | 'mud' | 'scratch';

export const TRAIL_LABELS: Record<TrailKind, string> = {
  footprint: 'Footprint',
  branch: 'Broken branch',
  fur: 'Fur tuft',
  mud: 'Mud mark',
  scratch: 'Scratch',
};

export interface GameFlags {
  hasTracker: boolean;
  robotActive: boolean;
  inVehicle: boolean;
  inLair: boolean;
  inJailBuilding: boolean;
  sasquatchCaptured: boolean;
  sasquatchInVehicle: boolean;
  sasquatchJailed: boolean;
  rewardClaimed: boolean;
}
