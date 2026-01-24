/**
 * ISyncRoomBroadcaster
 *
 * Interface for broadcasting sync room presence to Firebase RTDB.
 * Allows other devices to discover active sync sessions.
 */

import type { SyncRoom } from '../../domain/models/lan-sync-models';

export interface ISyncRoomBroadcaster {
	/** Whether currently broadcasting a room */
	readonly isBroadcasting: boolean;

	/** Current room data if broadcasting */
	readonly currentRoom: SyncRoom | null;

	/**
	 * Start broadcasting a sync room to Firebase.
	 * Sets up onDisconnect handler for automatic cleanup.
	 */
	broadcast(
		sequenceId: string,
		sequenceWord: string,
		peerJsRoomCode: string
	): Promise<void>;

	/**
	 * Stop broadcasting the current room.
	 * Removes the room from Firebase immediately.
	 */
	stopBroadcasting(): Promise<void>;

	/** Clean up resources */
	destroy(): void;
}
