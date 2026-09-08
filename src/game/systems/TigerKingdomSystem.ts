import Phaser from 'phaser';
import { TIGER_KINGDOM } from '../world/WorldLayout';

interface ResidentTiger {
  sprite: Phaser.Physics.Arcade.Sprite;
  homeX: number;
  homeY: number;
  tx: number;
  ty: number;
  speed: number;
}

/**
 * Tiger Kingdom at the low/south end of the forest —
 * dens, bone totems, throne rock, and resident tigers that patrol the grounds.
 * Fully walkable (no solid walls).
 */
export class TigerKingdomSystem {
  private scene: Phaser.Scene;
  private layer!: Phaser.GameObjects.Container;
  private residents: ResidentTiger[] = [];
  private outdoor = true;
  private built = false;
  private onSpawn?: (sprite: Phaser.Physics.Arcade.Sprite) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setOnSpawn(cb: (sprite: Phaser.Physics.Arcade.Sprite) => void): void {
    this.onSpawn = cb;
    for (const t of this.residents) cb(t.sprite);
  }

  build(parent?: Phaser.GameObjects.Container): void {
    if (this.built) return;
    this.built = true;
    const K = TIGER_KINGDOM;
    this.layer = this.scene.add.container(0, 0).setDepth(3);
    if (parent) parent.add(this.layer);

    // Kingdom ground wash
    const ground = this.scene.add
      .rectangle(K.x + K.w / 2, K.y + K.h / 2, K.w, K.h, 0xbf360c, 0.22)
      .setStrokeStyle(4, 0xff6f00, 0.55);
    this.layer.add(ground);

    // Gate arches (north entrance)
    for (const ox of [-180, 180]) {
      const pillar = this.scene.add
        .rectangle(K.gateX + ox, K.gateY + 40, 36, 110, 0x5d4037, 1)
        .setStrokeStyle(2, 0xffe082, 0.8);
      this.layer.add(pillar);
    }
    const lintel = this.scene.add
      .rectangle(K.gateX, K.gateY - 20, 400, 28, 0x6d4c41, 1)
      .setStrokeStyle(2, 0xffd54f, 0.9);
    this.layer.add(lintel);
    const banner = this.scene.add
      .text(K.gateX, K.gateY - 22, '🐅 TIGER KINGDOM 🐅', {
        fontSize: '18px',
        color: '#fff8e1',
        fontStyle: 'bold',
        stroke: '#bf360c',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.layer.add(banner);

    // Path from gate to throne
    const path = this.scene.add.graphics();
    path.fillStyle(0x8d6e63, 0.55);
    path.fillRect(K.gateX - 40, K.gateY, 80, K.throneY - K.gateY);
    this.layer.add(path);

    // Bone / rock ring around throne
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rx = K.throneX + Math.cos(a) * 160;
      const ry = K.throneY + Math.sin(a) * 110;
      const rock = this.scene.add
        .ellipse(rx, ry, 28 + (i % 3) * 8, 18 + (i % 2) * 6, 0x795548, 1)
        .setStrokeStyle(2, 0xffcc80, 0.5);
      this.layer.add(rock);
    }

    // Throne rock + crown mark
    const throne = this.scene.add
      .ellipse(K.throneX, K.throneY, 140, 90, 0x4e342e, 1)
      .setStrokeStyle(4, 0xffc107, 0.95);
    this.layer.add(throne);
    const crown = this.scene.add
      .text(K.throneX, K.throneY - 10, '👑', { fontSize: '42px' })
      .setOrigin(0.5);
    this.layer.add(crown);
    const throneLabel = this.scene.add
      .text(K.throneX, K.throneY + 55, 'THRONE OF THE STRIPE KING', {
        fontSize: '12px',
        color: '#ffe082',
        backgroundColor: '#00000099',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);
    this.layer.add(throneLabel);

    // Dens (caves)
    const denSpots = [
      { x: K.x + 280, y: K.y + 400 },
      { x: K.x + K.w - 320, y: K.y + 380 },
      { x: K.x + 500, y: K.y + K.h - 280 },
      { x: K.x + K.w - 480, y: K.y + K.h - 260 },
      { x: K.throneX - 420, y: K.throneY + 200 },
      { x: K.throneX + 420, y: K.throneY + 180 },
    ];
    for (const d of denSpots) {
      const mouth = this.scene.add
        .ellipse(d.x, d.y, 90, 55, 0x212121, 1)
        .setStrokeStyle(3, 0xff8a65, 0.7);
      const hill = this.scene.add.ellipse(d.x, d.y - 18, 110, 40, 0x5d4037, 0.9);
      const tag = this.scene.add
        .text(d.x, d.y + 36, 'DEN', {
          fontSize: '11px',
          color: '#ffccbc',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5);
      this.layer.add(hill);
      this.layer.add(mouth);
      this.layer.add(tag);
    }

    // Totem poles
    for (const ox of [-520, 520]) {
      const pole = this.scene.add.rectangle(K.throneX + ox, K.throneY - 40, 22, 120, 0x3e2723, 1);
      const face = this.scene.add
        .text(K.throneX + ox, K.throneY - 80, '🐯', { fontSize: '28px' })
        .setOrigin(0.5);
      this.layer.add(pole);
      this.layer.add(face);
    }

    // Welcome plaque
    const plaque = this.scene.add
      .text(K.gateX, K.gateY + 90, 'All the way down the LOW forest\nResident tigers · dens · throne', {
        fontSize: '13px',
        color: '#fff3e0',
        align: 'center',
        backgroundColor: '#bf360ccc',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5);
    this.layer.add(plaque);

    this.spawnResidents(denSpots);
  }

  setOutdoorVisible(vis: boolean): void {
    this.outdoor = vis;
    this.layer?.setVisible(vis);
    for (const t of this.residents) {
      t.sprite.setVisible(vis);
      if (!vis) t.sprite.setVelocity(0, 0);
    }
  }

  update(delta: number, player: Phaser.Physics.Arcade.Sprite, outdoors: boolean, onNear?: (msg: string) => void): void {
    if (!outdoors || !this.outdoor) {
      this.setOutdoorVisible(false);
      return;
    }
    this.layer?.setVisible(true);

    const K = TIGER_KINGDOM;
    const inKingdom =
      player.x >= K.x &&
      player.x <= K.x + K.w &&
      player.y >= K.y &&
      player.y <= K.y + K.h;

    for (const t of this.residents) {
      if (!t.sprite.visible) t.sprite.setVisible(true);
      const dx = t.tx - t.sprite.x;
      const dy = t.ty - t.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 20) {
        // New wander near home / throne
        if (Math.random() < 0.35) {
          t.tx = K.throneX + Phaser.Math.Between(-220, 220);
          t.ty = K.throneY + Phaser.Math.Between(-140, 140);
        } else {
          t.tx = t.homeX + Phaser.Math.Between(-120, 120);
          t.ty = t.homeY + Phaser.Math.Between(-90, 90);
        }
      } else {
        // If player is in kingdom, mildly circle / approach (family scare, not flatten)
        let vx = (dx / dist) * t.speed;
        let vy = (dy / dist) * t.speed;
        if (inKingdom) {
          const pdx = player.x - t.sprite.x;
          const pdy = player.y - t.sprite.y;
          const pd = Math.hypot(pdx, pdy) || 1;
          if (pd < 280) {
            vx = (pdx / pd) * (t.speed * 0.85);
            vy = (pdy / pd) * (t.speed * 0.85);
          }
        }
        t.sprite.setVelocity(vx, vy);
        t.sprite.setFlipX(vx < 0);
        if (t.sprite.anims) t.sprite.play('tiger-run', true);
      }
    }

    if (inKingdom && onNear && Math.random() < delta * 0.00015) {
      onNear('🐅 Tiger Kingdom! Dens, throne, and stripe royalty all around you.');
    }
  }

  count(): number {
    return this.residents.length;
  }

  getSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.residents.map((t) => t.sprite);
  }

  contains(x: number, y: number): boolean {
    const K = TIGER_KINGDOM;
    return x >= K.x && x <= K.x + K.w && y >= K.y && y <= K.y + K.h;
  }

  private spawnResidents(denSpots: Array<{ x: number; y: number }>): void {
    const K = TIGER_KINGDOM;
    const homes = [
      ...denSpots,
      { x: K.throneX - 100, y: K.throneY + 80 },
      { x: K.throneX + 100, y: K.throneY + 80 },
      { x: K.gateX - 80, y: K.gateY + 160 },
      { x: K.gateX + 80, y: K.gateY + 160 },
      { x: K.x + K.w / 2, y: K.y + K.h - 150 },
    ];
    for (let i = 0; i < homes.length; i++) {
      const h = homes[i];
      const sprite = this.scene.physics.add.sprite(h.x, h.y, 'tiger_sheet', 0);
      sprite.setDepth(12).setScale(1.1);
      sprite.setImmovable(false);
      sprite.body!.setSize(42, 24).setOffset(10, 16);
      if (sprite.anims?.exists?.('tiger-run')) sprite.play('tiger-run', true);
      else sprite.setFrame(0);
      this.onSpawn?.(sprite);
      this.residents.push({
        sprite,
        homeX: h.x,
        homeY: h.y,
        tx: h.x + Phaser.Math.Between(-40, 40),
        ty: h.y + Phaser.Math.Between(-40, 40),
        speed: 90 + Math.random() * 50,
      });
    }
  }
}
