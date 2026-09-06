import Phaser from 'phaser';
import { BLDG_TEX } from '../world/BuildingCatalog';
import type { BuildingCollisionSystem } from './BuildingCollisionSystem';

export type SecretKind = 'rug' | 'cabinet' | 'picture' | 'table' | 'fridge';

const SECRET_KINDS: SecretKind[] = ['rug', 'cabinet', 'picture', 'table', 'fridge'];
const SAVE_KEY = 'ecraft_craft_houses_v1';
const SCALE = 0.46;

export interface CraftHouseRecord {
  id: string;
  name: string;
  buildingX: number;
  buildingY: number;
  doorX: number;
  doorY: number;
  secret: SecretKind;
  secretFound: boolean;
  goldCollected: boolean;
}

interface LiveHouse extends CraftHouseRecord {
  facade: Phaser.GameObjects.Container;
  door: Phaser.GameObjects.Image;
}

/**
 * Builder-placed walk-in houses with a randomized secret room + gold stash.
 * Secrets hide under rugs, behind cabinets/pictures, under tables, or in fridges.
 */
export class CraftHouseSystem {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private buildings: BuildingCollisionSystem;
  private houses = new Map<string, LiveHouse>();
  private seq = 1;
  private goldTotal = 0;
  activeHouseId: string | null = null;
  secretRoomOpen = false;

  constructor(
    scene: Phaser.Scene,
    outdoorLayer: Phaser.GameObjects.Container,
    buildings: BuildingCollisionSystem,
  ) {
    this.scene = scene;
    this.layer = outdoorLayer;
    this.buildings = buildings;
  }

  getGoldTotal(): number {
    return this.goldTotal;
  }

  list(): CraftHouseRecord[] {
    return [...this.houses.values()].map((h) => this.toRecord(h));
  }

  count(): number {
    return this.houses.size;
  }

  getActive(): LiveHouse | null {
    return this.activeHouseId ? this.houses.get(this.activeHouseId) ?? null : null;
  }

  getById(id: string): LiveHouse | undefined {
    return this.houses.get(id);
  }

  /** Place a walk-in craft house in front of the player (BUILD mode). */
  placeNear(px: number, py: number, facing: number, facingDir: string): string {
    let ax = px;
    let ay = py;
    if (facingDir === 'left' || facingDir === 'right') ax = px + facing * 90;
    else if (facingDir === 'up') ay = py - 90;
    else ay = py + 90;

    // Snap to grid-ish
    const buildingX = Math.round(ax / 20) * 20;
    const buildingY = Math.round(ay / 20) * 20 - 10;
    const doorLocalY = BLDG_TEX.doorLocalY * SCALE;
    const doorX = buildingX;
    const doorY = buildingY + doorLocalY;

    // Don't stack on another craft house door
    for (const h of this.houses.values()) {
      if (Phaser.Math.Distance.Between(doorX, doorY, h.doorX, h.doorY) < 100) {
        return 'Too close to another craft house.';
      }
    }

    const id = `craft_house_${this.seq++}`;
    const secret = SECRET_KINDS[Phaser.Math.Between(0, SECRET_KINDS.length - 1)];
    const name = `Craft House #${this.houses.size + 1}`;
    this.spawnLive({
      id,
      name,
      buildingX,
      buildingY,
      doorX,
      doorY,
      secret,
      secretFound: false,
      goldCollected: false,
    });
    this.persist();
    return `Built ${name}! Walk to the door · E to enter. (Secret gold is hidden inside…)`;
  }

  nearest(px: number, py: number, maxDist = 90): LiveHouse | null {
    let best: LiveHouse | null = null;
    let bestD = maxDist;
    for (const h of this.houses.values()) {
      const d = Phaser.Math.Distance.Between(px, py, h.doorX, h.doorY);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { houses: CraftHouseRecord[]; goldTotal?: number; seq?: number };
      this.goldTotal = data.goldTotal ?? 0;
      this.seq = data.seq ?? 1;
      for (const row of data.houses || []) {
        if (this.houses.has(row.id)) continue;
        this.spawnLive(row);
        const n = Number(row.id.replace('craft_house_', ''));
        if (!Number.isNaN(n) && n >= this.seq) this.seq = n + 1;
      }
    } catch {
      /* ignore */
    }
  }

  clearAll(): void {
    for (const h of [...this.houses.values()]) {
      this.buildings.removeCraftHouse(h.id);
      h.facade.destroy(true);
    }
    this.houses.clear();
    this.activeHouseId = null;
    this.secretRoomOpen = false;
    this.goldTotal = 0;
    localStorage.removeItem(SAVE_KEY);
  }

  markSecretFound(houseId: string): void {
    const h = this.houses.get(houseId);
    if (!h || h.secretFound) return;
    h.secretFound = true;
    this.secretRoomOpen = true;
    this.persist();
  }

  collectGold(houseId: string): string {
    const h = this.houses.get(houseId);
    if (!h) return 'No house.';
    if (!h.secretFound) return 'Find the secret first!';
    if (h.goldCollected) return 'Gold already taken from this house.';
    h.goldCollected = true;
    this.goldTotal += 1;
    this.persist();
    return `💰 Gold collected! Vault: ${this.goldTotal} bar${this.goldTotal === 1 ? '' : 's'}.`;
  }

  secretLabel(kind: SecretKind): string {
    switch (kind) {
      case 'rug':
        return 'rug';
      case 'cabinet':
        return 'cabinet';
      case 'picture':
        return 'picture';
      case 'table':
        return 'table';
      case 'fridge':
        return 'refrigerator';
    }
  }

  private spawnLive(rec: CraftHouseRecord): void {
    const facade = this.scene.add.container(rec.buildingX, rec.buildingY).setDepth(3);
    const body = this.scene.add.image(0, 0, 'bldg_house').setScale(SCALE);
    const localY = BLDG_TEX.doorLocalY * SCALE;
    const frame = this.scene.add.image(0, localY - 2 * SCALE, 'door_frame').setScale(SCALE * 0.92);
    const door = this.scene.add.image(0, localY, 'door').setScale(SCALE);
    const plaque = this.scene.add
      .text(0, -BLDG_TEX.h * SCALE * 0.42, rec.name.toUpperCase(), {
        fontSize: '11px',
        color: '#fffde7',
        backgroundColor: '#1a237ecc',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5);
    facade.add([body, frame, door, plaque]);
    this.layer.add(facade);
    this.buildings.addCraftHouse(rec.id, rec.buildingX, rec.buildingY, SCALE);
    this.houses.set(rec.id, { ...rec, facade, door });
  }

  private toRecord(h: LiveHouse): CraftHouseRecord {
    return {
      id: h.id,
      name: h.name,
      buildingX: h.buildingX,
      buildingY: h.buildingY,
      doorX: h.doorX,
      doorY: h.doorY,
      secret: h.secret,
      secretFound: h.secretFound,
      goldCollected: h.goldCollected,
    };
  }

  private persist(): void {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          houses: this.list(),
          goldTotal: this.goldTotal,
          seq: this.seq,
        }),
      );
    } catch {
      /* ignore */
    }
  }
}
