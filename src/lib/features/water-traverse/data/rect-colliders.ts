/**
 * Rect → Rapier box maths, shared by every Water graybox.
 *
 * This was inline in the traverse route until the grotto needed the same
 * thing. The ramp case in particular is not worth deriving twice: a sloped
 * floor becomes a rotated slab sunk along its OWN normal, and getting that
 * wrong leaves the visitor's feet floating a few centimetres above the visible
 * slope — which is exactly what happened the first time.
 */

export interface WorldRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export type FloorKind = "flat" | "ramp-z";

export interface FloorRect {
  id: string;
  rect: WorldRect;
  kind: FloorKind;
  /** Elevation at minZ. */
  fromY: number;
  /** Elevation at maxZ. Equal to fromY when kind is "flat". */
  toY: number;
}

export interface WallRect {
  id: string;
  rect: WorldRect;
  baseY: number;
  topY: number;
}

export interface RectCollider {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  /** Quaternion. Present only for ramp slabs. */
  rotation?: { x: number; y: number; z: number; w: number };
}

/** Slab thickness for floors. Deep enough that nothing tunnels through it. */
export const FLOOR_THICKNESS = 1.2;

export function centre(r: WorldRect): { x: number; z: number } {
  return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
}

export function spanX(r: WorldRect): number {
  return r.maxX - r.minX;
}

export function spanZ(r: WorldRect): number {
  return r.maxZ - r.minZ;
}

/** Rotation about X by `angle`, as a quaternion. */
function pitchQuaternion(angle: number): {
  x: number;
  y: number;
  z: number;
  w: number;
} {
  return { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) };
}

export function floorCollider(floor: FloorRect): RectCollider {
  const c = centre(floor.rect);
  const width = spanX(floor.rect);
  const run = spanZ(floor.rect);

  if (floor.kind === "flat") {
    return {
      id: floor.id,
      position: [c.x, floor.fromY - FLOOR_THICKNESS / 2, c.z],
      size: [width, FLOOR_THICKNESS, run],
    };
  }

  const rise = floor.toY - floor.fromY;
  const length = Math.hypot(run, rise);
  // Rapier's +Z is the slab's own length axis. A positive rise as Z increases
  // means the far end is higher, which is a rotation of -atan2(rise, run)
  // about X.
  const pitch = -Math.atan2(rise, run);

  // Sink the slab along its OWN normal, not world -Y, so the walkable face
  // lands exactly on the authored slope.
  const normalY = run / length;
  const normalZ = -rise / length;

  return {
    id: floor.id,
    position: [
      c.x,
      (floor.fromY + floor.toY) / 2 - (normalY * FLOOR_THICKNESS) / 2,
      c.z - (normalZ * FLOOR_THICKNESS) / 2,
    ],
    size: [width, FLOOR_THICKNESS, length],
    rotation: pitchQuaternion(pitch),
  };
}

export function wallCollider(wall: WallRect): RectCollider {
  const c = centre(wall.rect);
  return {
    id: wall.id,
    position: [c.x, (wall.baseY + wall.topY) / 2, c.z],
    size: [spanX(wall.rect), wall.topY - wall.baseY, spanZ(wall.rect)],
  };
}

/** True when (x, z) lies inside the rect. */
export function contains(r: WorldRect, x: number, z: number): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/** Elevation of one floor rect at z. Ramps interpolate; flats are constant. */
export function floorRectYAt(floor: FloorRect, z: number): number {
  if (floor.kind === "flat") return floor.fromY;
  const run = spanZ(floor.rect);
  if (run <= 0) return floor.fromY;
  const t = Math.min(1, Math.max(0, (z - floor.rect.minZ) / run));
  return floor.fromY + (floor.toY - floor.fromY) * t;
}
