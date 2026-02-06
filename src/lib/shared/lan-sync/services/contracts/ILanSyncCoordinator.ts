/**
 * ILanSyncCoordinator
 *
 * Interface for orchestrating LAN playback synchronization.
 * Manages the sync protocol, state updates, and heartbeats.
 */

import type { SyncedPlaybackState, PeerConnectionState } from '../../domain/models/lan-sync-models';

export interface ILanSyncCoordinator {
	/** Current connection state */
	readonly connectionState: PeerConnectionState;

	/** Current synced playback state */
	readonly playbackState: SyncedPlaybackState;

	/** Whether sync is currently active */
	readonly isActive: boolean;

	/** Create a new sync room (become host) */
	createRoom(initialState: Partial<SyncedPlaybackState>): Promise<string>;

	/** Join an existing sync room */
	joinRoom(roomCode: string): Promise<void>;

	/** Disconnect from sync */
	disconnect(): void;

	/**
	 * Toggle sync for a sequence - the simple one-tap API.
	 * If not syncing: tries to join existing room, or creates one if none exists.
	 * If already syncing: disconnects.
	 * Returns true if now syncing, false if disconnected.
	 *
	 * @param sequenceId - The sequence ID to sync
	 * @param sequenceWord - Human-readable sequence word for display in discovery banners
	 * @param initialState - Optional initial playback state
	 */
	toggleSync(
		sequenceId: string,
		sequenceWord: string,
		initialState?: Partial<SyncedPlaybackState>
	): Promise<boolean>;

	/**
	 * Join a room by its PeerJS room code (used when joining from discovery banner).
	 */
	joinRoomByCode(peerJsRoomCode: string): Promise<void>;

	/** Update playback state (will broadcast to peers) */
	updatePlaybackState(update: Partial<SyncedPlaybackState>): void;

	/** Set the current sequence ID (for mismatch detection) */
	setSequenceId(sequenceId: string | null): void;

	/** Subscribe to playback state changes from peers */
	onPlaybackStateChange(callback: (state: SyncedPlaybackState) => void): () => void;

	/** Subscribe to connection state changes */
	onConnectionStateChange(callback: (state: PeerConnectionState) => void): () => void;

	/** Subscribe to sequence mismatch warnings */
	onSequenceMismatch(callback: (peerSequenceId: string | null) => void): () => void;

	/** Clean up resources */
	destroy(): void;
}
