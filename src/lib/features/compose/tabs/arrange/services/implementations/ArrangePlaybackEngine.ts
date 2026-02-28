/**
 * ArrangePlaybackEngine - requestAnimationFrame-based playback
 *
 * Drives smooth continuous playback and step-based beat animation
 * for the arrange grid. All timing is based on BPM with fractional
 * beat increments calculated from frame deltas.
 */

import type { IArrangePlaybackEngine } from "../contracts/IArrangePlaybackEngine";

export class ArrangePlaybackEngine implements IArrangePlaybackEngine {
  private _isPlaying = false;
  private _currentBeat = 0;
  private _bpm = 120;

  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private stepAnimating = false;
  private totalBeatsGetter: (() => number) | null = null;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get isStepAnimating(): boolean {
    return this.stepAnimating;
  }

  get currentBeat(): number {
    return this._currentBeat;
  }

  get bpm(): number {
    return this._bpm;
  }

  play(totalBeatsGetter: () => number, bpm?: number): void {
    this.stopLoop();
    this.totalBeatsGetter = totalBeatsGetter;
    if (bpm !== undefined) {
      this._bpm = bpm;
    }
    this._isPlaying = true;
    this.lastFrameTime = performance.now();
    this.startContinuousLoop();
  }

  pause(): void {
    this._isPlaying = false;
    this.stopLoop();
  }

  stop(): void {
    this._isPlaying = false;
    this.stopLoop();
    this._currentBeat = 0;
  }

  setBpm(bpm: number): void {
    this._bpm = Math.max(5, Math.min(300, bpm));
  }

  animateStep(amount: number, totalBeats: number): void {
    if (this._isPlaying) return;
    this.stopLoop();

    if (totalBeats <= 0) return;

    const startBeat = this._currentBeat;
    const targetBeat =
      (((this._currentBeat + amount) % totalBeats) + totalBeats) % totalBeats;
    const direction = amount > 0 ? 1 : -1;
    const distance = Math.abs(amount);
    let traveled = 0;

    this.stepAnimating = true;
    this.lastFrameTime = performance.now();

    const tick = (now: number) => {
      if (!this.stepAnimating) return;

      const deltaMs = now - this.lastFrameTime;
      this.lastFrameTime = now;

      const beatsPerMs = this._bpm / 60000;
      const increment = deltaMs * beatsPerMs;
      traveled += increment;

      if (traveled >= distance) {
        this._currentBeat = targetBeat;
        this.stepAnimating = false;
        this.animationFrameId = null;
        return;
      }

      this._currentBeat =
        (((startBeat + direction * traveled) % totalBeats) + totalBeats) %
        totalBeats;
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  setCurrentBeat(beat: number): void {
    this._currentBeat = beat;
  }

  dispose(): void {
    this.stopLoop();
    this.totalBeatsGetter = null;
  }

  // ---------------------------------------------------------------------------

  private startContinuousLoop(): void {
    const tick = (now: number) => {
      if (!this._isPlaying) return;

      const deltaMs = now - this.lastFrameTime;
      this.lastFrameTime = now;

      const beatsPerMs = this._bpm / 60 / 1000;
      const beatIncrement = deltaMs * beatsPerMs;

      const total = this.totalBeatsGetter?.() ?? 0;
      if (total > 0) {
        this._currentBeat = (this._currentBeat + beatIncrement) % total;
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    this.stepAnimating = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
