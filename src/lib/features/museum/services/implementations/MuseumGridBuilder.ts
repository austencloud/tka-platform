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
  FurnitureDefinition,
  Direction,
} from "../../domain/museum-grid-types";
import type { ExhibitPlacement, PerformerPlacement, TorchPlacement, FurniturePlacement } from "../../domain/layout-types";
import { tileKey } from "../../domain/museum-grid-types";
import { isWalkable } from "../../domain/tile-registry";
import { placeTile } from "../../data/museum-floor-plan";
import { GraphLayoutEngine } from "./GraphLayoutEngine";
import { CorridorRouter } from "./CorridorRouter";
import { LayoutValidator } from "./LayoutValidator";
import { ROOM_CONTENT } from "../../data/museum-room-content";
import { DEV_WHITEBOARDS_ENABLED, OPPOSITE_WALL } from "../../domain/museum-design-rules";
import type { PlaqueSize } from "../contracts/IPlaqueTextureGenerator";

/**
 * How far each exhibit size extends from its center tile, in grid tiles.
 * Derived from the 3D plaque widths in MuseumPlaque3D.svelte divided by
 * tileScale (0.5m). A standard plaque is 0.9m wide = 1.8 tiles, so it
 * extends ~1 tile on each side. A dev-whiteboard is 2.5m = 5 tiles, so
 * it extends ~3 tiles on each side. We round up to be safe.
 */
const EXHIBIT_HALF_SPAN: Record<PlaqueSize, number> = {
  standard: 1,
  "large": 2,
  "dev-whiteboard": 3,
};

/**
 * Tracks where exhibits have been placed along each wall segment so we
 * can detect visual overlap. Key: "roomId:wall", value: occupied ranges
 * (center tile coordinate + half-span in tiles).
 */
interface OccupiedRange {
  center: number;
  halfSpan: number;
}

export class MuseumGridBuilder implements IMuseumGridBuilder {
  private layoutEngine = new GraphLayoutEngine();
  private corridorRouter = new CorridorRouter();
  private validator = new LayoutValidator();

  /** Reset per build() call — tracks visual footprint of placed exhibits */
  private wallOccupancy = new Map<string, OccupiedRange[]>();

  private rangesOverlap(
    wallKey: string,
    center: number,
    halfSpan: number,
  ): boolean {
    const ranges = this.wallOccupancy.get(wallKey) ?? [];
    const newMin = center - halfSpan;
    const newMax = center + halfSpan;
    return ranges.some((r) => {
      const existMin = r.center - r.halfSpan;
      const existMax = r.center + r.halfSpan;
      return newMin < existMax && newMax > existMin;
    });
  }

  private recordOccupancy(
    wallKey: string,
    center: number,
    halfSpan: number,
  ): void {
    if (!this.wallOccupancy.has(wallKey)) {
      this.wallOccupancy.set(wallKey, []);
    }
    this.wallOccupancy.get(wallKey)!.push({ center, halfSpan });
  }

  /**
   * Returns the "along-the-wall" coordinate for a position: X for
   * horizontal walls (north/south), Y for vertical walls (east/west).
   */
  private alongCoord(x: number, y: number, wall: string): number {
    return wall === "north" || wall === "south" ? x : y;
  }

  build(rooms: RoomNode[], edges: RoomEdge[], config: GridConfig): MuseumGridBuildResult {
    this.wallOccupancy.clear();

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
    const furniture: FurnitureDefinition[] = [];

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
      this.placeFurniture(room, furniture);
    }

    // Step 4b: Place dev whiteboards (designer notes on anchor walls)
    this.placeDevWhiteboards(tiles, layout.rooms, edges, exhibits);

