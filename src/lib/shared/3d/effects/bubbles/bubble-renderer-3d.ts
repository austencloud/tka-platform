import type { Object3D } from "three";
import {
  setLinearRgbFromHex,
  type MutableRgb,
} from "../instancing/particle-color";
import {
  isTrackedTip,
  type BubbleTipSource3D,
} from "../scene-effects/scene-effect-source-3d";
import {
  BUBBLE_LIFETIME_SWELL,
  BUBBLE_POP_DURATION_SECONDS,
  resolveAliveBubbleFrame3D,
  resolveBubbleFragmentCount3D,
  resolveBubbleLifetimeMultiplier3D,
  resolveBubbleRiseSpeed3D,
  resolveBubbleSizeMultiplier3D,
  resolveBubbleWobbleX3D,
  resolveBubbleWobbleZ3D,
  resolvePoppingBubbleFrame3D,
} from "./bubble-art-direction-3d";
import {
  BubbleFilmPool3D,
  type BubbleFilmInstance3D,
} from "./bubble-film-pool-3d";

const MAX_CAPACITY = 2048;
const DEFAULT_CAPACITY = 512;
const TAU = Math.PI * 2;

/**
 * Scene-batched soap bubbles. Curved shells and cheap film fragments each use
 * one bounded draw; simulation state stays in stable typed arrays so density
 * never creates per-frame objects or Svelte components.
 */
export class BubbleRenderer3D {
  private shellPool = new BubbleFilmPool3D(DEFAULT_CAPACITY, "shell");
  private fragmentPool = new BubbleFilmPool3D(DEFAULT_CAPACITY, "fragment");
  private readonly active = new Uint8Array(MAX_CAPACITY);
  private readonly x = new Float32Array(MAX_CAPACITY);
  private readonly y = new Float32Array(MAX_CAPACITY);
  private readonly z = new Float32Array(MAX_CAPACITY);
  private readonly vx = new Float32Array(MAX_CAPACITY);
  private readonly vy = new Float32Array(MAX_CAPACITY);
  private readonly vz = new Float32Array(MAX_CAPACITY);
  private readonly age = new Float32Array(MAX_CAPACITY);
  private readonly maxAge = new Float32Array(MAX_CAPACITY);
  private readonly baseRadius = new Float32Array(MAX_CAPACITY);
  private readonly wobbleAmplitude = new Float32Array(MAX_CAPACITY);
  private readonly wobbleFrequency = new Float32Array(MAX_CAPACITY);
  private readonly filmPhase = new Float32Array(MAX_CAPACITY);
  private readonly filmStrength = new Float32Array(MAX_CAPACITY);
  private readonly popping = new Uint8Array(MAX_CAPACITY);
  private readonly popAge = new Float32Array(MAX_CAPACITY);
  private readonly popRadius = new Float32Array(MAX_CAPACITY);
  private readonly red = new Float32Array(MAX_CAPACITY);
  private readonly green = new Float32Array(MAX_CAPACITY);
  private readonly blue = new Float32Array(MAX_CAPACITY);

  private readonly fragmentActive = new Uint8Array(MAX_CAPACITY);
  private readonly fragmentX = new Float32Array(MAX_CAPACITY);
  private readonly fragmentY = new Float32Array(MAX_CAPACITY);
  private readonly fragmentZ = new Float32Array(MAX_CAPACITY);
  private readonly fragmentVx = new Float32Array(MAX_CAPACITY);
  private readonly fragmentVy = new Float32Array(MAX_CAPACITY);
  private readonly fragmentVz = new Float32Array(MAX_CAPACITY);
  private readonly fragmentAge = new Float32Array(MAX_CAPACITY);
  private readonly fragmentMaxAge = new Float32Array(MAX_CAPACITY);
  private readonly fragmentSize = new Float32Array(MAX_CAPACITY);
  private readonly fragmentPhase = new Float32Array(MAX_CAPACITY);
  private readonly fragmentFilmStrength = new Float32Array(MAX_CAPACITY);
  private readonly fragmentRed = new Float32Array(MAX_CAPACITY);
  private readonly fragmentGreen = new Float32Array(MAX_CAPACITY);
  private readonly fragmentBlue = new Float32Array(MAX_CAPACITY);

