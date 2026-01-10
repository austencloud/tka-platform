/**
 * MansionLayoutGenerator
 *
 * Generates an EPIC grand museum with room-based architecture.
 *
 * Layout:
 * - Grand Central Rotunda (massive circular atrium with dome)
 * - North Wing (main exhibition corridor - longest)
 * - East Wing (secondary gallery)
 * - West Wing (secondary gallery)
 * - Connecting doorways between wings
 *
 * Scale: Designed to feel like the Louvre or British Museum
 */

import type { IGalleryLayoutGenerator } from "../contracts/IGalleryLayoutGenerator";
import type {
  GalleryLayout,
  LayoutGenerationOptions,
} from "../../domain/models/GalleryLayout";
import type { Room } from "../../domain/models/Room";
import {
  ROTUNDA_THEME,
  WING_THEME,
  ALCOVE_THEME,
  LOBBY_THEME,
} from "../../domain/models/Room";
import type { Doorway } from "../../domain/models/doorway";
import { createGrandEntrance, createArchway } from "../../domain/models/doorway";
import { buildRoomGraph } from "../../domain/models/RoomGraph";
import type { CircularShape, RectangularShape } from "../../domain/models/room-shapes";
import type { DoorwayCorridor } from "../../domain/models/doorway";
import { RoomGeometryGenerator } from "./RoomGeometryGenerator";
import { CollisionWorldBuilder } from "./CollisionWorldBuilder";
import { ConnectionGeometryGenerator } from "./ConnectionGeometryGenerator";
import {
  WALL_HEIGHT,
  PLAYER_EYE_HEIGHT,
} from "../../domain/constants/gallery-dimensions";

// =============================================================================
// EPIC GRAND MUSEUM DIMENSIONS
// =============================================================================

// Grand Central Rotunda - Massive central hub
const ROTUNDA_RADIUS = 800;
const ROTUNDA_SEGMENTS = 32; // Smooth circle

// Main Wings - Long exhibition corridors
const WING_WIDTH = 600;
const NORTH_WING_LENGTH = 4000;
const EAST_WING_LENGTH = 2500;
const WEST_WING_LENGTH = 2500;

// Doorway dimensions
const GRAND_DOORWAY_WIDTH = 500;
const GRAND_DOORWAY_HEIGHT = 800;
const WING_DOORWAY_WIDTH = 400;
const WING_DOORWAY_HEIGHT = 600;

// Spacing
const WING_EXHIBIT_SPACING = 500;
const ALCOVE_EXHIBIT_SPACING = 300;

// Alcoves
const ALCOVE_WIDTH = 500;
const ALCOVE_DEPTH = 350;
const ALCOVE_SPACING = 1200;

export class MansionLayoutGenerator implements IGalleryLayoutGenerator {
  readonly name = "mansion";

  constructor(
    private readonly geometryGenerator: RoomGeometryGenerator,
    private readonly collisionBuilder: CollisionWorldBuilder,
    private readonly connectionGenerator: ConnectionGeometryGenerator
  ) {}

