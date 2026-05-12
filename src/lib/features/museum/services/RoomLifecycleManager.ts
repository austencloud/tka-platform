/**
 * RoomLifecycleManager - progressive room loading state machine.
 *
 * Tracks whether each room is unvisited, active (geometry built), or cached
 * (geometry torn down but descriptor kept). When the player enters a room,
 * this manager computes the minimal diff: what to build, what to tear down,
 * and which rooms can skip expensive tile-bucketing because their descriptor
 * is already in memory.
 *
 * Design: one hop of adjacency = the active set. Current room + all direct
 * neighbors stay loaded. Everything else gets its geometry torn down and its
 * descriptor saved. On return, geometry rebuilds from the cached descriptor
 * in ~20ms instead of ~200ms.
 */

import type { RoomDescriptor } from "../domain/room-descriptor";
import type { RoomEdge } from "../domain/layout-types";
import { RoomState, type LifecycleUpdate } from "./types";

export { RoomState, type LifecycleUpdate };

export interface RoomLifecycleOptions {
  /**
   * How long (in ms) a room stays in the active set after the player leaves,
   * before transitioning to cached. Currently unused in the state-machine
   * approach (transitions are immediate) but reserved for a future
   * hysteresis layer so callers can delay teardown during fast traversal.
   */
  hysteresisMs?: number;
}

export class RoomLifecycleManager {
  /** room → set of directly connected rooms */
  private readonly adjacency = new Map<string, Set<string>>();
  /** Current lifecycle state for every known room */
  private readonly states = new Map<string, RoomState>();
  /** Descriptor cache - survives geometry teardown */
  private readonly descriptors = new Map<string, RoomDescriptor>();

  constructor(edges: RoomEdge[], _options: RoomLifecycleOptions = {}) {
    // Build bidirectional adjacency graph and register every room we know about.
    for (const edge of edges) {
      if (!this.adjacency.has(edge.from)) this.adjacency.set(edge.from, new Set());
      if (!this.adjacency.has(edge.to)) this.adjacency.set(edge.to, new Set());
      this.adjacency.get(edge.from)!.add(edge.to);
      this.adjacency.get(edge.to)!.add(edge.from);
    }

    // Every room starts unvisited.
    for (const roomId of this.adjacency.keys()) {
      this.states.set(roomId, RoomState.Unvisited);
    }
  }

  getRoomState(roomId: string): RoomState {
    return this.states.get(roomId) ?? RoomState.Unvisited;
  }

  getAllRoomIds(): string[] {
    return [...this.adjacency.keys()];
  }

  onPlayerEnteredRoom(roomId: string): LifecycleUpdate {
    // The desired active set is the current room, direct neighbors (1 hop),
    // AND neighbors-of-neighbors (2 hops). Two hops ensures the player never
    // sees an unloaded room through a corridor-doorway chain: when you stand
    // in room A and look through room B's doorway, room C is already built.
    const desiredActive = new Set<string>([roomId]);
    const hop1 = new Set<string>();
    const neighbors = this.adjacency.get(roomId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        desiredActive.add(neighbor);
        hop1.add(neighbor);
      }
    }
    // Second hop: neighbors of neighbors
    for (const hop1Room of hop1) {
      const hop2Neighbors = this.adjacency.get(hop1Room);
      if (hop2Neighbors) {
        for (const hop2Room of hop2Neighbors) {
          desiredActive.add(hop2Room);
        }
      }
    }

    const toActivate: string[] = [];
    const fromCache: string[] = [];
    const priorities = new Map<string, number>();

    // Rooms that need to become active.
    for (const id of desiredActive) {
      const current = this.states.get(id) ?? RoomState.Unvisited;
      if (current !== RoomState.Active) {
        toActivate.push(id);

        // If this room already has a cached descriptor, rebuilding is cheap.
        if (current === RoomState.Cached) {
          fromCache.push(id);
        }

        this.states.set(id, RoomState.Active);
      }

      // Assign priority: current room = 0, direct neighbors = 1, 2-hop = 2.
      if (id === roomId) {
        priorities.set(id, 0);
      } else if (hop1.has(id)) {
        priorities.set(id, 1);
      } else {
        priorities.set(id, 2);
      }
    }

    // Rooms that were active but are no longer in the desired set → cache them.
    const toCache: string[] = [];
    for (const [id, state] of this.states) {
      if (state === RoomState.Active && !desiredActive.has(id)) {
        toCache.push(id);
        this.states.set(id, RoomState.Cached);
      }
    }

    return { toActivate, toCache, fromCache, priorities };
  }

  cacheDescriptor(roomId: string, descriptor: RoomDescriptor): void {
    this.descriptors.set(roomId, descriptor);
  }

  getCachedDescriptor(roomId: string): RoomDescriptor | null {
    return this.descriptors.get(roomId) ?? null;
  }
}
