/**
 * Device Sync Reactive State
 *
 * Svelte 5 reactive state wrapper for DeviceSyncCoordinator.
 * Bridges the coordinator (plain TypeScript) with Svelte's reactivity system.
 *
 * This state layer:
 * - Maintains reactive $state() properties that Svelte can track
 * - Subscribes to coordinator callbacks and updates state
 * - Provides an animation frame loop for smooth step updates during playback
 * - Exposes a singleton for global access
 */

import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type {
	SyncConnectionState,
	SyncedRoomState,
	ViewMode,
	SyncConnectionStatus
} from '../domain/sync-types';
import { createInitialConnectionState } from '../domain/sync-types';

// ============================================================================
// Coordinator Interface (expected from DeviceSyncCoordinator)
// ============================================================================

/**
 * Expected interface for the DeviceSyncCoordinator.
 * Defined here to avoid circular dependencies.
 * The actual implementation will be provided via initialize().
 */
export interface IDeviceSyncCoordinator {
	/** Subscribe to connection state changes */
	onConnectionStateChange(callback: (state: SyncConnectionState) => void): () => void;

	/** Subscribe to room state changes */
	onRoomStateChange(callback: (state: SyncedRoomState | null) => void): () => void;

	/** Get the current calculated step (based on playback intent) */
	getCurrentStep(): number;

	/** Create a room and start syncing a sequence */
	sync(sequence: SequenceData, displayName: string): Promise<string>;

	/** Join an existing room */
	joinRoom(roomCode: string, displayName: string): Promise<void>;

	/** Disconnect from the current room */
	disconnect(): void;

	/** Start playback */
	play(): void;

	/** Pause playback */
	pause(): void;

	/** Seek to a specific step */
	seek(step: number): void;

	/** Set playback speed */
	setSpeed(speed: number): void;

	/** Toggle loop mode */
	toggleLoop(): void;

	/** Clean up all resources */
	destroy(): void;
}

// ============================================================================
// Reactive State Class
// ============================================================================

/**
 * Reactive state wrapper for DeviceSyncCoordinator.
 *
 * Provides Svelte 5 reactive access to sync state while delegating
 * all operations to the underlying coordinator.
 */
class DeviceSyncState {
	// =========================================================================
	// Reactive State (Svelte 5 runes)
	// =========================================================================

	private _connectionState = $state<SyncConnectionState>(createInitialConnectionState());
	private _roomState = $state<SyncedRoomState | null>(null);
	private _viewMode = $state<ViewMode>('animation');
	private _currentStep = $state<number>(0);

	// =========================================================================
	// Non-Reactive Internals
	// =========================================================================

	private coordinator: IDeviceSyncCoordinator | null = null;
	private unsubscribers: Array<() => void> = [];
	private animationFrameId: number | null = null;

	// =========================================================================
	// Public Getters (Reactive)
	// =========================================================================

	/** Current connection state */
	get connectionState(): SyncConnectionState {
		return this._connectionState;
	}

	/** Current room state (null if not in a room) */
	get roomState(): SyncedRoomState | null {
		return this._roomState;
	}

	/** Current view mode (local preference, not synced) */
	get viewMode(): ViewMode {
		return this._viewMode;
	}

	/** Current playback step (updated every animation frame during playback) */
	get currentStep(): number {
		return this._currentStep;
	}

	// =========================================================================
	// Derived Getters
	// =========================================================================

	/** Whether connected to a room */
	get isConnected(): boolean {
		return this._connectionState.status === 'connected';
	}

	/** Whether playback is currently active */
	get isPlaying(): boolean {
		return this._roomState?.playback.playing ?? false;
	}

	/** Number of connected peers */
	get peerCount(): number {
		return this._connectionState.peerCount;
	}

	/** Current sequence word (if in a room) */
	get sequenceWord(): string | null {
		return this._roomState?.sequence.word ?? null;
	}

	/** Current room code (if in a room) */
	get roomCode(): string | null {
		return this._connectionState.roomCode;
	}

	/** Total steps in the sequence */
	get totalSteps(): number {
		return this._roomState?.playback.totalSteps ?? 0;
	}

	/** Current playback speed */
	get speed(): number {
		return this._roomState?.playback.speed ?? 1.0;
	}

	/** Whether loop mode is enabled */
	get loop(): boolean {
		return this._roomState?.playback.loop ?? true;
	}

	/** Connection quality indicator */
	get quality(): SyncConnectionState['quality'] {
		return this._connectionState.quality;
	}

	// =========================================================================
	// Initialization
	// =========================================================================

