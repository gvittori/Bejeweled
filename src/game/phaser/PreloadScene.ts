import Phaser from 'phaser';
import { GameMode, GemType } from '../../types';

export class PreloadScene extends Phaser.Scene {
  private mode: GameMode = 'classic';

  constructor() {
    super({ key: 'PreloadScene' });
  }

  init(data?: { mode?: GameMode }) {
    if (data && data.mode) {
      this.mode = data.mode;
    } else {
      const regMode = this.registry?.get('initialMode');
      if (regMode) {
        this.mode = regMode;
      }
    }
  }

  preload() {
    if (this.textures.exists('gems')) {
      return;
    }

    const { width, height } = this.cameras.main;

    // Loading Bar Visuals
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x1e1b4b, 0.8);
    progressBox.fillRoundedRect(width / 2 - 120, height / 2 - 12, 240, 24, 12);

    const loadingText = this.add.text(width / 2, height / 2 - 32, 'Summoning Jewels...', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#c084fc',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xa855f7, 1);
      progressBar.fillRoundedRect(width / 2 - 116, height / 2 - 8, 232 * value, 16, 8);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load gem spritesheet (780 x 800, 15 columns x 52px each, 14 rows used)
    this.load.spritesheet('gems', '/bejew.png', {
      frameWidth: 52,
      frameHeight: 52,
    });
  }

  create() {
    this.generateProceduralTextures();
    this.createGemAnimations();

    // Launch main GameScene
    const mode = this.mode || this.registry?.get('initialMode') || 'classic';
    this.scene.start('GameScene', { mode });
  }

  /**
   * Procedural textures for special gems, particle physics, and UI highlights
   */
  private generateProceduralTextures() {
    // 1. Particle Shard (Arcade Physics match explosions)
    if (!this.textures.exists('particle_shard')) {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(16, 6);
        ctx.lineTo(12, 16);
        ctx.lineTo(2, 14);
        ctx.lineTo(0, 6);
        ctx.closePath();
        ctx.fill();
        this.textures.addCanvas('particle_shard', canvas);
      }
    }


