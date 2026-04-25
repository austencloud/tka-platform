/**
 * Device Sync Coordinator Contract
 *
 * The main orchestrator for multi-device synchronization.
 * Coordinates HLC clocks, CRDT state merging, playback calculation,
 * and peer communication to achieve frame-accurate sync.
 */

import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type {
	SyncConnectionState,
	SyncedRoomState,
	ViewMode
} from '../../domain/sync-types';

/**
 * Interface for the main device sync coordinator.
 *
 * This orchestrator ties together:
 * - HybridLogicalClock for causal ordering
 * - PlaybackPositionCalculator for deterministic playback
 * - StateMerger for CRDT state merging
 * - SequenceLocalCache for instant sequence loading
 * - PeerConnectionManager for WebRTC communication
 */
export interface IDeviceSyncCoordinator {
	/**
	 * Current connection state (reactive via getter).
	 * Includes status, room code, peer count, and quality metrics.
	 */
	readonly connectionState: SyncConnectionState;

	/**
	 * Current room state (reactive via getter).
	 * Null when not connected to a room.
	 */
	readonly roomState: SyncedRoomState | null;

	/**
	 * This device's view mode (local only, not synced).
	 * Each device can independently choose animation, grid, or both.
	 */
	viewMode: ViewMode;

	/**
	 * This device's display name (set during sync/join).
	 */
	readonly displayName: string;

	/**
	 * Create or join a sync room for a sequence.
	 *
	 * This method is idempotent: if a room already exists for this sequence,
	 * we join it. Otherwise, we create a new room and become the host.
	 *
	 * The room code is deterministically derived from the sequence ID,
	 * ensuring all devices syncing the same sequence end up in the same room.
	 *
	 * @param sequence - The sequence to sync
	 * @param displayName - Display name for this device in the room
	 * @returns The room code (for display/sharing)
	 */
	sync(sequence: SequenceData, displayName: string): Promise<string>;

	/**
	 * Join an existing room by code.
	 *
	 * Use this when manually entering a room code (e.g., from QR code or text input).
	 *
	 * @param roomCode - The room code to join
	 * @param displayName - Display name for this device in the room
	 */
	joinRoom(roomCode: string, displayName: string): Promise<void>;

	/**
	 * Leave the current room and disconnect.
	 * Broadcasts a graceful PEER_LEAVE message before disconnecting.
	 */
	disconnect(): void;

	// =========================================================================
	// Playback Controls
	// These create and broadcast new intents to all peers.
	// =========================================================================

	/**
	 * Start playback from the current position.
	 * Creates a new PlaybackIntent with playing=true.
	 */
	play(): void;

	/**
	 * Pause playback at the current position.
	 * Creates a new PlaybackIntent with playing=false.
	 */
	pause(): void;

	/**
	 * Seek to a specific step.
	 * Creates a new PlaybackIntent with the target as anchor.
	 *
	 * @param step - The step to seek to (integer)
	 */
	seek(step: number): void;

	/**
	 * Set the playback speed.
	 *
	 * @param speed - Speed multiplier (1.0 = normal, 0.5 = half, 2.0 = double)
	 */
	setSpeed(speed: number): void;

	/**
	 * Toggle looping on/off.
	 */
	toggleLoop(): void;

	// =========================================================================
	// Position Calculation
	// =========================================================================

	/**
	 * Get the current playback position.
	 * Calculated locally from the current intent using the deterministic equation.
	 *
	 * @returns Current step (fractional during animation)
	 */
	getCurrentStep(): number;

	/**
	 * Get the corrected position for smooth rendering.
	 * Applies drift correction to smoothly sync to the target position.
	 *
	 * @param lastRenderedStep - The step rendered in the previous frame
	 * @returns Corrected step position
	 */
	getCorrectedStep(lastRenderedStep: number): number;

	/**
	 * Set the beat duration for position calculations.
	 * Should be called when BPM changes.
	 *
	 * @param durationMs - Duration of one beat in milliseconds
	 */
	setStepDuration(durationMs: number): void;

	// =========================================================================
	// Event Subscriptions
	// =========================================================================

	/**
	 * Subscribe to room state changes.
	 * Called when playback intent, peers, or sequence info changes.
	 *
	 * @param callback - Function called when room state changes
	 * @returns Unsubscribe function
	 */
	onRoomStateChange(callback: (state: SyncedRoomState | null) => void): () => void;

	/**
	 * Subscribe to connection state changes.
	 * Called when status, quality, or peer count changes.
	 *
	 * @param callback - Function called when connection state changes
	 * @returns Unsubscribe function
	 */
	onConnectionStateChange(callback: (state: SyncConnectionState) => void): () => void;

	// =========================================================================
	// Lifecycle
	// =========================================================================

	/**
	 * Clean up all resources.
	 * Disconnects from room, clears subscriptions, stops heartbeat.
	 */
	destroy(): void;
}
