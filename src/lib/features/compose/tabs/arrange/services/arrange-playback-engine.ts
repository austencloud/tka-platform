/**
 * ArrangePlaybackEngine - requestAnimationFrame-based playback
 *
 * Drives smooth continuous playback and step-based beat animation
 * for the arrange grid. All timing is based on BPM with fractional
 * beat increments calculated from frame deltas.
 */

export class ArrangePlaybackEngine {
  private _isPlaying = false;
  private _currentStep = 0;
  private _bpm = 120;

  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private stepAnimating = false;
  private totalStepsGetter: (() => number) | null = null;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get isStepAnimating(): boolean {
    return this.stepAnimating;
  }

  get currentStep(): number {
    return this._currentStep;
  }

  get bpm(): number {
    return this._bpm;
  }

  play(totalStepsGetter: () => number, bpm?: number): void {
    this.stopLoop();
    this.totalStepsGetter = totalStepsGetter;
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
    this._currentStep = 0;
  }

  setBpm(bpm: number): void {
    this._bpm = Math.max(5, Math.min(300, bpm));
  }

  animateStep(amount: number, totalSteps: number): void {
    if (this._isPlaying) return;
    this.stopLoop();

    if (totalSteps <= 0) return;

    const startStep = this._currentStep;
    const targetStep =
      (((this._currentStep + amount) % totalSteps) + totalSteps) % totalSteps;
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
        this._currentStep = targetStep;
        this.stepAnimating = false;
        this.animationFrameId = null;
        return;
      }

      this._currentStep =
        (((startStep + direction * traveled) % totalSteps) + totalSteps) %
        totalSteps;
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  setCurrentBeat(beat: number): void {
    this._currentStep = beat;
  }

  dispose(): void {
    this.stopLoop();
    this.totalStepsGetter = null;
  }


  private startContinuousLoop(): void {
    const tick = (now: number) => {
      if (!this._isPlaying) return;

      const deltaMs = now - this.lastFrameTime;
      this.lastFrameTime = now;

      const beatsPerMs = this._bpm / 60 / 1000;
      const beatIncrement = deltaMs * beatsPerMs;

      const total = this.totalStepsGetter?.() ?? 0;
      if (total > 0) {
        this._currentStep = (this._currentStep + beatIncrement) % total;
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
