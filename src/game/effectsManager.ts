import { FloatingText, GemType, LaserBeam, Particle, Shockwave } from '../types';
import { GEM_COLORS } from './gemRenderer';

export class EffectsManager {
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private laserBeams: LaserBeam[] = [];
  private floatingTexts: FloatingText[] = [];
  private screenShakeTime: number = 0;
  private screenShakeIntensity: number = 0;

  public reset() {
    this.particles = [];
    this.shockwaves = [];
    this.laserBeams = [];
    this.floatingTexts = [];
    this.screenShakeTime = 0;
    this.screenShakeIntensity = 0;
  }

  public triggerScreenShake(intensity: number = 6, duration: number = 0.25) {
    this.screenShakeIntensity = intensity;
    this.screenShakeTime = duration;
  }

  public getScreenShakeOffset(): { x: number; y: number } {
    if (this.screenShakeTime <= 0) return { x: 0, y: 0 };
    const factor = this.screenShakeIntensity * (this.screenShakeTime / 0.25);
    return {
      x: (Math.random() * 2 - 1) * factor,
      y: (Math.random() * 2 - 1) * factor,
    };
  }

  /**
   * Spawn crystal shards when gems match or explode
   */
  public spawnGemExplosion(
    cx: number,
    cy: number,
    type: GemType,
    count: number = 16,
    speedMultiplier: number = 1
  ) {
    const c = GEM_COLORS[type] || { main: '#ffffff', light: '#ffffff' };

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = (Math.random() * 140 + 70) * speedMultiplier;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - Math.random() * 50;
      const size = Math.random() * 7 + 4;
      const life = Math.random() * 0.35 + 0.35;

      this.particles.push({
        x: cx,
        y: cy,
        vx,
        vy,
        color: Math.random() > 0.4 ? c.light : c.main,
        size,
        alpha: 1,
        life,
        maxLife: life,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
        shape: Math.random() > 0.3 ? 'shard' : 'sparkle',
      });
    }

    // Add glowing shockwave ring
    this.shockwaves.push({
      x: cx,
      y: cy,
      radius: 5,
      maxRadius: 45 * speedMultiplier,
      color: c.light,
      alpha: 0.9,
      thickness: 3,
    });
  }

  /**
   * Spawn Star Gem cross laser beams
   */
  public spawnLaserCross(
    cx: number,
    cy: number,
    boardLeft: number,
    boardTop: number,
    boardWidth: number,
    boardHeight: number
  ) {
    const duration = 0.35;
    // Horizontal beam
    this.laserBeams.push({
      x1: boardLeft,
      y1: cy,
      x2: boardLeft + boardWidth,
      y2: cy,
      color: '#fef08a',
      life: duration,
      maxLife: duration,
    });
    // Vertical beam
    this.laserBeams.push({
      x1: cx,
      y1: boardTop,
      x2: cx,
      y2: boardTop + boardHeight,
      color: '#fef08a',
      life: duration,
      maxLife: duration,
    });

    this.triggerScreenShake(7, 0.3);
  }

  /**
   * Spawn floating text for points, combo multipliers, or praise words
   */
  public addFloatingText(
    text: string,
    x: number,
    y: number,
    color: string = '#fef08a',
    size: number = 22
  ) {
    this.floatingTexts.push({
      id: Math.random().toString(),
      text,
      x,
      y,
      color,
      size,
      alpha: 1,
      vy: -55,
      life: 1.0,
      maxLife: 1.0,
    });
  }

  /**
   * Update all active particles and effects
   */
  public update(dt: number) {
    if (this.screenShakeTime > 0) {
      this.screenShakeTime = Math.max(0, this.screenShakeTime - dt);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt; // gravity
      p.rotation += p.vRot * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 12 * dt;
      sw.alpha -= 2.2 * dt;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius * 0.98) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update laser beams
    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      const lb = this.laserBeams[i];
      lb.life -= dt;
      if (lb.life <= 0) {
        this.laserBeams.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
    }
  }

  /**
   * Render all effects to canvas
   */
  public render(ctx: CanvasRenderingContext2D) {
    // 1. Render Laser Beams
    this.laserBeams.forEach((lb) => {
      const progress = Math.max(0, lb.life / lb.maxLife);
      ctx.save();
      ctx.strokeStyle = lb.color;
      ctx.lineWidth = 14 * progress;
      ctx.shadowColor = lb.color;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = Math.min(1, progress * 1.2);
      ctx.beginPath();
      ctx.moveTo(lb.x1, lb.y1);
      ctx.lineTo(lb.x2, lb.y2);
      ctx.stroke();

      // White inner core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5 * progress;
      ctx.stroke();
      ctx.restore();
    });

    // 2. Render Shockwaves
    this.shockwaves.forEach((sw) => {
      if (sw.alpha <= 0) return;
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.thickness;
      ctx.globalAlpha = Math.min(1, Math.max(0, sw.alpha));
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 3. Render Particles
    this.particles.forEach((p) => {
      if (p.alpha <= 0) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha));
      ctx.fillStyle = p.color;

      if (p.shape === 'shard') {
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, s * 0.7);
        ctx.lineTo(-s * 0.7, s * 0.7);
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'sparkle') {
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.3, -s * 0.3);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.3, s * 0.3);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.3, s * 0.3);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.3, -s * 0.3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 4. Render Floating Texts
    this.floatingTexts.forEach((ft) => {
      if (ft.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, ft.alpha));
      ctx.font = `900 ${ft.size}px "Outfit", "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Dark outline for legibility
      ctx.strokeStyle = '#05030a';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);

      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }
}
