export interface IAnimationLoop {
  start(onUpdate: (deltaTime: number) => void, speed: number): void;
  stop(): void;
  isRunning(): boolean;
  setSpeed(speed: number): void;
  getSpeed(): number;
}
