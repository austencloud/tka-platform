/**
 * State Merger Contract
 *
 * Handles CRDT-based merging of room state from multiple peers.
 * Uses Last-Writer-Wins semantics based on HLC timestamps.
 */

import type { HLCTimestamp, PlaybackIntent, PeerInfo, SyncedRoomState, ViewMode } from '../../domain/sync-types';

/**
 * Result of a merge operation.
 */
export interface MergeResult {
	/** The merged state */
	state: SyncedRoomState;

	/** Whether the local state was changed */
	localChanged: boolean;

	/** Which fields were updated */
	updatedFields: Set<'playback' | 'sequence' | 'peers'>;
}

/**
 * Interface for CRDT-based state merging.
 */
export interface IStateMerger {
	/**
	 * Merge remote state into local state using CRDT semantics.
	 *
	 * For each field:
	 * - playback: LWW-Register by HLC (latest intent wins)
	 * - sequence: Prefer the one with data, else latest by HLC
	 * - peers: Union merge (all peers from both states)
	 *
	 * @param local - Current local state
	 * @param remote - Incoming remote state
	 * @returns The merged state and change info
	 */
	merge(local: SyncedRoomState, remote: SyncedRoomState): MergeResult;

	/**
	 * Merge a single playback intent into the current state.
	 *
	 * @param currentState - Current room state
	 * @param intent - The incoming intent
	 * @returns Updated state (or same reference if no change)
	 */
	mergeIntent(currentState: SyncedRoomState, intent: PlaybackIntent): SyncedRoomState;

	/**
	 * Merge a peer info update.
	 *
	 * @param currentState - Current room state
	 * @param peerInfo - Updated peer info
	 * @returns Updated state
	 */
	mergePeerInfo(currentState: SyncedRoomState, peerInfo: PeerInfo): SyncedRoomState;

	/**
	 * Remove a peer from the state.
	 *
	 * @param currentState - Current room state
	 * @param nodeId - Node ID of the peer to remove
	 * @returns Updated state
	 */
	removePeer(currentState: SyncedRoomState, nodeId: string): SyncedRoomState;

	/**
	 * Create a new playback intent.
	 *
	 * @param playing - Whether playback is active
	 * @param anchorStep - Step position at creation time
	 * @param speed - Playback speed
	 * @param loop - Whether to loop
	 * @param totalSteps - Total steps in sequence
	 * @returns A new PlaybackIntent with fresh HLC timestamp
	 */
	createIntent(
		playing: boolean,
		anchorStep: number,
		speed: number,
		loop: boolean,
		totalSteps: number
	): PlaybackIntent;

	/**
	 * Create peer info for this device.
	 *
	 * @param displayName - Display name
	 * @param viewMode - Current view mode
	 * @returns PeerInfo for this device
	 */
	createPeerInfo(displayName: string, viewMode: ViewMode): PeerInfo;
}
