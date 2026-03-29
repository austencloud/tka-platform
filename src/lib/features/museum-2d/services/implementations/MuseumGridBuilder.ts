/**
 * Museum Grid Builder
 *
 * Orchestrates the full layout pipeline:
 * 1. Layout engine computes room positions from the abstract graph
 * 2. Corridor router connects rooms with L-shaped corridors
 * 3. Stamps rooms and corridors onto the tile map using low-level helpers
 * 4. Places room content (exhibits, performers, torches) using room-relative positions
 * 5. Sets spawn position
 * 6. Runs validation
 */

import type { IMuseumGridBuilder, MuseumGridBuildResult } from "../contracts/IMuseumGridBuilder";
import type { RoomNode, RoomEdge, GridConfig, PlacedRoom, CorridorSegment } from "../../domain/layout-types";
import type {
  MuseumGrid,
  MuseumTile,
  ExhibitDefinition,
  PerformerDefinition,
  Direction,
} from "../../domain/museum-grid-types";
import type { ExhibitPlacement, PerformerPlacement, TorchPlacement } from "../../domain/layout-types";
import { tileKey } from "../../domain/museum-grid-types";
import { stampRoom, stampCorridor, carveDoor, placeTile } from "../../data/museum-floor-plan";
import { GraphLayoutEngine } from "./GraphLayoutEngine";
import { CorridorRouter } from "./CorridorRouter";
import { LayoutValidator } from "./LayoutValidator";
import { ROOM_CONTENT } from "../../data/museum-room-content";

export class MuseumGridBuilder implements IMuseumGridBuilder {
  private layoutEngine = new GraphLayoutEngine();
  private corridorRouter = new CorridorRouter();
  private validator = new LayoutValidator();

