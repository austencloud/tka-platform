/**
 * Museum Grid Builder
 *
 * Orchestrates the full layout pipeline:
 * 1. Layout engine computes room positions from the abstract graph
 * 2. Carve room floors
 * 3. Stamp wall segments (exhibits, doors, torches) via WallSegmentStamper
 * 4. Route corridors using stamped door positions
 * 5. Carve corridor floors
 * 6. Derive walls from adjacency
 * 7. Place performers + furniture
 * 8. Set spawn position
 * 9. Run validation
 */

import type { IMuseumGridBuilder, MuseumGridBuildResult } from "../contracts/IMuseumGridBuilder";
import type { RoomNode, RoomEdge, GridConfig, PlacedRoom, CorridorSegment } from "../../domain/layout-types";
import type {
  MuseumGrid,
  MuseumTile,
  ExhibitDefinition,
  PerformerDefinition,
  FurnitureDefinition,
} from "../../domain/museum-grid-types";
import { tileKey } from "../../domain/museum-grid-types";
import { isWalkable } from "../../domain/tile-registry";
import { GraphLayoutEngine } from "./GraphLayoutEngine";
import { CorridorRouter } from "./CorridorRouter";
import { LayoutValidator } from "./LayoutValidator";
import { WallSegmentStamper } from "./WallSegmentStamper";
import { ROOM_CONTENT } from "../../data/museum-room-content";

export class MuseumGridBuilder implements IMuseumGridBuilder {
  private layoutEngine = new GraphLayoutEngine();
  private corridorRouter = new CorridorRouter();
  private validator = new LayoutValidator();

  build(rooms: RoomNode[], edges: RoomEdge[], config: GridConfig): MuseumGridBuildResult {
    // Step 1: Compute room positions
    const layout = this.layoutEngine.computeLayout(rooms, edges, config);
    const roomLookup = new Map(layout.rooms.map((r) => [r.id, r]));

    const tiles = new Map<string, MuseumTile>();
    const exhibits: ExhibitDefinition[] = [];
    const performers: PerformerDefinition[] = [];
    const furniture: FurnitureDefinition[] = [];

    // Step 2: Carve room floors
    for (const room of layout.rooms) {
      this.carveRoomFloor(tiles, room);
    }

    // Step 3: Stamp wall segments + collect door positions
    const stamper = new WallSegmentStamper();
    const allDoorPositions = new Map<string, { x: number; y: number }>();

    for (const room of layout.rooms) {
      const result = stamper.stampRoom(tiles, room, edges);
      exhibits.push(...result.exhibits);
      for (const dp of result.doorPositions) {
        allDoorPositions.set(dp.edgeId, { x: dp.x, y: dp.y });
      }
    }

    // Step 4: Route corridors using stamped door positions
    const corridorData: { edge: RoomEdge; segments: CorridorSegment[] }[] = [];
    for (const edge of edges) {
      const fromRoom = roomLookup.get(edge.from);
      const toRoom = roomLookup.get(edge.to);
      if (!fromRoom || !toRoom) continue;
      const segments = this.corridorRouter.routeCorridor(fromRoom, toRoom, edge, allDoorPositions);
      corridorData.push({ edge, segments });
    }

    // Step 5: Carve corridor floors
    for (const { segments } of corridorData) {
      this.carveCorridorFloor(tiles, segments);
    }

    // Step 6: Derive walls — any empty tile adjacent to a walkable tile becomes a wall
    this.deriveWalls(tiles, layout.gridWidth, layout.gridHeight);

    // Step 7: Place performers + furniture
    for (const room of layout.rooms) {
      this.placePerformers(tiles, room, performers);
      this.placeFurniture(room, furniture);
    }

    // Step 8: Spawn position — south end of entrance, centered, facing north
    const firstRoom = layout.rooms[0]!;
    const spawnX = firstRoom.x + Math.floor(firstRoom.w / 2);
    const spawnY = firstRoom.y + firstRoom.h - 8;

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

    // Step 9: Validate
    const validation = this.validator.validate(grid, layout.rooms);

    return { grid, validation };
  }

  /**
   * Stamps a tile onto the grid at the given position.
   */
  private placeTile(tiles: Map<string, MuseumTile>, x: number, y: number, tile: MuseumTile): void {
    tiles.set(tileKey(x, y), tile);
  }

  /**
   * Carve room interior as floor tiles only.
   * No walls — walls are derived later from adjacency.
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
   * Carve corridor segments as floor tiles only.
   * Each segment is a straight run. The corridor width expands perpendicular
   * to the run direction.
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
   * Derive walls from adjacency.
   * Any empty tile (not in the map) that is adjacent (8-directional)
   * to a walkable tile becomes a wall.
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

    const wallPositions: { x: number; y: number }[] = [];

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const key = tileKey(x, y);
        if (tiles.has(key)) continue;

        const adjacentToWalkable = NEIGHBORS.some(([dx, dy]) => {
          const tile = tiles.get(tileKey(x + dx, y + dy));
          return tile !== undefined && isWalkable(tile.type);
        });

        if (adjacentToWalkable) {
          wallPositions.push({ x, y });
        }
      }
    }

    for (const pos of wallPositions) {
      tiles.set(tileKey(pos.x, pos.y), { type: "wall" });
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

      const interiorW = room.w - 2;
      const interiorH = room.h - 2;
      const px = centerX + Math.floor(placement.offsetX * interiorW);
      const py = centerY + Math.floor(placement.offsetY * interiorH);

      this.placeTile(tiles, px, py, {
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
   * Finds a walkable tile near the center of a room.
   * Spirals outward from center until a walkable floor tile is found.
   */
  private findWalkableSpawn(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
  ): { x: number; y: number } {
    const centerX = room.x + Math.floor(room.w / 2);
    const centerY = room.y + Math.floor(room.h / 2);

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

    return { x: room.x + 2, y: room.y + 2 };
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
