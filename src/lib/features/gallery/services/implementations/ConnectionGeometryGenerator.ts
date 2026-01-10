/**
 * ConnectionGeometryGenerator
 *
 * Generates physical corridor geometry to bridge gaps between rooms.
 *
 * This solves the "hallucinated museum" problem where rooms were defined
 * as isolated shapes with gaps between them. By calculating where each room's
 * edge actually is and generating corridor geometry to bridge those gaps,
 * we create architecturally coherent transitions.
 */

import type { Room } from "../../domain/models/Room";
import type { Doorway, DoorwayCorridor } from "../../domain/models/doorway";
import { createCorridor } from "../../domain/models/doorway";
import type { Point2D } from "../../domain/models/geometry";
import type { RectangularShape, CircularShape } from "../../domain/models/room-shapes";
import { getShapeCenter } from "../../domain/models/room-shapes";

export class ConnectionGeometryGenerator {
  /**
   * Generate corridor geometry for all doorways that need bridging
   */
  generateCorridors(
    rooms: readonly Room[],
    doorways: readonly Doorway[]
  ): DoorwayCorridor[] {
    const corridors: DoorwayCorridor[] = [];

    for (const doorway of doorways) {
      const roomA = rooms.find((r) => r.id === doorway.roomAId);
      const roomB = rooms.find((r) => r.id === doorway.roomBId);

      if (!roomA || !roomB) {
        console.warn(
          `[ConnectionGeometryGenerator] Doorway ${doorway.id} references missing room`
        );
        continue;
      }

      const corridor = this.generateCorridor(doorway, roomA, roomB);

      // Only add if there's actually a gap to bridge
      if (corridor) {
        const length = this.getCorridorLength(corridor);
        if (length >= 10) {
          corridors.push(corridor);
        }
      }
    }

    console.debug(
      `[ConnectionGeometryGenerator] Generated ${corridors.length} corridors from ${doorways.length} doorways`
    );

    return corridors;
  }

  /**
   * Generate a single corridor for a doorway between two rooms
   */
  generateCorridor(
    doorway: Doorway,
    roomA: Room,
    roomB: Room
  ): DoorwayCorridor | null {
    // Find where the doorway axis intersects each room's perimeter
    const startPoint = this.findRoomEdgePoint(doorway, roomA);
    const endPoint = this.findRoomEdgePoint(doorway, roomB);

    if (!startPoint || !endPoint) {
      console.warn(
        `[ConnectionGeometryGenerator] Could not find edge points for doorway ${doorway.id}`
      );
      return null;
    }

    return createCorridor(doorway, startPoint, endPoint);
  }

  /**
   * Find where the doorway's axis intersects a room's perimeter
   */
  findRoomEdgePoint(doorway: Doorway, room: Room): Point2D | null {
    const shape = room.shape;

    switch (shape.type) {
      case "circular":
        return this.findCircleEdgePoint(doorway, shape);
      case "rectangular":
        return this.findRectangleEdgePoint(doorway, shape);
      case "polygonal":
        // For polygonal shapes, use the doorway position directly
        // (more complex intersection would be needed for full support)
        return doorway.position;
    }
  }

  /**
   * Find where a ray from circle center through doorway intersects the circle edge
   */
  private findCircleEdgePoint(
    doorway: Doorway,
    shape: CircularShape
  ): Point2D {
    const center = shape.center;

    // Direction from circle center to doorway position
    const dx = doorway.position.x - center.x;
    const dz = doorway.position.z - center.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.001) {
      // Doorway is at center - use rotation to determine direction
      return {
        x: center.x + Math.sin(doorway.rotation) * shape.radius,
        z: center.z + Math.cos(doorway.rotation) * shape.radius,
      };
    }

    // Normalize and scale to radius
    return {
      x: center.x + (dx / dist) * shape.radius,
      z: center.z + (dz / dist) * shape.radius,
    };
  }

  /**
   * Find where a ray from rectangle center through doorway intersects the rectangle edge
   */
  private findRectangleEdgePoint(
    doorway: Doorway,
    shape: RectangularShape
  ): Point2D {
    const center = shape.center;
    const halfW = shape.width / 2;
    const halfD = shape.depth / 2;

    // Transform doorway position to local rectangle space
    const cos = Math.cos(-shape.rotation);
    const sin = Math.sin(-shape.rotation);
    const localDoorX = (doorway.position.x - center.x) * cos - (doorway.position.z - center.z) * sin;
    const localDoorZ = (doorway.position.x - center.x) * sin + (doorway.position.z - center.z) * cos;

    // Determine which edge the doorway is closest to
    let localEdgeX: number;
    let localEdgeZ: number;

    // Calculate parametric intersection with rectangle bounds
    // Ray from origin (center) through doorway position
    if (Math.abs(localDoorX) < 0.001 && Math.abs(localDoorZ) < 0.001) {
      // Doorway at center - use rotation to determine direction
      const localRayX = Math.sin(doorway.rotation - shape.rotation);
      const localRayZ = Math.cos(doorway.rotation - shape.rotation);

      if (Math.abs(localRayX) > Math.abs(localRayZ)) {
        // Primarily X direction
        localEdgeX = localRayX > 0 ? halfW : -halfW;
        localEdgeZ = (localEdgeX / localRayX) * localRayZ;
      } else {
        // Primarily Z direction
        localEdgeZ = localRayZ > 0 ? halfD : -halfD;
        localEdgeX = (localEdgeZ / localRayZ) * localRayX;
      }
    } else {
      // Calculate intersection with rectangle edges
      // We need to find where ray from (0,0) through (localDoorX, localDoorZ) hits the rectangle

      // Calculate t parameter for each edge
      const tRight = halfW / localDoorX; // Right edge (x = halfW)
      const tLeft = -halfW / localDoorX; // Left edge (x = -halfW)
      const tTop = halfD / localDoorZ; // Top edge (z = halfD)
      const tBottom = -halfD / localDoorZ; // Bottom edge (z = -halfD)

      // Find the smallest positive t that gives a valid intersection
      let tMin = Infinity;

      for (const t of [tRight, tLeft, tTop, tBottom]) {
        if (t > 0.001 && t < tMin) {
          const testX = localDoorX * t;
          const testZ = localDoorZ * t;

          // Check if point is on rectangle boundary (with small tolerance)
          if (
            testX >= -halfW - 1 &&
            testX <= halfW + 1 &&
            testZ >= -halfD - 1 &&
            testZ <= halfD + 1
          ) {
            tMin = t;
          }
        }
      }

      if (tMin === Infinity) {
        // Fallback: use closest edge point
        localEdgeX = Math.max(-halfW, Math.min(halfW, localDoorX));
        localEdgeZ = Math.max(-halfD, Math.min(halfD, localDoorZ));
      } else {
        localEdgeX = localDoorX * tMin;
        localEdgeZ = localDoorZ * tMin;
      }
    }

    // Clamp to edges
    localEdgeX = Math.max(-halfW, Math.min(halfW, localEdgeX));
    localEdgeZ = Math.max(-halfD, Math.min(halfD, localEdgeZ));

    // Transform back to world space
    const worldCos = Math.cos(shape.rotation);
    const worldSin = Math.sin(shape.rotation);

    return {
      x: center.x + localEdgeX * worldCos - localEdgeZ * worldSin,
      z: center.z + localEdgeX * worldSin + localEdgeZ * worldCos,
    };
  }

  /**
   * Calculate the length of a corridor
   */
  private getCorridorLength(corridor: DoorwayCorridor): number {
    const dx = corridor.endPoint.x - corridor.startPoint.x;
    const dz = corridor.endPoint.z - corridor.startPoint.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
