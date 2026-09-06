import Phaser from 'phaser';

/**
 * High-resolution original building facades for E-CRAFT.
 * Consistent doorway: center-bottom, 72×96 recess — interactive door attaches here.
 * Texture size: 512×448 (crisp when scaled down in-world).
 */
export const HIRES_BLDG = {
  w: 512,
  h: 448,
  /** Door center Y offset from texture center (origin 0.5,0.5). */
  doorLocalY: 152,
  doorTexW: 72,
  doorTexH: 96,
} as const;

type G = Phaser.GameObjects.Graphics;

function softShadow(g: G, w: number, h: number): void {
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(w / 2, h - 10, w * 0.92, 28);
  g.fillStyle(0x000000, 0.1);
  g.fillEllipse(w / 2, h - 6, w * 0.7, 14);
}

function doorway(g: G, w: number, h: number): void {
  const dw = HIRES_BLDG.doorTexW;
  const dh = HIRES_BLDG.doorTexH;
  const dx = w / 2 - dw / 2;
  const dy = h - 24 - dh;
  // Stone/wood frame
  g.fillStyle(0x3e2723, 1);
  g.fillRoundedRect(dx - 8, dy - 10, dw + 16, dh + 14, 6);
  g.fillStyle(0x5d4037, 1);
  g.fillRect(dx - 8, dy - 10, dw + 16, 10); // lintel
  // Dark opening (interactive door covers this)
  g.fillStyle(0x0a0a0c, 1);
  g.fillRoundedRect(dx, dy, dw, dh, 4);
  g.fillStyle(0x1a237e, 0.15);
  g.fillRect(dx + 6, dy + 8, dw - 12, dh - 16);
}

function glassWindow(
  g: G,
  x: number,
  y: number,
  ww: number,
  wh: number,
  panes = 4,
  lit = true,
): void {
  g.fillStyle(0x263238, 1);
  g.fillRoundedRect(x - 3, y - 3, ww + 6, wh + 6, 3);
  g.fillStyle(lit ? 0x81d4fa : 0x37474f, 1);
  g.fillRoundedRect(x, y, ww, wh, 2);
  if (lit) {
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(x + 3, y + 3, ww * 0.35, wh * 0.4);
    g.fillStyle(0x4fc3f7, 0.25);
    g.fillRect(x + ww * 0.5, y + wh * 0.45, ww * 0.4, wh * 0.4);
  }
  g.lineStyle(2, 0xeceff1, 0.85);
  g.strokeRoundedRect(x, y, ww, wh, 2);
  if (panes >= 2) g.lineBetween(x + ww / 2, y, x + ww / 2, y + wh);
  if (panes >= 4) g.lineBetween(x, y + wh / 2, x + ww, y + wh / 2);
}

function brickRows(g: G, x: number, y: number, w: number, h: number, c1: number, c2: number): void {
  const bh = 10;
  const bw = 22;
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 === 0 ? 0 : bw / 2;
    for (let col = -1; col * bw < w + bw; col++) {
      const bx = x + off + col * bw;
      if (bx + 2 < x || bx > x + w - 2) continue;
      const by = y + row * bh;
      g.fillStyle(row % 3 === 0 ? c2 : c1, 1);
      g.fillRect(bx, by, bw - 2, bh - 2);
    }
  }
}

function roofTiles(g: G, pts: number[], base: number, lite: number): void {
  const [x1, y1, x2, y2, x3, y3] = pts;
  g.fillStyle(base, 1);
  g.fillTriangle(x1, y1, x2, y2, x3, y3);
  g.lineStyle(2, lite, 0.35);
  const topY = y2;
  const botY = Math.max(y1, y3);
  for (let t = 0; t < 8; t++) {
    const yy = topY + ((botY - topY) * (t + 1)) / 9;
    const tnorm = (yy - topY) / (botY - topY || 1);
    const half = ((x3 - x1) / 2) * tnorm;
    const mid = (x1 + x3) / 2;
    g.lineBetween(mid - half, yy, mid + half, yy);
  }
  g.lineStyle(3, lite, 0.55);
  g.lineBetween(x1, y1, x2, y2);
  g.lineBetween(x2, y2, x3, y3);
}