  private readonly accumulators = new Map<number, number>();
  private readonly color: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly writeState: BubbleFilmInstance3D = {
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
    filmSeed: 0,
    filmStrength: 0.5,
  };
  private shellCursor = 0;
  private fragmentCursor = 0;
  private clock = 0;
  private capacity = DEFAULT_CAPACITY;
  private parent: Object3D | null = null;

  initialize(parent: Object3D): void {
    this.parent = parent;
    this.shellPool.initialize(parent);
    this.fragmentPool.initialize(parent);
  }

  update(sources: readonly BubbleTipSource3D[], delta: number): void {
    this.ensureCapacity(sources);
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    this.clock += dt;
    const presentSourceIds = new Set<number>();
    for (const source of sources) {
      presentSourceIds.add(source.sourceId);
      if (isTrackedTip(source.params.trackingMode, source.tipIndex)) {
        this.emit(source, dt);
      }
    }
    for (const sourceId of this.accumulators.keys()) {
      if (!presentSourceIds.has(sourceId)) this.accumulators.delete(sourceId);
    }

    this.shellPool.beginFrame(this.clock);
    this.fragmentPool.beginFrame(this.clock);
    this.updateShells(dt);
    this.updateFragments(dt);
    this.shellPool.commit();
    this.fragmentPool.commit();
  }

  clear(): void {
    this.active.fill(0);
    this.fragmentActive.fill(0);
    this.accumulators.clear();
    this.shellPool.clear();
    this.fragmentPool.clear();
  }

  dispose(): void {
    this.shellPool.dispose();
    this.fragmentPool.dispose();
    this.parent = null;
  }

  private updateShells(dt: number): void {
    for (let index = 0; index < this.capacity; index++) {
      if (this.active[index] === 0) continue;

      this.x[index]! += this.vx[index]! * dt;
      this.y[index]! += this.vy[index]! * dt;
      this.z[index]! += this.vz[index]! * dt;
      this.vx[index]! *= Math.pow(0.55, dt);
      this.vz[index]! *= Math.pow(0.55, dt);

      let frame;
      if (this.popping[index] === 1) {
        this.popAge[index]! += dt;
        if (this.popAge[index]! >= BUBBLE_POP_DURATION_SECONDS) {
          this.active[index] = 0;
          continue;
        }
        frame = resolvePoppingBubbleFrame3D(
          this.popRadius[index]!,
          this.popAge[index]!
        );
      } else {
        this.age[index]! += dt;
        frame = resolveAliveBubbleFrame3D(
          this.baseRadius[index]!,
          this.age[index]!,
          this.maxAge[index]!,
          this.filmPhase[index]! * TAU
        );
        if (this.age[index]! >= this.maxAge[index]!) {
          this.popping[index] = 1;
          this.popAge[index] = 0;
          this.popRadius[index] = frame.radius;
          this.spawnFragments(index);
          frame = resolvePoppingBubbleFrame3D(frame.radius, 0);
        }
      }

      if (frame.alpha <= 0.003) continue;
      const wobbleX = resolveBubbleWobbleX3D(
        this.age[index]!,
        this.wobbleFrequency[index]!,
        this.filmPhase[index]! * TAU,
        this.wobbleAmplitude[index]!
      );
      const wobbleZ = resolveBubbleWobbleZ3D(
        this.age[index]!,
        this.wobbleFrequency[index]!,
        this.filmPhase[index]! * TAU,
        this.wobbleAmplitude[index]!
      );
      const write = this.writeState;
      write.x = this.x[index]! + wobbleX;
      write.y = this.y[index]!;
      write.z = this.z[index]! + wobbleZ;
      write.scaleX = frame.scaleX;
      write.scaleY = frame.scaleY;
      write.scaleZ = frame.scaleZ;
      write.red = this.red[index]!;
      write.green = this.green[index]!;
      write.blue = this.blue[index]!;
      write.alpha = frame.alpha;
      write.filmSeed = this.filmPhase[index]!;
      write.filmStrength = this.filmStrength[index]!;
      this.shellPool.write(write);
    }
  }

