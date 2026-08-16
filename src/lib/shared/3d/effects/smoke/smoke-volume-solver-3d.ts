import {
  Data3DTexture,
  LinearFilter,
  RedFormat,
  UnsignedByteType,
} from "three";
import type { Smoke3DParams } from "$lib/shared/effects/translators/webgl3d-types";
import type {
  SceneEffectVector3,
  SmokeTipSource3D,
} from "../scene-effects/scene-effect-source-3d";

export const SMOKE_VOLUME_BRICK_SIZE = 20;
export const SMOKE_VOLUME_MAX_BRICKS = 8;
export const SMOKE_VOLUME_FIXED_STEP = 1 / 30;
const ATLAS_EDGE_BRICKS = 2;
const PRESSURE_ITERATIONS = 2;
const MAX_FRAME_STEPS = 2;
const VOLUME_SOURCE_GAIN = 4;
const EPSILON = 1e-6;

const BRICK_HALF_EXTENT: SceneEffectVector3 = { x: 2.35, y: 3.05, z: 2.35 };

export interface SmokeVolumeBrickRenderState3D {
  slot: number;
  center: SceneEffectVector3;
  halfExtent: SceneEffectVector3;
  atlasOffset: SceneEffectVector3;
  coreColor: string;
  edgeColor: string;
  densityScale: number;
  extinction: number;
  scattering: number;
  detailWarp: number;
  hueShift: number;
  seed: number;
}

export interface SmokeVolumeDebugSnapshot3D {
  activeBricks: number;
  atlasEdge: number;
  densitySum: number;
  occupiedVoxels: number;
  maxDivergence: number;
  simulationSteps: number;
}

interface SmokeVolumeBrick3D {
  rigId: number;
  slot: number;
  center: SceneEffectVector3;
  density: Float32Array;
  temperature: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  velocityZ: Float32Array;
  nextDensity: Float32Array;
  nextTemperature: Float32Array;
  nextVelocityX: Float32Array;
  nextVelocityY: Float32Array;
  nextVelocityZ: Float32Array;
  pressure: Float32Array;
  nextPressure: Float32Array;
  divergence: Float32Array;
  curlX: Float32Array;
  curlY: Float32Array;
  curlZ: Float32Array;
  curlMagnitude: Float32Array;
  params: Smoke3DParams;
  coreColor: string;
  edgeColor: string;
  maxDivergence: number;
  pendingSimulationTime: number;
}

