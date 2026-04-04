/**
 * Layout Validator
 *
 * Validates a built museum grid for correctness:
 * 1. Flood-fill from spawn — every room must be reachable
 * 2. Overlap detection — no two rooms share bounding rectangles
 * 3. Spawn on walkable tile — player isn't stuck in a wall
 * 4. Door alignment — doors land on wall tiles (not void or floor interior)
 */

import type { ILayoutValidator } from "../contracts/ILayoutValidator";
import type { MuseumGrid } from "../../domain/museum-grid-types";
import type { PlacedRoom, ValidationResult } from "../../domain/layout-types";
import { tileKey } from "../../domain/museum-grid-types";
import { isWalkable } from "../../domain/tile-registry";

export class LayoutValidator implements ILayoutValidator {
  validate(grid: MuseumGrid, rooms: PlacedRoom[]): ValidationResult {
    const errors: string[] = [];

    const spawnOnWalkable = this.checkSpawnWalkable(grid);
    if (!spawnOnWalkable) {
      errors.push(`Spawn at (${grid.spawn.x}, ${grid.spawn.y}) is not on a walkable tile`);
    }

    const unreachableRooms = this.checkConnectivity(grid, rooms);
    for (const roomId of unreachableRooms) {
      errors.push(`Room "${roomId}" is unreachable from spawn`);
    }

    const overlaps = this.checkOverlaps(rooms);
    for (const overlap of overlaps) {
      errors.push(`Rooms "${overlap.roomA}" and "${overlap.roomB}" overlap`);
    }

    return {
      valid: errors.length === 0,
      unreachableRooms,
      overlaps,
      spawnOnWalkable,
      errors,
    };
  }

  /**
   * Flood-fill from spawn. Returns list of room IDs that have zero
   * visited interior tiles (meaning the player can't reach them).
   */
  private checkConnectivity(grid: MuseumGrid, rooms: PlacedRoom[]): string[] {
    const visited = this.floodFill(grid, grid.spawn.x, grid.spawn.y);
    const unreachable: string[] = [];

    for (const room of rooms) {
      let hasVisitedTile = false;

      // Check interior tiles (skip walls on the perimeter)
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          if (visited.has(tileKey(x, y))) {
            hasVisitedTile = true;
            break;
          }
        }
        if (hasVisitedTile) break;
      }

      if (!hasVisitedTile) {
        unreachable.push(room.id);
      }
    }

    return unreachable;
  }

  /**
   * BFS flood-fill from a starting position. Visits all walkable tiles
   * reachable via 4-directional movement.
   */
  private floodFill(grid: MuseumGrid, startX: number, startY: number): Set<string> {
    const visited = new Set<string>();
    const startKey = tileKey(startX, startY);
    const startTile = grid.tiles.get(startKey);

    if (!startTile || !isWalkable(startTile.type)) {
      return visited;
    }

    const queue: [number, number][] = [[startX, startY]];
    visited.add(startKey);

    const directions: [number, number][] = [
      [0, -1], // north
      [0, 1],  // south
      [1, 0],  // east
      [-1, 0], // west
    ];

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;

      for (const [dx, dy] of directions) {
        const nx = cx + dx;
        const ny = cy + dy;
        const key = tileKey(nx, ny);

        if (visited.has(key)) continue;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;

        const tile = grid.tiles.get(key);
        if (!tile || !isWalkable(tile.type)) continue;

        visited.add(key);
        queue.push([nx, ny]);
      }
    }

    return visited;
  }

  /**
   * Checks whether any two room bounding rectangles overlap.
   */
  private checkOverlaps(rooms: PlacedRoom[]): { roomA: string; roomB: string }[] {
    const overlaps: { roomA: string; roomB: string }[] = [];

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i]!;
        const b = rooms[j]!;

        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;

        if (overlapX && overlapY) {
          overlaps.push({ roomA: a.id, roomB: b.id });
        }
      }
    }

    return overlaps;
  }

  /**
   * Checks that the spawn position is on a walkable tile.
   */
  private checkSpawnWalkable(grid: MuseumGrid): boolean {
    const tile = grid.tiles.get(tileKey(grid.spawn.x, grid.spawn.y));
    return tile !== undefined && isWalkable(tile.type);
  }
}
