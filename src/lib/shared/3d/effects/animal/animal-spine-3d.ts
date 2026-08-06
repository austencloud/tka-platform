import type { AnimalIntent } from "$lib/shared/effects/domain/effects-config";

const EPSILON = 1e-8;
const IDLE_SPEED_START = 0.08;
const IDLE_SPEED_END = 0.72;
const GRAVITY_SETTLE_RATE = 4.2;
const GRAVITY_RELEASE_RATE = 9;

export interface AnimalSpineFrameBuffers3D {
  tangents: Float32Array;
  normals: Float32Array;
  binormals: Float32Array;
}

/**
 * A stopped prop leaves the creature suspended from one point. Its free tail
 * should settle under that point instead of preserving an arbitrary last
 * heading forever. The blend is deliberately slower on the way into rest and
 * faster on the way back out, so a new gesture immediately owns the silhouette.
 */
export function dampAnimalGravityBlend3D(
  current: number,
  speed: number,
  delta: number
): number {
  const target =
    1 - smoothstep(Math.max(0, speed), IDLE_SPEED_START, IDLE_SPEED_END);
  const rate = target > current ? GRAVITY_SETTLE_RATE : GRAVITY_RELEASE_RATE;
  const safeDelta = Math.max(0, delta);
  return target + (current - target) * Math.exp(-rate * safeDelta);
}

/**
 * Blends the recorded gesture toward the equilibrium of a chain hanging from
 * its head. At full rest every link remains exactly one spacing apart along
 * world-down; while settling, a forward distance projection keeps the body
 * from visibly stretching or collapsing.
 */
export function applyAnimalGravity3D(
  points: Float32Array,
  count: number,
  spacing: number,
  gravityBlend: number
): void {
  if (count < 2) return;
  const blend = clamp(gravityBlend, 0, 1);
  if (blend <= 0) return;

  const headX = points[0]!;
  const headY = points[1]!;
  const headZ = points[2]!;
  for (let segment = 1; segment < count; segment++) {
    const i3 = segment * 3;
    points[i3] += (headX - points[i3]!) * blend;
    points[i3 + 1] += (headY - spacing * segment - points[i3 + 1]!) * blend;
    points[i3 + 2] += (headZ - points[i3 + 2]!) * blend;
  }

  // The blend above changes the curve without preserving arc length. Re-pin
  // each link from head to tail so the animal keeps the authored body length.
  for (let segment = 1; segment < count; segment++) {
    const i3 = segment * 3;
    const previous = i3 - 3;
    let dx = points[i3]! - points[previous]!;
    let dy = points[i3 + 1]! - points[previous + 1]!;
    let dz = points[i3 + 2]! - points[previous + 2]!;
    const length = Math.hypot(dx, dy, dz);
    if (length < EPSILON) {
      dx = 0;
      dy = -1;
      dz = 0;
    } else {
      const inverseLength = 1 / length;
      dx *= inverseLength;
      dy *= inverseLength;
      dz *= inverseLength;
    }
    points[i3] = points[previous]! + dx * spacing;
    points[i3 + 1] = points[previous + 1]! + dy * spacing;
    points[i3 + 2] = points[previous + 2]! + dz * spacing;
  }
}

/**
 * The creature needs a stable notion of up and sideways along the whole body.
 * A Frenet frame can flip when a prop path straightens or crosses an inflection,
 * so the frame below carries the previous normal forward with the smallest
 * possible rotation. Crests, eyes, and legs therefore stay on the same side of
 * the animal instead of snapping around its spine.
 */
