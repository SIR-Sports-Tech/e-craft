import Phaser from 'phaser';
import { CITY_ZONES } from '../world/WorldLayout';
import { BLDG_TEX, buildingSpriteScale, facadeDoorAnchor, listEnterableBuildings } from '../world/BuildingCatalog';

/** Zones that stay walk-through (pads / outdoors props). */
const SKIP = new Set(['forest', 'vehicle_bay', 'race_bay', 'job_board']);

/**
 * Solid footprints for city buildings so people and cars cannot walk/drive through them.
 * Door approach stays open on the south face (E to enter still works at the facade door).
 */
export class BuildingCollisionSystem {
  private scene: Phaser.Scene;
  private solids: Phaser.Physics.Arcade.StaticGroup;
  private bound = new Set<Phaser.GameObjects.GameObject>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.solids = scene.physics.add.staticGroup();
  }

  /** Build static bodies from enterable / solid civic footprints. */
  build(): void {
    const enterableIds = new Set(listEnterableBuildings().map((b) => b.id));
    for (const z of CITY_ZONES) {
      if (SKIP.has(z.id)) continue;
      // Only solid architecture (enterable buildings + any other labeled structures)
      if (!enterableIds.has(z.id) && z.id !== 'player_house') continue;

      const scale = buildingSpriteScale(z.id);
      const anchor = facadeDoorAnchor(z, scale);
      const bw = BLDG_TEX.w * scale * 0.78;
      const bh = BLDG_TEX.h * scale * 0.58;
      // Shift collider up so south door apron stays walkable
      const cx = anchor.buildingX;
      const cy = anchor.buildingY - bh * 0.12;

      const body = this.solids.create(cx, cy, undefined) as Phaser.Physics.Arcade.Image;
      body.setVisible(false);
      body.setActive(true);
      body.setSize(bw, bh);
      body.refreshBody();
      (body as unknown as { buildingId?: string }).buildingId = z.id;
    }
  }

  getSolids(): Phaser.Physics.Arcade.StaticGroup {
    return this.solids;
  }

  /**
   * Collide any mover with buildings.
   * WALL LAW: people, cars, police, animals — nothing ghosts through.
   */
  bindMover(mover: Phaser.GameObjects.GameObject): void {
    if (this.bound.has(mover)) return;
    this.bound.add(mover);
    this.scene.physics.add.collider(mover, this.solids);
  }

  /** Immediate resolve after scripted setPosition / tween steps. */
  resolveNow(mover: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject): void {
    this.scene.physics.world.collide(mover, this.solids);
  }

  count(): number {
    return this.solids.getLength();
  }

  /** Dynamic footprint for player-built craft houses (door apron left open south). */
  addCraftHouse(id: string, buildingX: number, buildingY: number, scale = 0.46): void {
    this.removeCraftHouse(id);
    const bw = BLDG_TEX.w * scale * 0.78;
    const bh = BLDG_TEX.h * scale * 0.58;
    const cx = buildingX;
    const cy = buildingY - bh * 0.12;
    const body = this.solids.create(cx, cy, undefined) as Phaser.Physics.Arcade.Image;
    body.setVisible(false);
    body.setActive(true);
    body.setSize(bw, bh);
    body.refreshBody();
    (body as unknown as { buildingId?: string }).buildingId = id;
  }

  removeCraftHouse(id: string): void {
    for (const child of this.solids.getChildren()) {
      const img = child as Phaser.Physics.Arcade.Image & { buildingId?: string };
      if (img.buildingId === id) {
        this.solids.remove(img, true, true);
      }
    }
  }
}
