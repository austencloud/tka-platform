/**
 * RoomGeometryGenerator
 *
 * Generates wall segments and exhibit slots from room definitions.
 * Handles doorway cuts and creates both legacy WallSegment format
 * and collision-ready WallCollider format.
 */

import { injectable } from "inversify";
import type { Room, DoorwayOpening } from "../../domain/models/Room";
import type { Doorway } from "../../domain/models/doorway";
import type { WallSegment, ExhibitSlot } from "../../domain/models/GalleryLayout";
import type { WallCollider } from "../../domain/models/WallCollider";
import { createWallCollider } from "../../domain/models/WallCollider";
import type { Point2D, LineSegment2D } from "../../domain/models/geometry";
import { distance2D, segmentAngle, segmentMidpoint } from "../../domain/models/geometry";
import { shapeToPolygon, getShapeCenter } from "../../domain/models/room-shapes";
import {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  FRAME_CENTER_Y,
  WALL_THICKNESS,
} from "../../domain/constants/gallery-dimensions";

// =============================================================================
// Types
// =============================================================================

interface WallWithCollider {
  wallSegment: WallSegment;
  colliders: WallCollider[];
}

interface GeneratedGeometry {
  walls: WallSegment[];
  colliders: WallCollider[];
}

// =============================================================================
// Service
// =============================================================================

@injectable()
export class RoomGeometryGenerator {
  /**
   * Generate wall segments and colliders from rooms
   */
  generateFromRooms(
    rooms: readonly Room[],
    doorways: readonly Doorway[]
  ): GeneratedGeometry {
    const allWalls: WallSegment[] = [];
    const allColliders: WallCollider[] = [];

    for (const room of rooms) {
      const { walls, colliders } = this.generateRoomGeometry(room, doorways);
      allWalls.push(...walls);
      allColliders.push(...colliders);
    }

    return { walls: allWalls, colliders: allColliders };
  }

  /**
   * Generate geometry for a single room
   */
  private generateRoomGeometry(
    room: Room,
    allDoorways: readonly Doorway[]
  ): GeneratedGeometry {
    // Get the polygon representing this room's boundary
    const polygon = shapeToPolygon(room.shape);
    const vertices = polygon.vertices;

    if (vertices.length < 3) {
      return { walls: [], colliders: [] };
    }

    const walls: WallSegment[] = [];
    const colliders: WallCollider[] = [];

    // Find doorways that connect to this room
    const roomDoorways = allDoorways.filter(
      (d) => d.roomAId === room.id || d.roomBId === room.id
    );

    // Generate wall segments from polygon edges
    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i]!;
      const end = vertices[(i + 1) % vertices.length]!;
      const wallId = `${room.id}-wall-${i}`;

      // Check if any doorway cuts through this wall segment
      const doorwayCuts = this.findDoorwayCuts(start, end, roomDoorways);

