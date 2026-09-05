const edges = {
  AtSecurityHQ: ['InUndergroundLair'],
  InUndergroundLair: ['HasTracker'],
  HasTracker: ['RobotActive'],
  RobotActive: ['CanDrive'],
  CanDrive: ['Tracking'],
  Tracking: ['FoundSasquatch'],
  FoundSasquatch: ['Captured'],
  Captured: ['Transporting'],
  Transporting: ['AtSuperJail'],
  AtSuperJail: ['Jailed'],
  Jailed: ['Rewarded'],
  Rewarded: ['FreeExplore'],
  FreeExplore: [],
};
let cur = 'AtSecurityHQ';
const path = [cur];
while (edges[cur]?.length) {
  cur = edges[cur][0];
  path.push(cur);
}
if (path.at(-1) !== 'FreeExplore') throw new Error('incomplete');
console.log('MISSION PATH OK:', path.join(' → '));
