import Phaser from 'phaser';

/**
 * Original Craft Blocks — NOT Minecraft IP.
 * Minecraft-like Creative: 3-axis grid (x/z ground + height), stack on top,
 * TOP / ISO view angles, place/break/hotbar/collide/save.
 */
export const CRAFT_BLOCKS = [
  { id: 'block_dirt', name: 'DIRT', color: '#8d6e63', solid: true },
  { id: 'block_grass', name: 'GRASS', color: '#43a047', solid: true },
  { id: 'block_stone', name: 'STONE', color: '#78909c', solid: true },
  { id: 'block_cobble', name: 'COBBLE', color: '#607d8b', solid: true },
  { id: 'block_wood', name: 'WOOD', color: '#a1887f', solid: true },
  { id: 'block_plank', name: 'PLANK', color: '#d7ccc8', solid: true },
  { id: 'block_brick', name: 'BRICK', color: '#c62828', solid: true },
  { id: 'block_clay', name: 'CLAY', color: '#bcaaa4', solid: true },
  { id: 'block_sand', name: 'SAND', color: '#fdd835', solid: true },
  { id: 'block_snow', name: 'SNOW', color: '#eceff1', solid: true },
  { id: 'block_iron', name: 'IRON', color: '#90a4ae', solid: true },
  { id: 'block_gold', name: 'GOLD', color: '#ffd54f', solid: true },
  { id: 'block_glass', name: 'GLASS', color: '#b3e5fc', solid: true },
  { id: 'block_wool', name: 'WOOL', color: '#f5f5f5', solid: true },
  { id: 'block_leaf', name: 'LEAF', color: '#66bb6a', solid: false },
  { id: 'block_water', name: 'WATER', color: '#29b6f6', solid: false },
  { id: 'block_fence', name: 'FENCE', color: '#6d4c41', solid: true },
  { id: 'block_torch', name: 'TORCH', color: '#ff9800', solid: false },
  { id: 'block_ladder', name: 'LADDER', color: '#8d6e63', solid: false },
  { id: 'block_chest', name: 'CHEST', color: '#ffb74d', solid: true },
  { id: 'block_magma', name: 'MAGMA', color: '#e64a19', solid: true },
  { id: 'block_obsidian', name: 'OBSIDIAN', color: '#311b92', solid: true },
] as const;

export type CraftBlockId = (typeof CRAFT_BLOCKS)[number]['id'];
export type CraftViewMode = 'top' | 'iso' | 'iso2';

const GRID = 40;
const TILE_H = 22; // vertical rise per height level (Minecraft-like stack)
const SAVE_KEY = 'ecraft_craft_blocks_v3';
const SAVE_KEY_V2 = 'ecraft_craft_blocks_v2';
const SAVE_KEY_LEGACY = 'ecraft_craft_blocks_v1';
const MAX_HEIGHT = 16;
const REACH_CELLS = 5;

type CellKey = string; // "gx,gz,h"

interface Placed {
  key: CellKey;
  gx: number;
  gz: number;
  h: number;
  id: CraftBlockId;
  sprite: Phaser.GameObjects.Image;
  body?: Phaser.Physics.Arcade.Image;
}

function blockMeta(id: CraftBlockId) {
  return CRAFT_BLOCKS.find((b) => b.id === id)!;
}

