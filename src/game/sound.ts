/**
 * Web Audio API Sound Synthesizer for Bejeweled Classic
 * High-quality, zero-dependency procedural sound effects
 */

// Defensive global patch to prevent unhandled "Cannot suspend/resume a closed AudioContext" DOMExceptions
if (typeof window !== 'undefined') {
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (AudioContextClass && AudioContextClass.prototype) {
    const origSuspend = AudioContextClass.prototype.suspend;
    if (origSuspend && !(origSuspend as any).__guarded) {
      const guardedSuspend = function (this: AudioContext): Promise<void> {
        if (this.state === 'closed') {
          return Promise.resolve();
        }
        try {
          return origSuspend.call(this).catch((err: any) => {
            if (err?.message && String(err.message).includes('closed')) {
              return Promise.resolve();
            }
            throw err;
          });
        } catch (err: any) {
          if (err?.message && String(err.message).includes('closed')) {
            return Promise.resolve();
          }
          throw err;
        }
      };
      (guardedSuspend as any).__guarded = true;
      AudioContextClass.prototype.suspend = guardedSuspend;
    }

    const origResume = AudioContextClass.prototype.resume;
    if (origResume && !(origResume as any).__guarded) {
      const guardedResume = function (this: AudioContext): Promise<void> {
        if (this.state === 'closed') {
          return Promise.resolve();
        }
        try {
          return origResume.call(this).catch((err: any) => {
            if (err?.message && String(err.message).includes('closed')) {
              return Promise.resolve();
            }
            throw err;
          });
        } catch (err: any) {
          if (err?.message && String(err.message).includes('closed')) {
            return Promise.resolve();
          }
          throw err;
        }
      };
      (guardedResume as any).__guarded = true;
      AudioContextClass.prototype.resume = guardedResume;
    }
  }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    // Check saved mute state
    try {
      const saved = localStorage.getItem('bejeweled_muted');
      if (saved !== null) {
        this.isMuted = saved === 'true';
      }
    } catch {
      this.isMuted = false;
    }
  }

  public init() {
    // If context was closed or invalid, reset reference
    if (this.ctx && this.ctx.state === 'closed') {
      this.ctx = null;
      this.isInitialized = false;
    }

    if (this.isInitialized && this.ctx && this.ctx.state === 'running') return;

    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  private getReadyContext(): AudioContext | null {
    if (this.isMuted) return null;
    this.init();
    if (!this.ctx || this.ctx.state === 'closed') return null;
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('bejeweled_muted', String(muted));
    } catch {
      // ignore
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Sound when selecting a gem
   */
  public playClick() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(860, t + 0.04);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.04);
    } catch {
      // ignore
    }
  }

  /**
   * Sound when swapping two gems
   */
  public playSwap() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(760, t + 0.08);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.1);
    } catch {
      // ignore
    }
  }

  /**
   * Sound when an invalid swap returns
   */
  public playSwapBack() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    } catch {
      // ignore
    }
  }

  /**
   * Sound when a match is cleared. Pitch scales up with cascade step!
   */
  public playMatch(cascadeIndex: number = 0) {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const frequencies = [
        523.25, // C5
        587.33, // D5
        659.25, // E5
        783.99, // G5
        880.00, // A5
        1046.5, // C6
        1174.66, // D6
        1318.51, // E6
        1567.98, // G6
        1760.0, // A6
        2093.0, // C7
      ];
      const baseFreq = frequencies[Math.min(cascadeIndex, frequencies.length - 1)];

      // Primary crystal chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, t);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.25);

      gain1.gain.setValueAtTime(0.28, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.28);

      // Harmonic bell overtone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(baseFreq * 2, t);

      gain2.gain.setValueAtTime(0.12, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t);
      osc2.stop(t + 0.35);
    } catch {
      // ignore
    }
  }

  /**
   * Sound for multi-combo cascade celebration
   */
  public playCombo(comboCount: number) {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const baseNotes = [659.25, 783.99, 987.77, 1318.51];
      baseNotes.forEach((freq, idx) => {
        if (!ctx || ctx.state === 'closed') return;
        const noteTime = t + idx * 0.04;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * (1 + comboCount * 0.1), noteTime);

        gain.gain.setValueAtTime(0.18, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.3);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Sound for Flame Gem explosion (3x3 blast)
   */
  public playExplosion() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;

      // Deep sub-bass thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.35);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);

      // Noise burst for crystal blast
      const bufferSize = Math.floor(ctx.sampleRate * 0.25);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.frequency.exponentialRampToValueAtTime(300, t + 0.25);
      filter.Q.setValueAtTime(2, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(t);
      noise.stop(t + 0.25);
    } catch {
      // ignore
    }
  }

  public playDetonate() {
    this.playExplosion();
  }

  /**
   * Sound for Star Gem cross beam laser
   */
  public playLaser() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.3);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2500, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.3);
    } catch {
      // ignore
    }
  }

  /**
   * Sound for Hypercube lightning wipe
   */
  public playHypercube() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760];
      notes.forEach((freq, idx) => {
        if (!ctx || ctx.state === 'closed') return;
        const noteTime = t + idx * 0.035;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.15, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.25);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Sound for Level Up celebration
   */
  public playLevelUp() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((freq, idx) => {
        if (!ctx || ctx.state === 'closed') return;
        const noteTime = t + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.25, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.6);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Sound for Hint click/display
   */
  public playHint() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1320, t + 0.15);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch {
      // ignore
    }
  }

  /**
   * Sound for Game Over
   */
  public playGameOver() {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const notes = [440, 415.3, 392, 349.23];
      notes.forEach((freq, idx) => {
        if (!ctx || ctx.state === 'closed') return;
        const noteTime = t + idx * 0.16;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.4);
      });
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundEngine();
