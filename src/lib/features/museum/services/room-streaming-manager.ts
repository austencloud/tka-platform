import type { StreamingUpdate } from "./types";
import type { WingRegion } from "../domain/museum-grid-types";
import type { RoomEdge } from "../domain/layout-types";

/**
 * Manages which museum rooms have geometry loaded based on player position.
 * Loads current room + adjacent rooms (connected by doors). Disposes rooms
 * that haven't been needed for a hysteresis period to avoid thrashing.
 */
export class RoomStreamingManager {
  /** room → set of rooms connected by doors */
  private adjacency = new Map<string, Set<string>>();
  /** Currently loaded room IDs */
  private loadedRooms = new Set<string>();
  /** Room ID → timestamp when it left the active set (for hysteresis) */
  private disposeTimers = new Map<string, number>();
  private hysteresisMs: number;

  constructor(edges: RoomEdge[], hysteresisMs = 5000) {
    this.hysteresisMs = hysteresisMs;

    // Build adjacency graph from edges
    for (const edge of edges) {
      if (!this.adjacency.has(edge.from)) this.adjacency.set(edge.from, new Set());
      if (!this.adjacency.has(edge.to)) this.adjacency.set(edge.to, new Set());
      this.adjacency.get(edge.from)!.add(edge.to);
      this.adjacency.get(edge.to)!.add(edge.from);
    }
  }

  getAdjacentRooms(roomId: string): Set<string> {
    return this.adjacency.get(roomId) ?? new Set();
  }

  getRoomAtTile(tileX: number, tileY: number, wings: WingRegion[]): string | null {
    for (const wing of wings) {
      const b = wing.bounds;
      if (tileX >= b.x && tileX < b.x + b.width &&
          tileY >= b.y && tileY < b.y + b.height) {
        return wing.id;
      }
    }
    return null;
  }

  update(currentRoomId: string | null): StreamingUpdate {
    const now = performance.now();

    // Compute the desired active set: current room + adjacent rooms
    const activeSet = new Set<string>();
    if (currentRoomId) {
      activeSet.add(currentRoomId);
      const adjacent = this.adjacency.get(currentRoomId);
      if (adjacent) {
        for (const id of adjacent) activeSet.add(id);
      }
    }

    // Rooms to load: in active set but not yet loaded
    const toLoad: string[] = [];
    for (const id of activeSet) {
      if (!this.loadedRooms.has(id)) {
        toLoad.push(id);
        this.loadedRooms.add(id);
        // Clear any pending dispose timer
        this.disposeTimers.delete(id);
      }
    }

    // Rooms to potentially dispose: loaded but not in active set
    const toDispose: string[] = [];
    for (const id of this.loadedRooms) {
      if (!activeSet.has(id)) {
        if (!this.disposeTimers.has(id)) {
          this.disposeTimers.set(id, now);
        } else if (now - this.disposeTimers.get(id)! >= this.hysteresisMs) {
          toDispose.push(id);
          this.loadedRooms.delete(id);
          this.disposeTimers.delete(id);
        }
      } else {
        // Room is back in active set - cancel any pending dispose
        this.disposeTimers.delete(id);
      }
    }

    return { toLoad, toDispose, activeSet };
  }

  /** Force-load a room immediately (e.g., for portal teleportation) */
  forceLoad(roomId: string): void {
    this.loadedRooms.add(roomId);
    this.disposeTimers.delete(roomId);
  }

  /** Reset all state (e.g., on grid rebuild) */
  reset(): void {
    this.loadedRooms.clear();
    this.disposeTimers.clear();
  }
}
