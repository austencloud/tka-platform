/**
 * IRoomLifecycleManager — contract for the progressive room loading state machine.
 *
 * The lifecycle manager tracks which rooms are active (geometry built), cached
 * (descriptor saved but geometry torn down), or unvisited (never loaded).
 * When the player enters a room, the manager computes exactly what needs to
 * change — what to build, what to tear down, and what can be rebuilt fast
 * from a cached descriptor — without the caller having to understand the
 * adjacency graph or state transitions.
 */

import type { RoomDescriptor } from "../../domain/room-descriptor";

export enum RoomState {
  Unvisited = "unvisited",
  Active = "active",
  Cached = "cached",
}

/**
 * The diff produced when the player enters a new room.
 * Callers apply this diff to the scene: build geometry for toActivate,
 * tear it down for toCache, and skip the expensive bucketing pass for
 * rooms listed in fromCache (they have a descriptor ready).
 */
export interface LifecycleUpdate {
  /** Rooms that need geometry built (first visit or returning from cache). */
  toActivate: string[];
  /** Rooms that should have their geometry torn down (player moved away). */
  toCache: string[];
  /**
   * Subset of toActivate that have cached descriptors.
   * These can skip the tile-bucketing phase — just replay the descriptor.
   */
  fromCache: string[];
  /**
   * Build priority for each room in toActivate.
   * 0 = current room (player is standing here), 1 = adjacent (prefetch).
   */
  priorities: Map<string, number>;
}

export interface IRoomLifecycleManager {
  /** Current lifecycle state of a room — unvisited, active, or cached. */
  getRoomState(roomId: string): RoomState;

  /**
   * All room IDs known to the manager (every node reachable via the edge graph).
   * Useful for iterating all possible rooms without hard-coding a list.
   */
  getAllRoomIds(): string[];

  /**
   * Called when the player physically enters a room.
   * Returns a diff describing what geometry changes are needed.
   * The current room and all rooms one hop away become the active set.
   * Rooms that were active but fell outside that set are moved to cached.
   */
  onPlayerEnteredRoom(roomId: string): LifecycleUpdate;

  /**
   * Stores a room descriptor after geometry is built.
   * The descriptor survives geometry teardown so the room can be rebuilt
   * quickly if the player returns.
   */
  cacheDescriptor(roomId: string, descriptor: RoomDescriptor): void;

  /**
   * Returns the cached descriptor for a room, or null if none exists.
   * A null result means this is a first-time build and bucketing is needed.
   */
  getCachedDescriptor(roomId: string): RoomDescriptor | null;
}
