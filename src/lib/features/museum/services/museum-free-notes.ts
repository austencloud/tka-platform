/**
 * Free-standing note placement.
 *
 * K's posted notes are authored as room-relative offsets (the furniture
 * frame: -0.5..0.5 of the room's bounds). The scene and the HUD both need the
 * same world position — one to draw the post, one to know when the visitor is
 * close enough to read it — so the conversion lives here.
 *
 * Cave chambers are terrain, not flat floor: an authored offset can land on
 * rock or in deep water. A post goes on the nearest floor the visitor can
 * stand on, searched outward tile by tile inside the room.
 */
import type { MuseumGrid } from "../domain/museum-grid-types";
import { tileKey } from "../domain/museum-grid-types";
import { isWalkable } from "../domain/tile-registry";
import { FREE_ANNOTATIONS, type FreeAnnotation } from "../data/museum-annotations";

export interface PlacedNote {
  note: FreeAnnotation;
  roomId: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  yaw: number;
}

function standable(grid: MuseumGrid, tx: number, ty: number, tileSize: number): boolean {
  const tile = grid.tiles.get(tileKey(tx, ty));
  if (!tile || !isWalkable(tile.type)) return false;
  return !grid.terrain?.blockedAt(tx * tileSize, ty * tileSize);
}

/**
 * Nearest standable tile to (tx, ty) anywhere in the room, or null when the
 * room has no floor at all. Rooms are a few hundred tiles; a full scan is
 * cheaper than being wrong about a spiral's radius.
 */
function snapToFloor(
  grid: MuseumGrid,
  tx: number,
  ty: number,
  bounds: { x: number; y: number; width: number; height: number },
  tileSize: number
): { tx: number; ty: number } | null {
  let best: { tx: number; ty: number } | null = null;
  let bestDist = Infinity;
  for (let cy = bounds.y; cy < bounds.y + bounds.height; cy++) {
    for (let cx = bounds.x; cx < bounds.x + bounds.width; cx++) {
      const dist = (cx - tx) ** 2 + (cy - ty) ** 2;
      if (dist >= bestDist) continue;
      if (!standable(grid, cx, cy, tileSize)) continue;
      best = { tx: cx, ty: cy };
      bestDist = dist;
    }
  }
  return best;
}

/** World placements for every free note the grid has a room for. */
export function placeFreeNotes(grid: MuseumGrid, tileSize: number): PlacedNote[] {
  const placed: PlacedNote[] = [];
  for (const note of FREE_ANNOTATIONS) {
    const wing = grid.wings.find((w) => w.id === note.roomId);
    if (!wing) continue;
    const b = wing.bounds;
    const wantX = Math.round(b.x + b.width / 2 + note.offsetX * b.width);
    const wantY = Math.round(b.y + b.height / 2 + note.offsetY * b.height);
    const spot = snapToFloor(grid, wantX, wantY, b, tileSize);
    if (!spot) continue;
    const worldX = spot.tx * tileSize;
    const worldZ = spot.ty * tileSize;
    let worldY = 0;
    try {
      worldY = grid.terrain?.elevationAt(worldX, worldZ) ?? 0;
    } catch {
      // A terrain program that cannot place this point still has a floor at datum.
      worldY = 0;
    }
    placed.push({
      note,
      roomId: note.roomId,
      worldX,
      worldY,
      worldZ,
      yaw: note.yaw ?? 0,
    });
  }
  return placed;
}
