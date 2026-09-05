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
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(120);
  }

  update(delta: number): void {
    this.t = (this.t + delta / this.dayLenMs) % 1;
    // night around 0.0 and 1.0, noon at 0.5
    const night = Math.max(0, Math.cos(this.t * Math.PI * 2));
    const alpha = Phaser.Math.Clamp(night * 0.45, 0, 0.45);
    this.overlay.setAlpha(alpha);
    const hour = Math.floor(this.t * 24);
    const phase = hour < 5 || hour >= 20 ? 'Night' : hour < 11 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
    this.label.setText(`🕒 ${phase} · ${hour.toString().padStart(2, '0')}:00`);
  }

  getHour(): number {
    return Math.floor(this.t * 24);
  }
}
