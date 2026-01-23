/**
 * LAN Sync Reactive State
 *
 * Svelte 5 reactive state for LAN playback synchronization.
 * Bridges the coordinator service with Svelte's reactivity system.
 */

import type { ILanSyncCoordinator } from '../services/contracts/ILanSyncCoordinator';
import type { SyncedPlaybackState, PeerConnectionState } from '../domain/models/lan-sync-models';
import { createInitialConnectionState, createInitialPlaybackState } from '../domain/models/lan-sync-models';

/** Reactive state for LAN sync */
class LanSyncState {
	private _connectionState = $state<PeerConnectionState>(createInitialConnectionState());
	private _playbackState = $state<SyncedPlaybackState>(createInitialPlaybackState());
	private _sequenceMismatchWarning = $state<string | null>(null);
	private _coordinator: ILanSyncCoordinator | null = null;
	private unsubscribers: Array<() => void> = [];

	/** Current connection state */
	get connectionState(): PeerConnectionState {
		return this._connectionState;
	}

	/** Current synced playback state */
	get playbackState(): SyncedPlaybackState {
		return this._playbackState;
	}

	/** Whether sync is active */
	get isActive(): boolean {
		const status = this._connectionState.status;
		return status === 'connected' || status === 'waiting-for-peer';
	}

	/** Whether connected to at least one peer */
	get isConnected(): boolean {
		return this._connectionState.status === 'connected';
	}

	/** Current room code (if any) */
	get roomCode(): string | null {
		return this._connectionState.roomCode;
	}

	/** Whether this device is the host */
	get isHost(): boolean {
		return this._connectionState.isHost;
	}

	/** Sequence mismatch warning from peer */
	get sequenceMismatchWarning(): string | null {
		return this._sequenceMismatchWarning;
	}

	/** Initialize with a coordinator instance */
	initialize(coordinator: ILanSyncCoordinator): void {
		this.cleanup();
		this._coordinator = coordinator;

		// Subscribe to state changes
		this.unsubscribers.push(
			coordinator.onConnectionStateChange((state) => {
				this._connectionState = state;
			})
		);

		this.unsubscribers.push(
			coordinator.onPlaybackStateChange((state) => {
				this._playbackState = state;
			})
		);

		this.unsubscribers.push(
			coordinator.onSequenceMismatch((peerSequenceId) => {
				this._sequenceMismatchWarning = peerSequenceId;
			})
		);

		// Sync initial state
		this._connectionState = coordinator.connectionState;
		this._playbackState = coordinator.playbackState;
	}

	/** Create a new sync room */
	async createRoom(initialState: Partial<SyncedPlaybackState> = {}): Promise<string> {
		if (!this._coordinator) {
			throw new Error('LAN sync not initialized');
		}
		return this._coordinator.createRoom(initialState);
	}

	/** Join an existing room */
	async joinRoom(roomCode: string): Promise<void> {
		if (!this._coordinator) {
			throw new Error('LAN sync not initialized');
		}
		return this._coordinator.joinRoom(roomCode);
	}

	/** Disconnect from sync */
	disconnect(): void {
		this._coordinator?.disconnect();
		this._sequenceMismatchWarning = null;
	}

	/** Update playback state (broadcasts to peers) */
	updatePlayback(update: Partial<SyncedPlaybackState>): void {
		this._coordinator?.updatePlaybackState(update);
	}

	/** Set the current sequence ID */
	setSequenceId(sequenceId: string | null): void {
		this._coordinator?.setSequenceId(sequenceId);
	}

	/** Clear the sequence mismatch warning */
	clearMismatchWarning(): void {
		this._sequenceMismatchWarning = null;
	}

	/** Clean up subscriptions */
	cleanup(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		this._coordinator = null;
		this._connectionState = createInitialConnectionState();
		this._playbackState = createInitialPlaybackState();
		this._sequenceMismatchWarning = null;
	}
}

/** Global singleton state for LAN sync */
export const lanSyncState = new LanSyncState();

/** Helper to get display-friendly connection status */
export function getConnectionStatusText(status: PeerConnectionState['status']): string {
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
