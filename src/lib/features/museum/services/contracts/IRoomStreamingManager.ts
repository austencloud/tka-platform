import type { WingRegion } from "../../domain/museum-grid-types";

export interface StreamingUpdate {
  /** Room IDs that should be loaded (not already loaded) */
  toLoad: string[];
  /** Room IDs that should be disposed (loaded but no longer needed) */
  toDispose: string[];
  /** All room IDs that should currently be loaded */
  activeSet: Set<string>;
}

export interface IRoomStreamingManager {
  /** Returns load/dispose instructions based on the player's current room */
  update(currentRoomId: string | null): StreamingUpdate;
  /** Find which room contains a tile position, or null if in a corridor */
  getRoomAtTile(tileX: number, tileY: number, wings: WingRegion[]): string | null;
  /** Get IDs of rooms adjacent to the given room (connected by doors) */
  getAdjacentRooms(roomId: string): Set<string>;
}