  generate(_options: LayoutGenerationOptions): GalleryLayout {
    // =========================================================================
    // STEP 1: Define all rooms
    // =========================================================================
    const rooms = this.createRooms();

    // =========================================================================
    // STEP 2: Define doorways connecting rooms
    // =========================================================================
    const doorways = this.createDoorways();

    // =========================================================================
    // STEP 3: Generate corridor geometry to bridge room gaps
    // =========================================================================
    const corridors = this.connectionGenerator.generateCorridors(rooms, doorways);

    // =========================================================================
    // STEP 4: Build room graph for spatial queries
    // =========================================================================
    const roomGraph = buildRoomGraph(rooms, doorways, "rotunda");

    // =========================================================================
    // STEP 5: Generate wall geometry from rooms and corridors
    // =========================================================================
    const { walls, colliders } = this.geometryGenerator.generateFromRooms(
      rooms,
      doorways,
      corridors
    );

    // =========================================================================
    // STEP 6: Build collision world
    // =========================================================================
    const collisionWorld = this.collisionBuilder.build(colliders);

    // =========================================================================
    // STEP 7: Calculate bounds
    // =========================================================================
    const bounds = this.calculateBounds(rooms);

    // =========================================================================
    // STEP 8: Assemble final layout
    // =========================================================================
    const totalSlots = walls.reduce((sum, wall) => sum + wall.exhibitSlots.length, 0);
    console.debug(
      `[MansionLayoutGenerator] Created EPIC museum: ${rooms.length} rooms, ` +
      `${doorways.length} doorways, ${corridors.length} corridors, ${totalSlots} exhibit slots`
    );

    // Debug: Log first few slot positions
    for (const wall of walls.slice(0, 3)) {
      console.debug(`[MansionLayoutGenerator] Wall ${wall.id}:`, {
        start: wall.startPos,
        end: wall.endPos,
        slotsCount: wall.exhibitSlots.length,
      });
      for (const slot of wall.exhibitSlots.slice(0, 2)) {
        console.debug(`  Slot ${slot.id}:`, {
          position: slot.position,
          rotation: slot.rotation,
        });
      }
    }

    return {
      id: "epic-mansion",
      name: "Epic Grand Museum",

      // New room-based architecture
      rooms,
      doorways,
      corridors,
      roomGraph,
      collisionWorld,

      // Legacy wall-based data
      walls,
      bounds,
      floorSize: {
        width: Math.abs(bounds.maxX - bounds.minX) + 400,
        depth: Math.abs(bounds.maxZ - bounds.minZ) + 400,
      },

      // Spawn
      spawnPoint: {
        x: 0,
        y: PLAYER_EYE_HEIGHT,
        z: -ROTUNDA_RADIUS * 0.5, // In southern part of rotunda, facing north
      },
      spawnRoomId: "rotunda",
    };
  }

  /**
   * Create all rooms in the museum
   */
  private createRooms(): Room[] {
    const rooms: Room[] = [];

    // =========================================================================
    // GRAND CENTRAL ROTUNDA
    // =========================================================================
    const rotundaShape: CircularShape = {
      type: "circular",
      center: { x: 0, z: 0 },
      radius: ROTUNDA_RADIUS,
      segments: ROTUNDA_SEGMENTS,
    };

    rooms.push({
      id: "rotunda",
      name: "Grand Rotunda",
      type: "rotunda",
      shape: rotundaShape,
      wallHeight: WALL_HEIGHT,
      theme: ROTUNDA_THEME,
      doorwayOpenings: [],
      hasCeiling: true,
      hasExhibits: true,
      exhibitSpacing: 600, // More spacing for grandeur
    });

    // =========================================================================
    // NORTH WING (Main Gallery)
    // =========================================================================
    const northWingStart = ROTUNDA_RADIUS + GRAND_DOORWAY_WIDTH / 2;
    const northWingCenter = northWingStart + NORTH_WING_LENGTH / 2;

    const northWingShape: RectangularShape = {
      type: "rectangular",
      center: { x: 0, z: northWingCenter },
      width: WING_WIDTH,
      depth: NORTH_WING_LENGTH,
      rotation: 0,
    };

    rooms.push({
      id: "north-wing",
      name: "North Wing Gallery",
      type: "wing",
      shape: northWingShape,
      wallHeight: WALL_HEIGHT,
      theme: WING_THEME,
      doorwayOpenings: [],
      hasCeiling: true,
      hasExhibits: true,
      exhibitSpacing: WING_EXHIBIT_SPACING,
    });

    // North wing alcoves
    const northAlcoves = this.createWingAlcoves(
      "north",
      { x: 0, z: northWingCenter },
      NORTH_WING_LENGTH,
      WING_WIDTH,
      0
    );
    rooms.push(...northAlcoves);

    // =========================================================================
    // EAST WING
    // =========================================================================
    const eastWingStart = ROTUNDA_RADIUS + GRAND_DOORWAY_WIDTH / 2;
    const eastWingCenter = eastWingStart + EAST_WING_LENGTH / 2;

    const eastWingShape: RectangularShape = {
      type: "rectangular",
      center: { x: eastWingCenter, z: 0 },
      width: EAST_WING_LENGTH,
      depth: WING_WIDTH,
      rotation: 0,
    };

    rooms.push({
      id: "east-wing",
      name: "East Wing Gallery",
      type: "wing",
      shape: eastWingShape,
      wallHeight: WALL_HEIGHT,
      theme: WING_THEME,
      doorwayOpenings: [],
      hasCeiling: true,
      hasExhibits: true,
      exhibitSpacing: WING_EXHIBIT_SPACING,
    });

    // =========================================================================
    // WEST WING
    // =========================================================================
    const westWingStart = -(ROTUNDA_RADIUS + GRAND_DOORWAY_WIDTH / 2);
    const westWingCenter = westWingStart - WEST_WING_LENGTH / 2;

    const westWingShape: RectangularShape = {
      type: "rectangular",
      center: { x: westWingCenter, z: 0 },
      width: WEST_WING_LENGTH,
      depth: WING_WIDTH,
      rotation: 0,
    };

    rooms.push({
      id: "west-wing",
      name: "West Wing Gallery",
      type: "wing",
      shape: westWingShape,
      wallHeight: WALL_HEIGHT,
      theme: WING_THEME,
      doorwayOpenings: [],
      hasCeiling: true,
      hasExhibits: true,
      exhibitSpacing: WING_EXHIBIT_SPACING,
    });

    // =========================================================================
    // SOUTH LOBBY (Entrance)
    // =========================================================================
    const lobbyCenter = -(ROTUNDA_RADIUS + 300);

    const lobbyShape: RectangularShape = {
      type: "rectangular",
      center: { x: 0, z: lobbyCenter },
      width: ROTUNDA_RADIUS * 1.5,
      depth: 400,
      rotation: 0,
    };

    rooms.push({
      id: "lobby",
      name: "Grand Entrance",
      type: "lobby",
      shape: lobbyShape,
      wallHeight: WALL_HEIGHT,
      theme: LOBBY_THEME,
      doorwayOpenings: [],
      hasCeiling: true,
      hasExhibits: false,
    });

    return rooms;
  }

