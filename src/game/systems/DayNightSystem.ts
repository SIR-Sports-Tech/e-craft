import Phaser from 'phaser';

/** Simple day/night wash over the world — living-city feel without blocking play. */
export class DayNightSystem {
  private overlay: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private t = 0.35; // 0..1 day cycle
  private readonly dayLenMs = 120000; // 2 min full cycle

  constructor(scene: Phaser.Scene, worldW: number, worldH: number) {
    this.overlay = scene.add
      .rectangle(worldW / 2, worldH / 2, worldW, worldH, 0x0a1630, 0)
      .setDepth(40)
      .setScrollFactor(1);
    this.label = scene.add
      .text(scene.scale.width - 12, 12, '', {
        fontSize: '13px',
        color: '#ffe082',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0).setAlpha(0.7)
      .setScrollFactor(0)
      .setDepth(120);
  }

  update(delta: number): void {
    this.t = (this.t + delta / this.dayLenMs) % 1;
    const night = Math.max(0, Math.cos(this.t * Math.PI * 2));
    const alpha = Phaser.Math.Clamp(night * 0.45, 0, 0.45);
    this.overlay.setAlpha(alpha);
    const hour = this.getHour();
    this.label.setVisible(false);
  }

  getHour(): number {
    return Math.floor(this.t * 24);
  }

  phase(): 'night' | 'morning' | 'day' | 'dusk' {
    const hour = this.getHour();
    if (hour < 5 || hour >= 21) return 'night';
    if (hour < 11) return 'morning';
    if (hour < 17) return 'day';
    return 'dusk';
  }

  /** Sleep advances time to next morning (~7am). */
  sleepUntilMorning(): { fromHour: number; toHour: number } {
    const fromHour = this.getHour();
    // t=0 → midnight; hour 7 → 7/24
    this.t = 7 / 24;
    this.overlay.setAlpha(0.08);
    return { fromHour, toHour: this.getHour() };
  }
}
