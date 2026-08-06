import type { SceneEffectVector3 } from "./scene-effect-source-3d";

/**
 * Allocation-free circular path storage for one stable scene-effect source.
 * Renderers choose whether age or travelled arc length determines visibility.
 */
export class BoundedSourcePath3D {
  readonly capacity: number;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly z: Float32Array;
  private readonly birth: Float32Array;
  private readonly speed: Float32Array;
  private head = 0;
  private length = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.birth = new Float32Array(capacity);
    this.speed = new Float32Array(capacity);
  }

  get count(): number {
    return this.length;
  }

  push(
    position: SceneEffectVector3,
    time: number,
    speed: number,
    minimumDistance: number
  ): boolean {
    if (this.length > 0) {
      const newest = this.indexFromNewest(0);
      const distance = Math.hypot(
        position.x - this.x[newest]!,
        position.y - this.y[newest]!,
        position.z - this.z[newest]!
      );
      if (distance < minimumDistance) return false;
    }

    this.x[this.head] = position.x;
    this.y[this.head] = position.y;
    this.z[this.head] = position.z;
    this.birth[this.head] = time;
    this.speed[this.head] = speed;
    this.head = (this.head + 1) % this.capacity;
    this.length = Math.min(this.length + 1, this.capacity);
    return true;
  }

  trimBefore(time: number): void {
    while (this.length > 0) {
      const oldest = this.indexFromNewest(this.length - 1);
      if (this.birth[oldest]! >= time) return;
      this.length--;
    }
  }

  indexFromNewest(offset: number): number {
    return (this.head - 1 - offset + this.capacity * 2) % this.capacity;
  }

  xAt(index: number): number {
    return this.x[index]!;
  }
  yAt(index: number): number {
    return this.y[index]!;
  }
  zAt(index: number): number {
    return this.z[index]!;
  }
  birthAt(index: number): number {
    return this.birth[index]!;
  }
  speedAt(index: number): number {
    return this.speed[index]!;
  }

  clear(): void {
    this.head = 0;
    this.length = 0;
  }
}
