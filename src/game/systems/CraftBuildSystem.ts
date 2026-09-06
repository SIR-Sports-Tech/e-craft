import Phaser from 'phaser';

/**
 * Original voxel-style Craft Blocks — NOT Minecraft IP.
 * Minecraft-like loop: grid · stack · place · break · hotbar · collide · save.
 */
export const CRAFT_BLOCKS = [
  { id: 'block_dirt', name: 'DIRT', color: '#8d6e63', solid: true },
  { id: 'block_grass', name: 'GRASS', color: '#43a047', solid: true },
  { id: 'block_stone', name: 'STONE', color: '#78909c', solid: true },
  { id: 'block_wood', name: 'WOOD', color: '#a1887f', solid: true },
  { id: 'block_brick', name: 'BRICK', color: '#c62828', solid: true },
  { id: 'block_gold', name: 'GOLD', color: '#ffd54f', solid: true },
  { id: 'block_water', name: 'WATER', color: '#29b6f6', solid: false },
  { id: 'block_sand', name: 'SAND', color: '#fdd835', solid: true },
  { id: 'block_leaf', name: 'LEAF', color: '#66bb6a', solid: false },
  { id: 'block_glass', name: 'GLASS', color: '#b3e5fc', solid: true },
  { id: 'block_iron', name: 'IRON', color: '#90a4ae', solid: true },
  { id: 'block_wool', name: 'WOOL', color: '#f5f5f5', solid: true },
] as const;

export type CraftBlockId = (typeof CRAFT_BLOCKS)[number]['id'];

const GRID = 40;
const SAVE_KEY = 'ecraft_craft_blocks_v1';
const MAX_STACK = 16;

type CellKey = string; // "gx,gy"

interface Placed {
  key: CellKey;
  id: CraftBlockId;
  sprite: Phaser.GameObjects.Image;
  body?: Phaser.Physics.Arcade.Image;
}

function blockMeta(id: CraftBlockId) {
  return CRAFT_BLOCKS.find((b) => b.id === id)!;
}

/**
 * Minecraft-like building with original Craft Blocks:
 * grid snap · stack · place · break · hotbar · solid collision · persistence.
 */