  private updateFragments(dt: number): void {
    for (let index = 0; index < this.capacity; index++) {
      if (this.fragmentActive[index] === 0) continue;
      this.fragmentAge[index]! += dt;
      if (this.fragmentAge[index]! >= this.fragmentMaxAge[index]!) {
        this.fragmentActive[index] = 0;
        continue;
      }
      this.fragmentVx[index]! *= Math.pow(0.32, dt);
      this.fragmentVy[index]! -= 0.32 * dt;
      this.fragmentVz[index]! *= Math.pow(0.32, dt);
      this.fragmentX[index]! += this.fragmentVx[index]! * dt;
      this.fragmentY[index]! += this.fragmentVy[index]! * dt;
      this.fragmentZ[index]! += this.fragmentVz[index]! * dt;

      const life = this.fragmentAge[index]! / this.fragmentMaxAge[index]!;
      const alpha = Math.pow(1 - life, 1.55) * 0.7;
      const size = this.fragmentSize[index]! * (1 - life * 0.38);
      const phase = this.fragmentPhase[index]!;
      const write = this.writeState;
      write.x = this.fragmentX[index]!;
      write.y = this.fragmentY[index]!;
      write.z = this.fragmentZ[index]!;
      write.scaleX = size;
      write.scaleY = size * (0.22 + 0.12 * Math.sin(this.clock * 15 + phase));
      write.scaleZ = size * 0.58;
      write.red = this.fragmentRed[index]!;
      write.green = this.fragmentGreen[index]!;
      write.blue = this.fragmentBlue[index]!;
      write.alpha = alpha;
      write.filmSeed = phase;
      write.filmStrength = this.fragmentFilmStrength[index]!;
      this.fragmentPool.write(write);
    }
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
    const palette = params.resolvedPalette;
    const base = params.baseRadius * (0.7 + 0.9 * params.intensity);
    const lifetimeMultiplier = resolveBubbleLifetimeMultiplier3D(palette.id);
    setLinearRgbFromHex(this.color, palette.rim);

    while (accumulator >= 1) {
      const slot = this.takeShellSlot();
      if (slot < 0) {
        accumulator = 0;
        break;
      }
      const sizeMultiplier = resolveBubbleSizeMultiplier3D(
        Math.random(),
        params.sizeJitter
      );
      const radius = base * sizeMultiplier;
      this.active[slot] = 1;
      this.x[slot] = source.position.x + (Math.random() - 0.5) * 0.04;
      this.y[slot] = source.position.y + (Math.random() - 0.5) * 0.04;
      this.z[slot] = source.position.z + (Math.random() - 0.5) * 0.04;
      this.vx[slot] = (Math.random() - 0.5) * 0.05;
      this.vy[slot] = resolveBubbleRiseSpeed3D(
        params.riseSpeed,
        sizeMultiplier
      );
      this.vz[slot] = (Math.random() - 0.5) * 0.05;
      this.age[slot] = 0;
      this.maxAge[slot] =
        params.lifetime * lifetimeMultiplier * (0.7 + Math.random() * 0.6);
      this.baseRadius[slot] = radius;
      this.wobbleAmplitude[slot] =
        (0.012 + Math.random() * 0.022) *
        Math.max(0.32, 1.25 - sizeMultiplier * 0.5);
      this.wobbleFrequency[slot] = 1.4 + Math.random() * 1.9;
      this.filmPhase[slot] = Math.random();
      this.filmStrength[slot] = palette.iridescent === true ? 1 : 0.62;
      this.popping[slot] = 0;
      this.popAge[slot] = 0;
      this.popRadius[slot] = radius * (1 + BUBBLE_LIFETIME_SWELL);
      this.red[slot] = this.color.red;
      this.green[slot] = this.color.green;
      this.blue[slot] = this.color.blue;
      accumulator -= 1;
    }
    this.accumulators.set(source.sourceId, accumulator);
  }