function voxelIndex(x: number, y: number, z: number): number {
  return x + y * SMOKE_VOLUME_BRICK_SIZE + z * SMOKE_VOLUME_BRICK_SIZE ** 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rigIdForSource(sourceId: number): number {
  return Math.floor(Math.max(0, sourceId - 1) / 4);
}

function deterministicUnit(sourceId: number, step: number): number {
  let value = (sourceId * 0x9e3779b1 + step * 0x85ebca6b) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

function makeField(): Float32Array {
  return new Float32Array(SMOKE_VOLUME_BRICK_SIZE ** 3);
}

function makeBrick(
  rigId: number,
  slot: number,
  center: SceneEffectVector3,
  params: Smoke3DParams
): SmokeVolumeBrick3D {
  return {
    rigId,
    slot,
    center: { ...center },
    density: makeField(),
    temperature: makeField(),
    velocityX: makeField(),
    velocityY: makeField(),
    velocityZ: makeField(),
    nextDensity: makeField(),
    nextTemperature: makeField(),
    nextVelocityX: makeField(),
    nextVelocityY: makeField(),
    nextVelocityZ: makeField(),
    pressure: makeField(),
    nextPressure: makeField(),
    divergence: makeField(),
    curlX: makeField(),
    curlY: makeField(),
    curlZ: makeField(),
    curlMagnitude: makeField(),
    params,
    coreColor: params.resolvedPalette.core,
    edgeColor: params.resolvedPalette.edge,
    maxDivergence: 0,
    pendingSimulationTime: 0,
  };
}

function sampleField(
  field: Float32Array,
  x: number,
  y: number,
  z: number
): number {
  const max = SMOKE_VOLUME_BRICK_SIZE - 1;
  const cx = clamp(x, 0, max);
  const cy = clamp(y, 0, max);
  const cz = clamp(z, 0, max);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const z0 = Math.floor(cz);
  const x1 = Math.min(max, x0 + 1);
  const y1 = Math.min(max, y0 + 1);
  const z1 = Math.min(max, z0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const fz = cz - z0;
  const x00 =
    field[voxelIndex(x0, y0, z0)]! * (1 - fx) +
    field[voxelIndex(x1, y0, z0)]! * fx;
  const x10 =
    field[voxelIndex(x0, y1, z0)]! * (1 - fx) +
    field[voxelIndex(x1, y1, z0)]! * fx;
  const x01 =
    field[voxelIndex(x0, y0, z1)]! * (1 - fx) +
    field[voxelIndex(x1, y0, z1)]! * fx;
  const x11 =
    field[voxelIndex(x0, y1, z1)]! * (1 - fx) +
    field[voxelIndex(x1, y1, z1)]! * fx;
  const y0Mix = x00 * (1 - fy) + x10 * fy;
  const y1Mix = x01 * (1 - fy) + x11 * fy;
  return y0Mix * (1 - fz) + y1Mix * fz;
}

function clearBrick(brick: SmokeVolumeBrick3D): void {
  brick.density.fill(0);
  brick.temperature.fill(0);
  brick.velocityX.fill(0);
  brick.velocityY.fill(0);
  brick.velocityZ.fill(0);
  brick.pressure.fill(0);
  brick.divergence.fill(0);
  brick.maxDivergence = 0;
  brick.pendingSimulationTime = 0;
}

export function shiftSmokeVolumeField3D(
  source: Float32Array,
  target: Float32Array,
  shiftX: number,
  shiftY: number,
  shiftZ: number
): void {
  const expectedLength = SMOKE_VOLUME_BRICK_SIZE ** 3;
  if (source.length !== expectedLength || target.length !== expectedLength)
    throw new RangeError(
      `Smoke volume fields must contain ${expectedLength} voxels.`
    );
  target.fill(0);
  const size = SMOKE_VOLUME_BRICK_SIZE;
  for (let z = 0; z < size; z++) {
    const targetZ = z - shiftZ;
    if (targetZ < 0 || targetZ >= size) continue;
    for (let y = 0; y < size; y++) {
      const targetY = y - shiftY;
      if (targetY < 0 || targetY >= size) continue;
      for (let x = 0; x < size; x++) {
        const targetX = x - shiftX;
        if (targetX < 0 || targetX >= size) continue;
        target[voxelIndex(targetX, targetY, targetZ)] =
          source[voxelIndex(x, y, z)]!;
      }
    }
  }
}

/**
 * Advances the shared smoke density atlas. One brick follows each performer,
 * while whole-voxel field shifts keep the existing plume fixed in the room.
 */
export class SmokeVolumeSolver3D {
  readonly atlasEdge = SMOKE_VOLUME_BRICK_SIZE * ATLAS_EDGE_BRICKS;
  readonly texture: Data3DTexture;
  private readonly atlasData: Uint8Array;
  private readonly bricks = new Map<number, SmokeVolumeBrick3D>();
  private readonly previousPositions = new Map<number, SceneEffectVector3>();
  private readonly freeSlots = Array.from(
    { length: SMOKE_VOLUME_MAX_BRICKS },
    (_, index) => index
  );
  private accumulator = 0;
  private stepIndex = 0;
  private simulationSteps = 0;

  constructor() {
    this.atlasData = new Uint8Array(this.atlasEdge ** 3);
    this.texture = new Data3DTexture(
      this.atlasData,
      this.atlasEdge,
      this.atlasEdge,
      this.atlasEdge
    );
    this.texture.format = RedFormat;
    this.texture.type = UnsignedByteType;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.unpackAlignment = 1;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  update(sources: readonly SmokeTipSource3D[], delta: number): void {
    if (sources.length === 0) {
      if (this.bricks.size > 0) this.clear();
      return;
    }

    const byRig = new Map<number, SmokeTipSource3D[]>();
    for (const source of sources) {
      const rigId = rigIdForSource(source.sourceId);
      const group = byRig.get(rigId);
      if (group) group.push(source);
      else byRig.set(rigId, [source]);
    }

    this.releaseMissingBricks(byRig);
    for (const [rigId, rigSources] of byRig) {
      let brick = this.bricks.get(rigId);
      if (!brick) {
        const slot = this.freeSlots.shift();
        if (slot === undefined) continue;
        brick = makeBrick(
          rigId,
          slot,
          this.desiredCenter(rigSources),
          rigSources[0]!.params
        );
        this.bricks.set(rigId, brick);
      }
      const params = rigSources[0]!.params;
      if (brick.params.resolvedPalette.id !== params.resolvedPalette.id) {
        clearBrick(brick);
      }
      brick.params = params;
      brick.coreColor = params.resolvedPalette.core;
      brick.edgeColor = params.resolvedPalette.edge;
      this.followSources(brick, rigSources);
    }

    this.accumulator += Math.min(Math.max(delta, 0), 1 / 15);
    let steps = 0;
    while (
      this.accumulator >= SMOKE_VOLUME_FIXED_STEP &&
      steps < MAX_FRAME_STEPS
    ) {
      for (const [rigId, rigSources] of byRig) {
        const brick = this.bricks.get(rigId);
        if (!brick) continue;
        brick.pendingSimulationTime += SMOKE_VOLUME_FIXED_STEP;
        const interleaveLargeCrowd = this.bricks.size > 4;
        if (interleaveLargeCrowd && brick.slot % 2 !== this.stepIndex % 2)
          continue;
        const simulationTime = Math.min(
          brick.pendingSimulationTime,
          SMOKE_VOLUME_FIXED_STEP * 2
        );
        this.injectSources(brick, rigSources, simulationTime);
        this.simulateBrick(brick, simulationTime);
        brick.pendingSimulationTime = 0;
        for (const source of rigSources) {
          this.previousPositions.set(source.sourceId, { ...source.position });
        }
      }
      this.accumulator -= SMOKE_VOLUME_FIXED_STEP;
      this.stepIndex += 1;
      this.simulationSteps += 1;
      steps += 1;
    }
    if (steps === MAX_FRAME_STEPS) this.accumulator = 0;

    if (steps > 0) this.packAtlas();
  }

  getRenderBricks(): SmokeVolumeBrickRenderState3D[] {
    return [...this.bricks.values()].map((brick) => {
      const x = brick.slot % ATLAS_EDGE_BRICKS;
      const y = Math.floor(brick.slot / ATLAS_EDGE_BRICKS) % ATLAS_EDGE_BRICKS;
      const z = Math.floor(brick.slot / ATLAS_EDGE_BRICKS ** 2);
      const profile = brick.params.volumeProfile;
      return {
        slot: brick.slot,
        center: { ...brick.center },
        halfExtent: { ...BRICK_HALF_EXTENT },
        atlasOffset: {
          x: x / ATLAS_EDGE_BRICKS,
          y: y / ATLAS_EDGE_BRICKS,
          z: z / ATLAS_EDGE_BRICKS,
        },
        coreColor: brick.coreColor,
        edgeColor: brick.edgeColor,
        densityScale: 0.72 + brick.params.intensity * 0.9,
        extinction: profile.extinction,
        scattering: profile.scattering,
        detailWarp: profile.detailWarp,
        hueShift: profile.hueShift,
        seed: (brick.rigId * 0.61803398875) % 1,
      };
    });
  }

  getDebugSnapshot(): SmokeVolumeDebugSnapshot3D {
    let densitySum = 0;
    let occupiedVoxels = 0;
    let maxDivergence = 0;
    for (const brick of this.bricks.values()) {
      for (const density of brick.density) {
        densitySum += density;
        if (density > 0.001) occupiedVoxels += 1;
      }
      maxDivergence = Math.max(maxDivergence, brick.maxDivergence);
    }
    return {
      activeBricks: this.bricks.size,
      atlasEdge: this.atlasEdge,
      densitySum,
      occupiedVoxels,
      maxDivergence,
      simulationSteps: this.simulationSteps,
    };
  }

  clear(): void {
    this.bricks.clear();
    this.previousPositions.clear();
    this.freeSlots.splice(
      0,
      this.freeSlots.length,
      ...Array.from({ length: SMOKE_VOLUME_MAX_BRICKS }, (_, index) => index)
    );
    this.atlasData.fill(0);
    this.texture.needsUpdate = true;
    this.accumulator = 0;
  }

  dispose(): void {
    this.clear();
    this.texture.dispose();
  }

  private releaseMissingBricks(
    sourcesByRig: ReadonlyMap<number, readonly SmokeTipSource3D[]>
  ): void {
    for (const [rigId, brick] of this.bricks) {
      if (sourcesByRig.has(rigId)) continue;
      this.bricks.delete(rigId);
      this.freeSlots.push(brick.slot);
      this.freeSlots.sort((a, b) => a - b);
      for (const sourceId of this.previousPositions.keys()) {
        if (rigIdForSource(sourceId) === rigId)
          this.previousPositions.delete(sourceId);
      }
    }
  }

  private desiredCenter(
    sources: readonly SmokeTipSource3D[]
  ): SceneEffectVector3 {
    const sum = sources.reduce(
      (acc, source) => ({
        x: acc.x + source.position.x,
        y: acc.y + source.position.y,
        z: acc.z + source.position.z,
      }),
      { x: 0, y: 0, z: 0 }
    );
    const count = Math.max(1, sources.length);
    return {
      x: sum.x / count,
      y: sum.y / count + BRICK_HALF_EXTENT.y * 0.28,
      z: sum.z / count,
    };
  }

  private followSources(
    brick: SmokeVolumeBrick3D,
    sources: readonly SmokeTipSource3D[]
  ): void {
    const desired = this.desiredCenter(sources);
    const cellX = (BRICK_HALF_EXTENT.x * 2) / (SMOKE_VOLUME_BRICK_SIZE - 1);
    const cellY = (BRICK_HALF_EXTENT.y * 2) / (SMOKE_VOLUME_BRICK_SIZE - 1);
    const cellZ = (BRICK_HALF_EXTENT.z * 2) / (SMOKE_VOLUME_BRICK_SIZE - 1);
    const dx = Math.trunc((desired.x - brick.center.x) / cellX);
    const dy = Math.trunc((desired.y - brick.center.y) / cellY);
    const dz = Math.trunc((desired.z - brick.center.z) / cellZ);
    if (dx === 0 && dy === 0 && dz === 0) return;
    if (
      Math.abs(dx) >= SMOKE_VOLUME_BRICK_SIZE ||
      Math.abs(dy) >= SMOKE_VOLUME_BRICK_SIZE ||
      Math.abs(dz) >= SMOKE_VOLUME_BRICK_SIZE
    ) {
      clearBrick(brick);
      brick.center = desired;
      return;
    }
    this.shiftBrick(brick, dx, dy, dz);
    brick.center.x += dx * cellX;
    brick.center.y += dy * cellY;
    brick.center.z += dz * cellZ;
  }

  private shiftBrick(
    brick: SmokeVolumeBrick3D,
    shiftX: number,
    shiftY: number,
    shiftZ: number
  ): void {
    const fields: Array<[Float32Array, Float32Array]> = [
      [brick.density, brick.nextDensity],
      [brick.temperature, brick.nextTemperature],
      [brick.velocityX, brick.nextVelocityX],
      [brick.velocityY, brick.nextVelocityY],
      [brick.velocityZ, brick.nextVelocityZ],
    ];
    for (const [source, target] of fields) {
      shiftSmokeVolumeField3D(source, target, shiftX, shiftY, shiftZ);
      source.set(target);
    }
  }

  private injectSources(
    brick: SmokeVolumeBrick3D,
    sources: readonly SmokeTipSource3D[],
    dt: number
  ): void {
    for (const source of sources) {
      const previous = this.previousPositions.get(source.sourceId) ?? {
        x: source.position.x - source.velocity.x * dt,
        y: source.position.y - source.velocity.y * dt,
        z: source.position.z - source.velocity.z * dt,
      };
      const distance = Math.hypot(
        source.position.x - previous.x,
        source.position.y - previous.y,
        source.position.z - previous.z
      );
      const cellWorld =
        (BRICK_HALF_EXTENT.x * 2) / (SMOKE_VOLUME_BRICK_SIZE - 1);
      const samples = clamp(Math.ceil(distance / (cellWorld * 0.55)), 1, 10);
      for (let sample = 0; sample <= samples; sample++) {
        const t = sample / samples;
        this.splat(
          brick,
          source,
          {
            x: previous.x + (source.position.x - previous.x) * t,
            y: previous.y + (source.position.y - previous.y) * t,
            z: previous.z + (source.position.z - previous.z) * t,
          },
          dt / (samples + 1)
        );
      }
    }
  }

  private splat(
    brick: SmokeVolumeBrick3D,
    source: SmokeTipSource3D,
    position: SceneEffectVector3,
    dt: number
  ): void {
    const params = source.params;
    const profile = params.volumeProfile;
    const speedScalar =
      params.motionReferenceSpeed > 0
        ? Math.min(1, source.speed / params.motionReferenceSpeed)
        : 0;
    // Particle spawn rates are counts-per-second, not a fluid-density unit.
    // Normalize the intent here so four tracked staff points build a readable
    // wake instead of saturating the entire performer brick in a few seconds.
    const sourceEnergy =
      params.ambientEmission + params.motionEmission * speedScalar;
    const amount =
      VOLUME_SOURCE_GAIN *
      profile.density *
      (0.32 + params.intensity * 0.68) *
      (0.65 + sourceEnergy * 3.2) *
      dt;
    const temperatureAmount =
      profile.temperature * (0.45 + params.resolvedRiseSpeed * 0.35) * dt;
    const size = SMOKE_VOLUME_BRICK_SIZE;
    const gx =
      ((position.x - (brick.center.x - BRICK_HALF_EXTENT.x)) /
        (BRICK_HALF_EXTENT.x * 2)) *
      (size - 1);
    const gy =
      ((position.y - (brick.center.y - BRICK_HALF_EXTENT.y)) /
        (BRICK_HALF_EXTENT.y * 2)) *
      (size - 1);
    const gz =
      ((position.z - (brick.center.z - BRICK_HALF_EXTENT.z)) /
        (BRICK_HALF_EXTENT.z * 2)) *
      (size - 1);
    if (gx < 0 || gy < 0 || gz < 0 || gx >= size || gy >= size || gz >= size)
      return;

    const radiusWorld =
      profile.injectionRadiusWorld * (0.72 + params.intensity * 1.2);
    const radius = Math.max(
      1,
      radiusWorld / ((BRICK_HALF_EXTENT.x * 2) / (size - 1))
    );
    const reach = Math.max(1, Math.ceil(radius * 1.7));
    const lateralAngle =
      deterministicUnit(source.sourceId, this.stepIndex) * Math.PI * 2;
    const lateralX = Math.cos(lateralAngle) * profile.lateralSpread;
    const lateralZ = Math.sin(lateralAngle) * profile.lateralSpread;

    for (
      let z = Math.max(1, Math.floor(gz) - reach);
      z <= Math.min(size - 2, Math.ceil(gz) + reach);
      z++
    ) {
      for (
        let y = Math.max(1, Math.floor(gy) - reach);
        y <= Math.min(size - 2, Math.ceil(gy) + reach);
        y++
      ) {
        for (
          let x = Math.max(1, Math.floor(gx) - reach);
          x <= Math.min(size - 2, Math.ceil(gx) + reach);
          x++
        ) {
          const ox = (x - gx) / radius;
          const oy = (y - gy) / radius;
          const oz = (z - gz) / radius;
          const distanceSquared = ox * ox + oy * oy + oz * oz;
          if (distanceSquared > 3) continue;
          const weight = Math.exp(-distanceSquared * 1.35);
          const index = voxelIndex(x, y, z);
          brick.density[index] = Math.min(
            5,
            brick.density[index]! + amount * weight
          );
          brick.temperature[index] = Math.min(
            3,
            brick.temperature[index]! + temperatureAmount * weight
          );
          const radialLength = Math.hypot(ox, oy, oz) || 1;
          const expansion = profile.expansion * weight * dt;
          brick.velocityX[index]! +=
            (source.velocity.x * 0.13 +
              lateralX +
              (ox / radialLength) * profile.expansion) *
            weight *
            dt;
          brick.velocityY[index]! +=
            (source.velocity.y * 0.08 +
              params.resolvedRiseSpeed * 0.34 +
              (oy / radialLength) * profile.expansion) *
            weight *
            dt;
          brick.velocityZ[index]! +=
            (source.velocity.z * 0.13 +
              lateralZ +
              (oz / radialLength) * profile.expansion) *
            weight *
            dt;
          brick.velocityX[index]! += (ox / radialLength) * expansion;
          brick.velocityZ[index]! += (oz / radialLength) * expansion;
        }
      }
    }
  }

  private simulateBrick(brick: SmokeVolumeBrick3D, dt: number): void {
    this.advect(brick, dt);
    this.applyForces(brick, dt);
    this.project(brick);
  }

  private advect(brick: SmokeVolumeBrick3D, dt: number): void {
    const size = SMOKE_VOLUME_BRICK_SIZE;
    const cellX = (BRICK_HALF_EXTENT.x * 2) / (size - 1);
    const cellY = (BRICK_HALF_EXTENT.y * 2) / (size - 1);
    const cellZ = (BRICK_HALF_EXTENT.z * 2) / (size - 1);
    const densityDecay = Math.exp(-brick.params.volumeProfile.dissipation * dt);
    const temperatureDecay = Math.exp(
      -(brick.params.volumeProfile.dissipation + 0.22) * dt
    );
    const velocityDecay = Math.exp(-0.38 * dt);

    brick.nextDensity.fill(0);
    brick.nextTemperature.fill(0);
    brick.nextVelocityX.fill(0);
    brick.nextVelocityY.fill(0);
    brick.nextVelocityZ.fill(0);
    for (let z = 1; z < size - 1; z++) {
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          const index = voxelIndex(x, y, z);
          const backX = x - (brick.velocityX[index]! * dt) / cellX;
          const backY = y - (brick.velocityY[index]! * dt) / cellY;
          const backZ = z - (brick.velocityZ[index]! * dt) / cellZ;
          brick.nextDensity[index] =
            sampleField(brick.density, backX, backY, backZ) * densityDecay;
          brick.nextTemperature[index] =
            sampleField(brick.temperature, backX, backY, backZ) *
            temperatureDecay;
          brick.nextVelocityX[index] =
            sampleField(brick.velocityX, backX, backY, backZ) * velocityDecay;
          brick.nextVelocityY[index] =
            sampleField(brick.velocityY, backX, backY, backZ) * velocityDecay;
          brick.nextVelocityZ[index] =
            sampleField(brick.velocityZ, backX, backY, backZ) * velocityDecay;
        }
      }
    }
    [brick.density, brick.nextDensity] = [brick.nextDensity, brick.density];
    [brick.temperature, brick.nextTemperature] = [
      brick.nextTemperature,
      brick.temperature,
    ];
    [brick.velocityX, brick.nextVelocityX] = [
      brick.nextVelocityX,
      brick.velocityX,
    ];
    [brick.velocityY, brick.nextVelocityY] = [
      brick.nextVelocityY,
      brick.velocityY,
    ];
    [brick.velocityZ, brick.nextVelocityZ] = [
      brick.nextVelocityZ,
      brick.velocityZ,
    ];
  }

  private applyForces(brick: SmokeVolumeBrick3D, dt: number): void {
    const size = SMOKE_VOLUME_BRICK_SIZE;
    const profile = brick.params.volumeProfile;
    const h = (BRICK_HALF_EXTENT.x * 2) / (size - 1);
    brick.curlMagnitude.fill(0);
    for (let z = 1; z < size - 1; z++) {
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          const index = voxelIndex(x, y, z);
          const dVzDy =
            (brick.velocityZ[voxelIndex(x, y + 1, z)]! -
              brick.velocityZ[voxelIndex(x, y - 1, z)]!) /
            (2 * h);
          const dVyDz =
            (brick.velocityY[voxelIndex(x, y, z + 1)]! -
              brick.velocityY[voxelIndex(x, y, z - 1)]!) /
            (2 * h);
          const dVxDz =
            (brick.velocityX[voxelIndex(x, y, z + 1)]! -
              brick.velocityX[voxelIndex(x, y, z - 1)]!) /
            (2 * h);
          const dVzDx =
            (brick.velocityZ[voxelIndex(x + 1, y, z)]! -
              brick.velocityZ[voxelIndex(x - 1, y, z)]!) /
            (2 * h);
          const dVyDx =
            (brick.velocityY[voxelIndex(x + 1, y, z)]! -
              brick.velocityY[voxelIndex(x - 1, y, z)]!) /
            (2 * h);
          const dVxDy =
            (brick.velocityX[voxelIndex(x, y + 1, z)]! -
              brick.velocityX[voxelIndex(x, y - 1, z)]!) /
            (2 * h);
          const curlX = dVzDy - dVyDz;
          const curlY = dVxDz - dVzDx;
          const curlZ = dVyDx - dVxDy;
          brick.curlX[index] = curlX;
          brick.curlY[index] = curlY;
          brick.curlZ[index] = curlZ;
          brick.curlMagnitude[index] = Math.hypot(curlX, curlY, curlZ);
        }
      }
    }

    const confinement =
      profile.vorticity * (0.25 + brick.params.resolvedCurlStrength * 1.25);
    for (let z = 2; z < size - 2; z++) {
      for (let y = 2; y < size - 2; y++) {
        for (let x = 2; x < size - 2; x++) {
          const index = voxelIndex(x, y, z);
          let nx =
            brick.curlMagnitude[voxelIndex(x + 1, y, z)]! -
            brick.curlMagnitude[voxelIndex(x - 1, y, z)]!;
          let ny =
            brick.curlMagnitude[voxelIndex(x, y + 1, z)]! -
            brick.curlMagnitude[voxelIndex(x, y - 1, z)]!;
          let nz =
            brick.curlMagnitude[voxelIndex(x, y, z + 1)]! -
            brick.curlMagnitude[voxelIndex(x, y, z - 1)]!;
          const length = Math.hypot(nx, ny, nz) + EPSILON;
          nx /= length;
          ny /= length;
          nz /= length;
          const curlX = brick.curlX[index]!;
          const curlY = brick.curlY[index]!;
          const curlZ = brick.curlZ[index]!;
          brick.velocityX[index]! +=
            (ny * curlZ - nz * curlY) * confinement * dt;
          brick.velocityY[index]! +=
            (nz * curlX - nx * curlZ) * confinement * dt +
            brick.temperature[index]! *
              profile.temperature *
              (0.55 + brick.params.riseSpeed) *
              dt;
          brick.velocityZ[index]! +=
            (nx * curlY - ny * curlX) * confinement * dt;
        }
      }
    }
  }

  private project(brick: SmokeVolumeBrick3D): void {
    const size = SMOKE_VOLUME_BRICK_SIZE;
    const h = (BRICK_HALF_EXTENT.x * 2) / (size - 1);
    brick.divergence.fill(0);
    brick.pressure.fill(0);
    brick.maxDivergence = 0;
    for (let z = 1; z < size - 1; z++) {
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          const index = voxelIndex(x, y, z);
          const divergence =
            (brick.velocityX[voxelIndex(x + 1, y, z)]! -
              brick.velocityX[voxelIndex(x - 1, y, z)]! +
              brick.velocityY[voxelIndex(x, y + 1, z)]! -
              brick.velocityY[voxelIndex(x, y - 1, z)]! +
              brick.velocityZ[voxelIndex(x, y, z + 1)]! -
              brick.velocityZ[voxelIndex(x, y, z - 1)]!) /
            (2 * h);
          brick.divergence[index] = divergence;
          brick.maxDivergence = Math.max(
            brick.maxDivergence,
            Math.abs(divergence)
          );
        }
      }
    }

    for (let iteration = 0; iteration < PRESSURE_ITERATIONS; iteration++) {
      brick.nextPressure.fill(0);
      for (let z = 1; z < size - 1; z++) {
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const index = voxelIndex(x, y, z);
            brick.nextPressure[index] =
              (brick.pressure[voxelIndex(x + 1, y, z)]! +
                brick.pressure[voxelIndex(x - 1, y, z)]! +
                brick.pressure[voxelIndex(x, y + 1, z)]! +
                brick.pressure[voxelIndex(x, y - 1, z)]! +
                brick.pressure[voxelIndex(x, y, z + 1)]! +
                brick.pressure[voxelIndex(x, y, z - 1)]! -
                brick.divergence[index]! * h * h) /
              6;
          }
        }
      }
      [brick.pressure, brick.nextPressure] = [
        brick.nextPressure,
        brick.pressure,
      ];
    }

    for (let z = 1; z < size - 1; z++) {
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          const index = voxelIndex(x, y, z);
          brick.velocityX[index]! -=
            (brick.pressure[voxelIndex(x + 1, y, z)]! -
              brick.pressure[voxelIndex(x - 1, y, z)]!) /
            (2 * h);
          brick.velocityY[index]! -=
            (brick.pressure[voxelIndex(x, y + 1, z)]! -
              brick.pressure[voxelIndex(x, y - 1, z)]!) /
            (2 * h);
          brick.velocityZ[index]! -=
            (brick.pressure[voxelIndex(x, y, z + 1)]! -
              brick.pressure[voxelIndex(x, y, z - 1)]!) /
            (2 * h);
        }
      }
    }
    brick.maxDivergence = 0;
    for (let z = 1; z < size - 1; z++) {
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          const divergence =
            (brick.velocityX[voxelIndex(x + 1, y, z)]! -
              brick.velocityX[voxelIndex(x - 1, y, z)]! +
              brick.velocityY[voxelIndex(x, y + 1, z)]! -
              brick.velocityY[voxelIndex(x, y - 1, z)]! +
              brick.velocityZ[voxelIndex(x, y, z + 1)]! -
              brick.velocityZ[voxelIndex(x, y, z - 1)]!) /
            (2 * h);
          brick.maxDivergence = Math.max(
            brick.maxDivergence,
            Math.abs(divergence)
          );
        }
      }
    }
  }

  private packAtlas(): void {
    this.atlasData.fill(0);
    const brickSize = SMOKE_VOLUME_BRICK_SIZE;
    const atlasStrideY = this.atlasEdge;
    const atlasStrideZ = this.atlasEdge ** 2;
    for (const brick of this.bricks.values()) {
      const brickX = brick.slot % ATLAS_EDGE_BRICKS;
      const brickY =
        Math.floor(brick.slot / ATLAS_EDGE_BRICKS) % ATLAS_EDGE_BRICKS;
      const brickZ = Math.floor(brick.slot / ATLAS_EDGE_BRICKS ** 2);
      for (let z = 0; z < brickSize; z++) {
        for (let y = 0; y < brickSize; y++) {
          for (let x = 0; x < brickSize; x++) {
            const density = brick.density[voxelIndex(x, y, z)]!;
            const encoded = Math.round(
              (1 - Math.exp(-Math.max(0, density) * 0.8)) * 255
            );
            const atlasX = brickX * brickSize + x;
            const atlasY = brickY * brickSize + y;
            const atlasZ = brickZ * brickSize + z;
            this.atlasData[
              atlasX + atlasY * atlasStrideY + atlasZ * atlasStrideZ
            ] = encoded;
          }
        }
      }
    }
    this.texture.needsUpdate = true;
  }
}
