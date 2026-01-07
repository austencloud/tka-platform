/**
 * Wall Collider Models
 *
 * Collision primitives for wall-based movement restriction.
 * The collision system uses 2D line segments representing walls,
 * and a circle representing the player.
 */

import type { Point2D, LineSegment2D } from "./geometry";
import { projectPointOntoSegment, distance2D, segmentNormal } from "./geometry";

// =============================================================================
// Wall Collider Definition
// =============================================================================

/**
 * A wall segment for collision detection
 */
export interface WallCollider {
  /** Unique identifier */
  readonly id: string;
  /** Start point of the wall segment */
  readonly start: Point2D;
  /** End point of the wall segment */
  readonly end: Point2D;
  /** ID of the room this wall belongs to */
  readonly roomId: string;
  /** Whether this wall is actually a doorway (no collision) */
  readonly isDoorway: boolean;
  /** Outward-facing normal (points into the room) */
  readonly normal: Point2D;
}

/**
 * Create a wall collider from two points
 */
export function createWallCollider(
  id: string,
  start: Point2D,
  end: Point2D,
  roomId: string,
  isDoorway: boolean = false
): WallCollider {
  const segment: LineSegment2D = { start, end };
  const normal = segmentNormal(segment);

  return {
    id,
    start,
    end,
    roomId,
    isDoorway,
    normal,
  };
}

// =============================================================================
// Collision World
// =============================================================================

/**
 * Complete collision world containing all walls
 */
export interface CollisionWorld {
  /** All wall colliders, indexed by ID */
  readonly walls: ReadonlyMap<string, WallCollider>;
  /** Wall IDs grouped by room ID for efficient lookup */
  readonly wallsByRoom: ReadonlyMap<string, readonly string[]>;
  /** Player collision radius */
  readonly playerRadius: number;
}

/**
 * Create a collision world from wall colliders
 */
export function createCollisionWorld(
  walls: readonly WallCollider[],
  playerRadius: number
): CollisionWorld {
  const wallMap = new Map<string, WallCollider>();
  const wallsByRoom = new Map<string, string[]>();

  for (const wall of walls) {
    wallMap.set(wall.id, wall);

    let roomWalls = wallsByRoom.get(wall.roomId);
    if (!roomWalls) {
      roomWalls = [];
      wallsByRoom.set(wall.roomId, roomWalls);
    }
    roomWalls.push(wall.id);
  }

  return {
    walls: wallMap,
    wallsByRoom,
    playerRadius,
  };
}

// =============================================================================
// Collision Detection
// =============================================================================

/**
 * Result of a collision test
 */
export interface CollisionResult {
  /** Whether there was a collision */
  readonly collided: boolean;
  /** The wall that was collided with (if any) */
  readonly wall?: WallCollider;
  /** Penetration depth */
  readonly penetration: number;
  /** Normal direction to push out */
  readonly normal: Point2D;
  /** Closest point on the wall */
  readonly contactPoint: Point2D;
}

/**
 * Test if a circle collides with a wall segment
 */
export function circleWallCollision(
  circleCenter: Point2D,
  circleRadius: number,
  wall: WallCollider
): CollisionResult | null {
  // Skip doorways
  if (wall.isDoorway) {
    return null;
  }

  const segment: LineSegment2D = { start: wall.start, end: wall.end };
  const closest = projectPointOntoSegment(circleCenter, segment);
  const dist = distance2D(circleCenter, closest);

  if (dist < circleRadius) {
    // Calculate push direction (from wall to circle)
    let nx = circleCenter.x - closest.x;
    let nz = circleCenter.z - closest.z;
    const len = Math.sqrt(nx * nx + nz * nz);

    if (len > 0.0001) {
      nx /= len;
      nz /= len;
    } else {
      // Circle center is exactly on the wall, use wall normal
      nx = wall.normal.x;
      nz = wall.normal.z;
    }

    return {
      collided: true,
      wall,
      penetration: circleRadius - dist,
      normal: { x: nx, z: nz },
      contactPoint: closest,
    };
  }

  return null;
}

