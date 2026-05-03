/**
 * Corridor Router
 *
 * Routes L-shaped corridors between connected rooms. Given two placed rooms
 * and the edge describing their connection (which walls the doors are on),
 * computes door positions and returns corridor segments that connect them.
 *
 * Corridors always route as up to 3 segments (two straight runs + one turn),
 * using the midpoint between doors as the elbow.
 */

import type { PlacedRoom, RoomEdge, CorridorSegment } from "../../domain/layout-types";

interface DoorPosition {
  x: number;
  y: number;
}

export class CorridorRouter {
  routeCorridor(
    fromRoom: PlacedRoom,
    toRoom: PlacedRoom,
    edge: RoomEdge,
    doorPositionMap?: Map<string, { x: number; y: number }>,
  ): CorridorSegment[] {
    const edgeId = `${edge.from}->${edge.to}`;
    const fromDoor = this.getDoorPosition(fromRoom, edge.fromWall, `${fromRoom.id}:${edgeId}`, doorPositionMap);
    const toDoor = this.getDoorPosition(toRoom, edge.toWall, `${toRoom.id}:${edgeId}`, doorPositionMap);
    const width = edge.corridorWidth ?? 4;

    return this.routeLShaped(fromDoor, toDoor, edge.fromWall, width);
  }

  /**
   * Computes the door position on a room wall. The door is centered on the
   * wall, positioned just outside the room's bounding rectangle.
   */
  private getDoorPosition(
    room: PlacedRoom,
    wall: string,
    edgeId: string,
    doorPositionMap?: Map<string, { x: number; y: number }>,
  ): DoorPosition {
    // Use stamped door position if available
    const mapped = doorPositionMap?.get(edgeId);
    if (mapped) return mapped;

    // Fallback: wall center (for edges without stamped doors)
    const centerX = room.x + Math.floor(room.w / 2);
    const centerY = room.y + Math.floor(room.h / 2);

    switch (wall) {
      case "north":
        return { x: centerX, y: room.y };
      case "south":
        return { x: centerX, y: room.y + room.h - 1 };
      case "east":
        return { x: room.x + room.w - 1, y: centerY };
      case "west":
        return { x: room.x, y: centerY };
      default:
        return { x: centerX, y: room.y };
    }
  }

  /**
   * Routes an L-shaped corridor between two door positions.
   *
   * For north/south exits: first segment is vertical, elbow is horizontal,
   * last segment is vertical.
   *
   * For east/west exits: first segment is horizontal, elbow is vertical,
   * last segment is horizontal.
   *
   * If the doors are already aligned on the routing axis, the elbow
   * collapses and we get a straight corridor (1-2 segments).
   */
  private routeLShaped(
    from: DoorPosition,
    to: DoorPosition,
    fromWall: string,
    width: number,
  ): CorridorSegment[] {
    const segments: CorridorSegment[] = [];

    if (fromWall === "north" || fromWall === "south") {
      // Primary axis is vertical (Y). Elbow runs horizontal (X).
      const midY = Math.floor((from.y + to.y) / 2);

      // Vertical leg from source door to elbow
      segments.push({
        x1: from.x,
        y1: from.y,
        x2: from.x,
        y2: midY,
        width,
      });

      // Horizontal elbow (only if doors aren't vertically aligned)
      if (from.x !== to.x) {
        segments.push({
          x1: from.x,
          y1: midY,
          x2: to.x,
          y2: midY,
          width,
        });
      }

      // Vertical leg from elbow to target door
      segments.push({
        x1: to.x,
        y1: midY,
        x2: to.x,
        y2: to.y,
        width,
      });
    } else {
      // Primary axis is horizontal (X). Elbow runs vertical (Y).
      const midX = Math.floor((from.x + to.x) / 2);

      // Horizontal leg from source door to elbow
      segments.push({
        x1: from.x,
        y1: from.y,
        x2: midX,
        y2: from.y,
        width,
      });

      // Vertical elbow (only if doors aren't horizontally aligned)
      if (from.y !== to.y) {
        segments.push({
          x1: midX,
          y1: from.y,
          x2: midX,
          y2: to.y,
          width,
        });
      }

      // Horizontal leg from elbow to target door
      segments.push({
        x1: midX,
        y1: to.y,
        x2: to.x,
        y2: to.y,
        width,
      });
    }

    return segments;
  }
}
