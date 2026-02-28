/**
 * ISyncRoomDiscovery
 *
 * Interface for browsing nearby sync rooms from Firebase RTDB.
 * Watches for rooms and notifies when they appear/disappear.
 */

import type { SyncRoomWithId } from '../../domain/models/lan-sync-models';

export interface ISyncRoomDiscovery {
	/** Whether discovery is currently active */
	readonly isBrowsing: boolean;

	/** Currently discovered nearby rooms (excluding own rooms) */
	readonly nearbyRooms: SyncRoomWithId[];

	/**
	 * Start browsing sync rooms.
	 * Watches Firebase RTDB for rooms and filters out own rooms.
	 */
	startDiscovery(): Promise<void>;

	/**
	 * Stop browsing rooms.
	 * Unsubscribes from Firebase listener.
	 */
	stopDiscovery(): void;

	/**
	 * Subscribe to changes in nearby rooms.
	 * Callback receives the updated list whenever rooms change.
	 * Returns unsubscribe function.
	 */
	onNearbyRoomsChange(callback: (rooms: SyncRoomWithId[]) => void): () => void;

	/** Clean up resources */
	destroy(): void;
}
