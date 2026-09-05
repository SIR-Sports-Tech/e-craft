/** Coordinate with city police — living-world seed (family-friendly). */

export interface PatrolOrder {
  id: string;
  label: string;
  active: boolean;
  progress: number;
}

export class PoliceSystem {
  patrols: PatrolOrder[] = [];
  trust = 0;

  requestForestSweep(): string {
    const existing = this.patrols.find((p) => p.id === 'forest_sweep');
    if (existing?.active) return 'Police: Forest sweep already underway.';
    this.patrols.push({ id: 'forest_sweep', label: 'Forest Sweep Patrol', active: true, progress: 0 });
    this.trust += 10;
    return 'Police: Copy that — deploying a friendly forest sweep.';
  }

  update(delta: number): string | null {
    let doneMsg: string | null = null;
    for (const p of this.patrols) {
      if (!p.active) continue;
      p.progress = Math.min(1, p.progress + delta / 25000);
      if (p.progress >= 1) {
        p.active = false;
        this.trust += 15;
        doneMsg = `Police: ${p.label} complete. Trust +15.`;
      }
    }
    return doneMsg;
  }

  boardLines(): string[] {
    const lines = [`Police trust: ${this.trust}`];
    for (const p of this.patrols) {
      lines.push(
        p.active
          ? `• ${p.label} ${Math.floor(p.progress * 100)}%`
          : `✓ ${p.label} done`,
      );
    }
    if (!this.patrols.length) lines.push('Talk to Officer Pike to request a patrol.');
    return lines;
  }
}
