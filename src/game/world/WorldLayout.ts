/** Top-down world layout for E-CRAFT v0.1 (original placeholder geometry). */

export const WORLD = {
  width: 3600,
  height: 2600,
} as const;

export interface RectZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  interact?: string;
}

/** Outdoor / city layer zones */
export const CITY_ZONES: RectZone[] = [
  {
    id: 'security_hq',
    label: 'Security Headquarters',
    x: 180,
    y: 160,
    w: 420,
    h: 300,
    color: 0x2a4a7a,
    interact: 'enter_hq',
  },
  {
    id: 'super_jail',
    label: 'SUPER JAIL',
    x: 640,
    y: 160,
    w: 360,
    h: 300,
    color: 0x5a2a2a,
    interact: 'enter_jail',
  },
  {
    id: 'vehicle_bay',
    label: 'Security Vehicle',
    x: 220,
    y: 500,
    w: 160,
    h: 90,
    color: 0x1e7a3a,
    interact: 'vehicle',
  },
  {
    id: 'city_plaza',
    label: 'City Plaza',
    x: 1100,
    y: 400,
    w: 500,
    h: 360,
    color: 0x3a3a4a,
  },
  {
    id: 'clinic',
    label: 'City Clinic',
    x: 1650,
    y: 280,
    w: 220,
    h: 180,
    color: 0x1a4a4a,
  },
  {
    id: 'airfield',
    label: 'Sky Patrol Pad',
    x: 1650,
    y: 520,
    w: 260,
    h: 160,
    color: 0x3a3a5a,
  },
  {
    id: 'shop',
    label: 'Gadget Shop',
    x: 900,
    y: 280,
    w: 180,
    h: 150,
    color: 0x4a3a1a,
  },
  {
    id: 'job_board',
    label: 'Job Board',
    x: 520,
    y: 500,
    w: 140,
    h: 100,
    color: 0x3e2723,
    interact: 'jobs',
  },
  {
    id: 'park',
    label: 'Friendship Park',
    x: 1100,
    y: 820,
    w: 360,
    h: 220,
    color: 0x2e7d32,
  },
  {
    id: 'forest',
    label: 'Forest / Wilderness',
    x: 2100,
    y: 200,
    w: 1300,
    h: 2000,
    color: 0x1a4a28,
  },
];

/** Indoor: underground gadget lair (shown when player is in lair mode) */
export const LAIR = {
  id: 'gadget_lair',
  label: 'Secret Underground Gadget Lair',
  x: 200,
  y: 900,
  w: 700,
  h: 480,
  color: 0x1a1a2e,
  trackerX: 420,
  trackerY: 1120,
  robotX: 620,
  robotY: 1120,
  exitX: 280,
  exitY: 980,
};

/** Indoor: Super Jail interior */
export const JAIL_INTERIOR = {
  id: 'jail_interior',
  label: 'SUPER JAIL Interior',
  x: 200,
  y: 900,
  w: 700,
  h: 480,
  color: 0x2a1515,
  cellX: 620,
  cellY: 1120,
  cellW: 160,
  cellH: 140,
  exitX: 280,
  exitY: 980,
};

/** Simple road rectangles (visual + driveable feel) */
export const ROADS: RectZone[] = [
  { id: 'road_h1', label: 'Main Road', x: 100, y: 720, w: 2000, h: 80, color: 0x333340 },
  { id: 'road_v1', label: 'Forest Road', x: 1900, y: 200, w: 80, h: 1600, color: 0x333340 },
  { id: 'road_h2', label: 'HQ Drive', x: 200, y: 480, w: 80, h: 280, color: 0x333340 },
];

export const SPAWN = {
  playerOutdoor: { x: 320, y: 620 },
  vehicle: { x: 300, y: 545 },
  sasquatchForest: { x: 2700, y: 900 },
};

export function pointInRect(
  px: number,
  py: number,
  r: { x: number; y: number; w: number; h: number },
): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
