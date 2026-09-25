import Phaser from 'phaser';
import { GameMode } from '../../types';

export class BootScene extends Phaser.Scene {
  private initialMode: GameMode = 'classic';

  constructor() {
    super({ key: 'BootScene' });
  }

  init(data?: { mode?: GameMode }) {
    if (data && data.mode) {
      this.initialMode = data.mode;
    } else {
      const regMode = this.registry?.get('initialMode');
      if (regMode) {
        this.initialMode = regMode;
      }
    }
  }

  preload() {
    // Minimal boot assets if needed
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0914');
    const mode = this.initialMode || this.registry?.get('initialMode') || 'classic';
    this.scene.start('PreloadScene', { mode });
  }
}