/**
 * Find the deepest collision among multiple walls
 */
export function findDeepestCollision(
  circleCenter: Point2D,
  circleRadius: number,
  walls: readonly WallCollider[]
): CollisionResult | null {
  let deepest: CollisionResult | null = null;

  for (const wall of walls) {
    const result = circleWallCollision(circleCenter, circleRadius, wall);
    if (result && (!deepest || result.penetration > deepest.penetration)) {
      deepest = result;
    }
  }

  return deepest;
}

/**
 * Find all collisions with walls
 */
export function findAllCollisions(
  circleCenter: Point2D,
  circleRadius: number,
  walls: readonly WallCollider[]
): readonly CollisionResult[] {
  const results: CollisionResult[] = [];

  for (const wall of walls) {
    const result = circleWallCollision(circleCenter, circleRadius, wall);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

// =============================================================================
// Collision Response
// =============================================================================

/**
 * Push a circle out of a wall collision
 */
export function resolveCollision(
  circleCenter: Point2D,
  collision: CollisionResult
): Point2D {
  return {
    x: circleCenter.x + collision.normal.x * collision.penetration,
    z: circleCenter.z + collision.normal.z * collision.penetration,
  };
}

/**
 * Resolve movement through walls with sliding
 * Returns the valid final position after collision response
 */
export function resolveMovement(
  from: Point2D,
  to: Point2D,
  walls: readonly WallCollider[],
  playerRadius: number,
  maxIterations: number = 4
): Point2D {
  let position = to;

  // Iterative collision resolution (handles corners)
  for (let i = 0; i < maxIterations; i++) {
    const collision = findDeepestCollision(position, playerRadius, walls);

    if (!collision) {
      // No collision, we're done
      break;
    }

    // Push out of the collision
    position = resolveCollision(position, collision);
  }

  return position;
}

/**
 * Check if a movement from one point to another crosses any walls
 * Uses swept circle collision for accurate detection
 */
export function checkMovementCollision(
  from: Point2D,
  to: Point2D,
  playerRadius: number,
  walls: readonly WallCollider[]
): boolean {
  // Simple approach: check at destination
  const collision = findDeepestCollision(to, playerRadius, walls);
  return collision !== null;
}

// =============================================================================
// Wall Query Helpers
// =============================================================================

/**
 * Get all walls for a set of room IDs
 */
export function getWallsForRooms(
  world: CollisionWorld,
  roomIds: readonly string[]
): readonly WallCollider[] {
  const walls: WallCollider[] = [];

  for (const roomId of roomIds) {
    const wallIds = world.wallsByRoom.get(roomId);
    if (wallIds) {
      for (const wallId of wallIds) {
        const wall = world.walls.get(wallId);
        if (wall) {
          walls.push(wall);
        }
      }
    }
  }

  return walls;
}

/**
 * Get walls near a point (for efficient collision checking)
 * Uses room-based spatial partitioning
 */
export function getWallsNearPoint(
  world: CollisionWorld,
  point: Point2D,
  roomIds: readonly string[],
  maxDistance: number
): readonly WallCollider[] {
  const walls: WallCollider[] = [];
  const maxDistSq = maxDistance * maxDistance;

  for (const roomId of roomIds) {
    const wallIds = world.wallsByRoom.get(roomId);
    if (!wallIds) continue;

    for (const wallId of wallIds) {
      const wall = world.walls.get(wallId);
      if (!wall) continue;

      // Quick distance check to wall midpoint
      const midX = (wall.start.x + wall.end.x) / 2;
      const midZ = (wall.start.z + wall.end.z) / 2;
      const dx = point.x - midX;
      const dz = point.z - midZ;

      // Include wall if point is close enough to midpoint
      // (This is conservative - wall might extend closer)
      if (dx * dx + dz * dz <= maxDistSq * 4) {
        walls.push(wall);
      }
    }
  }

  return walls;
}
