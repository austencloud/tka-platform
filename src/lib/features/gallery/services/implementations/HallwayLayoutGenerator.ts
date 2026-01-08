/**
 * HallwayLayoutGenerator
 *
 * Generates a simple straight corridor gallery layout with
 * exhibits on both walls. MVP layout for Phase 1.
 */

import { injectable } from "inversify";
import type { IGalleryLayoutGenerator } from "../contracts/IGalleryLayoutGenerator";
import type {
  GalleryLayout,
  WallSegment,
  ExhibitSlot,
  LayoutGenerationOptions,
} from "../../domain/models/GalleryLayout";
import type { Room } from "../../domain/models/Room";
import type { Doorway } from "../../domain/models/doorway";
import type { RoomGraph } from "../../domain/models/RoomGraph";
import { buildRoomGraph } from "../../domain/models/RoomGraph";
import type { CollisionWorld, WallCollider } from "../../domain/models/WallCollider";
import { createWallCollider } from "../../domain/models/WallCollider";
import { LOBBY_THEME } from "../../domain/models/Room";
import {
  WALL_HEIGHT,
  WALL_THICKNESS,
  HALLWAY_WIDTH,
  HALLWAY_BUFFER,
  EXHIBIT_SPACING,
  FRAME_WIDTH,
  FRAME_HEIGHT,
  FRAME_CENTER_Y,
  PLAYER_EYE_HEIGHT,
  SPAWN_DISTANCE,
} from "../../domain/constants/gallery-dimensions";

@injectable()
export class HallwayLayoutGenerator implements IGalleryLayoutGenerator {
  readonly name = "hallway";

  generate(options: LayoutGenerationOptions): GalleryLayout {
    const { exhibitCount } = options;

    // Calculate hallway dimensions
    const exhibitsPerWall = Math.ceil(exhibitCount / 2);
    const hallwayLength =
      exhibitsPerWall * EXHIBIT_SPACING + HALLWAY_BUFFER * 2;
    const halfWidth = HALLWAY_WIDTH / 2;

    // Generate walls
    const leftWall = this.createWall(
      "left-wall",
      { x: -halfWidth, z: 0 },
      { x: -halfWidth, z: hallwayLength },
      exhibitsPerWall,
      "left"
    );

    const rightWall = this.createWall(
      "right-wall",
      { x: halfWidth, z: 0 },
      { x: halfWidth, z: hallwayLength },
      exhibitCount - exhibitsPerWall,
      "right"
    );

    // Back wall (closes the end)
    const backWall: WallSegment = {
      id: "back-wall",
      startPos: { x: -halfWidth, z: hallwayLength },
      endPos: { x: halfWidth, z: hallwayLength },
      height: WALL_HEIGHT,
      thickness: WALL_THICKNESS,
      exhibitSlots: [],
    };

    // Front wall with entrance gap (optional, could be open)
    const frontWall: WallSegment = {
      id: "front-wall",
      startPos: { x: -halfWidth, z: 0 },
      endPos: { x: halfWidth, z: 0 },
      height: WALL_HEIGHT,
      thickness: WALL_THICKNESS,
      exhibitSlots: [],
    };

    const walls = [leftWall, rightWall, backWall, frontWall];

    // Create a single room for the hallway (legacy compatibility)
    const hallwayRoom: Room = {
      id: "hallway",
      name: "Gallery Hallway",
      type: "lobby",
      shape: {
        type: "rectangular",
        center: { x: 0, z: hallwayLength / 2 },
        width: HALLWAY_WIDTH,
        depth: hallwayLength,
        rotation: 0,
      },
      wallHeight: WALL_HEIGHT,
      theme: LOBBY_THEME,
      doorwayOpenings: [],
      hasExhibits: true,
      hasCeiling: true,
    };

    const rooms: readonly Room[] = [hallwayRoom];
    const doorways: readonly Doorway[] = [];
    const roomGraph: RoomGraph = buildRoomGraph(rooms, doorways, "hallway");

    // Create wall colliders from walls
    const wallColliders: WallCollider[] = walls.map((wall) =>
      createWallCollider(wall.id, wall.startPos, wall.endPos, "hallway", false)
    );

    const wallIds = wallColliders.map((w) => w.id);
    const collisionWorld: CollisionWorld = {
      walls: new Map(wallColliders.map((w) => [w.id, w])),
      wallsByRoom: new Map([["hallway", wallIds]]),
      playerRadius: 30,
    };

    return {
      id: `hallway-${exhibitCount}`,
      name: "Gallery Hallway",
      walls,
      rooms,
      doorways,
      corridors: [], // Simple hallway has no room gaps to bridge
      roomGraph,
      collisionWorld,
      spawnRoomId: "hallway",
      spawnPoint: {
        x: 0,
        y: PLAYER_EYE_HEIGHT,
        z: HALLWAY_BUFFER - SPAWN_DISTANCE,
      },
      bounds: {
        minX: -halfWidth - WALL_THICKNESS,
        maxX: halfWidth + WALL_THICKNESS,
        minZ: -WALL_THICKNESS,
        maxZ: hallwayLength + WALL_THICKNESS,
      },
      floorSize: {
        width: HALLWAY_WIDTH,
        depth: hallwayLength,
      },
    };
  }

  private createWall(
    id: string,
    startPos: { x: number; z: number },
    endPos: { x: number; z: number },
    slotCount: number,
    side: "left" | "right"
  ): WallSegment {
    const slots: ExhibitSlot[] = [];

    for (let i = 0; i < slotCount; i++) {
      const zPos = HALLWAY_BUFFER + i * EXHIBIT_SPACING + EXHIBIT_SPACING / 2;

      // Rotation: left wall faces right (+π/2), right wall faces left (-π/2)
      const rotation = side === "left" ? Math.PI / 2 : -Math.PI / 2;

      // X position: slightly inward from wall surface
      const xOffset = side === "left" ? WALL_THICKNESS / 2 : -WALL_THICKNESS / 2;

      slots.push({
        id: `${id}-slot-${i}`,
        wallId: id,
        position: {
          x: startPos.x + xOffset,
          y: FRAME_CENTER_Y,
          z: zPos,
        },
        rotation,
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
      });
    }

    return {
      id,
      startPos,
      endPos,
      height: WALL_HEIGHT,
      thickness: WALL_THICKNESS,
      exhibitSlots: slots,
    };
  }
}
