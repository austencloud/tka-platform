/**
 * MuseumProximityRenderer
 *
 * Manages proximity-grid-based visibility for museum fixtures (torches,
 * plaques, performers, lights, furniture). Owns the 7 proximity grids and
 * the pending-mount queue that throttles component instantiation across frames.
 *
 * All visible-item arrays ($state) stay in the Svelte component. This class
 * computes what should be visible and returns the results for the component
 * to apply.
 */

import { ProximityGrid } from "./proximity-grid";
import type {
  RoomChunk,
  PlaquePlacement,
  TorchPosition,
  LightPosition,
} from "./museum-geometry-builder";
import type { MuseumGrid } from "../domain/museum-grid-types";

// ── Constants ──

const CELL_SIZE = 8;
const _MOUNT_RADIUS = 30;
const _UNMOUNT_RADIUS = 40;

export const PROXIMITY_MAX_MOUNTS_PER_FRAME = 2;

// ── Types ──

export type MountCategory =
  | "torch"
  | "plaque"
  | "performer"
  | "exhibitLight"
  | "ceilingLight"
  | "sunlight"
  | "furniture";

export interface PendingMount {
  category: MountCategory;
  item: unknown;
}

export class MuseumProximityRenderer {
  // Proximity grids
  torchGrid: ProximityGrid<TorchPosition>;
  plaqueGrid: ProximityGrid<PlaquePlacement>;
  performerGrid: ProximityGrid<unknown>;
  exhibitLightGrid: ProximityGrid<LightPosition>;
  ceilingLightGrid: ProximityGrid<LightPosition>;
  sunlightGrid: ProximityGrid<LightPosition>;
  furnitureGrid: ProximityGrid<unknown>;

  // Movement tracking for recompute threshold
  lastCheckTX = -999;
  lastCheckTY = -999;

  constructor(grid: MuseumGrid) {
    this.torchGrid = new ProximityGrid<TorchPosition>(CELL_SIZE);
    this.plaqueGrid = new ProximityGrid<PlaquePlacement>(CELL_SIZE);
    this.performerGrid = new ProximityGrid<unknown>(CELL_SIZE);
    this.exhibitLightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
    this.ceilingLightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
    this.sunlightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
    this.furnitureGrid = new ProximityGrid<unknown>(CELL_SIZE);

    // Populate furniture and performer grids immediately
    for (const f of (grid.furniture ?? [])) {
      this.furnitureGrid.insert(f, f.tileX, f.tileY);
    }
    for (const p of grid.performers) {
      this.performerGrid.insert(p, p.tileX, p.tileY);
    }
  }

  /**
   * Build global proximity grids from ALL active chunks.
   * Called after all chunks are built.
   */
  buildGlobalProximityGrids(
    corridorChunk: RoomChunk | null,
    activeRoomChunks: Map<string, RoomChunk>,
  ): void {
    this.torchGrid = new ProximityGrid<TorchPosition>(CELL_SIZE);
    this.plaqueGrid = new ProximityGrid<PlaquePlacement>(CELL_SIZE);
    this.exhibitLightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
    this.ceilingLightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
    this.sunlightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);

    const allChunks = [corridorChunk, ...activeRoomChunks.values()].filter(Boolean) as RoomChunk[];
    for (const chunk of allChunks) {
      for (const t of chunk.torchPositions) this.torchGrid.insert(t, t.tileX, t.tileY);
      for (const p of chunk.plaquePlacements) this.plaqueGrid.insert(p, p.tileX, p.tileY);
      for (const l of chunk.exhibitLightPositions) this.exhibitLightGrid.insert(l, l.tileX, l.tileY);
      for (const l of chunk.ceilingLightPositions) this.ceilingLightGrid.insert(l, l.tileX, l.tileY);
      for (const l of chunk.sunlightPositions) this.sunlightGrid.insert(l, l.tileX, l.tileY);
    }
  }

  /**
   * Insert a newly activated room's fixtures into the proximity grids.
   */
  insertChunkFixtures(chunk: RoomChunk): void {
    for (const t of chunk.torchPositions) this.torchGrid.insert(t, t.tileX, t.tileY);
    for (const p of chunk.plaquePlacements) this.plaqueGrid.insert(p, p.tileX, p.tileY);
    for (const l of chunk.exhibitLightPositions) this.exhibitLightGrid.insert(l, l.tileX, l.tileY);
    for (const l of chunk.ceilingLightPositions) this.ceilingLightGrid.insert(l, l.tileX, l.tileY);
    for (const l of chunk.sunlightPositions) this.sunlightGrid.insert(l, l.tileX, l.tileY);
  }

  /**
   * Check if the player has moved enough to warrant a visibility recompute.
   * Returns true if the player moved 4+ tiles from the last check.
   */
  shouldRecompute(currentTX: number, currentTY: number): boolean {
    const dCheckX = currentTX - this.lastCheckTX;
    const dCheckY = currentTY - this.lastCheckTY;
    return dCheckX * dCheckX + dCheckY * dCheckY >= 16;
  }

  /**
   * Recompute visibility based on player position.
   * Currently a no-op: all components are mounted globally at init.
   */
  recomputeVisibility(_playerTX: number, _playerTY: number): void {
    // All components are mounted globally at init. No proximity-based
    // mount/unmount needed. This eliminates Svelte component mounting
    // during gameplay entirely.
  }

  /**
   * Get all plaque placements from all active chunks.
   */
  getAllPlaquePlacements(
    corridorChunk: RoomChunk | null,
    activeRoomChunks: Map<string, RoomChunk>,
  ): PlaquePlacement[] {
    const all: PlaquePlacement[] = [];
    if (corridorChunk) all.push(...corridorChunk.plaquePlacements);
    for (const chunk of activeRoomChunks.values()) all.push(...chunk.plaquePlacements);
    return all;
  }
}