export function writeAnimalRotationMinimizingFrames3D(
  points: Float32Array,
  count: number,
  buffers: AnimalSpineFrameBuffers3D
): void {
  if (count < 2) return;

  const { tangents, normals, binormals } = buffers;
  writeTangents(points, count, tangents);

  const tx = tangents[0]!;
  const ty = tangents[1]!;
  const tz = tangents[2]!;
  let nx = -tx * ty;
  let ny = 1 - ty * ty;
  let nz = -tz * ty;
  let normalLength = Math.hypot(nx, ny, nz);
  if (normalLength < EPSILON) {
    nx = 1 - tx * tx;
    ny = -tx * ty;
    nz = -tx * tz;
    normalLength = Math.hypot(nx, ny, nz);
  }
  const inverseNormalLength = normalLength > EPSILON ? 1 / normalLength : 1;
  nx *= inverseNormalLength;
  ny *= inverseNormalLength;
  nz *= inverseNormalLength;
  normals[0] = nx;
  normals[1] = ny;
  normals[2] = nz;
  writeBinormal(tangents, normals, binormals, 0);

  for (let segment = 1; segment < count; segment++) {
    const i3 = segment * 3;
    const previous = i3 - 3;
    const ptx = tangents[previous]!;
    const pty = tangents[previous + 1]!;
    const ptz = tangents[previous + 2]!;
    const ctx = tangents[i3]!;
    const cty = tangents[i3 + 1]!;
    const ctz = tangents[i3 + 2]!;

    let axisX = pty * ctz - ptz * cty;
    let axisY = ptz * ctx - ptx * ctz;
    let axisZ = ptx * cty - pty * ctx;
    const sinAngle = Math.hypot(axisX, axisY, axisZ);
    const cosAngle = clamp(ptx * ctx + pty * cty + ptz * ctz, -1, 1);

    nx = normals[previous]!;
    ny = normals[previous + 1]!;
    nz = normals[previous + 2]!;

    if (sinAngle > EPSILON) {
      const inverseAxisLength = 1 / sinAngle;
      axisX *= inverseAxisLength;
      axisY *= inverseAxisLength;
      axisZ *= inverseAxisLength;
      const crossX = axisY * nz - axisZ * ny;
      const crossY = axisZ * nx - axisX * nz;
      const crossZ = axisX * ny - axisY * nx;
      const axisDotNormal = axisX * nx + axisY * ny + axisZ * nz;
      const oneMinusCos = 1 - cosAngle;
      nx =
        nx * cosAngle + crossX * sinAngle + axisX * axisDotNormal * oneMinusCos;
      ny =
        ny * cosAngle + crossY * sinAngle + axisY * axisDotNormal * oneMinusCos;
      nz =
        nz * cosAngle + crossZ * sinAngle + axisZ * axisDotNormal * oneMinusCos;
    } else if (cosAngle < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }

    const alongTangent = nx * ctx + ny * cty + nz * ctz;
    nx -= ctx * alongTangent;
    ny -= cty * alongTangent;
    nz -= ctz * alongTangent;
    normalLength = Math.hypot(nx, ny, nz);
    if (normalLength < EPSILON) {
      nx = normals[previous]!;
      ny = normals[previous + 1]!;
      nz = normals[previous + 2]!;
      normalLength = Math.hypot(nx, ny, nz);
    }
    const inverseLength = normalLength > EPSILON ? 1 / normalLength : 1;
    normals[i3] = nx * inverseLength;
    normals[i3 + 1] = ny * inverseLength;
    normals[i3 + 2] = nz * inverseLength;
    writeBinormal(tangents, normals, binormals, segment);
  }
}

/**
 * Adds a travelling two-harmonic wave without moving the head off the prop.
 * The second axis gives the body a small rolling motion, so the animal reads as
 * a volume in wheel, wall, and floor planes instead of a flat sine ribbon.
 */