export class CraftBuildSystem {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private mode = false;
  private selected = 0;
  private cells = new Map<CellKey, Placed>();
  private ghost?: Phaser.GameObjects.Image;
  private depthBase = 11;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private lastAim: { gx: number; gz: number; h: number } | null = null;
  private boundMovers = new Set<Phaser.GameObjects.GameObject>();
  /** false = stack UP (default Minecraft feel); true = replace ground layer */
  private placeFloor = false;
  private viewMode: CraftViewMode = 'iso';
  private yaw = 0; // 0 or 1 for iso rotation

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
    this.solids = scene.physics.add.staticGroup();
  }

  getSolids(): Phaser.Physics.Arcade.StaticGroup {
    return this.solids;
  }

  bindMover(mover: Phaser.GameObjects.GameObject): void {
    if (this.boundMovers.has(mover)) return;
    this.boundMovers.add(mover);
    this.scene.physics.add.collider(mover, this.solids);
  }

  bindPlayer(player: Phaser.GameObjects.GameObject): void {
    this.bindMover(player);
  }

  isMode(): boolean {
    return this.mode;
  }

  getViewMode(): CraftViewMode {
    return this.viewMode;
  }

  /** Cycle TOP → ISO → ISO2 (rotated) like changing Minecraft camera angle. */
  cycleView(): CraftViewMode {
    if (this.viewMode === 'top') this.viewMode = 'iso';
    else if (this.viewMode === 'iso') {
      this.viewMode = 'iso2';
      this.yaw = 1;
    } else {
      this.viewMode = 'top';
      this.yaw = 0;
    }
    this.reprojectAll();
    return this.viewMode;
  }

  setViewMode(mode: CraftViewMode): void {
    this.viewMode = mode;
    this.yaw = mode === 'iso2' ? 1 : 0;
    this.reprojectAll();
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

  allBlocks(): typeof CRAFT_BLOCKS {
    return CRAFT_BLOCKS;
  }

  isFloorMode(): boolean {
    return this.placeFloor;
  }

  toggleFloorMode(): boolean {
    this.placeFloor = !this.placeFloor;
    return this.placeFloor;
  }

  toggleMode(): boolean {
    this.mode = !this.mode;
    if (this.mode) {
      // Default to ISO when entering build — Minecraft-like 3D read
      if (this.viewMode === 'top') this.viewMode = 'iso';
      this.ensureGhost();
      this.reprojectAll();
    } else this.hideGhost();
    return this.mode;
  }

  setMode(on: boolean): void {
    this.mode = on;
    if (on) {
      if (this.viewMode === 'top') this.viewMode = 'iso';
      this.ensureGhost();
      this.reprojectAll();
    } else this.hideGhost();
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

  aimAtWorld(wx: number, wy: number): void {
    const cell = this.worldToCell(wx, wy);
    // Aim at top of stack in that column (place on top) unless floor mode
    let h = 0;
    if (!this.placeFloor) {
      while (this.cells.has(this.key(cell.gx, cell.gz, h)) && h < MAX_HEIGHT) h++;
    }
    this.lastAim = { gx: cell.gx, gz: cell.gz, h };
    this.updateGhostSprite();
  }

  updateGhost(px: number, py: number, facing: number, facingDir: string): void {
    if (!this.mode) {
      this.hideGhost();
      return;
    }
    this.ensureGhost();
    if (!this.lastAim) {
      const aim = this.aimFromPlayer(px, py, facing, facingDir);
      let h = 0;
      if (!this.placeFloor) {
        while (this.cells.has(this.key(aim.gx, aim.gz, h)) && h < MAX_HEIGHT) h++;
      }
      this.lastAim = { ...aim, h };
    }
    this.updateGhostSprite();
  }

  clearPointerAim(): void {
    this.lastAim = null;
  }

  place(px: number, py: number, facing: number, facingDir: string): string {
    const col = this.lastAim
      ? { gx: this.lastAim.gx, gz: this.lastAim.gz }
      : this.aimFromPlayer(px, py, facing, facingDir);
    // Always resolve height from the column (ignore stale ghost h)
    let h = 0;
    if (this.placeFloor) {
      h = 0;
    } else {
      while (this.cells.has(this.key(col.gx, col.gz, h)) && h < MAX_HEIGHT) h++;
    }
    if (!this.inReach(px, py, col.gx, col.gz, Math.max(0, h - 1))) {
      return 'Too far — move closer.';
    }
    return this.placeAt(col.gx, col.gz, h);
  }

  placeAt(gx: number, gz: number, h: number): string {
    let th = h;
    if (!this.placeFloor) {
      // Minecraft-like: always sit on top of the column
      th = 0;
      while (this.cells.has(this.key(gx, gz, th)) && th < MAX_HEIGHT) th++;
    }
    if (th >= MAX_HEIGHT) return 'Stack too tall.';
    const k = this.key(gx, gz, th);
    if (this.cells.has(k)) {
      if (this.placeFloor) this.destroyPlaced(this.cells.get(k)!, false);
      else return 'Blocked — try another spot.';
    }
    // Need support under (except ground)
    if (th > 0 && !this.cells.has(this.key(gx, gz, th - 1))) {
      return 'Need a block underneath to stack (like Minecraft).';
    }
    return this.spawnBlock(gx, gz, th, this.selectedId());
  }

  breakAt(px: number, py: number, facing: number, facingDir: string): string {
    const aim = this.lastAim ?? (() => {
      const a = this.aimFromPlayer(px, py, facing, facingDir);
      // break top of column
      let top = -1;
      for (let h = MAX_HEIGHT - 1; h >= 0; h--) {
        if (this.cells.has(this.key(a.gx, a.gz, h))) {
          top = h;
          break;
        }
      }
      return { ...a, h: Math.max(0, top) };
    })();
    // Prefer top of aimed column
    for (let h = MAX_HEIGHT - 1; h >= 0; h--) {
      const hit = this.cells.get(this.key(aim.gx, aim.gz, h));
      if (hit) {
        if (!this.inReach(px, py, aim.gx, aim.gz, h)) return 'Too far to dig.';
        return this.destroyPlaced(hit);
      }
    }
    let best: Placed | null = null;
    let bestD = 90;
    for (const p of this.cells.values()) {
      const d = Phaser.Math.Distance.Between(px, py, p.sprite.x, p.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return 'No block to break nearby.';
    if (!this.inReach(px, py, best.gx, best.gz, best.h)) return 'Too far to dig.';
    return this.destroyPlaced(best);
  }

  load(): void {
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) raw = localStorage.getItem(SAVE_KEY_V2);
      if (!raw) raw = localStorage.getItem(SAVE_KEY_LEGACY);
      if (!raw) return;
      const data = JSON.parse(raw) as Array<{ gx: number; gy?: number; gz?: number; h?: number; id: string }>;
      for (const row of data) {
        if (!CRAFT_BLOCKS.some((b) => b.id === row.id)) continue;
        const gx = row.gx;
        const gz = row.gz ?? row.gy ?? 0;
        const h = row.h ?? 0;
        if (this.cells.has(this.key(gx, gz, h))) continue;
        this.spawnBlock(gx, gz, h, row.id as CraftBlockId, false);
      }
      this.persist();
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
    localStorage.removeItem(SAVE_KEY_V2);
    localStorage.removeItem(SAVE_KEY_LEGACY);
  }

  setCraftVisible(vis: boolean): void {
    for (const p of this.cells.values()) p.sprite.setVisible(vis);
    if (this.ghost) this.ghost.setVisible(vis && this.mode);
  }

  private spawnBlock(gx: number, gz: number, h: number, id: CraftBlockId, persist = true): string {
    const k = this.key(gx, gz, h);
    const { x, y } = this.project(gx, gz, h);
    const sprite = this.scene.add
      .image(x, y, id)
      .setDepth(this.depthFor(gx, gz, h))
      .setScale(this.viewMode === 'top' ? 1 : 1.05);
    this.layer.add(sprite);

    let body: Phaser.Physics.Arcade.Image | undefined;
    if (blockMeta(id).solid) {
      body = this.solids.create(x, y, id) as Phaser.Physics.Arcade.Image;
      body.setVisible(false);
      const size = id === 'block_fence' ? GRID - 18 : GRID - 6;
      body.setSize(size, size * 0.7);
      body.refreshBody();
    }

    this.cells.set(k, { key: k, gx, gz, h, id, sprite, body });
    this.burst(x, y, 0xffffff);
    if (persist) this.persist();
    this.lastAim = null;
    return `Placed ${blockMeta(id).name} @ height ${h} (${this.cells.size} blocks) · view ${this.viewMode.toUpperCase()}`;
  }

  private destroyPlaced(hit: Placed, persist = true): string {
    const name = hit.id.replace('block_', '');
    this.burst(hit.sprite.x, hit.sprite.y, 0xffab91);
    hit.sprite.destroy();
    hit.body?.destroy();
    this.cells.delete(hit.key);
    // Collapse unsupported blocks above (Minecraft gravity for creative simplicity: drop column)
    this.collapseColumn(hit.gx, hit.gz, hit.h);
    if (persist) this.persist();
    this.lastAim = null;
    const idx = CRAFT_BLOCKS.findIndex((b) => b.id === hit.id);
    if (idx >= 0) this.select(idx);
    return `Broke ${name} · ${this.cells.size} left`;
  }

  private collapseColumn(gx: number, gz: number, fromH: number): void {
    for (let h = fromH + 1; h < MAX_HEIGHT; h++) {
      const k = this.key(gx, gz, h);
      const p = this.cells.get(k);
      if (!p) continue;
      // move down one
      this.cells.delete(k);
      p.h -= 1;
      p.key = this.key(gx, gz, p.h);
      this.cells.set(p.key, p);
      const { x, y } = this.project(gx, gz, p.h);
      p.sprite.setPosition(x, y);
      p.sprite.setDepth(this.depthFor(gx, gz, p.h));
      if (p.body) {
        p.body.setPosition(x, y);
        p.body.refreshBody();
      }
    }
  }

  private reprojectAll(): void {
    for (const p of this.cells.values()) {
      const { x, y } = this.project(p.gx, p.gz, p.h);
      p.sprite.setPosition(x, y);
      p.sprite.setDepth(this.depthFor(p.gx, p.gz, p.h));
      p.sprite.setScale(this.viewMode === 'top' ? 1 : 1.05);
      if (p.body) {
        p.body.setPosition(x, y);
        p.body.refreshBody();
      }
    }
    this.updateGhostSprite();
  }

  /**
   * Ground stays player-aligned (same city grid). Height stacks UP the screen.
   * ISO views exaggerate vertical rise + slight skew so stacks read 3D like Minecraft.
   */
  private project(gx: number, gz: number, h: number): { x: number; y: number } {
    const rise = this.viewMode === 'top' ? TILE_H : GRID * 0.62;
    if (this.yaw === 0) {
      const skew = this.viewMode === 'top' ? 0 : h * 6;
      return { x: gx * GRID + skew, y: gz * GRID - h * rise };
    }
    // Rotated ground axes (look from the other corner)
    const skew = this.viewMode === 'top' ? 0 : h * 6;
    return { x: gz * GRID - skew, y: -gx * GRID - h * rise };
  }

  private worldToCell(wx: number, wy: number): { gx: number; gz: number } {
    // Aim uses ground plane (ignore height for pick)
    if (this.yaw === 0) {
      return { gx: Math.round(wx / GRID), gz: Math.round(wy / GRID) };
    }
    return { gx: Math.round(-wy / GRID), gz: Math.round(wx / GRID) };
  }

  private depthFor(gx: number, gz: number, h: number): number {
    // Higher blocks draw on top; further "south" draws later
    if (this.yaw === 0) return this.depthBase + gz + h * 3;
    return this.depthBase + gx + h * 3;
  }

  private inReach(px: number, py: number, gx: number, gz: number, h: number): boolean {
    const { x, y } = this.project(gx, gz, h);
    return Phaser.Math.Distance.Between(px, py, x, y) <= REACH_CELLS * GRID + GRID;
  }

  private aimFromPlayer(
    px: number,
    py: number,
    facing: number,
    facingDir: string,
  ): { gx: number; gz: number } {
    let ax = px;
    let ay = py;
    if (facingDir === 'left' || facingDir === 'right') ax = px + facing * GRID;
    else if (facingDir === 'up') ay = py - GRID;
    else ay = py + GRID;
    return this.worldToCell(ax, ay);
  }

  private updateGhostSprite(): void {
    if (!this.ghost || !this.lastAim) return;
    const { x, y } = this.project(this.lastAim.gx, this.lastAim.gz, this.lastAim.h);
    this.ghost.setTexture(this.selectedId());
    this.ghost.setPosition(x, y);
    this.ghost.setDepth(60);
    this.ghost.setVisible(true);
    this.ghost.setAlpha(
      this.cells.has(this.key(this.lastAim.gx, this.lastAim.gz, this.lastAim.h)) ? 0.25 : 0.55,
    );
    this.ghost.setScale(this.viewMode === 'top' ? 1 : 1.05);
  }

  private burst(x: number, y: number, tint: number): void {
    for (let i = 0; i < 6; i++) {
      const p = this.scene.add.rectangle(x, y, 6, 6, tint, 0.9).setDepth(60);
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
    const data = [...this.cells.values()].map((p) => ({
      gx: p.gx,
      gz: p.gz,
      h: p.h,
      id: p.id,
    }));
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  private key(gx: number, gz: number, h: number): CellKey {
    return `${gx},${gz},${h}`;
  }

  private ensureGhost(): void {
    if (this.ghost) return;
    this.ghost = this.scene.add.image(0, 0, this.selectedId()).setDepth(60).setAlpha(0.5);
    this.layer.add(this.ghost);
  }

  private hideGhost(): void {
    this.ghost?.setVisible(false);
  }
}