    // Step 5: Determine spawn position — south end of entrance, centered, facing north
    // Player starts at the "doors" end of the grand hallway and walks toward the cave
    const firstRoom = layout.rooms[0]!;
    const spawnX = firstRoom.x + Math.floor(firstRoom.w / 2);
    const spawnY = firstRoom.y + firstRoom.h - 8; // 8 tiles from south wall — safely inside the doors

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
      furniture,
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
    const NEIGHBORS: [number, number][] = [
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
      const plaqueSize: PlaqueSize = placement.size ?? "standard";
      const halfSpan = EXHIBIT_HALF_SPAN[plaqueSize];
      const wallKey = `${room.id}:${placement.wall}`;

      // Check wall-behind AND overlap with already-placed exhibits
      const needsReposition =
        !this.hasWallBehindSpan(tiles, pos.x, pos.y, placement.wall, halfSpan) ||
        this.rangesOverlap(wallKey, this.alongCoord(pos.x, pos.y, placement.wall), halfSpan);

      if (needsReposition) {
        const adjusted = this.findNonOverlappingPosition(
          tiles, room, placement, halfSpan, wallKey,
        );
        if (!adjusted) continue; // no space on this wall
        pos.x = adjusted.x;
        pos.y = adjusted.y;
      }

      placeTile(tiles, pos.x, pos.y, {
        type: "exhibit-panel",
        refId: placement.refId,
        facing: placement.facing,
      });

      // Record this exhibit's visual footprint on the wall
      this.recordOccupancy(
        wallKey,
        this.alongCoord(pos.x, pos.y, placement.wall),
        halfSpan,
      );

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
   * Checks whether there's a wall tile directly behind a single position.
   * "Behind" means one step outside the room in the direction the wall faces.
   */
  private hasWallBehind(
    tiles: Map<string, MuseumTile>,
    x: number,
    y: number,
    wall: string,
  ): boolean {
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
   * Checks that every tile in the exhibit's visual span has a wall behind it.
   * A standard plaque occupies ~2 tiles, a dev-whiteboard ~5 tiles. If any
   * tile in the span has a corridor behind it (doorway), the plaque would
   * visually cover the passageway.
   */
  private hasWallBehindSpan(
    tiles: Map<string, MuseumTile>,
    x: number,
    y: number,
    wall: string,
    halfSpan: number,
  ): boolean {
    const isHorizontal = wall === "north" || wall === "south";

    for (let offset = -halfSpan; offset <= halfSpan; offset++) {
      const checkX = isHorizontal ? x + offset : x;
      const checkY = isHorizontal ? y : y + offset;
      if (!this.hasWallBehind(tiles, checkX, checkY, wall)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Searches along a wall for the nearest position where the exhibit's full
   * visual span has wall tiles behind it (no doorway overlap). Returns null
   * if no valid position exists on this wall.
   */
  private findWallBackedPosition(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
    placement: ExhibitPlacement,
    halfSpan: number = 0,
  ): { x: number; y: number } | null {
    const wall = placement.wall;
    const isHorizontal = wall === "north" || wall === "south";

    // Fixed coordinate (perpendicular to wall)
    const fixedY = wall === "north" ? room.y : wall === "south" ? room.y + room.h - 1 : 0;
    const fixedX = wall === "west" ? room.x : wall === "east" ? room.x + room.w - 1 : 0;

    // Range along the wall — ensure the exhibit's span fits within the room
    // by shrinking the valid range by halfSpan on each side
    const start = (isHorizontal ? room.x + 1 : room.y + 1) + halfSpan;
    const end = (isHorizontal ? room.x + room.w - 2 : room.y + room.h - 2) - halfSpan;
    if (start > end) return null; // room too small for this exhibit size

    const idealPos = isHorizontal
      ? room.x + 1 + Math.floor(placement.position * (room.w - 2))
      : room.y + 1 + Math.floor(placement.position * (room.h - 2));

    // Clamp ideal position to valid range
    const clampedIdeal = Math.max(start, Math.min(end, idealPos));

    // Check ideal position first
    {
      const x = isHorizontal ? clampedIdeal : fixedX;
      const y = isHorizontal ? fixedY : clampedIdeal;
      const tile = tiles.get(tileKey(x, y));
      if (tile && tile.type === "floor" && this.hasWallBehindSpan(tiles, x, y, wall, halfSpan)) {
        return { x, y };
      }
    }

    // Search outward from the ideal position
    for (let offset = 1; offset <= (end - start); offset++) {
      for (const dir of [1, -1]) {
        const along = clampedIdeal + offset * dir;
        if (along < start || along > end) continue;

        const x = isHorizontal ? along : fixedX;
        const y = isHorizontal ? fixedY : along;
        const tile = tiles.get(tileKey(x, y));

        // Must be a floor tile with wall behind the full span
        if (tile && tile.type === "floor" && this.hasWallBehindSpan(tiles, x, y, wall, halfSpan)) {
          return { x, y };
        }
      }
    }

    return null;
  }

  /**
   * Like findWallBackedPosition but also rejects positions that would
   * overlap with exhibits already placed on this wall.
   */
  private findNonOverlappingPosition(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
    placement: ExhibitPlacement,
    halfSpan: number,
    wallKey: string,
  ): { x: number; y: number } | null {
    const wall = placement.wall;
    const isHorizontal = wall === "north" || wall === "south";

    const fixedY = wall === "north" ? room.y : wall === "south" ? room.y + room.h - 1 : 0;
    const fixedX = wall === "west" ? room.x : wall === "east" ? room.x + room.w - 1 : 0;

    const start = (isHorizontal ? room.x + 1 : room.y + 1) + halfSpan;
    const end = (isHorizontal ? room.x + room.w - 2 : room.y + room.h - 2) - halfSpan;
    if (start > end) return null;

    const idealPos = isHorizontal
      ? room.x + 1 + Math.floor(placement.position * (room.w - 2))
      : room.y + 1 + Math.floor(placement.position * (room.h - 2));
    const clampedIdeal = Math.max(start, Math.min(end, idealPos));

    const isValid = (along: number): boolean => {
      const x = isHorizontal ? along : fixedX;
      const y = isHorizontal ? fixedY : along;
      const tile = tiles.get(tileKey(x, y));
      return (
        !!tile &&
        tile.type === "floor" &&
        this.hasWallBehindSpan(tiles, x, y, wall, halfSpan) &&
        !this.rangesOverlap(wallKey, along, halfSpan)
      );
    };

    // Check ideal position first
    if (isValid(clampedIdeal)) {
      const x = isHorizontal ? clampedIdeal : fixedX;
      const y = isHorizontal ? fixedY : clampedIdeal;
      return { x, y };
    }

    // Search outward from the ideal position
    for (let offset = 1; offset <= (end - start); offset++) {
      for (const dir of [1, -1]) {
        const along = clampedIdeal + offset * dir;
        if (along < start || along > end) continue;
        if (isValid(along)) {
          const x = isHorizontal ? along : fixedX;
          const y = isHorizontal ? fixedY : along;
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
   * Places furniture definitions inside a room based on center-relative offsets.
   * Furniture doesn't stamp tiles — it only produces FurnitureDefinition entries
   * that the 3D renderer reads to place GLTF models.
   */
  private placeFurniture(
    room: PlacedRoom,
    furniture: FurnitureDefinition[],
  ): void {
    if (!room.furniture) return;

    const centerX = room.x + Math.floor(room.w / 2);
    const centerY = room.y + Math.floor(room.h / 2);
    const interiorW = room.w - 2;
    const interiorH = room.h - 2;

    for (let i = 0; i < room.furniture.length; i++) {
      const placement = room.furniture[i]!;
      const px = centerX + Math.floor(placement.offsetX * interiorW);
      const py = centerY + Math.floor(placement.offsetY * interiorH);

      furniture.push({
        id: `${room.id}-furniture-${i}`,
        role: placement.role,
        tileX: px,
        tileY: py,
        rotationY: placement.rotationY ?? 0,
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

      const wallKey = `${room.id}:${torch.wall}`;
      const along = this.alongCoord(pos.x, pos.y, torch.wall);

      // Skip if an exhibit already occupies this spot
      if (this.rangesOverlap(wallKey, along, 0)) continue;

      placeTile(tiles, pos.x, pos.y, { type: "torch" });

      // Record torch position so exhibits placed later won't overlap it
      this.recordOccupancy(wallKey, along, 1);
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
      const wbHalfSpan = EXHIBIT_HALF_SPAN["dev-whiteboard"];
      const wallKey = `${room.id}:${anchorWall}`;

      // Dev whiteboards are 2.5m wide (~5 tiles). Check wall backing AND
      // overlap with exhibits already placed on this wall.
      const wbPlacement = {
        wall: anchorWall,
        position: 0.5,
        refId: `dev-wb-${room.id}`,
        facing: entranceWall,
      };

      const needsReposition =
        !this.hasWallBehindSpan(tiles, pos.x, pos.y, anchorWall, wbHalfSpan) ||
        this.rangesOverlap(wallKey, this.alongCoord(pos.x, pos.y, anchorWall), wbHalfSpan);

      if (needsReposition) {
        const adjusted = this.findNonOverlappingPosition(
          tiles, room, wbPlacement, wbHalfSpan, wallKey,
        );
        if (!adjusted) continue; // no space on this wall
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

      // Record whiteboard's visual footprint
      this.recordOccupancy(
        wallKey,
        this.alongCoord(pos.x, pos.y, anchorWall),
        wbHalfSpan,
      );

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
