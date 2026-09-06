/** Simple gadget inventory for E-CRAFT. */

export type ItemId =
  | 'tracker'
  | 'radio'
  | 'badge'
  | 'keycard'
  | 'cooked_meal'
  | 'backpack'
  | 'phone'
  | 'whip';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
}

const DEFS: Record<ItemId, ItemDef> = {
  tracker: { id: 'tracker', name: 'Sasquatch Tracker', icon: '📡' },
  radio: { id: 'radio', name: 'Security Radio', icon: '📻' },
  badge: { id: 'badge', name: 'HQ Badge', icon: '🏅' },
  keycard: { id: 'keycard', name: 'Jail Keycard', icon: '🔑' },
  cooked_meal: { id: 'cooked_meal', name: 'Home Meal', icon: '🍲' },
  backpack: { id: 'backpack', name: 'Field Backpack', icon: '🎒' },
  phone: { id: 'phone', name: 'Field Phone', icon: '📱' },
  whip: { id: 'whip', name: 'Tiger Whip', icon: '🪢' },
};

export class InventorySystem {
  /** Always start with pack gear + badge/radio. */
  private items = new Set<ItemId>(['backpack', 'phone', 'whip', 'badge', 'radio']);

  has(id: ItemId): boolean {
    return this.items.has(id);
  }

  add(id: ItemId): void {
    this.items.add(id);
  }

  list(): ItemDef[] {
    return [...this.items].map((id) => DEFS[id]);
  }

  /** Items that live inside the backpack UI. */
  backpackContents(): ItemDef[] {
    return (['phone', 'whip'] as ItemId[])
      .filter((id) => this.items.has(id))
      .map((id) => DEFS[id]);
  }

  summary(): string {
    const list = this.list();
    if (!list.length) return 'Inventory empty';
    return list.map((i) => `${i.icon} ${i.name}`).join(' · ');
  }
}