      if (doorwayCuts.length === 0) {
        // No doorways - create a single wall segment
        const result = this.createWallWithExhibits(
          wallId,
          start,
          end,
          room,
          false
        );
        walls.push(result.wallSegment);
        colliders.push(...result.colliders);
      } else {
        // Has doorways - split wall into segments
        const segments = this.splitWallByDoorways(start, end, doorwayCuts);

        for (const seg of segments) {
          const segId = `${wallId}-seg-${segments.indexOf(seg)}`;

          if (seg.isDoorway) {
            // Create doorway collider (marked as isDoorway so no collision)
            colliders.push(
              createWallCollider(segId, seg.start, seg.end, room.id, true)
            );
          } else {
            // Create regular wall segment
            const result = this.createWallWithExhibits(
              segId,
              seg.start,
              seg.end,
              room,
              false
            );
            walls.push(result.wallSegment);
            colliders.push(...result.colliders);
          }
        }
      }
    }

    return { walls, colliders };
  }

  /**
   * Create a wall segment with exhibit slots
   */
  private createWallWithExhibits(
    id: string,
    start: Point2D,
    end: Point2D,
    room: Room,
    hasDoorway: boolean
  ): WallWithCollider {
    const segment: LineSegment2D = { start, end };
    const length = distance2D(start, end);
    const angle = segmentAngle(segment);

    // Create exhibit slots if room has exhibits and wall is long enough
    const exhibitSlots: ExhibitSlot[] = [];

    if (room.hasExhibits && length >= FRAME_WIDTH * 1.5) {
      const spacing = room.exhibitSpacing ?? 400;
      const usableLength = length - FRAME_WIDTH; // Buffer at ends
      const slotCount = Math.max(1, Math.floor(usableLength / spacing));

      if (slotCount > 0) {
        const actualSpacing = usableLength / slotCount;

        for (let i = 0; i < slotCount; i++) {
          // Position along the wall
          const t = (FRAME_WIDTH / 2 + actualSpacing * i + actualSpacing / 2) / length;
          const x = start.x + (end.x - start.x) * t;
          const z = start.z + (end.z - start.z) * t;

          // Offset position slightly from wall (inward)
          const roomCenter = getShapeCenter(room.shape);
          const toCenter = {
            x: roomCenter.x - x,
            z: roomCenter.z - z,
          };
          const toCenterLen = Math.sqrt(toCenter.x * toCenter.x + toCenter.z * toCenter.z);
          const normalizedToCenter = toCenterLen > 0
            ? { x: toCenter.x / toCenterLen, z: toCenter.z / toCenterLen }
            : { x: 0, z: 1 };

          exhibitSlots.push({
            id: `${id}-slot-${i}`,
            wallId: id,
            position: {
              x: x + normalizedToCenter.x * (WALL_THICKNESS / 2),
              y: FRAME_CENTER_Y,
              z: z + normalizedToCenter.z * (WALL_THICKNESS / 2),
            },
            // Face inward toward room center
            rotation: Math.atan2(normalizedToCenter.x, normalizedToCenter.z),
            width: FRAME_WIDTH,
            height: FRAME_HEIGHT,
            roomId: room.id,
          });
        }
      }
    }

    const wallSegment: WallSegment = {
      id,
      startPos: start,
      endPos: end,
      height: room.wallHeight,
      thickness: WALL_THICKNESS,
      exhibitSlots,
      roomId: room.id,
      hasDoorway,
    };

    const colliders = [createWallCollider(id, start, end, room.id, false)];

    return { wallSegment, colliders };
  }

  /**
   * Find where doorways cut through a wall segment
   */
  private findDoorwayCuts(
    wallStart: Point2D,
    wallEnd: Point2D,
    doorways: readonly Doorway[]
  ): Array<{ position: number; width: number; doorwayId: string }> {
    const cuts: Array<{ position: number; width: number; doorwayId: string }> = [];
    const wallLength = distance2D(wallStart, wallEnd);

    if (wallLength < 10) return cuts; // Skip tiny walls

    const wallDx = wallEnd.x - wallStart.x;
    const wallDz = wallEnd.z - wallStart.z;

    for (const doorway of doorways) {
      // Project doorway center onto wall segment
      const toPoint = {
        x: doorway.position.x - wallStart.x,
        z: doorway.position.z - wallStart.z,
      };

      // Parameter t along the wall
      const t =
        (toPoint.x * wallDx + toPoint.z * wallDz) / (wallLength * wallLength);

      if (t >= 0 && t <= 1) {
        // Closest point on wall to doorway center
        const closestX = wallStart.x + wallDx * t;
        const closestZ = wallStart.z + wallDz * t;
        const distToWall = distance2D(doorway.position, { x: closestX, z: closestZ });

        // If doorway is close enough to this wall, it cuts through
        if (distToWall < doorway.width / 2 + WALL_THICKNESS) {
          cuts.push({
            position: t * wallLength,
            width: doorway.width,
            doorwayId: doorway.id,
          });
        }
      }
    }

    // Sort by position along wall
    cuts.sort((a, b) => a.position - b.position);

    return cuts;
  }

  /**
   * Split a wall into segments around doorway cuts
   */
  private splitWallByDoorways(
    start: Point2D,
    end: Point2D,
    cuts: Array<{ position: number; width: number; doorwayId: string }>
  ): Array<{ start: Point2D; end: Point2D; isDoorway: boolean }> {
    const segments: Array<{ start: Point2D; end: Point2D; isDoorway: boolean }> = [];
    const wallLength = distance2D(start, end);

    if (wallLength < 10 || cuts.length === 0) {
      segments.push({ start, end, isDoorway: false });
      return segments;
    }

    const dx = (end.x - start.x) / wallLength;
    const dz = (end.z - start.z) / wallLength;

    let currentPos = 0;

    for (const cut of cuts) {
      const cutStart = Math.max(0, cut.position - cut.width / 2);
      const cutEnd = Math.min(wallLength, cut.position + cut.width / 2);

      // Wall segment before doorway
      if (cutStart > currentPos + 10) {
        segments.push({
          start: {
            x: start.x + dx * currentPos,
            z: start.z + dz * currentPos,
          },
          end: {
            x: start.x + dx * cutStart,
            z: start.z + dz * cutStart,
          },
          isDoorway: false,
        });
      }

      // Doorway segment (no collision)
      segments.push({
        start: {
          x: start.x + dx * cutStart,
          z: start.z + dz * cutStart,
        },
        end: {
          x: start.x + dx * cutEnd,
          z: start.z + dz * cutEnd,
        },
        isDoorway: true,
      });

      currentPos = cutEnd;
    }

    // Wall segment after last doorway
    if (currentPos < wallLength - 10) {
      segments.push({
        start: {
          x: start.x + dx * currentPos,
          z: start.z + dz * currentPos,
        },
        end: end,
        isDoorway: false,
      });
    }

    return segments;
  }
}
