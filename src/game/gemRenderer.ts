import { GemType, SpecialType, Tile } from '../types';

export const GEM_COLORS: Record<GemType, { main: string; light: string; shadow: string; glow: string }> = {
  [GemType.TOPAZ]: { main: '#eab308', light: '#fef08a', shadow: '#854d0e', glow: 'rgba(234, 179, 8, 0.6)' },
  [GemType.DIAMOND]: { main: '#cbd5e1', light: '#ffffff', shadow: '#64748b', glow: 'rgba(255, 255, 255, 0.7)' },
  [GemType.SAPPHIRE]: { main: '#0284c7', light: '#7dd3fc', shadow: '#0369a1', glow: 'rgba(2, 132, 199, 0.6)' },
  [GemType.RUBY]: { main: '#dc2626', light: '#fca5a5', shadow: '#991b1b', glow: 'rgba(220, 38, 38, 0.6)' },
  [GemType.AMETHYST]: { main: '#c026d3', light: '#f0abfc', shadow: '#86198f', glow: 'rgba(192, 38, 211, 0.6)' },
  [GemType.AMBER]: { main: '#ea580c', light: '#fdba74', shadow: '#9a3412', glow: 'rgba(234, 88, 12, 0.6)' },
  [GemType.EMERALD]: { main: '#16a34a', light: '#86efac', shadow: '#166534', glow: 'rgba(22, 163, 74, 0.6)' },
};

export class GemRenderer {
  private spriteSheet: HTMLImageElement | null = null;
  private isLoaded: boolean = false;
  private spriteSize: number = 52;

  constructor() {
    this.loadImage();
  }

  private loadImage() {
    const img = new Image();
    img.src = '/bejew.png';
    img.onload = () => {
      this.spriteSheet = img;
      this.isLoaded = true;
    };
    img.onerror = (e) => {
      console.warn('Could not load /bejew.png, will use vector rendering:', e);
    };
  }

  public get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Draw an individual gem at board coordinates (x, y) with tile size
   */
  public drawGem(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    x: number,
    y: number,
    size: number,
    time: number
  ) {
    const scale = tile.scale ?? 1;
    const alpha = tile.alpha ?? 1;

    if (alpha <= 0 || scale <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(x + size / 2, y + size / 2);

    if (tile.rotAngle) {
      ctx.rotate(tile.rotAngle);
    }

    ctx.scale(scale, scale);

    const pad = size * 0.08;
    const renderSize = size - pad * 2;

    // Hypercube has distinct rainbow animated cube rendering
    if (tile.special === SpecialType.HYPERCUBE) {
      this.drawHypercube(ctx, renderSize, time);
    } else {
      // Draw standard or special gem
      const drawn = this.drawSpriteGem(ctx, tile, renderSize, time);
      if (!drawn) {
        this.drawVectorGem(ctx, tile.type, renderSize);
      }

      // Overlays for Flame and Star specials
      if (tile.special === SpecialType.FLAME) {
        this.drawFlameAura(ctx, tile.type, renderSize, time);
      } else if (tile.special === SpecialType.STAR) {
        this.drawStarAura(ctx, renderSize, time);
      }
    }

    // Hint indicator pulse
    if (tile.isHinted) {
      this.drawHintPulse(ctx, renderSize, time);
    }

    ctx.restore();
  }

  /**
   * Draw gem from bejew.png spritesheet
   */
  private drawSpriteGem(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    renderSize: number,
    time: number
  ): boolean {
    if (!this.isLoaded || !this.spriteSheet) return false;

    // Sprite row mapping:
    // Row 0 = Gem 0 Spin, Row 1 = Gem 0 Shine
    // Row 2 = Gem 1 Spin, Row 3 = Gem 1 Shine
    // ...
    // Row 12 = Gem 6 Spin, Row 13 = Gem 6 Shine
    let subRow = 1; // Default to shine/idle
    let frame = 0;

    if (tile.animType === 'spin') {
      subRow = 0;
      frame = Math.floor(tile.animFrame) % 15;
    } else if (tile.animType === 'shine') {
      subRow = 1;
      frame = Math.floor(tile.animFrame) % 15;
    } else {
      // Idle: smooth periodic shine
      subRow = 1;
      frame = Math.floor(tile.animFrame) % 15;
    }

    const row = tile.type * 2 + subRow;
    const col = frame;

    const sx = col * this.spriteSize;
    const sy = row * this.spriteSize;
    const sWidth = this.spriteSize;
    const sHeight = this.spriteSize;

    // Draw centered
    const destX = -renderSize / 2;
    const destY = -renderSize / 2;

    // Subtle drop shadow behind gem for 3D depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = renderSize * 0.15;
    ctx.shadowOffsetY = renderSize * 0.08;

    ctx.drawImage(
      this.spriteSheet,
      sx,
      sy,
      sWidth,
      sHeight,
      destX,
      destY,
      renderSize,
      renderSize
    );

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    return true;
  }

  /**
   * Procedural vector gem fallback
   */
  public drawVectorGem(ctx: CanvasRenderingContext2D, type: GemType, size: number) {
    const r = size * 0.44;
    const c = GEM_COLORS[type];

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    switch (type) {
      case GemType.TOPAZ: // Diamond / Lozenge
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.9, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.9, 0);
        ctx.closePath();
        break;

      case GemType.DIAMOND: // Octagon
      case GemType.EMERALD:
        const sides = 8;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides + Math.PI / 8;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;

      case GemType.SAPPHIRE: // Inverted triangle
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.7);
        ctx.lineTo(r, -r * 0.7);
        ctx.lineTo(0, r * 0.9);
        ctx.closePath();
        break;

      case GemType.RUBY: // Square
        ctx.beginPath();
        ctx.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, 6);
        break;

