import Phaser from 'phaser';

/** Original voxel-style blocks — NOT Minecraft IP. */
export const CRAFT_BLOCKS = [
  { id: 'block_dirt', name: 'DIRT', color: '#8d6e63' },
  { id: 'block_grass', name: 'GRASS', color: '#43a047' },
  { id: 'block_stone', name: 'STONE', color: '#78909c' },
  { id: 'block_wood', name: 'WOOD', color: '#a1887f' },
  { id: 'block_brick', name: 'BRICK', color: '#c62828' },
  { id: 'block_gold', name: 'GOLD', color: '#ffd54f' },
  { id: 'block_water', name: 'WATER', color: '#29b6f6' },
  { id: 'block_sand', name: 'SAND', color: '#fdd835' },
] as const;

export type CraftBlockId = (typeof CRAFT_BLOCKS)[number]['id'];

const GRID = 40;
const SAVE_KEY = 'ecraft_craft_blocks_v1';

type CellKey = string; // "gx,gy"

interface Placed {
  key: CellKey;
  id: CraftBlockId;
  sprite: Phaser.GameObjects.Image;
}

/**
 * Minecraft-like building loop with original Craft Blocks:
 * grid snap · stack · place · break · hotbar · save.
 */
export class CraftBuildSystem {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private mode = false;
  private selected = 0;
  private cells = new Map<CellKey, Placed>();
  private ghost?: Phaser.GameObjects.Image;
  private depthBase = 11;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
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

  /** Update ghost in front of player. */
  updateGhost(px: number, py: number, facing: number, facingDir: string): void {
    if (!this.mode) {
      this.hideGhost();
      return;
    }
    this.ensureGhost();
    const { gx, gy } = this.aimCell(px, py, facing, facingDir);
    const { x, y } = this.cellToWorld(gx, gy);
    this.ghost!.setPosition(x, y);
    this.ghost!.setTexture(this.selectedId());
    this.ghost!.setVisible(true);
    this.ghost!.setAlpha(this.cells.has(this.key(gx, gy)) ? 0.25 : 0.55);
  }

  place(px: number, py: number, facing: number, facingDir: string): string {
    const { gx, gy } = this.aimCell(px, py, facing, facingDir);
    // Stack upward if cell occupied
    let ty = gy;
    let guard = 0;
    while (this.cells.has(this.key(gx, ty)) && guard < 12) {
      ty -= 1; // up on screen = smaller y
      guard++;
    }
    const k = this.key(gx, ty);
    if (this.cells.has(k)) return 'Stack full there — try another spot.';
    const { x, y } = this.cellToWorld(gx, ty);
    const sprite = this.scene.add.image(x, y, this.selectedId()).setDepth(this.depthBase + (20 - ty)).setScale(1);
    this.layer.add(sprite);
    this.cells.set(k, { key: k, id: this.selectedId(), sprite });
    this.persist();
    return `Placed ${this.selectedName()} (${this.cells.size} blocks)`;
  }

  /** Break nearest block in front / under aim. */
  breakAt(px: number, py: number, facing: number, facingDir: string): string {
    const { gx, gy } = this.aimCell(px, py, facing, facingDir);
    // Prefer top of stack in that column, else exact cell, else nearest
    for (let ty = gy - 8; ty <= gy + 2; ty++) {
      const k = this.key(gx, ty);
      const hit = this.cells.get(k);
      if (hit) {
        hit.sprite.destroy();
        this.cells.delete(k);
        this.persist();
        return `Broke ${hit.id.replace('block_', '')} · ${this.cells.size} left`;
      }
    }
    // Nearby fallback
    let best: Placed | null = null;
    let bestD = 70;
    for (const p of this.cells.values()) {
      const d = Phaser.Math.Distance.Between(px, py, p.sprite.x, p.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return 'No block to break nearby.';
    best.sprite.destroy();
    this.cells.delete(best.key);
    this.persist();
    return `Broke ${best.id.replace('block_', '')} · ${this.cells.size} left`;
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
        const sprite = this.scene.add.image(x, y, row.id).setDepth(this.depthBase + (20 - row.gy)).setScale(1);
        this.layer.add(sprite);
        this.cells.set(k, { key: k, id: row.id, sprite });
      }
    } catch {
      /* ignore */
    }
  }

  clearAll(): void {
    for (const p of this.cells.values()) p.sprite.destroy();
    this.cells.clear();
    localStorage.removeItem(SAVE_KEY);
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
