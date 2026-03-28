/**
 * Museum 2D Game State Factory
 *
 * Tracks player position, facing direction, movement, and which interactable
 * the player is standing next to. Provides collision-checked movement and
 * interaction via the tile registry.
 */

import type {
  MuseumGrid,
  Direction,
  WingRegion,
} from "../domain/museum-grid-types";
import { tileKey } from "../domain/museum-grid-types";
import { isSolid, isInteractable } from "../domain/tile-registry";

const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

export function createMuseum2DState(grid: MuseumGrid) {
  let playerX = $state(grid.spawn.x);
  let playerY = $state(grid.spawn.y);
  let playerFacing = $state<Direction>(grid.spawn.facing);
  let isMoving = $state(false);

  // Interaction panel state — which definition ID is currently focused
  let focusedExhibitId = $state<string | null>(null);
  let focusedPerformerId = $state<string | null>(null);
  let focusedTriggerId = $state<string | null>(null);

  // Movement cooldown handled externally (keyboard repeat timer),
  // but we track "isMoving" for animation purposes
  let moveTimeout: ReturnType<typeof setTimeout> | null = null;

  function canMoveTo(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
    const tile = grid.tiles.get(tileKey(x, y));
    // Empty tile (not in the map) = void, can't walk there
    if (!tile) return false;
    return !isSolid(tile.type);
  }

  function movePlayer(direction: Direction) {
    const delta = DIRECTION_DELTAS[direction];
    const newX = playerX + delta.dx;
    const newY = playerY + delta.dy;

    // Always update facing, even if movement is blocked
    playerFacing = direction;

    if (!canMoveTo(newX, newY)) return;

    playerX = newX;
    playerY = newY;

    // Brief "isMoving" flag for animation — duration matches CSS transition (120ms)
    isMoving = true;
    if (moveTimeout) clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      isMoving = false;
    }, 120);

    // Check if we stepped onto a trigger
    checkTriggerAtPosition(newX, newY);
  }

  /**
   * Move diagonally by (dx, dy). Both axes must be non-zero.
   *
   * Prevents corner-cutting: the diagonal tile AND both adjacent cardinal tiles
   * must all be walkable. If any of the three is blocked, movement is cancelled.
   * Facing is set to the vertical axis (north/south) for consistency.
   */
  function moveDiagonal(dx: number, dy: number, preferredFacing: Direction) {
    const targetX = playerX + dx;
    const targetY = playerY + dy;
    const adjacentHX = playerX + dx; // same column, current row
    const adjacentHY = playerY;
    const adjacentVX = playerX;      // current column, same row
    const adjacentVY = playerY + dy;

    // Update facing regardless of whether movement succeeds
    playerFacing = preferredFacing;

    // All three tiles must be walkable to prevent corner-cutting
    if (
      !canMoveTo(targetX, targetY) ||
      !canMoveTo(adjacentHX, adjacentHY) ||
      !canMoveTo(adjacentVX, adjacentVY)
    ) return;

    playerX = targetX;
    playerY = targetY;

    isMoving = true;
    if (moveTimeout) clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      isMoving = false;
    }, 120);

    checkTriggerAtPosition(targetX, targetY);
  }

  function checkTriggerAtPosition(x: number, y: number) {
    const trigger = grid.triggers.find((t) => t.tileX === x && t.tileY === y);
    if (trigger) {
      focusedTriggerId = trigger.id;
      focusedExhibitId = null;
      focusedPerformerId = null;
    }
  }

  /**
   * Look at the tile the player is facing. If it's interactable, find the
   * matching exhibit or performer definition and focus it in the detail panel.
   */
  function interact() {
    const delta = DIRECTION_DELTAS[playerFacing];
    const targetX = playerX + delta.dx;
    const targetY = playerY + delta.dy;

    const tile = grid.tiles.get(tileKey(targetX, targetY));
    if (!tile || !isInteractable(tile.type)) {
      // Clear any previous focus
      focusedExhibitId = null;
      focusedPerformerId = null;
      focusedTriggerId = null;
      return;
    }

    // Find matching definition by tile coordinates
    const exhibit = grid.exhibits.find(
      (e) => e.tileX === targetX && e.tileY === targetY
    );
    if (exhibit) {
      focusedExhibitId = exhibit.id;
      focusedPerformerId = null;
      focusedTriggerId = null;
      return;
    }

    const performer = grid.performers.find(
      (p) => p.tileX === targetX && p.tileY === targetY
    );
    if (performer) {
      focusedPerformerId = performer.id;
      focusedExhibitId = null;
      focusedTriggerId = null;
      return;
    }

    // Fallback: use refId to find matching definition (handles multi-tile objects)
    if (tile.refId) {
      const exhibitByRef = grid.exhibits.find((e) => e.id === tile.refId);
      if (exhibitByRef) {
        focusedExhibitId = exhibitByRef.id;
        focusedPerformerId = null;
        focusedTriggerId = null;
        return;
      }
      const performerByRef = grid.performers.find((p) => p.id === tile.refId);
      if (performerByRef) {
        focusedPerformerId = performerByRef.id;
        focusedExhibitId = null;
        focusedTriggerId = null;
        return;
      }
    }
  }

  /**
   * Which wing region currently contains the player, if any.
   */
  function findCurrentWing(): WingRegion | null {
    return (
      grid.wings.find((w) => {
        const b = w.bounds;
        return (
          playerX >= b.x &&
          playerX < b.x + b.width &&
          playerY >= b.y &&
          playerY < b.y + b.height
        );
      }) ?? null
    );
  }

  function clearFocus() {
    focusedExhibitId = null;
    focusedPerformerId = null;
    focusedTriggerId = null;
  }

  return {
    get playerX() { return playerX; },
    get playerY() { return playerY; },
    get playerFacing() { return playerFacing; },
    get isMoving() { return isMoving; },
    get focusedExhibitId() { return focusedExhibitId; },
    get focusedPerformerId() { return focusedPerformerId; },
    get focusedTriggerId() { return focusedTriggerId; },
    get currentWing() { return findCurrentWing(); },
    get grid() { return grid; },

    movePlayer,
    moveDiagonal,
    interact,
    clearFocus,
  };
}

export type Museum2DState = ReturnType<typeof createMuseum2DState>;
