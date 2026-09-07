import Phaser from 'phaser';
import { BLDG_TEX, listEnterableBuildings } from '../world/BuildingCatalog';

/**
 * Solid building shells — people and cars cannot walk/drive THROUGH structures.
 * Only a south door gap stays open so you can walk up and press E to go IN.
 */
export class BuildingCollisionSystem {
  private scene: Phaser.Scene;
  private solids: Phaser.Physics.Arcade.StaticGroup;
  private bound = new Set<Phaser.GameObjects.GameObject>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.solids = scene.physics.add.staticGroup();
  }

  /** Build static bodies: full footprint + door notch only. */
  build(): void {
    for (const b of listEnterableBuildings()) {
      this.addBuildingShell(b.id, b.zone.x, b.zone.y, b.zone.w, b.zone.h, b.doorX, b.doorY);
    }
  }

  getSolids(): Phaser.Physics.Arcade.StaticGroup {
    return this.solids;
  }

  /**
   * WALL LAW — collide any mover with buildings.
   * Nothing ghosts through walls; enter only via the door gap.
   */
  bindMover(mover: Phaser.GameObjects.GameObject): void {
    if (this.bound.has(mover)) return;
    this.bound.add(mover);
    this.scene.physics.add.collider(mover, this.solids);
  }

  resolveNow(mover: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject): void {
    this.scene.physics.world.collide(mover, this.solids);
  }

  /** Push all bound movers out of solids (cars that tunnel with scripted velocity). */
  resolveAllBound(): void {
    for (const m of this.bound) {
      this.resolveNow(m);
    }
  }

  count(): number {
    return this.solids.getLength();
  }

  /** Craft-built house shell with south door gap. */
  addCraftHouse(id: string, buildingX: number, buildingY: number, scale = 0.46): void {
    this.removeCraftHouse(id);
    const w = BLDG_TEX.w * scale * 0.92;
    const h = BLDG_TEX.h * scale * 0.88;
    const x = buildingX - w / 2;
    const y = buildingY - h / 2;
    const doorX = buildingX;
    const doorY = buildingY + BLDG_TEX.doorLocalY * scale;
    this.addBuildingShell(id, x, y, w, h, doorX, doorY);
  }

  removeCraftHouse(id: string): void {
    for (const child of [...this.solids.getChildren()]) {
      const img = child as Phaser.Physics.Arcade.Image & { buildingId?: string };
      if (img.buildingId === id) {
        this.solids.remove(img, true, true);
      }
    }
  }

  /**
   * Three-piece shell: north mass + SW wing + SE wing.
   * Gap between wings = door approach (only way in).
   */
  private addBuildingShell(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    doorX: number,
    doorY: number,
  ): void {
    const pad = 6;
    const left = x + pad;
    const right = x + w - pad;
    const top = y + pad;
    const south = y + h - pad;
    // Door gap sits on the south face — keep a walkable apron to the door
    // Wide enough for player + Cybertruck to reach the door — NOT a through-passage
    const gap = Math.max(88, Math.min(120, w * 0.34));
    const gapL = doorX - gap / 2;
    const gapR = doorX + gap / 2;
    // North mass ends just above the door so you cannot cut through the facade
    const doorTop = Math.min(south - 24, Math.max(top + 40, doorY - 28));

    // 1) Main north / core mass (full width)
    this.addRect(id, (left + right) / 2, (top + doorTop) / 2, right - left, doorTop - top);

    // 2) South-west wing (left of door)
    if (gapL - left > 18) {
      this.addRect(id, (left + gapL) / 2, (doorTop + south) / 2, gapL - left, south - doorTop);
    }
    // 3) South-east wing (right of door)
    if (right - gapR > 18) {
      this.addRect(id, (gapR + right) / 2, (doorTop + south) / 2, right - gapR, south - doorTop);
    }
  }

  private addRect(id: string, cx: number, cy: number, bw: number, bh: number): void {
    if (bw < 8 || bh < 8) return;
    // Use Zone — StaticGroup.create() without a texture stays 32×32 (invisible ghost holes)
    const zone = this.scene.add.zone(cx, cy, bw, bh);
    this.scene.physics.add.existing(zone, true);
    const sb = zone.body as Phaser.Physics.Arcade.StaticBody;
    sb.setSize(bw, bh);
    sb.updateFromGameObject();
    this.solids.add(zone);
    (zone as unknown as { buildingId?: string }).buildingId = id;
  }
}