    // 2. Particle Spark (Soft glowing circular spark)
    if (!this.textures.exists('particle_spark')) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        rad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        rad.addColorStop(0.3, 'rgba(250, 204, 21, 0.8)');
        rad.addColorStop(0.8, 'rgba(234, 88, 12, 0.3)');
        rad.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(16, 16, 16, 0, Math.PI * 2);
        ctx.fill();
        this.textures.addCanvas('particle_spark', canvas);
      }
    }

    // 3. Flame Gem Glow Aura (Warm pulsing aura, no circling dots)
    if (!this.textures.exists('gem_glow_flame')) {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rad = ctx.createRadialGradient(48, 48, 8, 48, 48, 46);
        rad.addColorStop(0, 'rgba(255, 240, 150, 0.8)');
        rad.addColorStop(0.3, 'rgba(255, 140, 0, 0.65)');
        rad.addColorStop(0.7, 'rgba(220, 38, 38, 0.3)');
        rad.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(48, 48, 46, 0, Math.PI * 2);
        ctx.fill();
        this.textures.addCanvas('gem_glow_flame', canvas);
      }
    }

    // 4. Star Gem Aura (Radiant 4-pointed golden/white star)
    if (!this.textures.exists('gem_star_aura')) {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(48, 48);
        // Soft central glow
        const rad = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
        rad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        rad.addColorStop(0.25, 'rgba(253, 224, 71, 0.7)');
        rad.addColorStop(0.7, 'rgba(234, 179, 8, 0.25)');
        rad.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.fillStyle = rad;

        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-6, 0);
          ctx.lineTo(0, -44);
          ctx.lineTo(6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.rotate(Math.PI / 2);
        }

        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();

        this.textures.addCanvas('gem_star_aura', canvas);
      }
    }

    // 5. Hypercube Texture (Rainbow metallic cube)
    if (!this.textures.exists('gem_hypercube')) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Dark metallic outer cube
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(8, 8, 48, 48, 10);
        } else {
          ctx.rect(8, 8, 48, 48);
        }
        ctx.fill();

        // Faceted diamond inside
        const grad = ctx.createLinearGradient(16, 16, 48, 48);
        grad.addColorStop(0, '#f43f5e');
        grad.addColorStop(0.25, '#fb923c');
        grad.addColorStop(0.5, '#facc15');
        grad.addColorStop(0.75, '#38bdf8');
        grad.addColorStop(1, '#a855f7');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(32, 12);
        ctx.lineTo(52, 32);
        ctx.lineTo(32, 52);
        ctx.lineTo(12, 32);
        ctx.closePath();
        ctx.fill();

        // Sparkling center star
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(32, 32, 5, 0, Math.PI * 2);
        ctx.fill();

        this.textures.addCanvas('gem_hypercube', canvas);
      }
    }

    // 6. Selection Bracket (Golden corner brackets)
    if (!this.textures.exists('gem_selection')) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const p = 4;
        const s = 56;
        const len = 14;

        // TL
        ctx.beginPath();
        ctx.moveTo(p, p + len);
        ctx.lineTo(p, p);
        ctx.lineTo(p + len, p);
        ctx.stroke();

        // TR
        ctx.beginPath();
        ctx.moveTo(p + s - len, p);
        ctx.lineTo(p + s, p);
        ctx.lineTo(p + s, p + len);
        ctx.stroke();

        // BR
        ctx.beginPath();
        ctx.moveTo(p + s, p + s - len);
        ctx.lineTo(p + s, p + s);
        ctx.lineTo(p + s - len, p + s);
        ctx.stroke();

        // BL
        ctx.beginPath();
        ctx.moveTo(p + len, p + s);
        ctx.lineTo(p, p + s);
        ctx.lineTo(p, p + s - len);
        ctx.stroke();

        this.textures.addCanvas('gem_selection', canvas);
      }
    }

    // 7. Hint Ring (Dashed glowing circle)
    if (!this.textures.exists('gem_hint_ring')) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(32, 32, 26, 0, Math.PI * 2);
        ctx.stroke();
        this.textures.addCanvas('gem_hint_ring', canvas);
      }
    }

    // 8. Board Cell Background (Subtle beveled cell)
    if (!this.textures.exists('cell_bg')) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(26, 21, 46, 0.7)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(2, 2, 60, 60, 8);
        } else {
          ctx.rect(2, 2, 60, 60);
        }
        ctx.fill();

        ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        this.textures.addCanvas('cell_bg', canvas);
      }
    }
  }

  /**
   * Create all 7 gem shine and spin animations from the loaded spritesheet
   */
  private createGemAnimations() {
    for (let type = 0; type < 7; type++) {
      // Shine animation: Row (type * 2 + 1)
      const shineRow = type * 2 + 1;
      const shineFrames: { key: string; frame: number }[] = [];
      for (let f = 0; f < 15; f++) {
        shineFrames.push({ key: 'gems', frame: shineRow * 15 + f });
      }

      const shineKey = `gem_${type}_shine`;
      if (!this.anims.exists(shineKey)) {
        this.anims.create({
          key: shineKey,
          frames: shineFrames,
          frameRate: 10,
          repeat: -1,
        });
      }

      // Spin animation: Row (type * 2 + 0)
      const spinRow = type * 2;
      const spinFrames: { key: string; frame: number }[] = [];
      for (let f = 0; f < 15; f++) {
        spinFrames.push({ key: 'gems', frame: spinRow * 15 + f });
      }

      const spinKey = `gem_${type}_spin`;
      if (!this.anims.exists(spinKey)) {
        this.anims.create({
          key: spinKey,
          frames: spinFrames,
          frameRate: 15,
          repeat: -1,
        });
      }
    }
  }
}