export function applyAnimalSlither3D(
  points: Float32Array,
  count: number,
  buffers: AnimalSpineFrameBuffers3D,
  clock: number,
  spacing: number,
  amplitude: number,
  speedRatio: number
): void {
  const activity = smoothstep(speedRatio, 0.02, 0.34);
  if (activity <= 0) return;
  const phaseSpeed = 3.2 + speedRatio * 2.1;
  for (let segment = 1; segment < count; segment++) {
    const i3 = segment * 3;
    const progress = segment / (count - 1);
    const ramp = Math.pow(progress, 1.3);
    const phase = segment * spacing * 3.7 - clock * phaseSpeed;
    const lateralWave =
      (Math.sin(phase) + 0.22 * Math.sin(phase * 2.1 + 0.7)) *
      amplitude *
      ramp *
      activity;
    const rollWave =
      Math.sin(phase * 0.71 + 1.2) * amplitude * 0.22 * ramp * activity;
    points[i3] +=
      buffers.binormals[i3]! * lateralWave + buffers.normals[i3]! * rollWave;
    points[i3 + 1] +=
      buffers.binormals[i3 + 1]! * lateralWave +
      buffers.normals[i3 + 1]! * rollWave;
    points[i3 + 2] +=
      buffers.binormals[i3 + 2]! * lateralWave +
      buffers.normals[i3 + 2]! * rollWave;
  }
}

export function animalBodyRadiusProfile(
  creature: AnimalIntent["creature"],
  progress: number
): number {
  const u = clamp(progress, 0, 1);
  if (creature === "caterpillar") {
    if (u < 0.08) return 0.72 + (u / 0.08) * 0.28;
    const tail = (u - 0.08) / 0.92;
    return Math.max(0.18, Math.sqrt(Math.max(0, 1 - tail ** 4)));
  }
  if (u < 0.075) return 0.72 + (u / 0.075) * 0.28;
  const tail = (u - 0.075) / 0.925;
  return Math.max(0.1, 1 - tail * tail * 0.92);
}

export function animalBuildMultiplier(
  creature: AnimalIntent["creature"]
): number {
  if (creature === "caterpillar") return 1.28;
  if (creature === "dragon") return 1.12;
  return 1;
}

function writeTangents(
  points: Float32Array,
  count: number,
  tangents: Float32Array
): void {
  for (let segment = 0; segment < count; segment++) {
    const i3 = segment * 3;
    const towardHead = Math.max(0, segment - 1) * 3;
    const towardTail = Math.min(count - 1, segment + 1) * 3;
    let tx = points[towardHead]! - points[towardTail]!;
    let ty = points[towardHead + 1]! - points[towardTail + 1]!;
    let tz = points[towardHead + 2]! - points[towardTail + 2]!;
    const length = Math.hypot(tx, ty, tz);
    if (length < EPSILON && segment > 0) {
      tx = tangents[i3 - 3]!;
      ty = tangents[i3 - 2]!;
      tz = tangents[i3 - 1]!;
    } else if (length < EPSILON) {
      tx = 1;
      ty = 0;
      tz = 0;
    } else {
      const inverseLength = 1 / length;
      tx *= inverseLength;
      ty *= inverseLength;
      tz *= inverseLength;
    }
    tangents[i3] = tx;
    tangents[i3 + 1] = ty;
    tangents[i3 + 2] = tz;
  }
}

function writeBinormal(
  tangents: Float32Array,
  normals: Float32Array,
  binormals: Float32Array,
  segment: number
): void {
  const i3 = segment * 3;
  const tx = tangents[i3]!;
  const ty = tangents[i3 + 1]!;
  const tz = tangents[i3 + 2]!;
  const nx = normals[i3]!;
  const ny = normals[i3 + 1]!;
  const nz = normals[i3 + 2]!;
  let bx = ty * nz - tz * ny;
  let by = tz * nx - tx * nz;
  let bz = tx * ny - ty * nx;
  const length = Math.hypot(bx, by, bz);
  const inverseLength = length > EPSILON ? 1 / length : 1;
  bx *= inverseLength;
  by *= inverseLength;
  bz *= inverseLength;
  binormals[i3] = bx;
  binormals[i3 + 1] = by;
  binormals[i3 + 2] = bz;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number, min: number, max: number): number {
  const amount = clamp((value - min) / (max - min), 0, 1);
  return amount * amount * (3 - 2 * amount);
}
