/** Simple gadget inventory for E-CRAFT. */

export type ItemId = 'tracker' | 'radio' | 'badge' | 'keycard' | 'cooked_meal';

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
};

export class InventorySystem {
  private items = new Set<ItemId>(['badge', 'radio']);

  has(id: ItemId): boolean {
    return this.items.has(id);
  }

  add(id: ItemId): void {
    this.items.add(id);
  }

  list(): ItemDef[] {
    return [...this.items].map((id) => DEFS[id]);
  }

  summary(): string {
    const list = this.list();
    if (!list.length) return 'Inventory empty';
    return list.map((i) => `${i.icon} ${i.name}`).join(' · ');
  }
}