	/**
	 * Initialize with a coordinator instance.
	 * Sets up subscriptions and syncs initial state.
	 */
	initialize(coordinator: IDeviceSyncCoordinator): void {
		// Clean up any previous coordinator
		this.cleanup();

		this.coordinator = coordinator;

		// Subscribe to connection state changes
		this.unsubscribers.push(
			coordinator.onConnectionStateChange((state) => {
				this._connectionState = state;
			})
		);

		// Subscribe to room state changes
		this.unsubscribers.push(
			coordinator.onRoomStateChange((state) => {
				this._roomState = state;

				// Manage animation frame loop based on playback state
				if (state?.playback.playing) {
					this.startStepUpdateLoop();
				} else {
					this.stopStepUpdateLoop();
					// Update step one final time when paused
					if (this.coordinator) {
						this._currentStep = this.coordinator.getCurrentStep();
					}
				}
			})
		);
	}

	// =========================================================================
	// Room Operations (Delegated to Coordinator)
	// =========================================================================

	/**
	 * Create a room and start syncing a sequence.
	 * @returns The generated room code
	 */
	async sync(sequence: SequenceData, displayName: string): Promise<string> {
		if (!this.coordinator) {
			throw new Error('Device sync not initialized');
		}
		return this.coordinator.sync(sequence, displayName);
	}

	/**
	 * Join an existing room by code.
	 */
	async joinRoom(roomCode: string, displayName: string): Promise<void> {
		if (!this.coordinator) {
			throw new Error('Device sync not initialized');
		}
		return this.coordinator.joinRoom(roomCode, displayName);
	}

	/**
	 * Disconnect from the current room.
	 */
	disconnect(): void {
		this.stopStepUpdateLoop();
		this.coordinator?.disconnect();
	}

	// =========================================================================
	// Playback Controls (Delegated to Coordinator)
	// =========================================================================

	/** Start playback */
	play(): void {
		this.coordinator?.play();
	}

	/** Pause playback */
	pause(): void {
		this.coordinator?.pause();
	}

	/** Seek to a specific step */
	seek(step: number): void {
		this.coordinator?.seek(step);
		// Immediately update local step for responsive UI
		this._currentStep = step;
	}

	/** Set playback speed */
	setSpeed(speed: number): void {
		this.coordinator?.setSpeed(speed);
	}

	/** Toggle loop mode */
	toggleLoop(): void {
		this.coordinator?.toggleLoop();
	}

	// =========================================================================
	// Local State (Not Synced)
	// =========================================================================

	/**
	 * Set view mode (local only, not synced to peers).
	 * Each device chooses how to display the sequence independently.
	 */
	setViewMode(mode: ViewMode): void {
		this._viewMode = mode;
	}

	// =========================================================================
	// Animation Frame Loop
	// =========================================================================

	/**
	 * Start the animation frame loop for updating currentStep.
	 * This provides smooth, frame-accurate step updates during playback.
	 */
	private startStepUpdateLoop(): void {
		if (this.animationFrameId !== null) return;

		const update = () => {
			if (this.coordinator && this._roomState?.playback.playing) {
				this._currentStep = this.coordinator.getCurrentStep();
			}
			this.animationFrameId = requestAnimationFrame(update);
		};

		this.animationFrameId = requestAnimationFrame(update);
	}

	/**
	 * Stop the animation frame loop.
	 */
	private stopStepUpdateLoop(): void {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	// =========================================================================
	// Cleanup
	// =========================================================================

	/**
	 * Clean up all subscriptions and resources.
	 * Call this when the sync system is no longer needed.
	 */
	cleanup(): void {
		// Stop animation frame loop
		this.stopStepUpdateLoop();

		// Unsubscribe from all callbacks
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];

		// Destroy coordinator
		this.coordinator?.destroy();
		this.coordinator = null;

		// Reset state to initial values
		this._connectionState = createInitialConnectionState();
		this._roomState = null;
		this._currentStep = 0;
		// Keep viewMode - it's a user preference
	}
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global singleton state for device sync */
export const deviceSyncState = new DeviceSyncState();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a human-readable connection status text.
 */
export function getConnectionStatusText(status: SyncConnectionStatus): string {
	switch (status) {
		case 'disconnected':
			return 'Not connected';
		case 'creating-room':
			return 'Creating room...';
		case 'waiting-for-peer':
			return 'Waiting for device...';
		case 'joining-room':
			return 'Joining room...';
		case 'connected':
			return 'Connected';
		case 'reconnecting':
			return 'Reconnecting...';
		case 'error':
			return 'Connection error';
		default:
			return 'Unknown';
	}
}

/**
 * Get a human-readable quality indicator.
 */
export function getQualityIndicator(quality: SyncConnectionState['quality']): {
	label: string;
	color: string;
} {
	switch (quality) {
		case 'excellent':
			return { label: 'Excellent', color: 'var(--semantic-success)' };
		case 'good':
			return { label: 'Good', color: 'var(--semantic-success)' };
		case 'degraded':
			return { label: 'Fair', color: 'var(--semantic-warning)' };
		case 'poor':
			return { label: 'Poor', color: 'var(--semantic-error)' };
		case 'disconnected':
			return { label: 'Disconnected', color: 'var(--theme-text-muted)' };
		default:
			return { label: 'Unknown', color: 'var(--theme-text-muted)' };
	}
}
