import { CylinderGeometry, Object3D, Quaternion, Vector3 } from "three";
import {
  ParticleInstancePool3D,
  type ParticleInstanceWrite,
} from "../instancing/particle-instance-pool-3d";
import { setRgbFromHex, type MutableRgb } from "../instancing/particle-color";
import {
  isTrackedTip,
  type GooTipSource3D,
} from "../scene-effects/scene-effect-source-3d";

const CAPACITY = 2048;
const UP = new Vector3(0, 1, 0);

export class GooRenderer3D {
  private readonly pool = new ParticleInstancePool3D({
    capacity: CAPACITY,
    geometry: new CylinderGeometry(1, 1, 1, 6, 1),
    renderOrder: 102,
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
  private readonly radius = new Float32Array(CAPACITY);
  private readonly gravity = new Float32Array(CAPACITY);
  private readonly red = new Float32Array(CAPACITY);
  private readonly green = new Float32Array(CAPACITY);
  private readonly blue = new Float32Array(CAPACITY);
  private readonly peakAlpha = new Float32Array(CAPACITY);
  private readonly accumulators = new Map<number, number>();
  private readonly velocityDirection = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly color: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly writeState: ParticleInstanceWrite = {
    x: 0,
    y: 0,
    z: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    red: 1,
    green: 1,
    blue: 1,
    alpha: 1,
  };
  private cursor = 0;

  initialize(parent: Object3D): void {
    this.pool.initialize(parent);
  }

  update(sources: readonly GooTipSource3D[], delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    for (const source of sources) {
      if (isTrackedTip(source.params.trackingMode, source.tipIndex))
        this.emit(source, dt);
    }

    this.pool.beginFrame();
    for (let index = 0; index < CAPACITY; index++) {
      if (this.active[index] === 0) continue;
      this.age[index]! += dt;
      if (this.age[index]! >= this.maxAge[index]!) {
        this.active[index] = 0;
        continue;
      }
      this.vy[index]! += this.gravity[index]! * dt;
      this.x[index]! += this.vx[index]! * dt;
      this.y[index]! += this.vy[index]! * dt;
      this.z[index]! += this.vz[index]! * dt;

      const life = this.age[index]! / this.maxAge[index]!;
      const fade =
        life < 0.08
          ? life / 0.08
          : life > 0.7
            ? Math.max(0, 1 - (life - 0.7) / 0.3)
            : 1;
      this.velocityDirection.set(
        this.vx[index]!,
        this.vy[index]!,
        this.vz[index]!
      );
      if (this.velocityDirection.lengthSq() < 1e-8) {
        this.orientation.identity();
      } else {
        this.velocityDirection.normalize();
        this.orientation.setFromUnitVectors(UP, this.velocityDirection);
      }

      const write = this.writeState;
      const radius = this.radius[index]!;
      write.x = this.x[index]!;
      write.y = this.y[index]!;
      write.z = this.z[index]!;
      write.scaleX = radius;
      write.scaleY = radius * 3;
      write.scaleZ = radius;
      write.quaternionX = this.orientation.x;
      write.quaternionY = this.orientation.y;
      write.quaternionZ = this.orientation.z;
      write.quaternionW = this.orientation.w;
      write.red = this.red[index]!;
      write.green = this.green[index]!;
      write.blue = this.blue[index]!;
      write.alpha = fade * this.peakAlpha[index]!;
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

  private emit(source: GooTipSource3D, dt: number): void {
    const params = source.params;
    const speedScalar =
      params.motionReferenceSpeed > 0
        ? Math.min(1, source.speed / params.motionReferenceSpeed)
        : 0;
    const rate =
      params.ambientEmission * params.ambientSpawnRate +
      params.motionEmission * speedScalar * params.motionSpawnRate;
    let accumulator = (this.accumulators.get(source.sourceId) ?? 0) + dt * rate;
    while (accumulator >= 1) {
      const slot = this.takeSlot();
      if (slot < 0) break;
      const fling = 0.6 + Math.random() * 0.4;
      const kick = 0.25 + Math.random() * 0.45;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      this.active[slot] = 1;
      this.x[slot] = source.position.x + (Math.random() - 0.5) * 0.015;
      this.y[slot] = source.position.y + (Math.random() - 0.5) * 0.015;
      this.z[slot] = source.position.z + (Math.random() - 0.5) * 0.015;
      this.vx[slot] =
        source.velocity.x * fling + Math.sin(phi) * Math.cos(theta) * kick;
      this.vy[slot] =
        source.velocity.y * fling + Math.sin(phi) * Math.sin(theta) * kick;
      this.vz[slot] = source.velocity.z * fling + Math.cos(phi) * kick;
      this.age[slot] = 0;
      this.maxAge[slot] = 0.3 + Math.random() * 0.4;
      this.radius[slot] =
        params.baseRadius *
        (0.55 + Math.random() * 0.9) *
        (0.6 + 0.4 * params.intensity);
      this.gravity[slot] = params.worldGravity;
      this.peakAlpha[slot] = 1 - params.clarity * 0.25;
      setRgbFromHex(this.color, params.resolvedPalette.edge);
      this.red[slot] = this.color.red;
      this.green[slot] = this.color.green;
      this.blue[slot] = this.color.blue;
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