/** Modern glass Security HQ — navy + teal accents + antenna. */
export function drawHq(scene: Phaser.Scene): void {
  const w = HIRES_BLDG.w;
  const h = HIRES_BLDG.h;
  const g = scene.make.graphics({ x: 0, y: 0 });
  softShadow(g, w, h);

  // Plinth
  g.fillStyle(0x37474f, 1);
  g.fillRoundedRect(28, h - 36, w - 56, 20, 4);

  // Main body — glass curtain wall
  g.fillStyle(0x0d47a1, 1);
  g.fillRoundedRect(40, 110, w - 80, h - 150, 10);
  // Glass panes grid
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) {
      const gx = 52 + col * 68;
      const gy = 122 + row * 48;
      g.fillStyle(0x0277bd, 1);
      g.fillRoundedRect(gx, gy, 60, 40, 3);
      g.fillStyle(0x4fc3f7, 0.55);
      g.fillRoundedRect(gx + 2, gy + 2, 56, 36, 2);
      g.fillStyle(0xffffff, 0.28);
      g.fillRect(gx + 4, gy + 4, 22, 14);
      g.lineStyle(1.5, 0xe1f5fe, 0.5);
      g.strokeRoundedRect(gx, gy, 60, 40, 3);
    }
  }
  // Teal accent stripe
  g.fillStyle(0x00bfa5, 1);
  g.fillRect(40, 168, w - 80, 10);
  g.fillRect(40, 280, w - 80, 8);

  // Roof deck
  g.fillStyle(0x1565c0, 1);
  g.fillRoundedRect(32, 78, w - 64, 40, 6);
  g.fillStyle(0x42a5f5, 1);
  g.fillTriangle(24, 95, w / 2, 18, w - 24, 95);
  g.fillStyle(0x81d4fa, 0.5);
  g.fillTriangle(60, 95, w / 2, 36, w - 60, 95);

  // Antenna / flag
  g.lineStyle(4, 0xcfd8dc, 1);
  g.lineBetween(w / 2, 18, w / 2, -8);
  g.fillStyle(0xf44336, 1);
  g.fillCircle(w / 2, -12, 7);
  g.fillStyle(0xffeb3b, 1);
  g.fillTriangle(w / 2, 8, w / 2 + 28, 18, w / 2, 28);

  // Entrance canopy
  g.fillStyle(0x00897b, 1);
  g.fillRoundedRect(w / 2 - 70, h - 140, 140, 16, 3);
  g.fillStyle(0x004d40, 0.5);
  g.fillRect(w / 2 - 60, h - 124, 8, 20);
  g.fillRect(w / 2 + 52, h - 124, 8, 20);

  doorway(g, w, h);

  // Side planters
  g.fillStyle(0x5d4037, 1);
  g.fillRoundedRect(56, h - 70, 48, 28, 4);
  g.fillRoundedRect(w - 104, h - 70, 48, 28, 4);
  g.fillStyle(0x66bb6a, 1);
  g.fillCircle(80, h - 78, 14);
  g.fillCircle(w - 80, h - 78, 14);

  g.generateTexture('bldg_hq', w, h);
  g.destroy();
}

