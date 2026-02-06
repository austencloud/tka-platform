/**
 * Lightweight Timeline for Three.js Animations
 *
 * MIT-compatible replacement for GSAP timeline.
 * Provides keyframe-based animations with progress control.
 */

import { getEasing, type EasingFunction } from "./easing";

/**
 * A single tween segment in the timeline
 */
interface TweenSegment {
  /** Target object to animate */
  target: Record<string, unknown>;
  /** Property values to animate to */
  properties: Record<string, number>;
  /** Start time in seconds */
  startTime: number;
  /** Duration in seconds (0 for instant set) */
  duration: number;
  /** Easing function */
  easing: EasingFunction;
  /** Starting values (captured when animation begins) */
  startValues: Record<string, number>;
  /** Callback to run on each update */
  onUpdate?: () => void;
}

/**
 * A callback scheduled at a specific time
 */
interface ScheduledCallback {
  time: number;
  callback: () => void;
  fired: boolean;
}

/**
 * Timeline configuration options
 */
export interface TimelineOptions {
  /** Start paused (default: true) */
  paused?: boolean;
  /** Called on each frame update */
  onUpdate?: () => void;
  /** Called when timeline completes */
  onComplete?: () => void;
}

/**
 * Options for adding a tween
 */
export interface TweenOptions {
  /** Duration in seconds */
  duration?: number;
  /** Easing name (e.g., "power2.inOut") */
  ease?: string;
  /** Callback on each update */
  onUpdate?: () => void;
}

/**
 * Lightweight timeline for Three.js animations
 */
export class Timeline {
  private segments: TweenSegment[] = [];
  private callbacks: ScheduledCallback[] = [];
  private totalDuration: number = 0;
  private _progress: number = 0;
  private _timeScale: number = 1;
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  private onUpdate?: () => void;
  private onComplete?: () => void;

  constructor(options: TimelineOptions = {}) {
    this.onUpdate = options.onUpdate;
    this.onComplete = options.onComplete;

    if (!options.paused) {
      this.play();
    }
  }

  /**
   * Add a tween animation at a specific time
   */
  to(
    target: Record<string, unknown>,
    properties: Record<string, number> & TweenOptions,
    position: number
  ): this {
    const { duration = 0.5, ease = "power2.inOut", onUpdate, ...props } = properties;

    // Capture starting values (will be updated when animation starts)
    const startValues: Record<string, number> = {};
    for (const key of Object.keys(props)) {
      const value = target[key];
      startValues[key] = typeof value === "number" ? value : 0;
    }

    this.segments.push({
      target,
      properties: props,
      startTime: position,
      duration,
      easing: getEasing(ease),
      startValues,
      onUpdate,
    });

    // Update total duration
    const endTime = position + duration;
    if (endTime > this.totalDuration) {
      this.totalDuration = endTime;
    }

    return this;
  }

  /**
   * Set values instantly at a specific time (no animation)
   */
  set(
    target: Record<string, unknown>,
    properties: Record<string, number>,
    position: number
  ): this {
    // Set is just a tween with 0 duration
    this.segments.push({
      target,
      properties,
      startTime: position,
      duration: 0,
      easing: (t) => t,
      startValues: {},
    });

    if (position > this.totalDuration) {
      this.totalDuration = position;
    }

    return this;
  }

  /**
   * Schedule a callback at a specific time
   */
  call(callback: () => void, _args: unknown[], position: number): this {
    this.callbacks.push({
      time: position,
      callback,
      fired: false,
    });

    if (position > this.totalDuration) {
      this.totalDuration = position;
    }

    return this;
  }

  /**
   * Get/set current progress (0-1)
   */
  progress(value?: number): number {
    if (value !== undefined) {
      this._progress = Math.max(0, Math.min(1, value));
      this.updateToProgress(this._progress);
      return this._progress;
    }
    return this._progress;
  }

  /**
   * Get/set playback speed
   */
  timeScale(value?: number): number {
    if (value !== undefined) {
      this._timeScale = Math.max(0.1, Math.min(10, value));
      return this._timeScale;
    }
    return this._timeScale;
  }

  /**
   * Start playing from current position
   */
  play(): void {
    if (this._isPlaying && !this._isPaused) return;

    this._isPlaying = true;
    this._isPaused = false;
    this.lastTime = performance.now();
    this.tick();
  }

  /**
   * Restart from the beginning
   */
  restart(): void {
    this._progress = 0;
    this.resetCallbacks();
    this.captureStartValues();
    this.play();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this._isPlaying) return;

    this._isPaused = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (!this._isPaused) return;

    this._isPaused = false;
    this.lastTime = performance.now();
    this.tick();
  }

  /**
   * Stop and reset to beginning
   */
  kill(): void {
    this._isPlaying = false;
    this._isPaused = false;
    this._progress = 0;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.segments = [];
    this.callbacks = [];
  }

  /**
   * Main animation loop
   */
  private tick = (): void => {
    if (!this._isPlaying || this._isPaused) return;

    const now = performance.now();
    const delta = (now - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = now;

    // Advance progress based on time scale
    const progressDelta = (delta * this._timeScale) / this.totalDuration;
    this._progress = Math.min(1, this._progress + progressDelta);

    // Update all tweens
    this.updateToProgress(this._progress);

    // Fire callbacks
    this.onUpdate?.();

    // Check for completion
    if (this._progress >= 1) {
      this._isPlaying = false;
      this._isPaused = false;
      this.onComplete?.();
      return;
    }

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  /**
   * Update all segments to a specific progress
   */
  private updateToProgress(progress: number): void {
    const currentTime = progress * this.totalDuration;

    // Update each segment
    for (const segment of this.segments) {
      this.updateSegment(segment, currentTime);
    }

    // Fire any scheduled callbacks
    for (const cb of this.callbacks) {
      if (!cb.fired && currentTime >= cb.time) {
        cb.callback();
        cb.fired = true;
      }
    }
  }

  /**
   * Update a single tween segment
   */
  private updateSegment(segment: TweenSegment, currentTime: number): void {
    const { target, properties, startTime, duration, easing, startValues, onUpdate } =
      segment;

    // Before start time - ensure at start values
    if (currentTime < startTime) {
      return;
    }

    // Instant set (duration = 0)
    if (duration === 0) {
      if (currentTime >= startTime) {
        for (const [key, value] of Object.entries(properties)) {
          (target as Record<string, number>)[key] = value;
        }
      }
      return;
    }

    // Calculate segment progress
    const elapsed = currentTime - startTime;
    const segmentProgress = Math.min(1, Math.max(0, elapsed / duration));
    const easedProgress = easing(segmentProgress);

    // Interpolate each property
    for (const [key, endValue] of Object.entries(properties)) {
      const startValue = startValues[key] ?? 0;
      const currentValue = startValue + (endValue - startValue) * easedProgress;
      (target as Record<string, number>)[key] = currentValue;
    }

    onUpdate?.();
  }

  /**
   * Capture starting values for all segments
   */
  private captureStartValues(): void {
    for (const segment of this.segments) {
      for (const key of Object.keys(segment.properties)) {
        const value = segment.target[key];
        segment.startValues[key] = typeof value === "number" ? value : 0;
      }
    }
  }

  /**
   * Reset all callbacks to unfired state
   */
  private resetCallbacks(): void {
    for (const cb of this.callbacks) {
      cb.fired = false;
    }
  }
}
