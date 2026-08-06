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
import {
  isTrackedTip,
  type BubbleTipSource3D,
} from "../scene-effects/scene-effect-source-3d";

const CAPACITY = 2048;
const POP_DURATION = 0.14;
const POP_MAX_SCALE = 1.5;

export class BubbleRenderer3D {
  private readonly pool = new ParticleInstancePool3D({
    capacity: CAPACITY,
    geometry: new SphereGeometry(1, 12, 8),
    wireframe: true,
    renderOrder: 104,
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
  private readonly baseRadius = new Float32Array(CAPACITY);
  private readonly maxRadius = new Float32Array(CAPACITY);
  private readonly growthRate = new Float32Array(CAPACITY);
  private readonly popping = new Uint8Array(CAPACITY);
  private readonly popAge = new Float32Array(CAPACITY);
  private readonly popRadius = new Float32Array(CAPACITY);
  private readonly red = new Float32Array(CAPACITY);
  private readonly green = new Float32Array(CAPACITY);
  private readonly blue = new Float32Array(CAPACITY);
  private readonly iridescent = new Uint8Array(CAPACITY);
  private readonly accumulators = new Map<number, number>();
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

  update(sources: readonly BubbleTipSource3D[], delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    for (const source of sources) {
      if (isTrackedTip(source.params.trackingMode, source.tipIndex))
        this.emit(source, dt);
    }

    this.pool.beginFrame();
    for (let index = 0; index < CAPACITY; index++) {
      if (this.active[index] === 0) continue;
      let radius: number;
      let alpha: number;
      if (this.popping[index] === 1) {
        this.popAge[index]! += dt;
        if (this.popAge[index]! >= POP_DURATION) {
          this.active[index] = 0;
          continue;
        }
        const popT = this.popAge[index]! / POP_DURATION;
        radius = this.popRadius[index]! * (1 + (POP_MAX_SCALE - 1) * popT);
        alpha = 1 - popT;
      } else {
        this.age[index]! += dt;
        const life = Math.min(1, this.age[index]! / this.maxAge[index]!);
        const grow = 1 - Math.pow(1 - life, 1.6);
        radius =
          this.baseRadius[index]! +
          (this.maxRadius[index]! - this.baseRadius[index]!) *
            grow *
            this.growthRate[index]!;
        if (
          this.age[index]! >= this.maxAge[index]! ||
          radius >= this.maxRadius[index]!
        ) {
          this.popping[index] = 1;
          this.popAge[index] = 0;
          this.popRadius[index] = radius;
        }
        const fadeIn = life < 0.08 ? life / 0.08 : 1;
        const fadeOut = life > 0.85 ? 1 - (life - 0.85) / 0.15 : 1;
        alpha = fadeIn * fadeOut;
      }

      this.x[index]! += this.vx[index]! * dt;
      this.y[index]! += this.vy[index]! * dt;
      this.z[index]! += this.vz[index]! * dt;
      if (this.iridescent[index] === 1) {
        const life = Math.min(1, this.age[index]! / this.maxAge[index]!);
        const hue =
          life <= 0.5
            ? 320 + (210 - 320) * life * 2
            : 210 + (80 - 210) * (life - 0.5) * 2;
        setRgbFromHsl(this.color, hue, 1, 0.75);
      } else {
        this.color.red = this.red[index]!;
        this.color.green = this.green[index]!;
        this.color.blue = this.blue[index]!;
      }

      const write = this.writeState;
      write.x = this.x[index]!;
      write.y = this.y[index]!;
      write.z = this.z[index]!;
      write.scaleX = radius;
      write.scaleY = radius;
      write.scaleZ = radius;
      write.red = this.color.red;
      write.green = this.color.green;
      write.blue = this.color.blue;
      write.alpha = alpha * 0.55;
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

  private emit(source: BubbleTipSource3D, dt: number): void {
    const params = source.params;
    const speedScalar =
      params.motionReferenceSpeed > 0
        ? Math.min(1, source.speed / params.motionReferenceSpeed)
        : 0;
    const rate =
      params.ambientEmission * params.ambientSpawnRate +
      params.motionEmission * speedScalar * params.motionSpawnRate;
    let accumulator = (this.accumulators.get(source.sourceId) ?? 0) + dt * rate;
    const paletteId = params.resolvedPalette.id;
    const maxSizeMultiplier =
      paletteId === "soap" || paletteId === "oil" || paletteId === "spirit"
        ? 3
        : paletteId === "champagne" || paletteId === "acid"
          ? 1.4
          : 2.2;
    const base = params.baseRadius * (0.7 + 0.9 * params.intensity);
    while (accumulator >= 1) {
      const slot = this.takeSlot();
      if (slot < 0) break;
      const jitter =
        1 + (Math.random() - 0.5) * 2 * Math.max(0.05, params.sizeJitter);
      const radius = base * jitter;
      this.active[slot] = 1;
      this.x[slot] = source.position.x + (Math.random() - 0.5) * 0.04;
      this.y[slot] = source.position.y + (Math.random() - 0.5) * 0.04;
      this.z[slot] = source.position.z + (Math.random() - 0.5) * 0.04;
      this.vx[slot] = (Math.random() - 0.5) * 0.05;
      this.vy[slot] = params.riseSpeed;
      this.vz[slot] = (Math.random() - 0.5) * 0.05;
      this.age[slot] = 0;
      this.maxAge[slot] = params.lifetime * (0.7 + Math.random() * 0.6);
      this.baseRadius[slot] = radius;
      this.maxRadius[slot] =
        radius * maxSizeMultiplier * (0.85 + Math.random() * 0.3);
      this.growthRate[slot] = Math.max(0, 1 - params.sizeJitter);
      this.popping[slot] = 0;
      this.popAge[slot] = 0;
      this.popRadius[slot] = radius;
      this.iridescent[slot] =
        params.resolvedPalette.iridescent === true ? 1 : 0;
      setRgbFromHex(this.color, params.resolvedPalette.rim);
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
