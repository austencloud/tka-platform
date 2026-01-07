/**
 * IGalleryPositionSyncer - Real-time position synchronization
 *
 * Handles broadcasting local player position and receiving remote player updates.
 * Optimized for low-latency updates with debouncing and interpolation support.
 */

import type { LocalPlayerState, RemotePlayer } from '../../domain/multiplayer-models';

export interface IGalleryPositionSyncer {
	// =========================================================================
	// Initialization
	// =========================================================================

	/**
	 * Start syncing for the given session
	 * Sets up listeners and onDisconnect handlers
	 */
	startSync(sessionId: string): Promise<void>;

	/**
	 * Stop syncing and clean up listeners
	 */
	stopSync(): Promise<void>;

	/**
	 * Check if currently syncing
	 */
	isSyncing(): boolean;

	// =========================================================================
	// Local Player Broadcasting
	// =========================================================================

	/**
	 * Update the local player's state
	 * Debounced internally to avoid flooding the network
	 */
	updateLocalState(state: LocalPlayerState): void;

	/**
	 * Force an immediate broadcast (bypasses debounce)
	 * Use sparingly - for important state changes
	 */
	broadcastNow(): Promise<void>;

	/**
	 * Set the local player's status
	 */
	setStatus(status: 'active' | 'idle' | 'away'): void;

	// =========================================================================
	// Remote Players
	// =========================================================================

	/**
	 * Get all remote players with interpolated positions
	 * Call this every frame to get smooth positions for rendering
	 */
	getRemotePlayers(): RemotePlayer[];

	/**
	 * Update interpolation for all remote players
	 * Call this every frame with delta time
	 * @param deltaTime Time since last frame in seconds
	 */
	updateInterpolation(deltaTime: number): void;

	/**
	 * Subscribe to remote player changes
	 * Called when players join, leave, or update
	 * @returns Unsubscribe function
	 */
	subscribeToRemotePlayers(callback: (players: RemotePlayer[]) => void): () => void;

	// =========================================================================
	// Utility
	// =========================================================================

	/**
	 * Get the local player's user ID
	 */
	getLocalUserId(): string | null;

	/**
	 * Check if a player is nearby (within threshold distance)
	 */
	isPlayerNearby(playerId: string, threshold?: number): boolean;

	/**
	 * Get players sorted by distance from local player
	 */
	getPlayersByDistance(): RemotePlayer[];
}

export const IGalleryPositionSyncer = Symbol.for('IGalleryPositionSyncer');
