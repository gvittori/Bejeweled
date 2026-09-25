import Phaser from 'phaser';
import { BootScene } from './BootScene';
import { PreloadScene } from './PreloadScene';
import { GameScene } from './GameScene';
import { GameMode, GameState } from '../../types';
import { applyPhaserWebGLFixes } from './webglFix';

export interface PhaserGameCallbacks {
  onStatsUpdate: (stats: GameState) => void;
  onGameOver: (stats: GameState) => void;
  onLevelUp: (level: number) => void;
  onGameResumed?: (info: { level: number; score: number; multiplier: number }) => void;
}

export class PhaserGameBridge {
  private game: Phaser.Game | null = null;
  private gameScene: GameScene | null = null;
  private callbacks: PhaserGameCallbacks;
  private isDestroyed: boolean = false;

  constructor(
    container: HTMLElement,
    mode: GameMode,
    callbacks: PhaserGameCallbacks
  ) {
    this.callbacks = callbacks;
    const safeWidth = Math.max(container.clientWidth || 0, 320);
    const safeHeight = Math.max(container.clientHeight || 0, 340);

    // Resolve Phaser: prefer CDN global if present, otherwise npm package
    const PhaserClass = (typeof window !== 'undefined' && (window as any).Phaser) || Phaser;

    // Apply defensive WebGL framebuffer & render-target guards
    applyPhaserWebGLFixes(PhaserClass);
    applyPhaserWebGLFixes(Phaser);

    const config: Phaser.Types.Core.GameConfig = {
      type: PhaserClass.AUTO,
      parent: container,
      width: safeWidth,
      height: safeHeight,
      backgroundColor: '#0b0914',
      transparent: false,
      audio: {
        noAudio: true,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: PhaserClass.Scale.NONE,
        autoCenter: PhaserClass.Scale.CENTER_BOTH,
        width: safeWidth,
        height: safeHeight,
        min: {
          width: 280,
          height: 280,
        },
      },
      scene: [BootScene, PreloadScene, GameScene],
      callbacks: {
        preBoot: (game: Phaser.Game) => {
          game.registry.set('initialMode', mode);
        },
      },
    };

    try {
      const gameInstance = new PhaserClass.Game(config);
      this.game = gameInstance;

      // Listen on Game-level event emitter
      gameInstance.events.on('game-scene-ready', (scene: GameScene) => {
        if (!this.isDestroyed) {
          this.gameScene = scene;
        }
      });

      gameInstance.events.on('stats-update', (stats: GameState) => {
        if (!this.isDestroyed && this.callbacks?.onStatsUpdate) {
          this.callbacks.onStatsUpdate(stats);
        }
      });

      gameInstance.events.on('game-over', (stats: GameState) => {
        if (!this.isDestroyed && this.callbacks?.onGameOver) {
          this.callbacks.onGameOver(stats);
        }
      });

      gameInstance.events.on('level-up', (level: number) => {
        if (!this.isDestroyed && this.callbacks?.onLevelUp) {
          this.callbacks.onLevelUp(level);
        }
      });

      gameInstance.events.on('game-resumed', (info: { level: number; score: number; multiplier: number }) => {
        if (!this.isDestroyed && this.callbacks?.onGameResumed) {
          this.callbacks.onGameResumed(info);
        }
      });
    } catch (err) {
      console.error('Failed to initialize Phaser Game:', err);
    }
  }

  public updateCallbacks(callbacks: PhaserGameCallbacks) {
    this.callbacks = callbacks;
  }

  public triggerHint() {
    if (this.isDestroyed || !this.game) return;
    this.game.events.emit('bridge:trigger-hint');
    this.gameScene?.triggerHint();
  }

  public setPaused(paused: boolean) {
    if (this.isDestroyed || !this.game) return;
    this.game.events.emit('bridge:set-paused', paused);
    this.gameScene?.setPaused(paused);
  }

  public setGameMode(mode: GameMode) {
    if (this.isDestroyed || !this.game) return;
    this.game.events.emit('bridge:set-mode', mode);
    this.gameScene?.setGameMode(mode);
  }

  public restart() {
    if (this.isDestroyed || !this.game) return;
    this.game.events.emit('bridge:restart');
    this.gameScene?.restartGame();
  }

  public resize(width: number, height: number) {
    if (this.isDestroyed || !this.game || !this.game.scale) return;
    if (width > 0 && height > 0) {
      const safeW = Math.max(280, Math.floor(width));
      const safeH = Math.max(280, Math.floor(height));
      this.game.scale.resize(safeW, safeH);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.game) {
      try {
        this.game.destroy(true, false);
      } catch (err) {
        console.warn('Error during Phaser destruction:', err);
      }
      this.game = null;
      this.gameScene = null;
    }
  }
}