  /**
   * Create alcoves along a wing
   */
  private createWingAlcoves(
    wingPrefix: string,
    wingCenter: { x: number; z: number },
    wingLength: number,
    wingWidth: number,
    wingRotation: number
  ): Room[] {
    const alcoves: Room[] = [];
    const halfLength = wingLength / 2;
    const halfWidth = wingWidth / 2;
    const startZ = -halfLength + ALCOVE_SPACING;
    const endZ = halfLength - ALCOVE_SPACING;

    let alcoveIndex = 0;

    for (let localZ = startZ; localZ < endZ; localZ += ALCOVE_SPACING) {
      // Alternate left and right
      const isLeft = alcoveIndex % 2 === 0;
      const localX = isLeft ? -(halfWidth + ALCOVE_DEPTH / 2) : halfWidth + ALCOVE_DEPTH / 2;

      // Apply wing rotation (for future non-axis-aligned wings)
      const cos = Math.cos(wingRotation);
      const sin = Math.sin(wingRotation);
      const worldX = wingCenter.x + localX * cos - localZ * sin;
      const worldZ = wingCenter.z + localX * sin + localZ * cos;

      // Alcoves should face the corridor they open into
      // Left alcoves (isLeft=true) open toward positive X → rotate -π/2
      // Right alcoves (isLeft=false) open toward negative X → rotate π/2
      const alcoveRotation = wingRotation + (isLeft ? -Math.PI / 2 : Math.PI / 2);

      const alcoveShape: RectangularShape = {
        type: "rectangular",
        center: { x: worldX, z: worldZ },
        width: ALCOVE_WIDTH,
        depth: ALCOVE_DEPTH,
        rotation: alcoveRotation,
      };

      alcoves.push({
        id: `${wingPrefix}-alcove-${alcoveIndex}`,
        name: `${wingPrefix.charAt(0).toUpperCase() + wingPrefix.slice(1)} Alcove ${alcoveIndex + 1}`,
        type: "alcove",
        shape: alcoveShape,
        wallHeight: WALL_HEIGHT,
        theme: ALCOVE_THEME,
        doorwayOpenings: [],
        hasCeiling: true,
        hasExhibits: true,
        exhibitSpacing: ALCOVE_EXHIBIT_SPACING,
      });

      alcoveIndex++;
    }

    return alcoves;
  }

