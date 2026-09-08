import type { Object3D } from "three";
import { QualityTier } from "../types";
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
  BUBBLE_MAX_DEFORMATION,
  BUBBLE_MIN_REBOUND_DEFORMATION,
  BUBBLE_POP_DURATION_SECONDS,
  resolveAliveBubbleFrame3D,
  resolveBubbleDeformationTarget3D,
  resolveBubbleFragmentCount3D,
  resolveBubbleLifetimeMultiplier3D,
  resolveBubbleRiseSpeed3D,
  resolveBubbleRuptureOrigin3D,
  resolveBubbleRuptureProgress3D,
  resolveBubbleSizeMultiplier3D,
  resolveBubbleVelocityInheritance3D,
  resolveBubbleWobbleX3D,
  resolveBubbleWobbleZ3D,
  resolvePoppingBubbleFrame3D,
} from "./bubble-art-direction-3d";
import {
  BubbleFilmPool3D,
  type BubbleFilmInstance3D,
} from "./bubble-film-pool-3d";
import { SampledCurlGrid2D } from "../smoke/smoke-curl-field";

const MAX_CAPACITY = 2048;
const DEFAULT_CAPACITY = 512;
const TAU = Math.PI * 2;
const AIRFLOW_SCALE = 0.72;
const AIRFLOW_STRENGTH = 0.034;
const HORIZONTAL_DRAG = 0.48;
const VERTICAL_INHERITANCE_DRAG = 0.16;
const DEFORMATION_STIFFNESS = 58;
const DEFORMATION_DAMPING = 12;
const DEFORMATION_DIRECTION_RESPONSE = 7;

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
  private readonly riseSpeed = new Float32Array(MAX_CAPACITY);
  private readonly age = new Float32Array(MAX_CAPACITY);
  private readonly maxAge = new Float32Array(MAX_CAPACITY);
  private readonly baseRadius = new Float32Array(MAX_CAPACITY);
  private readonly sizeMultiplier = new Float32Array(MAX_CAPACITY);
  private readonly wobbleAmplitude = new Float32Array(MAX_CAPACITY);
  private readonly wobbleFrequency = new Float32Array(MAX_CAPACITY);
  private readonly filmPhase = new Float32Array(MAX_CAPACITY);
  private readonly filmStrength = new Float32Array(MAX_CAPACITY);
  private readonly deformation = new Float32Array(MAX_CAPACITY);
  private readonly deformationVelocity = new Float32Array(MAX_CAPACITY);
  private readonly deformationDirectionX = new Float32Array(MAX_CAPACITY);
  private readonly deformationDirectionY = new Float32Array(MAX_CAPACITY);
  private readonly deformationDirectionZ = new Float32Array(MAX_CAPACITY);
  private readonly ruptureOriginX = new Float32Array(MAX_CAPACITY);
  private readonly ruptureOriginY = new Float32Array(MAX_CAPACITY);
  private readonly popping = new Uint8Array(MAX_CAPACITY);
  private readonly popAge = new Float32Array(MAX_CAPACITY);
  private readonly popRadius = new Float32Array(MAX_CAPACITY);
  private readonly right = new Float32Array(MAX_CAPACITY);
  private readonly green = new Float32Array(MAX_CAPACITY);
  private readonly left = new Float32Array(MAX_CAPACITY);

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
  private readonly fragmentRight = new Float32Array(MAX_CAPACITY);
  private readonly fragmentGreen = new Float32Array(MAX_CAPACITY);
  private readonly fragmentLeft = new Float32Array(MAX_CAPACITY);

  private readonly accumulators = new Map<number, number>();
  private readonly color: MutableRgb = { right: 1, green: 1, left: 1 };
  private readonly airflow = new SampledCurlGrid2D(48, 10, 1 / 3);
  private readonly airflowSample = { vx: 0, vy: 0 };
  private readonly writeState: BubbleFilmInstance3D = {
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
    filmSeed: 0,
    filmStrength: 0.5,
    filmLife: 0,
    deformationX: 1,
    deformationY: 0,
    deformationZ: 0,
    deformation: 0,
    ruptureOriginX: 0,
    ruptureOriginY: 0.5,
    ruptureProgress: 0,
  };
  private shellCursor = 0;
  private fragmentCursor = 0;
  private clock = 0;
  private capacity = DEFAULT_CAPACITY;
  private qualityTier = QualityTier.HIGH;
  private parent: Object3D | null = null;

  initialize(parent: Object3D): void {
    this.parent = parent;
    this.shellPool.initialize(parent);
    this.fragmentPool.initialize(parent);
    this.shellPool.setQualityTier(this.qualityTier);
    this.fragmentPool.setQualityTier(this.qualityTier);
  }

  update(sources: readonly BubbleTipSource3D[], delta: number): void {
    this.syncQualityTier(sources);
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

      const airflow = this.airflow.sampleInto(
        this.x[index]! * AIRFLOW_SCALE,
        this.z[index]! * AIRFLOW_SCALE,
        this.clock,
        this.airflowSample
      );
      this.vx[index]! += airflow.vx * AIRFLOW_STRENGTH * dt;
      this.vz[index]! += airflow.vy * AIRFLOW_STRENGTH * dt;
      const horizontalDrag = Math.pow(HORIZONTAL_DRAG, dt);
      this.vx[index]! *= horizontalDrag;
      this.vz[index]! *= horizontalDrag;
      const verticalDrag = Math.pow(VERTICAL_INHERITANCE_DRAG, dt);
      this.vy[index] =
        this.riseSpeed[index]! +
        (this.vy[index]! - this.riseSpeed[index]!) * verticalDrag;
      this.x[index]! += this.vx[index]! * dt;
      this.y[index]! += this.vy[index]! * dt;
      this.z[index]! += this.vz[index]! * dt;

      const relativeX = this.vx[index]!;
      const relativeY = this.vy[index]! - this.riseSpeed[index]!;
      const relativeZ = this.vz[index]!;
      const relativeSpeed = Math.hypot(relativeX, relativeY, relativeZ);
      if (relativeSpeed > 0.018) {
        const directionBlend =
          1 - Math.exp(-DEFORMATION_DIRECTION_RESPONSE * dt);
        const inverseSpeed = 1 / relativeSpeed;
        let directionX =
          this.deformationDirectionX[index]! +
          (relativeX * inverseSpeed - this.deformationDirectionX[index]!) *
            directionBlend;
        let directionY =
          this.deformationDirectionY[index]! +
          (relativeY * inverseSpeed - this.deformationDirectionY[index]!) *
            directionBlend;
        let directionZ =
          this.deformationDirectionZ[index]! +
          (relativeZ * inverseSpeed - this.deformationDirectionZ[index]!) *
            directionBlend;
        const directionLength = Math.hypot(directionX, directionY, directionZ);
        if (directionLength > 0.0001) {
          directionX /= directionLength;
          directionY /= directionLength;
          directionZ /= directionLength;
          this.deformationDirectionX[index] = directionX;
          this.deformationDirectionY[index] = directionY;
          this.deformationDirectionZ[index] = directionZ;
        }
      }

      const life = Math.min(
        1,
        this.maxAge[index]! > 0 ? this.age[index]! / this.maxAge[index]! : 1
      );
      const tensionPulse =
        Math.sin(
          this.age[index]! * this.wobbleFrequency[index]! * 1.35 +
            this.filmPhase[index]! * TAU
        ) *
        0.009 *
        (1 - life * 0.45);
      const targetDeformation =
        this.popping[index] === 1
          ? 0
          : resolveBubbleDeformationTarget3D(
              relativeSpeed,
              this.sizeMultiplier[index]!
            ) + tensionPulse;
      let deformationVelocity = this.deformationVelocity[index]!;
      deformationVelocity +=
        ((targetDeformation - this.deformation[index]!) *
          DEFORMATION_STIFFNESS -
          deformationVelocity * DEFORMATION_DAMPING) *
        dt;
      let deformation = this.deformation[index]! + deformationVelocity * dt;
      if (deformation > BUBBLE_MAX_DEFORMATION) {
        deformation = BUBBLE_MAX_DEFORMATION;
        deformationVelocity = Math.min(0, deformationVelocity);
      } else if (deformation < BUBBLE_MIN_REBOUND_DEFORMATION) {
        deformation = BUBBLE_MIN_REBOUND_DEFORMATION;
        deformationVelocity = Math.max(0, deformationVelocity);
      }
      this.deformation[index] = deformation;
      this.deformationVelocity[index] = deformationVelocity;

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
      write.right = this.right[index]!;
      write.green = this.green[index]!;
      write.left = this.left[index]!;
      write.alpha = frame.alpha;
      write.filmSeed = this.filmPhase[index]!;
      write.filmStrength = this.filmStrength[index]!;
      write.filmLife =
        this.popping[index] === 1
          ? 1
          : Math.min(1, this.age[index]! / this.maxAge[index]!);
      write.deformationX = this.deformationDirectionX[index]!;
      write.deformationY = this.deformationDirectionY[index]!;
      write.deformationZ = this.deformationDirectionZ[index]!;
      write.deformation = deformation;
      write.ruptureOriginX = this.ruptureOriginX[index]!;
      write.ruptureOriginY = this.ruptureOriginY[index]!;
      write.ruptureProgress =
        this.popping[index] === 1
          ? resolveBubbleRuptureProgress3D(this.popAge[index]!)
          : 0;
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
      write.right = this.fragmentRight[index]!;
      write.green = this.fragmentGreen[index]!;
      write.left = this.fragmentLeft[index]!;
      write.alpha = alpha;
      write.filmSeed = phase;
      write.filmStrength = this.fragmentFilmStrength[index]!;
      write.filmLife = life;
      write.deformationX = 1;
      write.deformationY = 0;
      write.deformationZ = 0;
      write.deformation = 0;
      write.ruptureOriginX = 0;
      write.ruptureOriginY = 0.5;
      write.ruptureProgress = 0;
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
    const velocityInheritance = resolveBubbleVelocityInheritance3D(
      source.speed
    );
    setLinearRgbFromHex(this.color, palette.rim);
    const requestedSpawnCount = Math.floor(accumulator);
    let spawnOrdinal = 0;

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
      const pathProgress =
        requestedSpawnCount > 0
          ? (spawnOrdinal + 1) / (requestedSpawnCount + 1)
          : 1;
      const birthLag = dt * (1 - pathProgress);
      const spawnJitter = 0.016 + radius * 0.22;
      const resolvedRiseSpeed = resolveBubbleRiseSpeed3D(
        params.riseSpeed,
        sizeMultiplier
      );
      this.active[slot] = 1;
      this.x[slot] =
        source.position.x -
        source.velocity.x * birthLag +
        (Math.random() - 0.5) * spawnJitter;
      this.y[slot] =
        source.position.y -
        source.velocity.y * birthLag +
        (Math.random() - 0.5) * spawnJitter;
      this.z[slot] =
        source.position.z -
        source.velocity.z * birthLag +
        (Math.random() - 0.5) * spawnJitter;
      this.vx[slot] =
        source.velocity.x * velocityInheritance + (Math.random() - 0.5) * 0.06;
      this.vy[slot] =
        resolvedRiseSpeed + source.velocity.y * velocityInheritance;
      this.vz[slot] =
        source.velocity.z * velocityInheritance + (Math.random() - 0.5) * 0.06;
      this.riseSpeed[slot] = resolvedRiseSpeed;
      this.age[slot] = 0;
      this.maxAge[slot] =
        params.lifetime * lifetimeMultiplier * (0.7 + Math.random() * 0.6);
      this.baseRadius[slot] = radius;
      this.sizeMultiplier[slot] = sizeMultiplier;
      this.wobbleAmplitude[slot] =
        (0.012 + Math.random() * 0.022) *
        Math.max(0.32, 1.25 - sizeMultiplier * 0.5);
      this.wobbleFrequency[slot] = 1.4 + Math.random() * 1.9;
      this.filmPhase[slot] = Math.random();
      this.filmStrength[slot] = palette.iridescent === true ? 1 : 0.62;
      this.deformation[slot] = 0;
      this.deformationVelocity[slot] = 0;
      const sourceDirectionLength = Math.hypot(
        source.velocity.x,
        source.velocity.y,
        source.velocity.z
      );
      if (sourceDirectionLength > 0.0001) {
        this.deformationDirectionX[slot] =
          source.velocity.x / sourceDirectionLength;
        this.deformationDirectionY[slot] =
          source.velocity.y / sourceDirectionLength;
        this.deformationDirectionZ[slot] =
          source.velocity.z / sourceDirectionLength;
      } else {
        const calmAngle = this.filmPhase[slot]! * TAU;
        this.deformationDirectionX[slot] = Math.cos(calmAngle);
        this.deformationDirectionY[slot] = 0.28;
        this.deformationDirectionZ[slot] = Math.sin(calmAngle);
      }
      const ruptureOrigin = resolveBubbleRuptureOrigin3D(this.filmPhase[slot]!);
      this.ruptureOriginX[slot] = ruptureOrigin.x;
      this.ruptureOriginY[slot] = ruptureOrigin.y;
      this.popping[slot] = 0;
      this.popAge[slot] = 0;
      this.popRadius[slot] = radius * (1 + BUBBLE_LIFETIME_SWELL);
      this.right[slot] = this.color.right;
      this.green[slot] = this.color.green;
      this.left[slot] = this.color.left;
      accumulator -= 1;
      spawnOrdinal++;
    }
    this.accumulators.set(source.sourceId, accumulator);
  }

  private spawnFragments(shellIndex: number): void {
    const count = resolveBubbleFragmentCount3D(Math.random());
    const ruptureAngle = this.filmPhase[shellIndex]! * TAU;
    const radius = this.popRadius[shellIndex]!;
    const originX = Math.cos(ruptureAngle) * radius * 0.34;
    const originY = radius * 0.52;
    const originZ = Math.sin(ruptureAngle) * radius * 0.34;
    for (let ordinal = 0; ordinal < count; ordinal++) {
      const slot = this.takeFragmentSlot();
      if (slot < 0) return;
      const fan = count > 1 ? ordinal / (count - 1) - 0.5 : 0;
      const angle = ruptureAngle + fan * 1.5 + (Math.random() - 0.5) * 0.28;
      const directionY = 0.16 + Math.random() * 0.42;
      const horizontal = Math.sqrt(Math.max(0, 1 - directionY * directionY));
      const directionX = Math.cos(angle) * horizontal;
      const directionZ = Math.sin(angle) * horizontal;
      const speed = 0.12 + Math.random() * 0.28;
      this.fragmentActive[slot] = 1;
      this.fragmentX[slot] = this.x[shellIndex]! + originX;
      this.fragmentY[slot] = this.y[shellIndex]! + originY;
      this.fragmentZ[slot] = this.z[shellIndex]! + originZ;
      this.fragmentVx[slot] = this.vx[shellIndex]! + directionX * speed;
      this.fragmentVy[slot] = this.vy[shellIndex]! * 0.18 + directionY * speed;
      this.fragmentVz[slot] = this.vz[shellIndex]! + directionZ * speed;
      this.fragmentAge[slot] = 0;
      this.fragmentMaxAge[slot] = 0.18 + Math.random() * 0.2;
      this.fragmentSize[slot] = radius * (0.065 + Math.random() * 0.05);
      this.fragmentPhase[slot] =
        (this.filmPhase[shellIndex]! + ordinal / count) % 1;
      this.fragmentFilmStrength[slot] = this.filmStrength[shellIndex]!;
      this.fragmentRight[slot] = this.right[shellIndex]!;
      this.fragmentGreen[slot] = this.green[shellIndex]!;
      this.fragmentLeft[slot] = this.left[shellIndex]!;
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
    const nextCapacity = resolveBubbleCapacityForQuality3D(
      requested,
      this.qualityTier
    );
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
    this.shellPool.setQualityTier(this.qualityTier);
    this.fragmentPool.setQualityTier(this.qualityTier);
    if (this.parent) {
      this.shellPool.initialize(this.parent);
      this.fragmentPool.initialize(this.parent);
    }
  }

  private syncQualityTier(sources: readonly BubbleTipSource3D[]): void {
    const nextTier = sources[0]?.qualityTier ?? this.qualityTier;
    if (nextTier === this.qualityTier) return;
    this.qualityTier = nextTier;
    this.shellPool.setQualityTier(nextTier);
    this.fragmentPool.setQualityTier(nextTier);
  }
}

export function resolveBubbleCapacityTier3D(requested: number): number {
  if (requested <= 512) return 512;
  if (requested <= 1024) return 1024;
  return 2048;
}

export function resolveBubbleCapacityForQuality3D(
  requested: number,
  qualityTier: QualityTier
): number {
  const tierLimit =
    qualityTier === QualityTier.HIGH
      ? 2048
      : qualityTier === QualityTier.MEDIUM
        ? 1024
        : 512;
  return resolveBubbleCapacityTier3D(Math.min(requested, tierLimit));
}