      case GemType.AMETHYST: // Triangle
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9);
        ctx.lineTo(r, r * 0.8);
        ctx.lineTo(-r, r * 0.8);
        ctx.closePath();
        break;

      case GemType.AMBER: // Hexagon
        const hex = 6;
        ctx.beginPath();
        for (let i = 0; i < hex; i++) {
          const angle = (i * 2 * Math.PI) / hex + Math.PI / 6;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
    }

    // Fill with rich gradient
    const grad = ctx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r * 1.2);
    grad.addColorStop(0, c.light);
    grad.addColorStop(0.4, c.main);
    grad.addColorStop(1, c.shadow);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = c.light;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Flame Gem aura (match 4) - glowing fiery aura
   */
  private drawFlameAura(
    ctx: CanvasRenderingContext2D,
    type: GemType,
    size: number,
    time: number
  ) {
    const pulse = Math.sin(time * 6) * 0.15 + 1.05;
    const r = (size / 2) * pulse;

    ctx.save();
    // Glowing fiery aura
    const flameGrad = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, r * 1.35);
    flameGrad.addColorStop(0, 'rgba(255, 230, 100, 0.45)');
    flameGrad.addColorStop(0.45, 'rgba(255, 95, 0, 0.55)');
    flameGrad.addColorStop(0.8, 'rgba(235, 40, 0, 0.25)');
    flameGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Star Gem aura (match 5 / L / T)
   */
  private drawStarAura(ctx: CanvasRenderingContext2D, size: number, time: number) {
    ctx.save();
    const rot = time * 2.5;
    ctx.rotate(rot);

    // 4-pointed radiant star burst
    const starLength = size * 0.75 + Math.sin(time * 10) * (size * 0.1);
    const starGrad = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, starLength);
    starGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    starGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.8)');
    starGrad.addColorStop(0.8, 'rgba(234, 179, 8, 0.4)');
    starGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');

    ctx.fillStyle = starGrad;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-size * 0.12, 0);
      ctx.lineTo(0, -starLength);
      ctx.lineTo(size * 0.12, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Hypercube Rainbow Core
   */
  private drawHypercube(ctx: CanvasRenderingContext2D, size: number, time: number) {
    ctx.save();
    const half = size * 0.42;

    // Pulsing outer rainbow halo
    const hue = (time * 120) % 360;
    const glowGrad = ctx.createRadialGradient(0, 0, half * 0.5, 0, 0, half * 1.5);
    glowGrad.addColorStop(0, `hsla(${hue}, 100%, 75%, 0.8)`);
    glowGrad.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 100%, 60%, 0.5)`);
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, half * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Dark sleek cosmic cube base
    ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
    ctx.shadowBlur = 12;

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-half, -half, half * 2, half * 2, 8);
    ctx.fill();

    // Rainbow faceted inner diamond lattice
    const inner = half * 0.75;
    const rot = time * 2;
    ctx.rotate(rot);

    ctx.beginPath();
    ctx.moveTo(0, -inner);
    ctx.lineTo(inner, 0);
    ctx.lineTo(0, inner);
    ctx.lineTo(-inner, 0);
    ctx.closePath();

    const rainbowGrad = ctx.createLinearGradient(-inner, -inner, inner, inner);
    rainbowGrad.addColorStop(0, `hsl(${hue}, 100%, 65%)`);
    rainbowGrad.addColorStop(0.33, `hsl(${(hue + 120) % 360}, 100%, 65%)`);
    rainbowGrad.addColorStop(0.66, `hsl(${(hue + 240) % 360}, 100%, 65%)`);
    rainbowGrad.addColorStop(1, `hsl(${(hue + 360) % 360}, 100%, 65%)`);

    ctx.fillStyle = rainbowGrad;
    ctx.fill();

    // Center sparkling starlet
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, inner * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Hint pulse ring for guiding user
   */
  private drawHintPulse(ctx: CanvasRenderingContext2D, size: number, time: number) {
    const pulse = (Math.sin(time * 10) + 1) * 0.5;
    const r = (size / 2) * (1.1 + pulse * 0.2);

    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + pulse * 0.5})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Selection highlight ring (active touched/selected gem)
   */
  public drawSelection(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    time: number
  ) {
    const pad = size * 0.05;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const half = size / 2 - pad;

    ctx.save();
    const pulse = (Math.sin(time * 6) + 1) * 0.5;

    // Glowing outer ring
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 10 + pulse * 6;

    // Bracketed corners
    const cornerLen = size * 0.22;
    ctx.beginPath();

    // Top Left
    ctx.moveTo(cx - half, cy - half + cornerLen);
    ctx.lineTo(cx - half, cy - half);
    ctx.lineTo(cx - half + cornerLen, cy - half);

    // Top Right
    ctx.moveTo(cx + half - cornerLen, cy - half);
    ctx.lineTo(cx + half, cy - half);
    ctx.lineTo(cx + half, cy - half + cornerLen);

    // Bottom Right
    ctx.moveTo(cx + half, cy + half - cornerLen);
    ctx.lineTo(cx + half, cy + half);
    ctx.lineTo(cx + half - cornerLen, cy + half);

    // Bottom Left
    ctx.moveTo(cx - half + cornerLen, cy + half);
    ctx.lineTo(cx - half, cy + half);
    ctx.lineTo(cx - half, cy + half - cornerLen);

    ctx.stroke();
    ctx.restore();
  }
}
