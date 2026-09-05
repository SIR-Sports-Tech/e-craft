import Phaser from 'phaser';

/**
 * Day/night wash + visible SUN that rises and arcs across the sky.
 * t: 0 = midnight, 0.25 ≈ 6am sunrise, 0.5 = noon, 0.75 ≈ 6pm sunset.
 */
export class DayNightSystem {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private sun!: Phaser.GameObjects.Container;
  private sunCore!: Phaser.GameObjects.Arc;
  private sunGlow!: Phaser.GameObjects.Arc;
  private moon!: Phaser.GameObjects.Arc;
  private t = 0.35; // start mid-morning so sun is already climbing
  private readonly dayLenMs = 120000; // 2 min full cycle

  constructor(scene: Phaser.Scene, worldW: number, worldH: number) {
    this.scene = scene;
    this.overlay = scene.add
      .rectangle(worldW / 2, worldH / 2, worldW, worldH, 0x0a1630, 0)
      .setDepth(40)
      .setScrollFactor(1);

    // Sun / moon fixed to camera so they live in the sky UI layer
    this.sunGlow = scene.add.circle(0, 0, 38, 0xfff59d, 0.35);
    this.sunCore = scene.add.circle(0, 0, 22, 0xffee58, 1).setStrokeStyle(3, 0xfffde7, 0.9);
    const ray = scene.add.graphics();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ray.lineStyle(3, 0xffe082, 0.55);
      ray.lineBetween(Math.cos(a) * 26, Math.sin(a) * 26, Math.cos(a) * 44, Math.sin(a) * 44);
    }
    this.sun = scene.add.container(0, 0, [this.sunGlow, ray, this.sunCore]).setDepth(95).setScrollFactor(0);

    this.moon = scene.add
      .circle(0, 0, 16, 0xeceff1, 0.95)
      .setStrokeStyle(2, 0xb0bec5, 0.8)
      .setDepth(95)
      .setScrollFactor(0)
      .setVisible(false);

    this.label = scene.add
      .text(scene.scale.width - 12, 12, '', {
        fontSize: '13px',
        color: '#ffe082',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setAlpha(0.85)
      .setScrollFactor(0)
      .setDepth(120);

    this.placeSkyBodies();
  }

  update(delta: number): void {
    this.t = (this.t + delta / this.dayLenMs) % 1;
    const night = Math.max(0, Math.cos(this.t * Math.PI * 2));
    const alpha = Phaser.Math.Clamp(night * 0.45, 0, 0.45);
    this.overlay.setAlpha(alpha);
    this.placeSkyBodies();
  }

  private placeSkyBodies(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const hour = this.getHour();
    // Day arc: sun visible roughly 5am–8pm
    const dayStart = 5 / 24;
    const dayEnd = 20 / 24;
    const isDay = this.t >= dayStart && this.t <= dayEnd;

    if (isDay) {
      const u = (this.t - dayStart) / (dayEnd - dayStart); // 0..1 sunrise→sunset
      // Rise from left-low, peak at top-center, set right-low
      const x = Phaser.Math.Linear(w * 0.12, w * 0.88, u);
      const y = h * 0.42 - Math.sin(u * Math.PI) * (h * 0.32);
      this.sun.setPosition(x, y);
      this.sun.setVisible(true);
      this.sun.setAlpha(0.75 + Math.sin(u * Math.PI) * 0.25);
      // Warm glow stronger at sunrise/sunset
      const edge = Math.sin(u * Math.PI);
      this.sunGlow.setFillStyle(edge < 0.35 ? 0xff8a65 : 0xfff59d, 0.3 + edge * 0.25);
      this.sunCore.setFillStyle(edge < 0.35 ? 0xff7043 : 0xffee58, 1);
      this.moon.setVisible(false);
      this.label.setText(hour < 11 ? `☀ Sunrise · ${hour}:00` : hour < 17 ? `☀ Day · ${hour}:00` : `☀ Sunset · ${hour}:00`);
      this.label.setVisible(true);
    } else {
      this.sun.setVisible(false);
      // Moon arc opposite
      const nightU = this.t > dayEnd ? (this.t - dayEnd) / (1 - dayEnd + dayStart) : (this.t + (1 - dayEnd)) / (1 - dayEnd + dayStart);
      const nu = Phaser.Math.Clamp(nightU, 0, 1);
      this.moon.setPosition(Phaser.Math.Linear(w * 0.15, w * 0.85, nu), h * 0.28 - Math.sin(nu * Math.PI) * (h * 0.18));
      this.moon.setVisible(true);
      this.label.setText(`🌙 Night · ${hour}:00`);
      this.label.setVisible(true);
    }
  }

  getHour(): number {
    return Math.floor(this.t * 24);
  }

  getT(): number {
    return this.t;
  }

  phase(): 'night' | 'morning' | 'day' | 'dusk' {
    const hour = this.getHour();
    if (hour < 5 || hour >= 21) return 'night';
    if (hour < 11) return 'morning';
    if (hour < 17) return 'day';
    return 'dusk';
  }

  /** Sleep advances time to next morning (~7am) — sun rises. */
  sleepUntilMorning(): { fromHour: number; toHour: number } {
    const fromHour = this.getHour();
    this.t = 7 / 24;
    this.overlay.setAlpha(0.08);
    this.placeSkyBodies();
    return { fromHour, toHour: this.getHour() };
  }

  /** Force a sunrise moment (for demos / sleep wake). */
  forceSunrise(): void {
    this.t = 6.2 / 24;
    this.overlay.setAlpha(0.12);
    this.placeSkyBodies();
  }

  setOutdoorVisible(vis: boolean): void {
    // Keep sky bodies visible even indoors as a window vibe — but dim
    this.sun.setAlpha(vis ? 1 : 0.35);
    this.moon.setAlpha(vis ? 1 : 0.35);
  }
}