/** Fortified SUPER JAIL — deep brick, barred windows, watch lights. */
export function drawJail(scene: Phaser.Scene): void {
  const w = HIRES_BLDG.w;
  const h = HIRES_BLDG.h;
  const g = scene.make.graphics({ x: 0, y: 0 });
  softShadow(g, w, h);

  g.fillStyle(0x4e342e, 1);
  g.fillRoundedRect(36, 100, w - 72, h - 130, 8);
  brickRows(g, 40, 104, w - 80, h - 150, 0x6d4c41, 0x5d4037);

  // Darker battlements
  g.fillStyle(0x3e2723, 1);
  for (let i = 0; i < 9; i++) {
    g.fillRect(48 + i * 48, 72, 32, 36);
  }
  g.fillStyle(0x8d6e63, 1);
  g.fillRect(36, 100, w - 72, 12);

  // Watch lights
  g.fillStyle(0xffeb3b, 0.9);
  g.fillCircle(70, 88, 8);
  g.fillCircle(w - 70, 88, 8);
  g.fillStyle(0xfff59d, 0.35);
  g.fillCircle(70, 88, 16);
  g.fillCircle(w - 70, 88, 16);

  // Barred windows
  for (const wx of [90, 200, 320, 420]) {
    glassWindow(g, wx, 150, 50, 58, 2, false);
    g.lineStyle(3, 0x212121, 0.9);
    for (let i = 0; i < 4; i++) g.lineBetween(wx + 8 + i * 12, 152, wx + 8 + i * 12, 206);
  }
  for (const wx of [90, 200, 320, 420]) {
    glassWindow(g, wx, 240, 50, 58, 2, false);
    g.lineStyle(3, 0x212121, 0.9);
    for (let i = 0; i < 4; i++) g.lineBetween(wx + 8 + i * 12, 242, wx + 8 + i * 12, 296);
  }

  // Warning stripe over door
  g.fillStyle(0xffc107, 1);
  g.fillRect(w / 2 - 60, h - 140, 120, 12);
  g.fillStyle(0x212121, 1);
  for (let i = 0; i < 6; i++) g.fillRect(w / 2 - 60 + i * 20, h - 140, 10, 12);

  doorway(g, w, h);

  // Corner towers
  g.fillStyle(0x5d4037, 1);
  g.fillRoundedRect(20, 120, 48, h - 160, 4);
  g.fillRoundedRect(w - 68, 120, 48, h - 160, 4);
  g.fillStyle(0x3e2723, 1);
  g.fillTriangle(16, 124, 44, 70, 72, 124);
  g.fillTriangle(w - 72, 124, w - 44, 70, w - 16, 124);

  g.generateTexture('bldg_jail', w, h);
  g.destroy();
}

/** Cozy player house — warm stucco, red roof, flower boxes. */
export function drawHouse(scene: Phaser.Scene): void {
  const w = HIRES_BLDG.w;
  const h = HIRES_BLDG.h;
  const g = scene.make.graphics({ x: 0, y: 0 });
  softShadow(g, w, h);

  // Walls
  g.fillStyle(0xfff3e0, 1);
  g.fillRoundedRect(56, 140, w - 112, h - 170, 8);
  g.fillStyle(0xffe0b2, 1);
  g.fillRect(56, 140, w - 112, 18);

  // Timber trim
  g.lineStyle(4, 0x6d4c41, 0.85);
  g.strokeRoundedRect(56, 140, w - 112, h - 170, 8);
  g.lineBetween(w / 2, 158, w / 2, h - 30);

  roofTiles(g, [40, 150, w / 2, 28, w - 40, 150], 0xc62828, 0xef9a9a);
  // Chimney
  g.fillStyle(0x795548, 1);
  g.fillRect(w / 2 + 80, 48, 36, 70);
  g.fillStyle(0x5d4037, 1);
  g.fillRect(w / 2 + 74, 42, 48, 14);
  g.fillStyle(0xb0bec5, 0.5);
  g.fillEllipse(w / 2 + 98, 36, 28, 12);

  glassWindow(g, 100, 180, 70, 64, 4, true);
  glassWindow(g, w - 170, 180, 70, 64, 4, true);
  // Flower boxes
  g.fillStyle(0x8d6e63, 1);
  g.fillRoundedRect(96, 244, 78, 16, 3);
  g.fillRoundedRect(w - 174, 244, 78, 16, 3);
  g.fillStyle(0xe91e63, 1);
  g.fillCircle(110, 240, 6);
  g.fillCircle(130, 236, 7);
  g.fillCircle(150, 242, 5);
  g.fillStyle(0xffeb3b, 1);
  g.fillCircle(w - 160, 238, 6);
  g.fillCircle(w - 140, 236, 7);
  g.fillStyle(0x66bb6a, 1);
  g.fillCircle(120, 248, 5);
  g.fillCircle(w - 150, 248, 5);

  // Upper dormer window
  glassWindow(g, w / 2 - 28, 100, 56, 44, 4, true);

  doorway(g, w, h);

  // Welcome mat
  g.fillStyle(0x2e7d32, 1);
  g.fillRoundedRect(w / 2 - 40, h - 22, 80, 10, 2);

  g.generateTexture('bldg_house', w, h);
  g.destroy();
}

