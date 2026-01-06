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

    return {
      id: `hallway-${exhibitCount}`,
      name: "Gallery Hallway",
      walls: [leftWall, rightWall, backWall, frontWall],
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
