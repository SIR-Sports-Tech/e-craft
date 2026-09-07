import Phaser from 'phaser';
import { CIVIC_INTERIOR, CRAFT_HOUSE_INTERIOR } from '../world/BuildingCatalog';
import { HOUSE_INTERIOR, JAIL_INTERIOR, LAIR } from '../world/WorldLayout';
import { BUILDING_LOOT, type ItemId } from './InventorySystem';

export type WorldLoot = {
  id: string;
  itemId: ItemId;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  buildingKey: string;
  kind: 'loot' | 'gold' | 'phone';
};

/**
 * Indoor loot, desk phones, computers, and bank gold piles.
 * WALL of gold in the bank — mine / pick up bars into the backpack.
 */
export class BuildingLootSystem {
  private scene: Phaser.Scene;
  private loot: WorldLoot[] = [];
  private computer?: Phaser.GameObjects.Image;
  private computerChair?: Phaser.GameObjects.Rectangle;
  private computerLabel?: Phaser.GameObjects.Text;
  private computerActive = false;
  private roomKey: string | null = null;
  private bankGoldLeft = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  clear(): void {
    for (const L of this.loot) {
      L.sprite.destroy();
      L.label.destroy();
    }
    this.loot = [];
    this.computer?.destroy();
    this.computerChair?.destroy();
    this.computerLabel?.destroy();
    this.computer = undefined;
    this.computerChair = undefined;
    this.computerLabel = undefined;
    this.computerActive = false;
    this.roomKey = null;
    this.bankGoldLeft = 0;
  }

  isAtComputer(): boolean {
    return this.computerActive;
  }

  leaveComputer(): void {
    this.computerActive = false;
  }

  getBankGoldLeft(): number {
    return this.bankGoldLeft;
  }

  /** Spawn interactables for the current indoor room. */
  spawnForRoom(roomKey: string): void {
    this.clear();
    this.roomKey = roomKey;
    const bounds = this.boundsFor(roomKey);
    if (!bounds) return;

    const lootKey = roomKey.startsWith('craft_house') ? 'craft_house' : roomKey;
    const isBank = roomKey === 'bank';

    // Computer desk — every building
    const cx = bounds.x + bounds.w * 0.62;
    const cy = bounds.y + bounds.h * 0.42;
    this.computer = this.scene.add.image(cx, cy, 'furn_computer').setDepth(22).setScale(1.15);
    this.computerChair = this.scene.add
      .rectangle(cx - 36, cy + 18, 28, 22, 0x5d4037, 1)
      .setStrokeStyle(2, 0x3e2723, 1)
      .setDepth(21);
    this.computerLabel = this.scene.add
      .text(cx, cy - 36, '[E] Sit · Use Computer', {
        fontSize: '11px',
        color: '#e3f2fd',
        backgroundColor: '#0d47a1cc',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(23);

    if (isBank) {
      this.spawnBankGold(bounds);
      // Still one desk phone near the computer
      this.spawnLootItem('desk_phone', cx - 70, cy + 40, 'bank', 'phone');
      return;
    }

    const items = BUILDING_LOOT[lootKey] || ['desk_phone', 'snack'];
    const spots = [
      { x: bounds.x + 140, y: bounds.y + 220 },
      { x: bounds.x + 280, y: bounds.y + 300 },
      { x: bounds.x + 480, y: bounds.y + 240 },
      { x: bounds.x + 560, y: bounds.y + 340 },
    ];
    items.forEach((itemId, i) => {
      const spot = spots[i % spots.length];
      const kind = itemId === 'desk_phone' || itemId === 'phone' ? 'phone' : 'loot';
      this.spawnLootItem(itemId, spot.x + (i % 2) * 20, spot.y + (i % 3) * 12, roomKey, kind);
    });
  }

  private spawnBankGold(bounds: { x: number; y: number; w: number; h: number }): void {
    // Fill the whole bank floor with gold piles — no safe, just gold
    let n = 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const x = bounds.x + 90 + col * 95 + (row % 2) * 20;
        const y = bounds.y + 160 + row * 70;
        if (y > bounds.y + bounds.h - 60) continue;
        this.spawnLootItem('gold_bar', x, y, 'bank', 'gold');
        n++;
      }
    }
    this.bankGoldLeft = n;
  }