/** Civic plaza / school / library style — limestone + warm roof. */
export function drawPlaza(scene: Phaser.Scene): void {
  const w = HIRES_BLDG.w;
  const h = HIRES_BLDG.h;
  const g = scene.make.graphics({ x: 0, y: 0 });
  softShadow(g, w, h);

  g.fillStyle(0x90a4ae, 1);
  g.fillRoundedRect(44, 120, w - 88, h - 150, 8);
  // Stone blocks
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 10; col++) {
      const bx = 50 + col * 42;
      const by = 126 + row * 24;
      g.fillStyle(col % 2 === row % 2 ? 0xb0bec5 : 0x78909c, 1);
      g.fillRect(bx, by, 40, 22);
      g.lineStyle(1, 0x546e7a, 0.4);
      g.strokeRect(bx, by, 40, 22);
    }
  }

  roofTiles(g, [28, 128, w / 2, 22, w - 28, 128], 0xffb74d, 0xffe0b2);
  // Pediment
  g.fillStyle(0xffcc80, 1);
  g.fillTriangle(80, 128, w / 2, 70, w - 80, 128);
  g.fillStyle(0xffe082, 1);
  g.fillCircle(w / 2, 100, 16);

  // Columns
  for (const cx of [110, 190, w - 190, w - 110]) {
    g.fillStyle(0xeceff1, 1);
    g.fillRect(cx - 12, 160, 24, h - 200);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(cx, 158, 30, 12);
    g.fillEllipse(cx, h - 40, 32, 12);
  }

  glassWindow(g, 220, 170, 72, 70, 4, true);
  glassWindow(g, w - 292, 170, 72, 70, 4, true);
  glassWindow(g, 220, 260, 72, 60, 4, true);
  glassWindow(g, w - 292, 260, 72, 60, 4, true);

  doorway(g, w, h);

  // Steps
  g.fillStyle(0x78909c, 1);
  g.fillRect(w / 2 - 70, h - 28, 140, 8);
  g.fillStyle(0x90a4ae, 1);
  g.fillRect(w / 2 - 80, h - 20, 160, 8);

  g.generateTexture('bldg_plaza', w, h);
  g.destroy();
}

/** Forest cabin / shop — warm timber, green roof, porch. */
export function drawCabin(scene: Phaser.Scene): void {
  const w = HIRES_BLDG.w;
  const h = HIRES_BLDG.h;
  const g = scene.make.graphics({ x: 0, y: 0 });
  softShadow(g, w, h);

  // Log walls
  g.fillStyle(0x6d4c41, 1);
  g.fillRoundedRect(60, 150, w - 120, h - 180, 6);
  for (let i = 0; i < 14; i++) {
    const yy = 154 + i * 18;
    g.fillStyle(i % 2 === 0 ? 0x8d6e63 : 0x795548, 1);
    g.fillRoundedRect(64, yy, w - 128, 16, 4);
    g.fillStyle(0x5d4037, 0.35);
    g.fillCircle(72, yy + 8, 5);
    g.fillCircle(w - 72, yy + 8, 5);
  }

  roofTiles(g, [36, 160, w / 2, 30, w - 36, 160], 0x2e7d32, 0x81c784);
  // Skylight
  glassWindow(g, w / 2 - 24, 90, 48, 36, 2, true);

  glassWindow(g, 100, 190, 64, 56, 4, true);
  glassWindow(g, w - 164, 190, 64, 56, 4, true);

  // Porch roof
  g.fillStyle(0x33691e, 1);
  g.fillTriangle(w / 2 - 100, h - 120, w / 2, h - 160, w / 2 + 100, h - 120);
  g.fillStyle(0x5d4037, 1);
  g.fillRect(w / 2 - 90, h - 118, 12, 50);
  g.fillRect(w / 2 + 78, h - 118, 12, 50);

  doorway(g, w, h);

  // Woodpile
  g.fillStyle(0x4e342e, 1);
  for (let i = 0; i < 5; i++) g.fillEllipse(90 + i * 10, h - 40, 18, 10);

  g.generateTexture('bldg_forest_cabin', w, h);
  g.destroy();
}

/** Generate all hi-res building textures into the Phaser texture cache. */
export function generateHiResBuildings(scene: Phaser.Scene): void {
  drawHq(scene);
  drawJail(scene);
  drawHouse(scene);
  drawPlaza(scene);
  drawCabin(scene);
}
