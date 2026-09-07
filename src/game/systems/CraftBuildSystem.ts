import Phaser from 'phaser';
import { CITY_ZONES } from '../world/WorldLayout';

/**
 * Voxel Creative builder — Minecraft-STYLE feel (original code + art).
 * NOT Mojang/Minecraft IP or source. Behaves like Creative:
 *  - Aim a column in front of you
 *  - PLACE stacks on top (needs support)
 *  - BREAK removes the top block of the aimed column
 *  - Hotbar select · ghost preview · solid collision · save
 *
 * FOREST LAW: craft blocks in the wilderness never block walking —
 * the woods stay fully walkable everywhere.
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

/** One world cell = one cube footprint (matches city walk grid). */
const GRID = 40;
/** Vertical rise per stacked cube (reads like Minecraft stack height). */
const CUBE_RISE = 28;
const SAVE_KEY = 'ecraft_craft_blocks_v4';
const SAVE_KEY_V3 = 'ecraft_craft_blocks_v3';
const SAVE_KEY_V2 = 'ecraft_craft_blocks_v2';
const SAVE_KEY_LEGACY = 'ecraft_craft_blocks_v1';
const MAX_HEIGHT = 32;
const REACH_CELLS = 6;

type CellKey = string;

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
  private ghostOutline?: Phaser.GameObjects.Graphics;
  private depthBase = 11;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private lastAim: { gx: number; gz: number; h: number } | null = null;
  private boundMovers = new Set<Phaser.GameObjects.GameObject>();
  private placeFloor = false;
  private viewMode: CraftViewMode = 'iso';
  private yaw = 0;

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

  resolveNow(mover: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject): void {
    this.scene.physics.world.collide(mover, this.solids);
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

  /** Pointer/tap locks aim briefly (Minecraft crosshair on a cell). */
  private pointerAimUntil = 0;

  aimAtWorld(wx: number, wy: number): void {
    const cell = this.worldToCell(wx, wy);
    this.lastAim = { gx: cell.gx, gz: cell.gz, h: this.columnPlaceHeight(cell.gx, cell.gz) };
    this.pointerAimUntil = Date.now() + 2500;
    this.updateGhostSprite();
  }

  updateGhost(px: number, py: number, facing: number, facingDir: string): void {
    if (!this.mode) {
      this.hideGhost();
      return;
    }
    this.ensureGhost();
    // Creative-style: ghost follows look direction unless a fresh tap locked a cell
    if (!this.lastAim || Date.now() > this.pointerAimUntil) {
      const aim = this.aimFromPlayer(px, py, facing, facingDir);
      this.lastAim = { ...aim, h: this.columnPlaceHeight(aim.gx, aim.gz) };
    } else {
      this.lastAim.h = this.columnPlaceHeight(this.lastAim.gx, this.lastAim.gz);
    }
    this.updateGhostSprite();
  }

  clearPointerAim(): void {
    this.lastAim = null;
    this.pointerAimUntil = 0;
  }

  /**
   * PLACE — Minecraft Creative feel:
   * - Tap/lock cell → stack there
   * - Else place on column you are facing
   * - Always stacks on top of existing blocks in that column
   */
  place(px: number, py: number, facing: number, facingDir: string): string {
    const usePointer = !!this.lastAim && Date.now() <= this.pointerAimUntil;
    const col = usePointer
      ? { gx: this.lastAim!.gx, gz: this.lastAim!.gz }
      : this.aimFromPlayer(px, py, facing, facingDir);
    const h = this.columnPlaceHeight(col.gx, col.gz);
    if (!this.inReach(px, py, col.gx, col.gz, Math.max(0, h - 1))) {
      return 'Too far — walk closer (Creative reach).';
    }
    const msg = this.placeAt(col.gx, col.gz, h);
    // Keep aiming this column so next PLACE stacks higher (like holding place)
    this.lastAim = { gx: col.gx, gz: col.gz, h: this.columnPlaceHeight(col.gx, col.gz) };
    this.pointerAimUntil = Date.now() + 2000;
    return msg;
  }

  placeAt(gx: number, gz: number, h: number): string {
    const th = this.placeFloor ? 0 : this.columnPlaceHeight(gx, gz);
    if (th >= MAX_HEIGHT) return 'Stack too tall (build limit).';
    const k = this.key(gx, gz, th);
    if (this.cells.has(k)) {
      if (this.placeFloor) this.destroyPlaced(this.cells.get(k)!, false);
      else return 'Blocked.';
    }
    if (th > 0 && !this.cells.has(this.key(gx, gz, th - 1))) {
      return 'Need a block underneath to stack.';
    }
    return this.spawnBlock(gx, gz, th, this.selectedId());
  }

  /**
   * BREAK — dig the looked-at / tapped column (top block first),
   * else the nearest block in look direction (Creative dig).
   */
  breakAt(px: number, py: number, facing: number, facingDir: string): string {
    const usePointer = !!this.lastAim && Date.now() <= this.pointerAimUntil;
    const aim = usePointer
      ? this.lastAim!
      : { ...this.aimFromPlayer(px, py, facing, facingDir), h: 0 };

    for (let h = MAX_HEIGHT - 1; h >= 0; h--) {
      const hit = this.cells.get(this.key(aim.gx, aim.gz, h));
      if (hit) {
        if (!this.inReach(px, py, aim.gx, aim.gz, h)) return 'Too far to dig.';
        const msg = this.destroyPlaced(hit);
        this.lastAim = { gx: aim.gx, gz: aim.gz, h: this.columnPlaceHeight(aim.gx, aim.gz) };
        this.pointerAimUntil = Date.now() + 2000;
        return msg;
      }
    }

    // Sweep along look ray for a block (Minecraft-ish)
    const ray = this.rayBlocks(px, py, facing, facingDir);
    if (ray) {
      const msg = this.destroyPlaced(ray);
      this.lastAim = { gx: ray.gx, gz: ray.gz, h: this.columnPlaceHeight(ray.gx, ray.gz) };
      this.pointerAimUntil = Date.now() + 2000;
      return msg;
    }

    let best: Placed | null = null;
    let bestD = GRID * 2.2;
    for (const p of this.cells.values()) {
      const d = Phaser.Math.Distance.Between(px, py, p.sprite.x, p.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return 'No block to break — look at a block / tap it.';
    return this.destroyPlaced(best);
  }

  /** Walk forward up to REACH cells and return top block of first occupied column. */
  private rayBlocks(
    px: number,
    py: number,
    facing: number,
    facingDir: string,
  ): Placed | null {
    for (let step = 1; step <= REACH_CELLS; step++) {
      let ax = px;
      let ay = py;
      const dist = GRID * step;
      if (facingDir === 'left' || facingDir === 'right') ax = px + facing * dist;
      else if (facingDir === 'up') ay = py - dist;
      else ay = py + dist;
      const { gx, gz } = this.worldToCell(ax, ay);
      for (let h = MAX_HEIGHT - 1; h >= 0; h--) {
        const hit = this.cells.get(this.key(gx, gz, h));
        if (hit) return hit;
      }
    }
    return null;
  }

  load(): void {
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) raw = localStorage.getItem(SAVE_KEY_V3);
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
    localStorage.removeItem(SAVE_KEY_V3);
    localStorage.removeItem(SAVE_KEY_V2);
    localStorage.removeItem(SAVE_KEY_LEGACY);
  }

  setCraftVisible(vis: boolean): void {
    for (const p of this.cells.values()) p.sprite.setVisible(vis);
    if (this.ghost) this.ghost.setVisible(vis && this.mode);
    if (!vis) this.ghostOutline?.clear();
  }

  /** Next free height in a column (or 0 in floor mode). */
  private columnPlaceHeight(gx: number, gz: number): number {
    if (this.placeFloor) return 0;
    let h = 0;
    while (this.cells.has(this.key(gx, gz, h)) && h < MAX_HEIGHT) h++;
    return h;
  }

  private spawnBlock(gx: number, gz: number, h: number, id: CraftBlockId, persist = true): string {
    const k = this.key(gx, gz, h);
    const { x, y } = this.project(gx, gz, h);
    const sprite = this.scene.add
      .image(x, y, id)
      .setDepth(this.depthFor(gx, gz, h))
      .setOrigin(0.5, 0.85)
      .setScale(1);
    this.layer.add(sprite);

    let body: Phaser.Physics.Arcade.Image | undefined;
    // Never plant walk-blockers in the forest / wilderness
    if (blockMeta(id).solid && !this.isForestWorld(x, y)) {
      body = this.solids.create(x, y - 6, id) as Phaser.Physics.Arcade.Image;
      body.setVisible(false);
      const size = id === 'block_fence' ? GRID - 18 : GRID - 4;
      body.setSize(size, size * 0.75);
      body.refreshBody();
    }

    this.cells.set(k, { key: k, gx, gz, h, id, sprite, body });
    this.burst(x, y - 16, 0xffffff);
    if (persist) this.persist();
    this.lastAim = null;
    return `⬛ Placed ${blockMeta(id).name} @ y=${h} (${this.cells.size} blocks)`;
  }

  private destroyPlaced(hit: Placed, persist = true): string {
    const name = hit.id.replace('block_', '');
    this.burst(hit.sprite.x, hit.sprite.y - 12, 0xffab91);
    hit.sprite.destroy();
    hit.body?.destroy();
    this.cells.delete(hit.key);
    this.collapseColumn(hit.gx, hit.gz, hit.h);
    if (persist) this.persist();
    this.lastAim = null;
    const idx = CRAFT_BLOCKS.findIndex((b) => b.id === hit.id);
    if (idx >= 0) this.select(idx);
    return `⛏ Broke ${name} · ${this.cells.size} left`;
  }

  private collapseColumn(gx: number, gz: number, fromH: number): void {
    for (let h = fromH + 1; h < MAX_HEIGHT; h++) {
      const k = this.key(gx, gz, h);
      const p = this.cells.get(k);
      if (!p) continue;
      this.cells.delete(k);
      p.h -= 1;
      p.key = this.key(gx, gz, p.h);
      this.cells.set(p.key, p);
      const { x, y } = this.project(gx, gz, p.h);
      p.sprite.setPosition(x, y);
      p.sprite.setDepth(this.depthFor(gx, gz, p.h));
      if (p.body) {
        p.body.setPosition(x, y - 6);
        p.body.refreshBody();
      }
    }
  }

  private reprojectAll(): void {
    for (const p of this.cells.values()) {
      const { x, y } = this.project(p.gx, p.gz, p.h);
      p.sprite.setPosition(x, y);
      p.sprite.setDepth(this.depthFor(p.gx, p.gz, p.h));
      p.sprite.setOrigin(0.5, 0.85);
      if (p.body) {
        p.body.setPosition(x, y - 6);
        p.body.refreshBody();
      }
    }
    this.updateGhostSprite();
  }

  /**
   * Project voxel (gx,gz,h) → screen.
   * Ground stays city-aligned; height stacks UP with cube rise.
   * ISO adds slight eastward skew so stacks read 3D.
   */
  private project(gx: number, gz: number, h: number): { x: number; y: number } {
    const rise = this.viewMode === 'top' ? 20 : CUBE_RISE;
    if (this.yaw === 0) {
      const skew = this.viewMode === 'top' ? 0 : h * 4;
      return { x: gx * GRID + skew, y: gz * GRID - h * rise };
    }
    const skew = this.viewMode === 'top' ? 0 : h * 4;
    return { x: gz * GRID - skew, y: -gx * GRID - h * rise };
  }

  private worldToCell(wx: number, wy: number): { gx: number; gz: number } {
    if (this.yaw === 0) {
      return { gx: Math.round(wx / GRID), gz: Math.round(wy / GRID) };
    }
    return { gx: Math.round(-wy / GRID), gz: Math.round(wx / GRID) };
  }

  private depthFor(gx: number, gz: number, h: number): number {
    if (this.yaw === 0) return this.depthBase + gz * 2 + h * 4;
    return this.depthBase + gx * 2 + h * 4;
  }

  private inReach(px: number, py: number, gx: number, gz: number, h: number): boolean {
    const { x, y } = this.project(gx, gz, Math.max(0, h));
    return Phaser.Math.Distance.Between(px, py, x, y) <= REACH_CELLS * GRID + GRID * 0.5;
  }

  private aimFromPlayer(
    px: number,
    py: number,
    facing: number,
    facingDir: string,
  ): { gx: number; gz: number } {
    // Prefer the nearest occupied column ahead (stack on it), else empty cell ahead
    for (let step = 1; step <= 3; step++) {
      let ax = px;
      let ay = py;
      const dist = GRID * step;
      if (facingDir === 'left' || facingDir === 'right') ax = px + facing * dist;
      else if (facingDir === 'up') ay = py - dist;
      else ay = py + dist;
      const cell = this.worldToCell(ax, ay);
      if (this.columnPlaceHeight(cell.gx, cell.gz) > 0) return cell;
    }
    let ax = px;
    let ay = py;
    const step = GRID * 1.15;
    if (facingDir === 'left' || facingDir === 'right') ax = px + facing * step;
    else if (facingDir === 'up') ay = py - step;
    else ay = py + step;
    return this.worldToCell(ax, ay);
  }

  private updateGhostSprite(): void {
    if (!this.ghost || !this.lastAim) return;
    const { x, y } = this.project(this.lastAim.gx, this.lastAim.gz, this.lastAim.h);
    const blocked = this.cells.has(this.key(this.lastAim.gx, this.lastAim.gz, this.lastAim.h));
    const needSupport =
      this.lastAim.h > 0 && !this.cells.has(this.key(this.lastAim.gx, this.lastAim.gz, this.lastAim.h - 1));
    const ok = !blocked && !needSupport;
    this.ghost.setTexture(this.selectedId());
    this.ghost.setPosition(x, y);
    this.ghost.setOrigin(0.5, 0.85);
    this.ghost.setDepth(80);
    this.ghost.setVisible(true);
    this.ghost.setAlpha(ok ? 0.55 : 0.28);
    this.ghost.setTint(ok ? 0xa5d6a7 : 0xff8a80);

    // Selection box outline (Minecraft-style wireframe cue)
    if (!this.ghostOutline) {
      this.ghostOutline = this.scene.add.graphics().setDepth(81);
      this.layer.add(this.ghostOutline);
    }
    this.ghostOutline.clear();
    if (this.mode) {
      this.ghostOutline.lineStyle(2, ok ? 0x69f0ae : 0xff5252, 0.95);
      this.ghostOutline.strokeRect(x - 20, y - 48, 40, 44);
    }
  }

  private burst(x: number, y: number, tint: number): void {
    for (let i = 0; i < 8; i++) {
      const p = this.scene.add.rectangle(x, y, 5, 5, tint, 0.95).setDepth(90);
      this.layer.add(p);
      this.scene.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-30, 30),
        y: y + Phaser.Math.Between(-34, 10),
        alpha: 0,
        duration: 320,
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

  /** True if world point sits in the forest wilderness zone. */
  private isForestWorld(x: number, y: number): boolean {
    const forest = CITY_ZONES.find((z) => z.id === 'forest');
    if (!forest) return false;
    return (
      x >= forest.x - 20 &&
      x <= forest.x + forest.w + 20 &&
      y >= forest.y - 20 &&
      y <= forest.y + forest.h + 20
    );
  }

  /** Strip any leftover solid hitboxes that land in the forest (old saves). */
  clearForestSolids(): number {
    let n = 0;
    for (const p of this.cells.values()) {
      if (!p.body) continue;
      if (!this.isForestWorld(p.sprite.x, p.sprite.y)) continue;
      p.body.destroy();
      p.body = undefined;
      n++;
    }
    return n;
  }

  private ensureGhost(): void {
    if (this.ghost) return;
    this.ghost = this.scene.add
      .image(0, 0, this.selectedId())
      .setDepth(80)
      .setAlpha(0.5)
      .setOrigin(0.5, 0.85);
    this.layer.add(this.ghost);
  }

  private hideGhost(): void {
    this.ghost?.setVisible(false);
    this.ghostOutline?.clear();
  }
}
