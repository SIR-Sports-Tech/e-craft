/** Field backpack + gadget inventory for E-CRAFT. */

export type ItemId =
  | 'tracker'
  | 'radio'
  | 'badge'
  | 'keycard'
  | 'cooked_meal'
  | 'backpack'
  | 'phone'
  | 'whip'
  | 'gold_bar'
  | 'first_aid'
  | 'book'
  | 'gadget_part'
  | 'snack'
  | 'desk_phone'
  | 'evidence'
  | 'harbor_map';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  /** Shown in backpack panel as usable/loot */
  backpack?: boolean;
  stackable?: boolean;
}

const DEFS: Record<ItemId, ItemDef> = {
  tracker: { id: 'tracker', name: 'Sasquatch Tracker', icon: '📡' },
  radio: { id: 'radio', name: 'Security Radio', icon: '📻' },
  badge: { id: 'badge', name: 'HQ Badge', icon: '🏅' },
  keycard: { id: 'keycard', name: 'Jail Keycard', icon: '🔑' },
  cooked_meal: { id: 'cooked_meal', name: 'Home Meal', icon: '🍲', backpack: true },
  backpack: { id: 'backpack', name: 'Field Backpack', icon: '🎒' },
  phone: { id: 'phone', name: 'Field Phone', icon: '📱', backpack: true },
  whip: { id: 'whip', name: 'Tiger Whip', icon: '🪢', backpack: true },
  gold_bar: { id: 'gold_bar', name: 'Gold Bar', icon: '🥇', backpack: true, stackable: true },
  first_aid: { id: 'first_aid', name: 'First-Aid Kit', icon: '🩹', backpack: true },
  book: { id: 'book', name: 'City Book', icon: '📕', backpack: true },
  gadget_part: { id: 'gadget_part', name: 'Gadget Part', icon: '🔧', backpack: true },
  snack: { id: 'snack', name: 'Market Snack', icon: '🍎', backpack: true },
  desk_phone: { id: 'desk_phone', name: 'Desk Phone', icon: '☎️', backpack: true },
  evidence: { id: 'evidence', name: 'Evidence Bag', icon: '🧾', backpack: true },
  harbor_map: { id: 'harbor_map', name: 'Harbor Map', icon: '🗺️', backpack: true },
};

/** Default loot placed inside each building type. */
export const BUILDING_LOOT: Record<string, ItemId[]> = {
  clinic: ['first_aid', 'desk_phone'],
  shop: ['gadget_part', 'desk_phone'],
  police_desk: ['evidence', 'desk_phone'],
  school: ['book', 'desk_phone'],
  library: ['book', 'desk_phone'],
  market_row: ['snack', 'desk_phone'],
  docks: ['harbor_map', 'desk_phone'],
  airfield: ['harbor_map', 'desk_phone'],
  city_plaza: ['snack', 'desk_phone'],
  park: ['snack', 'desk_phone'],
  bank: ['gold_bar', 'desk_phone'],
  security_hq: ['desk_phone', 'gadget_part'],
  super_jail: ['desk_phone', 'keycard'],
  player_house: ['desk_phone', 'snack'],
  craft_house: ['desk_phone', 'snack'],
};

export class InventorySystem {
  private items = new Set<ItemId>(['backpack', 'phone', 'whip', 'badge', 'radio']);
  private stacks = new Map<ItemId, number>();

  has(id: ItemId): boolean {
    return this.items.has(id) || (this.stacks.get(id) ?? 0) > 0;
  }

  count(id: ItemId): number {
    if (DEFS[id]?.stackable) return this.stacks.get(id) ?? 0;
    return this.items.has(id) ? 1 : 0;
  }

  add(id: ItemId, n = 1): void {
    const def = DEFS[id];
    if (def?.stackable) {
      this.stacks.set(id, (this.stacks.get(id) ?? 0) + n);
      this.items.add(id);
      return;
    }
    this.items.add(id);
  }

  /** Remove one (or n) — returns false if missing. */
  remove(id: ItemId, n = 1): boolean {
    const def = DEFS[id];
    if (def?.stackable) {
      const cur = this.stacks.get(id) ?? 0;
      if (cur < n) return false;
      const next = cur - n;
      if (next <= 0) {
        this.stacks.delete(id);
        this.items.delete(id);
      } else this.stacks.set(id, next);
      return true;
    }
    if (!this.items.has(id)) return false;
    // Keep core starter gear undroppable except desk_phone / loot
    if (id === 'backpack' || id === 'badge') return false;
    this.items.delete(id);
    return true;
  }

  list(): ItemDef[] {
    return [...this.items].map((id) => DEFS[id]);
  }

  backpackContents(): Array<ItemDef & { qty: number }> {
    const out: Array<ItemDef & { qty: number }> = [];
    for (const id of this.items) {
      const def = DEFS[id];
      if (!def?.backpack) continue;
      out.push({ ...def, qty: this.count(id) });
    }
    return out;
  }

  /** Prefer dropping loot (not starter whip/phone unless only option). */
  preferredDropId(): ItemId | null {
    const lootOrder: ItemId[] = [
      'gold_bar',
      'snack',
      'book',
      'first_aid',
      'gadget_part',
      'evidence',
      'harbor_map',
      'desk_phone',
      'cooked_meal',
    ];
    for (const id of lootOrder) {
      if (this.count(id) > 0) return id;
    }
    return null;
  }

  def(id: ItemId): ItemDef {
    return DEFS[id];
  }

  summary(): string {
    const parts: string[] = [];
    for (const id of this.items) {
      const d = DEFS[id];
      const q = this.count(id);
      parts.push(q > 1 ? `${d.icon}${d.name}×${q}` : `${d.icon} ${d.name}`);
    }
    if (!parts.length) return 'Inventory empty';
    return parts.join(' · ');
  }
}
