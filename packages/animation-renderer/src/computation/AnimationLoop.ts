import type { IAnimationLoop } from "../contracts/IAnimationLoop";

export class AnimationLoop implements IAnimationLoop {
  private animationFrameId: number | null = null;
  private lastTimestamp: number | null = null;
  private speed: number = 1.0;
  private onUpdateCallback: ((deltaTime: number) => void) | null = null;

  start(onUpdate: (deltaTime: number) => void, speed: number): void {
    if (this.animationFrameId !== null) {
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

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      this.animationFrameId = requestAnimationFrame(this.loop);
      return;
    }

    const deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const adjustedDeltaTime = deltaTime * this.speed;
    this.onUpdateCallback(adjustedDeltaTime);

    if (this.animationFrameId !== null) {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };
}
