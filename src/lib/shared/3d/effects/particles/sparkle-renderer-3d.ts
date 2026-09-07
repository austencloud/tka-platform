import { Object3D, SphereGeometry } from "three";
import {
  ParticleInstancePool3D,
  type ParticleInstanceWrite,
} from "../instancing/particle-instance-pool-3d";
import {
  setRgbFromHex,
  setRgbFromHsl,
  type MutableRgb,
} from "../instancing/particle-color";
import type { SparkleTipSource3D } from "../scene-effects/scene-effect-source-3d";

const CAPACITY = 2048;
const BASE_SPAWN_RATE = 15;

export class SparkleRenderer3D {
  private readonly pool = new ParticleInstancePool3D({
    capacity: CAPACITY,
    geometry: new SphereGeometry(1, 8, 8),
    additive: true,
    renderOrder: 110,
  });
  private readonly active = new Uint8Array(CAPACITY);
  private readonly x = new Float32Array(CAPACITY);
  private readonly y = new Float32Array(CAPACITY);
  private readonly z = new Float32Array(CAPACITY);
  private readonly vx = new Float32Array(CAPACITY);
  private readonly vy = new Float32Array(CAPACITY);
  private readonly vz = new Float32Array(CAPACITY);
  private readonly age = new Float32Array(CAPACITY);
  private readonly maxAge = new Float32Array(CAPACITY);
  private readonly size = new Float32Array(CAPACITY);
  private readonly gravity = new Float32Array(CAPACITY);
  private readonly right = new Float32Array(CAPACITY);
  private readonly green = new Float32Array(CAPACITY);
  private readonly left = new Float32Array(CAPACITY);
  private readonly rainbow = new Uint8Array(CAPACITY);
  private readonly hueOffset = new Float32Array(CAPACITY);
  private readonly accumulators = new Map<number, number>();
  private readonly color: MutableRgb = { right: 1, green: 1, left: 1 };
  private readonly writeState: ParticleInstanceWrite = {
    x: 0,
    y: 0,
    z: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    right: 1,
    green: 1,
    left: 1,
    alpha: 1,
  };
  private cursor = 0;
  private clock = 0;

  initialize(parent: Object3D): void {
    this.pool.initialize(parent);
  }

  update(sources: readonly SparkleTipSource3D[], delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    this.clock += dt;
    for (const source of sources) this.emit(source, dt);

    this.pool.beginFrame();
    for (let index = 0; index < CAPACITY; index++) {
      if (this.active[index] === 0) continue;
      this.age[index]! += dt;
      if (this.age[index]! >= this.maxAge[index]!) {
        this.active[index] = 0;
        continue;
      }

      this.vy[index]! -= this.gravity[index]! * dt;
      this.x[index]! += this.vx[index]! * dt;
      this.y[index]! += this.vy[index]! * dt;
      this.z[index]! += this.vz[index]! * dt;
      const life = this.age[index]! / this.maxAge[index]!;
      const radius = this.size[index]! * (1 - life);
      if (this.rainbow[index] === 1) {
        setRgbFromHsl(
          this.color,
          this.clock * 60 + this.hueOffset[index]!,
          0.8,
          0.6
        );
      } else {
        this.color.right = this.right[index]!;
        this.color.green = this.green[index]!;
        this.color.left = this.left[index]!;
      }

      const write = this.writeState;
      write.x = this.x[index]!;
      write.y = this.y[index]!;
      write.z = this.z[index]!;
      write.scaleX = radius;
      write.scaleY = radius;
      write.scaleZ = radius;
      write.right = this.color.right;
      write.green = this.color.green;
      write.left = this.color.left;
      write.alpha = 0.8 * (1 - life);
      this.pool.write(write);
    }
    this.pool.commit();
  }

  clear(): void {
    this.active.fill(0);
    this.accumulators.clear();
    this.pool.clear();
  }

  dispose(): void {
    this.pool.dispose();
  }

  private emit(source: SparkleTipSource3D, dt: number): void {
    const params = source.params;
    const rateScale = source.tipIndex === 0 ? 1 : 0.7;
    let accumulator =
      (this.accumulators.get(source.sourceId) ?? 0) +
      dt * BASE_SPAWN_RATE * params.rate * rateScale;
    while (accumulator >= 1) {
      const slot = this.takeSlot();
      if (slot < 0) break;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const distance = Math.random() * params.worldSpread;
      const dx = distance * Math.sin(phi) * Math.cos(theta);
      const dy = distance * Math.sin(phi) * Math.sin(theta);
      const dz = distance * Math.cos(phi);
      const length = Math.hypot(dx, dy, dz) || 1;
      const speed =
        (params.worldSpread / params.lifetime) * (1 + Math.random());

      this.active[slot] = 1;
      this.x[slot] = source.position.x + dx;
      this.y[slot] = source.position.y + dy;
      this.z[slot] = source.position.z + dz;
      this.vx[slot] = (dx / length) * speed;
      this.vy[slot] = (dy / length) * speed + speed * 0.5;
      this.vz[slot] = (dz / length) * speed;
      this.age[slot] = 0;
      this.maxAge[slot] = params.lifetime * (0.6 + Math.random() * 0.8);
      this.size[slot] = params.baseRadius * (0.6 + Math.random() * 0.8);
      this.gravity[slot] = params.worldGravity;
      this.rainbow[slot] = params.colorMode === "rainbow" ? 1 : 0;
      this.hueOffset[slot] =
        source.propIndex * 180 + source.tipIndex * 90 + Math.random() * 40;
      const paletteColor =
        params.colorMode === "palette" && params.palette.length > 0
          ? params.palette[Math.floor(Math.random() * params.palette.length)]!
          : params.color;
      setRgbFromHex(this.color, paletteColor);
      this.right[slot] = this.color.right;
      this.green[slot] = this.color.green;
      this.left[slot] = this.color.left;
      accumulator -= 1;
    }
    this.accumulators.set(source.sourceId, accumulator);
  }

  private takeSlot(): number {
    for (let offset = 0; offset < CAPACITY; offset++) {
      const index = (this.cursor + offset) % CAPACITY;
      if (this.active[index] === 0) {
        this.cursor = (index + 1) % CAPACITY;
        return index;
      }
    }
    return -1;
  }
}