  build(rooms: RoomNode[], edges: RoomEdge[], config: GridConfig): MuseumGridBuildResult {
    // Step 1: Compute room positions
    const layout = this.layoutEngine.computeLayout(rooms, edges, config);

    // Step 2: Route corridors between connected rooms
    const roomLookup = new Map(layout.rooms.map((r) => [r.id, r]));
    const corridorData: { edge: RoomEdge; segments: CorridorSegment[] }[] = [];

    for (const edge of edges) {
      const fromRoom = roomLookup.get(edge.from);
      const toRoom = roomLookup.get(edge.to);
      if (!fromRoom || !toRoom) continue;

      const segments = this.corridorRouter.routeCorridor(fromRoom, toRoom, edge);
      corridorData.push({ edge, segments });
    }

    // Step 3: Build the tile map
    const tiles = new Map<string, MuseumTile>();
    const exhibits: ExhibitDefinition[] = [];
    const performers: PerformerDefinition[] = [];

    // Stamp all rooms
    for (const room of layout.rooms) {
      stampRoom(tiles, room.x, room.y, room.w, room.h, room.material);
    }

    // Stamp all corridors and carve doors
    for (const { edge, segments } of corridorData) {
      const fromRoom = roomLookup.get(edge.from)!;
      const toRoom = roomLookup.get(edge.to)!;
      const width = edge.corridorWidth ?? 4;

      this.stampCorridorSegments(tiles, segments, fromRoom.material);
      this.carveDoorOnWall(tiles, fromRoom, edge.fromWall, width);
      this.carveDoorOnWall(tiles, toRoom, edge.toWall, width);
    }

    // Step 4: Place room content (exhibits, performers, torches)
    for (const room of layout.rooms) {
      this.placeExhibits(tiles, room, exhibits);
      this.placePerformers(tiles, room, performers);
      this.placeTorches(tiles, room);
    }

    // Step 5: Determine spawn position (center of first room's floor)
    const firstRoom = layout.rooms[0];
    const spawnX = firstRoom.x + Math.floor(firstRoom.w / 2);
    const spawnY = firstRoom.y + Math.floor(firstRoom.h / 2);

    const grid: MuseumGrid = {
      width: layout.gridWidth,
      height: layout.gridHeight,
      tileScale: 0.5,
      tiles,
      wings: layout.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        bounds: { x: r.x, y: r.y, width: r.w, height: r.h },
        theme: r.theme,
        description: r.description,
      })),
      spawn: { x: spawnX, y: spawnY, facing: "north" },
      exhibits,
      performers,
      triggers: [],
    };

    // Step 6: Validate
    const validation = this.validator.validate(grid, layout.rooms);

    return { grid, validation };
  }

  /**
   * Stamps corridor segments onto the tile map. Each segment is a straight
   * run (horizontal or vertical). The corridor width expands perpendicular
   * to the run direction.
   */
  private stampCorridorSegments(
    tiles: Map<string, MuseumTile>,
    segments: CorridorSegment[],
    material: string,
  ): void {
    for (const seg of segments) {
      const isVertical = seg.x1 === seg.x2;
      const halfWidth = Math.floor(seg.width / 2);

      if (isVertical) {
        const minY = Math.min(seg.y1, seg.y2);
        const maxY = Math.max(seg.y1, seg.y2);
        const corridorX = seg.x1 - halfWidth;
        const corridorW = seg.width;
        const corridorH = maxY - minY + 1;

        if (corridorH > 0) {
          stampCorridor(tiles, corridorX, minY, corridorW, corridorH, "vertical", "stone");
        }
      } else {
        const minX = Math.min(seg.x1, seg.x2);
        const maxX = Math.max(seg.x1, seg.x2);
        const corridorY = seg.y1 - halfWidth;
        const corridorW = maxX - minX + 1;
        const corridorH = seg.width;

        if (corridorW > 0) {
          stampCorridor(tiles, minX, corridorY, corridorW, corridorH, "horizontal", "stone");
        }
      }
    }
  }

  /**
   * Carves a door opening on a room wall. The door is centered on the wall,
   * matching the corridor width.
   */
  private carveDoorOnWall(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
    wall: string,
    doorWidth: number,
  ): void {
    const centerX = room.x + Math.floor(room.w / 2);
    const centerY = room.y + Math.floor(room.h / 2);
    const halfDoor = Math.floor(doorWidth / 2);

    switch (wall) {
      case "north":
        carveDoor(tiles, centerX - halfDoor, room.y, doorWidth, "horizontal");
        break;
      case "south":
        carveDoor(tiles, centerX - halfDoor, room.y + room.h - 1, doorWidth, "horizontal");
        break;
      case "east":
        carveDoor(tiles, room.x + room.w - 1, centerY - halfDoor, doorWidth, "vertical");
        break;
      case "west":
        carveDoor(tiles, room.x, centerY - halfDoor, doorWidth, "vertical");
        break;
    }
  }

  /**
   * Places exhibit tiles inside a room based on room-relative wall positions.
   * Also registers ExhibitDefinitions with the content from museum-room-content.
   */
  private placeExhibits(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
    exhibits: ExhibitDefinition[],
  ): void {
    if (!room.exhibits) return;

    for (const placement of room.exhibits) {
      const pos = this.computeWallPosition(room, placement.wall, placement.position);
      placeTile(tiles, pos.x, pos.y, {
        type: "exhibit-panel",
        refId: placement.refId,
        facing: placement.facing,
      });

      // Look up content for this exhibit
      const content = ROOM_CONTENT[room.id]?.exhibits?.[placement.refId];
      exhibits.push({
        id: placement.refId,
        tileX: pos.x,
        tileY: pos.y,
        plaque: content?.plaque,
      });
    }
  }

  /**
   * Places performer tiles inside a room based on center-relative offsets.
   */
  private placePerformers(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
    performers: PerformerDefinition[],
  ): void {
    if (!room.performers) return;

    for (const placement of room.performers) {
      const centerX = room.x + Math.floor(room.w / 2);
      const centerY = room.y + Math.floor(room.h / 2);

      // Convert -0.5..0.5 offset to tiles (using interior dimensions)
      const interiorW = room.w - 2; // exclude walls
      const interiorH = room.h - 2;
      const px = centerX + Math.floor(placement.offsetX * interiorW);
      const py = centerY + Math.floor(placement.offsetY * interiorH);

      placeTile(tiles, px, py, {
        type: "performer-station",
        refId: placement.refId,
        facing: placement.facing,
      });

      const content = ROOM_CONTENT[room.id]?.performers?.[placement.refId];
      performers.push({
        id: placement.refId,
        tileX: px,
        tileY: py,
        facing: placement.facing,
        sequenceId: content?.sequenceId,
        autoPlay: content?.autoPlay ?? false,
      });
    }
  }

  /**
   * Places torch tiles inside a room based on wall-relative positions.
   */
  private placeTorches(tiles: Map<string, MuseumTile>, room: PlacedRoom): void {
    if (!room.torches) return;

    for (const torch of room.torches) {
      const pos = this.computeWallPosition(room, torch.wall, torch.position);
      placeTile(tiles, pos.x, pos.y, { type: "torch" });
    }
  }

  /**
   * Converts a wall-relative position (wall + fraction 0.0-1.0) to absolute
   * tile coordinates. Places the content 1 tile inside the wall.
   */
  private computeWallPosition(
    room: PlacedRoom,
    wall: string,
    position: number,
  ): { x: number; y: number } {
    // Interior dimensions (excluding wall tiles on both sides)
    const interiorW = room.w - 2;
    const interiorH = room.h - 2;

    switch (wall) {
      case "north":
        return {
          x: room.x + 1 + Math.floor(position * interiorW),
          y: room.y + 1,
        };
      case "south":
        return {
          x: room.x + 1 + Math.floor(position * interiorW),
          y: room.y + room.h - 2,
        };
      case "east":
        return {
          x: room.x + room.w - 2,
          y: room.y + 1 + Math.floor(position * interiorH),
        };
      case "west":
        return {
          x: room.x + 1,
          y: room.y + 1 + Math.floor(position * interiorH),
        };
      default:
        return { x: room.x + 1, y: room.y + 1 };
    }
  }
}

/**
 * Convenience function for building the museum grid.
 * Used by Museum2DModule.svelte.
 */
export function buildMuseumGrid(
  rooms: RoomNode[],
  edges: RoomEdge[],
  config: GridConfig,
): MuseumGridBuildResult {
  const builder = new MuseumGridBuilder();
  return builder.build(rooms, edges, config);
}
