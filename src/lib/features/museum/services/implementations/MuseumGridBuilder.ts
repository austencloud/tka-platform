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
import { isWalkable } from "../../domain/tile-registry";
import { placeTile } from "../../data/museum-floor-plan";
import { GraphLayoutEngine } from "./GraphLayoutEngine";
import { CorridorRouter } from "./CorridorRouter";
import { LayoutValidator } from "./LayoutValidator";
import { ROOM_CONTENT } from "../../data/museum-room-content";
import { DEV_WHITEBOARDS_ENABLED, OPPOSITE_WALL } from "../../domain/museum-design-rules";

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

    // Step 3: Carve-Then-Wall rendering
    // Phase 1: Carve rooms and corridors as FLOOR only (no walls)
    // Phase 2: Derive walls from adjacency (any void tile next to floor = wall)
    const tiles = new Map<string, MuseumTile>();
    const exhibits: ExhibitDefinition[] = [];
    const performers: PerformerDefinition[] = [];

    // Phase 1a: Carve room interiors as floor (no walls)
    for (const room of layout.rooms) {
      this.carveRoomFloor(tiles, room);
    }

    // Phase 1b: Carve corridor paths as floor (no walls)
    for (const { segments } of corridorData) {
      this.carveCorridorFloor(tiles, segments);
    }

    // Phase 1c: Carve doorway flares where corridors meet rooms
    // This widens the corridor opening at room junctions to prevent corner-cutting
    for (const { edge } of corridorData) {
      const fromRoom = roomLookup.get(edge.from)!;
      const toRoom = roomLookup.get(edge.to)!;
      const width = edge.corridorWidth ?? 4;
      this.carveDoorwayFlare(tiles, fromRoom, edge.fromWall, width);
      this.carveDoorwayFlare(tiles, toRoom, edge.toWall, width);
    }

    // Phase 2: Derive walls — any empty tile adjacent to a walkable tile becomes a wall
    this.deriveWalls(tiles, layout.gridWidth, layout.gridHeight);

    // Step 4: Place room content (exhibits, performers, torches)
    for (const room of layout.rooms) {
      this.placeExhibits(tiles, room, exhibits);
      this.placePerformers(tiles, room, performers);
      this.placeTorches(tiles, room);
    }

    // Step 4b: Place dev whiteboards (designer notes on anchor walls)
    this.placeDevWhiteboards(tiles, layout.rooms, edges, exhibits);

    // Step 5: Determine spawn position (find a walkable tile near center of first room)
    const firstRoom = layout.rooms[0];
    const { x: spawnX, y: spawnY } = this.findWalkableSpawn(tiles, firstRoom);

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
   * Phase 1a: Carve room interior as floor tiles only.
   * No walls — walls are derived in Phase 2.
   */
  private carveRoomFloor(tiles: Map<string, MuseumTile>, room: PlacedRoom): void {
    for (let dy = 0; dy < room.h; dy++) {
      for (let dx = 0; dx < room.w; dx++) {
        tiles.set(tileKey(room.x + dx, room.y + dy), {
          type: "floor",
          material: room.material,
        });
      }
    }
  }

  /**
   * Phase 1b: Carve corridor segments as floor tiles only.
   * Each segment is a straight run. The corridor width expands perpendicular
   * to the run direction. Carving is monotonic — floor overwrites void,
   * never downgrades existing floor.
   */
  private carveCorridorFloor(
    tiles: Map<string, MuseumTile>,
    segments: CorridorSegment[],
  ): void {
    for (const seg of segments) {
      const isVertical = seg.x1 === seg.x2;
      const halfWidth = Math.floor(seg.width / 2);

      if (isVertical) {
        const minY = Math.min(seg.y1, seg.y2);
        const maxY = Math.max(seg.y1, seg.y2);
        for (let y = minY; y <= maxY; y++) {
          for (let dx = -halfWidth; dx < seg.width - halfWidth; dx++) {
            const x = seg.x1 + dx;
            tiles.set(tileKey(x, y), { type: "corridor", material: "stone" });
          }
        }
      } else {
        const minX = Math.min(seg.x1, seg.x2);
        const maxX = Math.max(seg.x1, seg.x2);
        for (let x = minX; x <= maxX; x++) {
          for (let dy = -halfWidth; dy < seg.width - halfWidth; dy++) {
            const y = seg.y1 + dy;
            tiles.set(tileKey(x, y), { type: "corridor", material: "stone" });
          }
        }
      }
    }
  }

  /**
   * Phase 1c: Carve a flared opening where a corridor meets a room wall.
   * Extends the corridor opening by 2 tiles on each side and 2 tiles deep
   * into the space outside the room, creating a smooth transition from
   * narrow corridor to wide room. Prevents the "cut corners" artifact.
   */
  private carveDoorwayFlare(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
    wall: string,
    corridorWidth: number,
  ): void {
    const centerX = room.x + Math.floor(room.w / 2);
    const centerY = room.y + Math.floor(room.h / 2);
    const halfCorridor = Math.floor(corridorWidth / 2);
    const flareExtra = 2; // extra tiles on each side beyond corridor width
    const flareDepth = 2; // how far the flare extends outside the room

    switch (wall) {
      case "north":
        for (let dy = 1; dy <= flareDepth; dy++) {
          for (let dx = -(halfCorridor + flareExtra); dx <= halfCorridor + flareExtra; dx++) {
            tiles.set(tileKey(centerX + dx, room.y - dy), { type: "corridor", material: "stone" });
          }
        }
        break;
      case "south":
        for (let dy = 1; dy <= flareDepth; dy++) {
          for (let dx = -(halfCorridor + flareExtra); dx <= halfCorridor + flareExtra; dx++) {
            tiles.set(tileKey(centerX + dx, room.y + room.h - 1 + dy), { type: "corridor", material: "stone" });
          }
        }
        break;
      case "east":
        for (let dx = 1; dx <= flareDepth; dx++) {
          for (let dy = -(halfCorridor + flareExtra); dy <= halfCorridor + flareExtra; dy++) {
            tiles.set(tileKey(room.x + room.w - 1 + dx, centerY + dy), { type: "corridor", material: "stone" });
          }
        }
        break;
      case "west":
        for (let dx = 1; dx <= flareDepth; dx++) {
          for (let dy = -(halfCorridor + flareExtra); dy <= halfCorridor + flareExtra; dy++) {
            tiles.set(tileKey(room.x - dx, centerY + dy), { type: "corridor", material: "stone" });
          }
        }
        break;
    }
  }

  /**
   * Phase 2: Derive walls from adjacency.
   * Any empty tile (not in the map) that is adjacent (8-directional)
   * to a walkable tile becomes a wall. This generates walls around
   * rooms and corridors automatically, with correct elbows and junctions.
   */
  private deriveWalls(
    tiles: Map<string, MuseumTile>,
    gridWidth: number,
    gridHeight: number,
  ): void {
    const NEIGHBORS = [
      [-1, -1], [0, -1], [1, -1],
      [-1,  0],          [1,  0],
      [-1,  1], [0,  1], [1,  1],
    ];

    // Collect wall positions first (can't modify map while iterating neighbors)
    const wallPositions: { x: number; y: number }[] = [];

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const key = tileKey(x, y);
        if (tiles.has(key)) continue; // already carved — skip

        const adjacentToWalkable = NEIGHBORS.some(([dx, dy]) => {
          const tile = tiles.get(tileKey(x + dx, y + dy));
          return tile !== undefined && isWalkable(tile.type);
        });

        if (adjacentToWalkable) {
          wallPositions.push({ x, y });
        }
      }
    }

    // Stamp walls
    for (const pos of wallPositions) {
      tiles.set(tileKey(pos.x, pos.y), { type: "wall" });
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

      // An exhibit needs a wall behind it. At doorway openings the wall is
      // replaced by corridor tiles, so the plaque would float in mid-air.
      // Check the tile directly behind the exhibit (one step outside the room).
      if (!this.hasWallBehind(tiles, pos.x, pos.y, placement.wall)) {
        // Try shifting along the wall to find a position with a wall behind it
        const adjusted = this.findWallBackedPosition(tiles, room, placement);
        if (!adjusted) continue; // entire wall segment is a doorway
        pos.x = adjusted.x;
        pos.y = adjusted.y;
      }

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
        size: placement.size,
        sequenceId: content?.sequenceId,
        plaque: content?.plaque,
      });
    }
  }

  /**
   * Checks whether there's a wall tile directly behind the given position.
   * "Behind" means one step outside the room in the direction the wall faces.
   */
  private hasWallBehind(
    tiles: Map<string, MuseumTile>,
    x: number,
    y: number,
    wall: string,
  ): boolean {
    // One step outside the room from the wall edge
    const behindOffsets: Record<string, { dx: number; dy: number }> = {
      north: { dx: 0, dy: -1 },
      south: { dx: 0, dy: 1 },
      east: { dx: 1, dy: 0 },
      west: { dx: -1, dy: 0 },
    };
    const off = behindOffsets[wall];
    if (!off) return true;

    const behind = tiles.get(tileKey(x + off.dx, y + off.dy));
    return behind !== undefined && behind.type === "wall";
  }

  /**
   * Searches along a wall for the nearest position that has a wall tile
   * behind it (not a doorway opening). Returns null if no valid position
   * exists on this wall.
   */
  private findWallBackedPosition(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
    placement: ExhibitPlacement,
  ): { x: number; y: number } | null {
    const wall = placement.wall;
    const isHorizontal = wall === "north" || wall === "south";

    // Fixed coordinate (perpendicular to wall)
    const fixedY = wall === "north" ? room.y : wall === "south" ? room.y + room.h - 1 : 0;
    const fixedX = wall === "west" ? room.x : wall === "east" ? room.x + room.w - 1 : 0;

    // Range along the wall (skip corners)
    const start = isHorizontal ? room.x + 1 : room.y + 1;
    const end = isHorizontal ? room.x + room.w - 2 : room.y + room.h - 2;
    const idealPos = isHorizontal
      ? room.x + 1 + Math.floor(placement.position * (room.w - 2))
      : room.y + 1 + Math.floor(placement.position * (room.h - 2));

    // Search outward from the ideal position
    for (let offset = 1; offset <= (end - start); offset++) {
      for (const dir of [1, -1]) {
        const along = idealPos + offset * dir;
        if (along < start || along > end) continue;

        const x = isHorizontal ? along : fixedX;
        const y = isHorizontal ? fixedY : along;
        const tile = tiles.get(tileKey(x, y));

        // Must be a floor tile with a wall behind it
        if (tile && tile.type === "floor" && this.hasWallBehind(tiles, x, y, wall)) {
          return { x, y };
        }
      }
    }

    return null;
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
      // Skip torches at doorway openings (no wall behind to mount on)
      if (!this.hasWallBehind(tiles, pos.x, pos.y, torch.wall)) continue;
      placeTile(tiles, pos.x, pos.y, { type: "torch" });
    }
  }

  /**
   * Places dev whiteboard exhibits on the anchor wall (opposite the entrance)
   * of every room that has devNotes. These are large panels showing designer
   * notes, spatial-beat info, and TODO items visible during playtesting.
   */
  private placeDevWhiteboards(
    tiles: Map<string, MuseumTile>,
    rooms: PlacedRoom[],
    edges: RoomEdge[],
    exhibits: ExhibitDefinition[],
  ): void {
    if (!DEV_WHITEBOARDS_ENABLED) return;

    for (const room of rooms) {
      if (!room.devNotes) continue;

      // Determine the entrance wall: find the main-path edge where this room
      // is the destination. The toWall on that edge is where visitors enter.
      // First room (entrance lobby) has no inbound edge — default to "south".
      let entranceWall: Direction = "south";
      const inboundEdge = edges.find((e) => e.to === room.id);
      if (inboundEdge) {
        entranceWall = inboundEdge.toWall as Direction;
      }

      // Anchor wall is opposite the entrance — the first wall visitors see
      const anchorWall = OPPOSITE_WALL[entranceWall];

      // Place centered on the anchor wall (position 0.5)
      const pos = this.computeWallPosition(room, anchorWall, 0.5);

      // If center lands on a doorway, shift along the wall to find a backed spot
      if (!this.hasWallBehind(tiles, pos.x, pos.y, anchorWall)) {
        const adjusted = this.findWallBackedPosition(tiles, room, {
          wall: anchorWall,
          position: 0.5,
          refId: `dev-wb-${room.id}`,
          facing: entranceWall,
        });
        if (!adjusted) continue; // entire wall is a doorway — skip
        pos.x = adjusted.x;
        pos.y = adjusted.y;
      }

      // Facing toward the room interior (same direction as the entrance wall)
      const facing = entranceWall;

      placeTile(tiles, pos.x, pos.y, {
        type: "exhibit-panel",
        refId: `dev-wb-${room.id}`,
        facing,
      });

      exhibits.push({
        id: `dev-wb-${room.id}`,
        tileX: pos.x,
        tileY: pos.y,
        size: "dev-whiteboard",
        plaque: {
          title: room.name,
          body: room.devNotes,
        },
      });
    }
  }

  /**
   * Finds a walkable tile near the center of a room.
   * Spirals outward from center until a walkable floor tile is found.
   */
  private findWalkableSpawn(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
  ): { x: number; y: number } {
    const centerX = room.x + Math.floor(room.w / 2);
    const centerY = room.y + Math.floor(room.h / 2);

    // Spiral outward from center
    for (let radius = 0; radius < Math.max(room.w, room.h); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const x = centerX + dx;
          const y = centerY + dy;
          const tile = tiles.get(tileKey(x, y));
          if (tile && isWalkable(tile.type)) {
            return { x, y };
          }
        }
      }
    }

    // Fallback: interior point (shouldn't reach here for valid rooms)
    return { x: room.x + 2, y: room.y + 2 };
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
          y: room.y,  // flush against north wall
        };
      case "south":
        return {
          x: room.x + 1 + Math.floor(position * interiorW),
          y: room.y + room.h - 1,  // flush against south wall
        };
      case "east":
        return {
          x: room.x + room.w - 1,  // flush against east wall
          y: room.y + 1 + Math.floor(position * interiorH),
        };
      case "west":
        return {
          x: room.x,  // flush against west wall
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