  private spawnFragments(shellIndex: number): void {
    const count = resolveBubbleFragmentCount3D(Math.random());
    for (let ordinal = 0; ordinal < count; ordinal++) {
      const slot = this.takeFragmentSlot();
      if (slot < 0) return;
      const angle = (ordinal / count) * TAU + (Math.random() - 0.5) * 0.32;
      const elevation = (Math.random() - 0.5) * 0.55;
      const horizontal = Math.cos(elevation);
      const directionX = Math.cos(angle) * horizontal;
      const directionY = Math.sin(elevation);
      const directionZ = Math.sin(angle) * horizontal;
      const radius = this.popRadius[shellIndex]!;
      const speed = 0.12 + Math.random() * 0.28;
      this.fragmentActive[slot] = 1;
      this.fragmentX[slot] = this.x[shellIndex]! + directionX * radius * 0.76;
      this.fragmentY[slot] = this.y[shellIndex]! + directionY * radius * 0.76;
      this.fragmentZ[slot] = this.z[shellIndex]! + directionZ * radius * 0.76;
      this.fragmentVx[slot] = this.vx[shellIndex]! + directionX * speed;
      this.fragmentVy[slot] = this.vy[shellIndex]! * 0.18 + directionY * speed;
      this.fragmentVz[slot] = this.vz[shellIndex]! + directionZ * speed;
      this.fragmentAge[slot] = 0;
      this.fragmentMaxAge[slot] = 0.18 + Math.random() * 0.2;
      this.fragmentSize[slot] = radius * (0.065 + Math.random() * 0.05);
      this.fragmentPhase[slot] =
        (this.filmPhase[shellIndex]! + ordinal / count) % 1;
      this.fragmentFilmStrength[slot] = this.filmStrength[shellIndex]!;
      this.fragmentRed[slot] = this.red[shellIndex]!;
      this.fragmentGreen[slot] = this.green[shellIndex]!;
      this.fragmentBlue[slot] = this.blue[shellIndex]!;
    }
  }

  private takeShellSlot(): number {
    for (let offset = 0; offset < this.capacity; offset++) {
      const index = (this.shellCursor + offset) % this.capacity;
      if (this.active[index] === 0) {
        this.shellCursor = (index + 1) % this.capacity;
        return index;
      }
    }
    return -1;
  }

  private takeFragmentSlot(): number {
    for (let offset = 0; offset < this.capacity; offset++) {
      const index = (this.fragmentCursor + offset) % this.capacity;
      if (this.fragmentActive[index] === 0) {
        this.fragmentCursor = (index + 1) % this.capacity;
        return index;
      }
    }
    return -1;
  }

  private ensureCapacity(sources: readonly BubbleTipSource3D[]): void {
    if (sources.length === 0) return;
    let requested = DEFAULT_CAPACITY;
    for (const source of sources) {
      requested = Math.max(requested, source.params.poolSize);
    }
    const nextCapacity = resolveBubbleCapacityTier3D(requested);
    if (nextCapacity === this.capacity) return;

    this.capacity = nextCapacity;
    this.shellCursor %= nextCapacity;
    this.fragmentCursor %= nextCapacity;
    this.active.fill(0, nextCapacity);
    this.fragmentActive.fill(0, nextCapacity);
    this.shellPool.dispose();
    this.fragmentPool.dispose();
    this.shellPool = new BubbleFilmPool3D(nextCapacity, "shell");
    this.fragmentPool = new BubbleFilmPool3D(nextCapacity, "fragment");
    if (this.parent) {
      this.shellPool.initialize(this.parent);
      this.fragmentPool.initialize(this.parent);
    }
  }
}

export function resolveBubbleCapacityTier3D(requested: number): number {
  if (requested <= 512) return 512;
  if (requested <= 1024) return 1024;
  return 2048;
}
