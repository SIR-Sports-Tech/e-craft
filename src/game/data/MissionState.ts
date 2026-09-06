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
  [MissionPhase.AtSecurityHQ]:
    '① Tap purple ACTIVATE ROBOT (or enter HQ → lair with E) ② Tap orange GET IN CAR ③ Hold D-pad ▶ to drive',
  [MissionPhase.InUndergroundLair]:
    'In the lair: pick up the Tracker (E), then tap purple ACTIVATE ROBOT — or EXIT and tap it outside.',
  [MissionPhase.HasTracker]:
    'Tap purple ACTIVATE ROBOT now — the robot appears beside you. Then tap orange GET IN CAR.',
  [MissionPhase.RobotActive]:
    'Robot is ON! Tap orange GET IN CAR (or RACE), then HOLD the right D-pad ▶ to drive east to the forest.',
  [MissionPhase.CanDrive]:
    'You can drive! Tap GET IN CAR / RACE, then HOLD ▶ on the D-pad. Go east into the forest for the trail.',
  [MissionPhase.Tracking]: 'Follow the gold trail / arrow. HOLD TRACKER helps. Robot radios tips if you get lost.',
  [MissionPhase.FoundSasquatch]: 'Near Sasquatch: tap CAPTURE (or Space). When he is DOWN, tap GET IN CAR to load him.',
  [MissionPhase.Captured]: 'Sasquatch is down — tap GET IN CAR to load him, then drive to SUPER JAIL.',
  [MissionPhase.Transporting]: 'Drive to SUPER JAIL (follow the map). Hold D-pad to steer.',
  [MissionPhase.AtSuperJail]: 'Walk to SUPER JAIL door and tap E — lock Sasquatch in the cell.',
  [MissionPhase.Jailed]: 'Mission almost complete… visit jail anytime with VISIT JAIL.',
  [MissionPhase.Rewarded]: 'You earned the reward! Keep exploring — cars still work anytime.',
  [MissionPhase.FreeExplore]: 'Free explore. ACTIVATE ROBOT · GET IN CAR · hold D-pad anytime.',
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
  inHouse: boolean;
  sasquatchCaptured: boolean;
  sasquatchInVehicle: boolean;
  sasquatchJailed: boolean;
  rewardClaimed: boolean;
}