export class CraftBuildSystem {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private mode = false;
  private selected = 0;
  private cells = new Map<CellKey, Placed>();
  private ghost?: Phaser.GameObjects.Image;
  private depthBase = 11;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private lastAim: { gx: number; gy: number } | null = null;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
    this.solids = scene.physics.add.staticGroup();
  }

  /** Collide player with solid Craft Blocks (walk on / bump walls). */
  bindPlayer(player: Phaser.GameObjects.GameObject): void {
    this.scene.physics.add.collider(player, this.solids);
  }

  isMode(): boolean {
    return this.mode;
  }

  selectedId(): CraftBlockId {
    return CRAFT_BLOCKS[this.selected].id;
  }

  selectedName(): string {
    return CRAFT_BLOCKS[this.selected].name;
  }

  selectedIndex(): number {
    return this.selected;
  }

  blockCount(): number {
    return CRAFT_BLOCKS.length;
  }

  count(): number {
    return this.cells.size;
  }

  toggleMode(): boolean {
    this.mode = !this.mode;
    if (this.mode) this.ensureGhost();
    else this.hideGhost();
    return this.mode;
  }

  setMode(on: boolean): void {
    this.mode = on;
    if (on) this.ensureGhost();
    else this.hideGhost();
  }

  cycle(dir = 1): void {
    this.selected = (this.selected + dir + CRAFT_BLOCKS.length) % CRAFT_BLOCKS.length;
    if (this.ghost) this.ghost.setTexture(this.selectedId());
  }

  select(index: number): void {
    if (index < 0 || index >= CRAFT_BLOCKS.length) return;
    this.selected = index;
    if (this.ghost) this.ghost.setTexture(this.selectedId());
  }

  /** Aim from pointer world coords (tap/click to build like Minecraft). */
  aimAtWorld(wx: number, wy: number): void {
    this.lastAim = {
      gx: Math.round(wx / GRID),
      gy: Math.round(wy / GRID),
    };
    if (this.mode && this.ghost) {
      const { x, y } = this.cellToWorld(this.lastAim.gx, this.lastAim.gy);
      this.ghost.setPosition(x, y);
      this.ghost.setTexture(this.selectedId());
      this.ghost.setVisible(true);
      this.ghost.setAlpha(this.cells.has(this.key(this.lastAim.gx, this.lastAim.gy)) ? 0.25 : 0.55);
    }
  }

  /** Update ghost in front of player (when no recent pointer aim). */
  updateGhost(px: number, py: number, facing: number, facingDir: string): void {
    if (!this.mode) {
      this.hideGhost();
      return;
    }
    this.ensureGhost();
    const aim = this.lastAim ?? this.aimCell(px, py, facing, facingDir);
    const { x, y } = this.cellToWorld(aim.gx, aim.gy);
    this.ghost!.setPosition(x, y);
    this.ghost!.setTexture(this.selectedId());
    this.ghost!.setVisible(true);
    this.ghost!.setAlpha(this.cells.has(this.key(aim.gx, aim.gy)) ? 0.25 : 0.55);
  }

  clearPointerAim(): void {
    this.lastAim = null;
  }

  place(px: number, py: number, facing: number, facingDir: string): string {
    const base = this.lastAim ?? this.aimCell(px, py, facing, facingDir);
    return this.placeAt(base.gx, base.gy);
  }

  placeAt(gx: number, gy: number): string {
    // Stack upward if cell occupied
    let ty = gy;
    let guard = 0;
    while (this.cells.has(this.key(gx, ty)) && guard < MAX_STACK) {
      ty -= 1; // up on screen = smaller y
      guard++;
    }
    const k = this.key(gx, ty);
    if (this.cells.has(k)) return 'Stack full there — try another spot.';
    const id = this.selectedId();
    const { x, y } = this.cellToWorld(gx, ty);
    const sprite = this.scene.add
      .image(x, y, id)
      .setDepth(this.depthBase + (20 - ty))
      .setScale(1);
    this.layer.add(sprite);

    let body: Phaser.Physics.Arcade.Image | undefined;
    if (blockMeta(id).solid) {
      body = this.solids.create(x, y, id) as Phaser.Physics.Arcade.Image;
      body.setVisible(false);
      body.setSize(GRID - 4, GRID - 4);
      body.refreshBody();
    }

    this.cells.set(k, { key: k, id, sprite, body });
    this.burst(x, y, 0xffffff);
    this.persist();
    this.lastAim = null;
    return `Placed ${this.selectedName()} (${this.cells.size} blocks)`;
  }

  /** Break nearest block in front / under aim. */
  breakAt(px: number, py: number, facing: number, facingDir: string): string {
    const aim = this.lastAim ?? this.aimCell(px, py, facing, facingDir);
    // Prefer top of stack in that column, else exact cell, else nearest
    for (let ty = aim.gy - MAX_STACK; ty <= aim.gy + 2; ty++) {
      const k = this.key(aim.gx, ty);
      const hit = this.cells.get(k);
      if (hit) {
        return this.destroyPlaced(hit);
      }
    }
    // Nearby fallback
    let best: Placed | null = null;
    let bestD = 80;
    for (const p of this.cells.values()) {
      const d = Phaser.Math.Distance.Between(px, py, p.sprite.x, p.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return 'No block to break nearby.';
    return this.destroyPlaced(best);
  }

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Array<{ gx: number; gy: number; id: CraftBlockId }>;
      for (const row of data) {
        if (!CRAFT_BLOCKS.some((b) => b.id === row.id)) continue;
        const k = this.key(row.gx, row.gy);
        if (this.cells.has(k)) continue;
        const { x, y } = this.cellToWorld(row.gx, row.gy);
        const sprite = this.scene.add
          .image(x, y, row.id)
          .setDepth(this.depthBase + (20 - row.gy))
          .setScale(1);
        this.layer.add(sprite);
        let body: Phaser.Physics.Arcade.Image | undefined;
        if (blockMeta(row.id).solid) {
          body = this.solids.create(x, y, row.id) as Phaser.Physics.Arcade.Image;
          body.setVisible(false);
          body.setSize(GRID - 4, GRID - 4);
          body.refreshBody();
        }
        this.cells.set(k, { key: k, id: row.id, sprite, body });
      }
    } catch {
      /* ignore */
    }
  }

  clearAll(): void {
    for (const p of this.cells.values()) {
      p.sprite.destroy();
      p.body?.destroy();
    }
    this.cells.clear();
    this.solids.clear(true, true);
    localStorage.removeItem(SAVE_KEY);
  }

  private destroyPlaced(hit: Placed): string {
    const name = hit.id.replace('block_', '');
    this.burst(hit.sprite.x, hit.sprite.y, 0xffab91);
    hit.sprite.destroy();
    hit.body?.destroy();
    this.cells.delete(hit.key);
    this.persist();
    this.lastAim = null;
    return `Broke ${name} · ${this.cells.size} left`;
  }

  private burst(x: number, y: number, tint: number): void {
    for (let i = 0; i < 6; i++) {
      const p = this.scene.add
        .rectangle(x, y, 6, 6, tint, 0.9)
        .setDepth(60);
      this.layer.add(p);
      this.scene.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-28, 28),
        y: y + Phaser.Math.Between(-28, 28),
        alpha: 0,
        duration: 280,
        onComplete: () => p.destroy(),
      });
    }
  }

  private persist(): void {
    const data = [...this.cells.values()].map((p) => {
      const [gx, gy] = p.key.split(',').map(Number);
      return { gx, gy, id: p.id };
    });
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  private aimCell(px: number, py: number, facing: number, facingDir: string): { gx: number; gy: number } {
    let ax = px;
    let ay = py;
    if (facingDir === 'left' || facingDir === 'right') {
      ax = px + facing * (GRID * 0.9);
    } else if (facingDir === 'up') {
      ay = py - GRID * 0.9;
    } else {
      ay = py + GRID * 0.9;
    }
    return {
      gx: Math.round(ax / GRID),
      gy: Math.round(ay / GRID),
    };
  }

  private cellToWorld(gx: number, gy: number): { x: number; y: number } {
    return { x: gx * GRID, y: gy * GRID };
  }

  private key(gx: number, gy: number): CellKey {
    return `${gx},${gy}`;
  }

  private ensureGhost(): void {
    if (this.ghost) return;
    this.ghost = this.scene.add.image(0, 0, this.selectedId()).setDepth(50).setAlpha(0.5).setScale(1);
    this.layer.add(this.ghost);
  }

  private hideGhost(): void {
    this.ghost?.setVisible(false);
  }
}
