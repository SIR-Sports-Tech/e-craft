/** Lightweight mystery/clue board for living-world feel. */

export interface MysteryClue {
  id: string;
  text: string;
  found: boolean;
}

export class MysterySystem {
  clues: MysteryClue[] = [
    { id: 'c1', text: 'Strange footprints appear only after dusk.', found: false },
    { id: 'c2', text: 'Broken branches form a path toward Friendship Park.', found: false },
    { id: 'c3', text: 'A fur tuft near Super Jail smells like pine.', found: false },
  ];

  findNearestUnfound(): MysteryClue | null {
    return this.clues.find((c) => !c.found) ?? null;
  }

  revealNext(): string {
    const c = this.findNearestUnfound();
    if (!c) return 'All mystery clues found!';
    c.found = true;
    return `Mystery clue: ${c.text}`;
  }

  summary(): string {
    const n = this.clues.filter((c) => c.found).length;
    return `Mysteries ${n}/${this.clues.length}`;
  }
}
