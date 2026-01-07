/**
 * CollisionResolver
 *
 * Handles collision detection and response for player movement.
 * Uses room-based spatial partitioning for efficient collision checks.
 */

import { injectable } from "inversify";
import type { Point2D } from "../../domain/models/geometry";
import type { CollisionWorld, WallCollider } from "../../domain/models/WallCollider";
import {
  findDeepestCollision,
  resolveCollision,
  getWallsForRooms,
} from "../../domain/models/WallCollider";
import type { RoomGraph } from "../../domain/models/RoomGraph";
import {
  findRoomAtPointWithHint,
  getRoomWithNeighbors,
} from "../../domain/models/RoomGraph";

// =============================================================================
// Types
// =============================================================================

export interface MovementResult {
  /** Final valid position after collision resolution */
  position: Point2D;
  /** ID of the room the player is now in */
  currentRoomId: string;
  /** Whether any collision occurred */
  collided: boolean;
}

// =============================================================================
// Service
// =============================================================================

@injectable()
export class CollisionResolver {
  /**
   * Resolve player movement with wall collision
   *
   * @param from Current position
   * @param to Desired position
   * @param currentRoomId ID of room player is currently in
   * @param collisionWorld The collision world
   * @param roomGraph The room graph for spatial queries
   * @returns The valid final position and room
   */
  resolveMovement(
    from: Point2D,
    to: Point2D,
    currentRoomId: string,
    collisionWorld: CollisionWorld,
    roomGraph: RoomGraph
  ): MovementResult {
    // Get walls from current room and adjacent rooms
    const relevantRooms = getRoomWithNeighbors(roomGraph, currentRoomId);
    const roomIds = relevantRooms.map((r) => r.room.id);
    const walls = getWallsForRooms(collisionWorld, roomIds);

    // Resolve collisions iteratively
    let position = { ...to };
    let collided = false;
    const maxIterations = 4;

    for (let i = 0; i < maxIterations; i++) {
      const collision = findDeepestCollision(
        position,
        collisionWorld.playerRadius,
        walls
      );

      if (!collision) {
        break;
      }

      collided = true;
      position = resolveCollision(position, collision);
    }

    // Determine which room the player is now in
    const roomNode = findRoomAtPointWithHint(roomGraph, position, currentRoomId);
    const newRoomId = roomNode?.room.id ?? currentRoomId;

    return {
      position,
      currentRoomId: newRoomId,
      collided,
    };
  }

  /**
   * Check if a position is valid (not inside any wall)
   */
  isPositionValid(
    position: Point2D,
    currentRoomId: string,
    collisionWorld: CollisionWorld,
    roomGraph: RoomGraph
  ): boolean {
    const relevantRooms = getRoomWithNeighbors(roomGraph, currentRoomId);
    const roomIds = relevantRooms.map((r) => r.room.id);
    const walls = getWallsForRooms(collisionWorld, roomIds);

    const collision = findDeepestCollision(
      position,
      collisionWorld.playerRadius,
      walls
    );

    return collision === null;
  }

  /**
   * Find the nearest valid position to a given point
   * Useful for placing the player after teleportation
   */
  findNearestValidPosition(
    position: Point2D,
    currentRoomId: string,
    collisionWorld: CollisionWorld,
    roomGraph: RoomGraph
  ): Point2D {
    // Use the movement resolver starting from the same point
    const result = this.resolveMovement(
      position,
      position,
      currentRoomId,
      collisionWorld,
      roomGraph
    );
    return result.position;
  }

  /**
   * Slide movement along a wall when hitting it at an angle
   * This creates smooth wall-sliding behavior
   */
  slideAlongWall(
    from: Point2D,
    to: Point2D,
    currentRoomId: string,
    collisionWorld: CollisionWorld,
    roomGraph: RoomGraph
  ): MovementResult {
    // Try the full movement first
    const result = this.resolveMovement(
      from,
      to,
      currentRoomId,
      collisionWorld,
      roomGraph
    );

    if (!result.collided) {
      return result;
    }

    // If we collided, try sliding along X and Z separately
    const dx = to.x - from.x;
    const dz = to.z - from.z;

    // Try moving along X only
    const xResult = this.resolveMovement(
      from,
      { x: to.x, z: from.z },
      currentRoomId,
      collisionWorld,
      roomGraph
    );

    // Try moving along Z only
    const zResult = this.resolveMovement(
      from,
      { x: from.x, z: to.z },
      currentRoomId,
      collisionWorld,
      roomGraph
    );

    // Choose the movement that gets us closest to the target
    const distToTarget = (p: Point2D) => {
      const tdx = to.x - p.x;
      const tdz = to.z - p.z;
      return tdx * tdx + tdz * tdz;
    };

    const fullDist = distToTarget(result.position);
    const xDist = distToTarget(xResult.position);
    const zDist = distToTarget(zResult.position);

    // Return the best result
    if (fullDist <= xDist && fullDist <= zDist) {
      return result;
    } else if (xDist <= zDist) {
      return xResult;
    } else {
      return zResult;
    }
  }
}
