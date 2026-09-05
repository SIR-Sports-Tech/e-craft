import { installDomOverlay } from './ui/domOverlay';
import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { TitleScene } from './game/scenes/TitleScene';
import { GameScene } from './game/scenes/GameScene';
import { UIScene } from './game/scenes/UIScene';

const isPhone =
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0a1628',
  // Cap FPS / skip frames on phones to avoid spiral-of-death freezes
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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
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

// eslint-disable-next-line no-new
installDomOverlay();
const game = new Phaser.Game(config);
(window as unknown as { __phaserGame: unknown }).__phaserGame = game;