  /**
   * Create doorways connecting rooms
   */
  private createDoorways(): Doorway[] {
    const doorways: Doorway[] = [];

    // =========================================================================
    // ROTUNDA -> NORTH WING
    // =========================================================================
    doorways.push(
      createGrandEntrance(
        "rotunda-north",
        "rotunda",
        "north-wing",
        { x: 0, z: ROTUNDA_RADIUS },
        0, // Facing north
        GRAND_DOORWAY_WIDTH,
        GRAND_DOORWAY_HEIGHT
      )
    );

    // =========================================================================
    // ROTUNDA -> EAST WING
    // =========================================================================
    doorways.push(
      createGrandEntrance(
        "rotunda-east",
        "rotunda",
        "east-wing",
        { x: ROTUNDA_RADIUS, z: 0 },
        Math.PI / 2, // Facing east
        GRAND_DOORWAY_WIDTH,
        GRAND_DOORWAY_HEIGHT
      )
    );

    // =========================================================================
    // ROTUNDA -> WEST WING
    // =========================================================================
    doorways.push(
      createGrandEntrance(
        "rotunda-west",
        "rotunda",
        "west-wing",
        { x: -ROTUNDA_RADIUS, z: 0 },
        -Math.PI / 2, // Facing west
        GRAND_DOORWAY_WIDTH,
        GRAND_DOORWAY_HEIGHT
      )
    );

    // =========================================================================
    // ROTUNDA -> LOBBY (South entrance)
    // =========================================================================
    doorways.push(
      createGrandEntrance(
        "rotunda-lobby",
        "rotunda",
        "lobby",
        { x: 0, z: -ROTUNDA_RADIUS },
        Math.PI, // Facing south
        GRAND_DOORWAY_WIDTH,
        GRAND_DOORWAY_HEIGHT
      )
    );

    // =========================================================================
    // NORTH WING -> ALCOVES
    // =========================================================================
    const northWingStart = ROTUNDA_RADIUS + GRAND_DOORWAY_WIDTH / 2;
    const northWingCenter = northWingStart + NORTH_WING_LENGTH / 2;
    const halfLength = NORTH_WING_LENGTH / 2;
    const halfWidth = WING_WIDTH / 2;
    const startZ = -halfLength + ALCOVE_SPACING;
    const endZ = halfLength - ALCOVE_SPACING;

    let alcoveIndex = 0;
    for (let localZ = startZ; localZ < endZ; localZ += ALCOVE_SPACING) {
      const isLeft = alcoveIndex % 2 === 0;
      const localX = isLeft ? -halfWidth : halfWidth;
      const worldZ = northWingCenter + localZ;

      doorways.push(
        createArchway(
          `north-wing-alcove-${alcoveIndex}`,
          "north-wing",
          `north-alcove-${alcoveIndex}`,
          { x: localX, z: worldZ },
          isLeft ? -Math.PI / 2 : Math.PI / 2,
          WING_DOORWAY_WIDTH,
          WING_DOORWAY_HEIGHT
        )
      );

      alcoveIndex++;
    }

    return doorways;
  }

  /**
   * Calculate bounding box for all rooms
   */
  private calculateBounds(rooms: readonly Room[]): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const room of rooms) {
      const shape = room.shape;

      if (shape.type === "circular") {
        minX = Math.min(minX, shape.center.x - shape.radius);
        maxX = Math.max(maxX, shape.center.x + shape.radius);
        minZ = Math.min(minZ, shape.center.z - shape.radius);
        maxZ = Math.max(maxZ, shape.center.z + shape.radius);
      } else if (shape.type === "rectangular") {
        const halfW = shape.width / 2;
        const halfD = shape.depth / 2;
        // Account for rotation
        const cos = Math.abs(Math.cos(shape.rotation));
        const sin = Math.abs(Math.sin(shape.rotation));
        const boundW = halfW * cos + halfD * sin;
        const boundD = halfW * sin + halfD * cos;

        minX = Math.min(minX, shape.center.x - boundW);
        maxX = Math.max(maxX, shape.center.x + boundW);
        minZ = Math.min(minZ, shape.center.z - boundD);
        maxZ = Math.max(maxZ, shape.center.z + boundD);
      }
    }

    return { minX, maxX, minZ, maxZ };
  }
}
