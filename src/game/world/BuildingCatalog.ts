import { CITY_ZONES, type RectZone } from './WorldLayout';

/** Shared indoor footprint (same room shell as house/jail/lair). */
export const CIVIC_INTERIOR = {
  id: 'civic_interior',
  x: 200,
  y: 900,
  w: 700,
  h: 480,
  exitX: 280,
  exitY: 980,
} as const;

/** Hi-res facade textures are 512×448; door center sits 152px below image center. */
export const BLDG_TEX = { w: 512, h: 448, doorLocalY: 152, doorTexW: 72 } as const;

export type BuildingKind = 'lair' | 'jail' | 'house' | 'civic';

export interface EnterableBuilding {
  id: string;
  kind: BuildingKind;
  label: string;
  /** Outdoor door world position (flush on facade) */
  doorX: number;
  doorY: number;
  /** Building sprite world center */
  buildingX: number;
  buildingY: number;
  buildingScale: number;
  doorScale: number;
  /** Prompt on the door */
  prompt: string;
  /** Civic theme key (only for kind === 'civic') */
  theme?: string;
  zone: RectZone;
}

/**
 * Display scale for 512px facades — keeps world footprint similar to old 180px art
 * while staying crisp (HQ/Jail slightly larger).
 */
export function buildingSpriteScale(id: string): number {
  return id === 'security_hq' || id === 'super_jail' ? 0.58 : 0.46;
}

/** World position of the facade doorway (door sits ON the building). */
export function facadeDoorAnchor(z: RectZone, scale = buildingSpriteScale(z.id)): {
  buildingX: number;
  buildingY: number;
  doorX: number;
  doorY: number;
  doorScale: number;
  buildingScale: number;
} {
  const buildingX = z.x + z.w / 2;
  const buildingY = z.y + z.h / 2 - 10;
  const doorX = buildingX;
  const doorY = buildingY + BLDG_TEX.doorLocalY * scale;
  // Door texture is 72×96 — scale with facade so it fills the recess
  const doorScale = scale;
  return { buildingX, buildingY, doorX, doorY, doorScale, buildingScale: scale };
}

export interface CivicTheme {
  title: string;
  wall: number;
  accent: number;
  tip: string;
  propA: string;
  propB: string;
  propC: string;
}

/** Themed interiors for non-special civic buildings. */
export const CIVIC_THEMES: Record<string, CivicTheme> = {
  clinic: {
    title: '🏥 City Clinic',
    wall: 0xe0f7fa,
    accent: 0x00838f,
    tip: 'Nurse Ada keeps first-aid kits stocked. Feel better!',
    propA: 'Exam Bed',
    propB: 'Medicine Cabinet',
    propC: 'Reception Desk',
  },
  shop: {
    title: '🧰 Gadget Shop',
    wall: 0xfff8e1,
    accent: 0xef6c00,
    tip: 'Trackers, radios, and trail chalk — browse the shelves.',
    propA: 'Gadget Shelf',
    propB: 'Counter',
    propC: 'Display Case',
  },
  police_desk: {
    title: '🚓 City Police Desk',
    wall: 0xe8eaf6,
    accent: 0x1a237e,
    tip: 'Officer Pike files forest tips here. Stay safe out there.',
    propA: 'Booking Desk',
    propB: 'Radio Console',
    propC: 'Evidence Locker',
  },
  school: {
    title: '🏫 Friendship School',
    wall: 0xfff3e0,
    accent: 0x5d4037,
    tip: 'Classrooms teach trail safety and city kindness.',
    propA: 'Teacher Desk',
    propB: 'Chalkboard',
    propC: 'Student Desks',
  },
  library: {
    title: '📚 City Library',
    wall: 0xefebe9,
    accent: 0x4e342e,
    tip: 'Quiet stacks of cryptid lore and city maps.',
    propA: 'Book Stacks',
    propB: 'Reading Table',
    propC: 'Card Catalog',
  },
  market_row: {
    title: '🛒 Market Row Hall',
    wall: 0xfbe9e7,
    accent: 0xbf360c,
    tip: 'Fresh fruit, snacks, and city gossip for sale.',
    propA: 'Fruit Stall',
    propB: 'Checkout',
    propC: 'Produce Crates',
  },
  docks: {
    title: '⚓ River Docks Office',
    wall: 0xeceff1,
    accent: 0x37474f,
    tip: 'Harbor charts and rope coils. Watch your step on the pier.',
    propA: 'Harbor Desk',
    propB: 'Rope Coils',
    propC: 'Tide Chart',
  },
  airfield: {
    title: '✈️ Sky Patrol Pad',
    wall: 0xe3f2fd,
    accent: 0x1565c0,
    tip: 'Pilot Remy briefs sky patrol from this hangar office.',
    propA: 'Flight Desk',
    propB: 'Radio Tower Panel',
    propC: 'Map Table',
  },
  city_plaza: {
    title: '🏛️ Plaza Visitor Hall',
    wall: 0xf3e5f5,
    accent: 0x6a1b9a,
    tip: 'Welcome to the heart of the city — ask anyone for directions.',
    propA: 'Info Desk',
    propB: 'City Map Wall',
    propC: 'Bench Seating',
  },
  park: {
    title: '🌳 Park Pavilion',
    wall: 0xe8f5e9,
    accent: 0x2e7d32,
    tip: 'A shady pavilion for picnics and trail briefings.',
    propA: 'Picnic Tables',
    propB: 'Trail Map',
    propC: 'Water Fountain',
  },
};

const SPECIAL: Record<string, { kind: BuildingKind; prompt: string }> = {
  security_hq: { kind: 'lair', prompt: '[E] HQ Door → Lair' },
  super_jail: { kind: 'jail', prompt: '[E] Jail Door' },
  player_house: { kind: 'house', prompt: '[E] Front Door' },
};

/** Zones that are props / outdoors only — no interior door. */
const SKIP = new Set(['forest', 'vehicle_bay', 'race_bay', 'job_board']);

/**
 * Every labeled city building you can walk up to and enter.
 * Door anchors are computed from the building sprite facade (not zone bottom).
 */
export function listEnterableBuildings(): EnterableBuilding[] {
  const out: EnterableBuilding[] = [];
  for (const z of CITY_ZONES) {
    if (SKIP.has(z.id)) continue;
    const special = SPECIAL[z.id];
    const anchor = facadeDoorAnchor(z);
    if (special) {
      out.push({
        id: z.id,
        kind: special.kind,
        label: z.label,
        doorX: anchor.doorX,
        doorY: anchor.doorY,
        buildingX: anchor.buildingX,
        buildingY: anchor.buildingY,
        buildingScale: anchor.buildingScale,
        doorScale: anchor.doorScale,
        prompt: special.prompt,
        zone: z,
      });
    } else if (CIVIC_THEMES[z.id]) {
      out.push({
        id: z.id,
        kind: 'civic',
        label: z.label,
        doorX: anchor.doorX,
        doorY: anchor.doorY,
        buildingX: anchor.buildingX,
        buildingY: anchor.buildingY,
        buildingScale: anchor.buildingScale,
        doorScale: anchor.doorScale,
        prompt: `[E] Enter ${z.label}`,
        theme: z.id,
        zone: z,
      });
    }
  }
  return out;
}

export function getEnterable(id: string): EnterableBuilding | undefined {
  return listEnterableBuildings().find((b) => b.id === id);
}
