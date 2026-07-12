/**
 * Animation Loop Service Implementation
 *
 * Manages requestAnimationFrame loop with timing and speed control.
 * Provides clean abstraction over browser animation APIs.
 */

import { frameStatsRecorder } from "./frame-stats-recorder";

export class AnimationLoop {
  private animationFrameId: number | null = null;
  private lastTimestamp: number | null = null;
  private speed: number = 1.0;
  private onUpdateCallback: ((deltaTime: number) => void) | null = null;

  start(onUpdate: (deltaTime: number) => void, speed: number): void {
    if (this.animationFrameId !== null) {
      // Already running, just update callback and speed
      this.onUpdateCallback = onUpdate;
      this.speed = Math.max(0.1, Math.min(3.0, speed));
      return;
    }

    this.onUpdateCallback = onUpdate;
    this.speed = Math.max(0.1, Math.min(3.0, speed));
    this.lastTimestamp = null;
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastTimestamp = null;
    this.onUpdateCallback = null;
  }

  isRunning(): boolean {
    return this.animationFrameId !== null;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(3.0, speed));
  }

  getSpeed(): number {
    return this.speed;
  }

  private loop = (timestamp: number): void => {
    if (!this.onUpdateCallback) {
      this.stop();
      return;
    }

    // Calculate deltaTime
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      // First frame, just initialize - don't update
      this.animationFrameId = requestAnimationFrame(this.loop);
      return;
    }

    const deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Apply speed multiplier and invoke callback
    const adjustedDeltaTime = deltaTime * this.speed;
    const updateStart = performance.now();
    this.onUpdateCallback(adjustedDeltaTime);
    // Dev-only smoothness instrumentation: raw rAF gap (total frame cost) +
    // update-callback duration (engine cost). No-op when disabled.
    frameStatsRecorder.record(deltaTime, performance.now() - updateStart);

    // Continue loop if still running
    if (this.animationFrameId !== null) {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };
}