  private spawnLootItem(
    itemId: ItemId,
    x: number,
    y: number,
    buildingKey: string,
    kind: WorldLoot['kind'],
  ): void {
    const tex = kind === 'gold' || itemId === 'gold_bar' ? 'gold_pile' : kind === 'phone' ? 'furn_phone' : 'loot_bag';
    const sprite = this.scene.add.image(x, y, tex).setDepth(22).setScale(kind === 'gold' ? 0.85 : 1);
    const icons: Record<string, string> = {
      gold_bar: '🥇',
      desk_phone: '☎️',
      phone: '📱',
      first_aid: '🩹',
      book: '📕',
      gadget_part: '🔧',
      snack: '🍎',
      evidence: '🧾',
      harbor_map: '🗺️',
      keycard: '🔑',
    };
    const label = this.scene.add
      .text(x, y - 28, `${icons[itemId] || '📦'} Pick up`, {
        fontSize: '10px',
        color: '#fffde7',
        backgroundColor: '#00000099',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(23);
    this.loot.push({
      id: `${buildingKey}_${itemId}_${this.loot.length}`,
      itemId,
      sprite,
      label,
      buildingKey,
      kind,
    });
  }

  nearestLoot(px: number, py: number, range = 70): WorldLoot | null {
    let best: WorldLoot | null = null;
    let bestD = range;
    for (const L of this.loot) {
      if (!L.sprite.active || !L.sprite.visible) continue;
      const d = Phaser.Math.Distance.Between(px, py, L.sprite.x, L.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = L;
      }
    }
    return best;
  }

  nearComputer(px: number, py: number, range = 80): boolean {
    if (!this.computer?.visible) return false;
    return Phaser.Math.Distance.Between(px, py, this.computer.x, this.computer.y) <= range;
  }

  computerSeat(): { x: number; y: number } | null {
    if (!this.computerChair) return null;
    return { x: this.computerChair.x, y: this.computerChair.y };
  }

  sitAtComputer(): boolean {
    if (!this.computer) return false;
    this.computerActive = true;
    this.computerLabel?.setText('💻 Typing… (CLOSE to stand)');
    return true;
  }

  /** Remove world loot and return its item id (caller adds to inventory). */
  takeLoot(L: WorldLoot): ItemId {
    if (L.kind === 'gold') this.bankGoldLeft = Math.max(0, this.bankGoldLeft - 1);
    L.sprite.destroy();
    L.label.destroy();
    this.loot = this.loot.filter((x) => x.id !== L.id);
    return L.itemId;
  }

  /** Drop an item into the current room at player feet. */
  dropAt(itemId: ItemId, x: number, y: number): void {
    const kind = itemId === 'gold_bar' ? 'gold' : itemId === 'desk_phone' || itemId === 'phone' ? 'phone' : 'loot';
    this.spawnLootItem(itemId, x + Phaser.Math.Between(-16, 16), y + 20, this.roomKey || 'world', kind);
  }

  setVisible(vis: boolean): void {
    for (const L of this.loot) {
      L.sprite.setVisible(vis);
      L.label.setVisible(vis);
    }
    this.computer?.setVisible(vis);
    this.computerChair?.setVisible(vis);
    this.computerLabel?.setVisible(vis);
    if (!vis) this.computerActive = false;
  }

  private boundsFor(roomKey: string): { x: number; y: number; w: number; h: number } | null {
    if (roomKey === 'player_house') return HOUSE_INTERIOR;
    if (roomKey === 'super_jail' || roomKey === 'jail') return JAIL_INTERIOR;
    if (roomKey === 'security_hq' || roomKey === 'lair') return LAIR;
    if (roomKey.startsWith('craft_house')) return CRAFT_HOUSE_INTERIOR;
    // All civic themes share CIVIC_INTERIOR
    return CIVIC_INTERIOR;
  }
}
