import { installDomOverlay } from './ui/domOverlay';
import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { TitleScene } from './game/scenes/TitleScene';
import { GameScene } from './game/scenes/GameScene';
import { UIScene } from './game/scenes/UIScene';

const isPhone =
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);

/** Fill the real viewport — never letterbox a tiny 16:9 strip on phones. */
function viewportSize(): { w: number; h: number } {
  const w = Math.max(320, Math.floor(window.innerWidth || document.documentElement.clientWidth || 1280));
  const h = Math.max(480, Math.floor(window.innerHeight || document.documentElement.clientHeight || 720));
  return { w, h };
}

const start = viewportSize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0a1628',
  fps: {
    target: isPhone ? 40 : 60,
    min: 20,
    forceSetTimeOut: isPhone,
  },
  render: {
    antialias: !isPhone,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  scale: {
    // RESIZE = canvas matches phone/desktop window (full screen)
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: start.w,
    height: start.h,
    expandParent: true,
    autoRound: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { x: 0, y: 0 },
      fps: isPhone ? 40 : 60,
    },
  },
  scene: [BootScene, TitleScene, GameScene, UIScene],
  input: {
    activePointers: 3,
  },
};

installDomOverlay();
const game = new Phaser.Game(config);
(window as unknown as { __phaserGame: Phaser.Game }).__phaserGame = game;

function refreshFill(): void {
  const { w, h } = viewportSize();
  try {
    game.scale.resize(w, h);
  } catch {
    /* ignore during boot */
  }
  const canvas = game.canvas;
  if (canvas) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.margin = '0';
    canvas.style.display = 'block';
  }
}

window.addEventListener('resize', refreshFill);
window.addEventListener('orientationchange', () => setTimeout(refreshFill, 80));
game.events.once('ready', refreshFill);
setTimeout(refreshFill, 50);
setTimeout(refreshFill, 300);
