/**
 * LanSyncCoordinator
 *
 * Orchestrates LAN playback synchronization between devices.
 * Manages the sync protocol, state updates, heartbeats, and conflict resolution.
 */

import type { ILanSyncCoordinator } from '../contracts/ILanSyncCoordinator';
import type { IPeerConnectionManager } from '../contracts/IPeerConnectionManager';
import type {
	SyncedPlaybackState,
	PeerConnectionState,
	SyncMessage,
	LanSyncConfig
} from '../../domain/models/lan-sync-models';
import {
	createInitialPlaybackState,
	DEFAULT_LAN_SYNC_CONFIG
} from '../../domain/models/lan-sync-models';

export class LanSyncCoordinator implements ILanSyncCoordinator {
	private _playbackState: SyncedPlaybackState = createInitialPlaybackState();
	private config: LanSyncConfig;

	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private lastHeartbeatReceived: number = 0;
	private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;

	private playbackStateCallbacks: Set<(state: SyncedPlaybackState) => void> = new Set();
	private connectionStateCallbacks: Set<(state: PeerConnectionState) => void> = new Set();
	private sequenceMismatchCallbacks: Set<(peerSequenceId: string | null) => void> = new Set();

	private unsubscribers: Array<() => void> = [];

	constructor(
		private peerManager: IPeerConnectionManager,
		config: Partial<LanSyncConfig> = {}
	) {
		this.config = { ...DEFAULT_LAN_SYNC_CONFIG, ...config };
		this.setupMessageHandler();
		this.setupConnectionStateForwarding();
	}

	get connectionState(): PeerConnectionState {
		return this.peerManager.connectionState;
	}

	get playbackState(): SyncedPlaybackState {
		return this._playbackState;
	}

	get isActive(): boolean {
		const status = this.connectionState.status;
		return status === 'connected' || status === 'waiting-for-peer';
	}

	async createRoom(initialState: Partial<SyncedPlaybackState> = {}): Promise<string> {
		this._playbackState = {
			...createInitialPlaybackState(),
			...initialState,
			timestamp: Date.now()
		};

		const roomCode = await this.peerManager.createRoom();
		this.startHeartbeat();

		return roomCode;
	}

	async joinRoom(roomCode: string): Promise<void> {
		await this.peerManager.joinRoom(roomCode);
		this.startHeartbeat();

		// Request full state from host
		this.peerManager.broadcast({
			type: 'REQUEST_FULL_STATE',
			timestamp: Date.now(),
			senderId: this.connectionState.peerId || 'unknown'
		});
	}

	disconnect(): void {
		this.stopHeartbeat();
		this.peerManager.disconnect();
		this._playbackState = createInitialPlaybackState();
	}

	updatePlaybackState(update: Partial<SyncedPlaybackState>): void {
		const newState = {
			...this._playbackState,
			...update,
			timestamp: Date.now()
		};

		this._playbackState = newState;

		// Broadcast to peers
		if (this.connectionState.status === 'connected') {
			this.peerManager.broadcast({
				type: 'STATE_UPDATE',
				timestamp: newState.timestamp,
				senderId: this.connectionState.peerId || 'unknown',
				state: update
			});
		}

		// Notify local listeners
		this.notifyPlaybackStateChange(newState);
	}

	setSequenceId(sequenceId: string | null): void {
		if (this._playbackState.sequenceId !== sequenceId) {
			this.updatePlaybackState({ sequenceId });
		}
	}

	onPlaybackStateChange(callback: (state: SyncedPlaybackState) => void): () => void {
		this.playbackStateCallbacks.add(callback);
		return () => this.playbackStateCallbacks.delete(callback);
	}

	onConnectionStateChange(callback: (state: PeerConnectionState) => void): () => void {
		this.connectionStateCallbacks.add(callback);
		return () => this.connectionStateCallbacks.delete(callback);
	}

	onSequenceMismatch(callback: (peerSequenceId: string | null) => void): () => void {
		this.sequenceMismatchCallbacks.add(callback);
		return () => this.sequenceMismatchCallbacks.delete(callback);
	}

	destroy(): void {
		this.disconnect();
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		this.playbackStateCallbacks.clear();
		this.connectionStateCallbacks.clear();
		this.sequenceMismatchCallbacks.clear();
	}

	private setupMessageHandler(): void {
		const unsub = this.peerManager.onMessage((message) => {
			this.handleMessage(message);
		});
		this.unsubscribers.push(unsub);
	}

	private setupConnectionStateForwarding(): void {
		const unsub = this.peerManager.onConnectionStateChange((state) => {
			for (const callback of this.connectionStateCallbacks) {
				callback(state);
			}
		});
		this.unsubscribers.push(unsub);
	}

	private handleMessage(message: SyncMessage): void {
		this.lastHeartbeatReceived = Date.now();

		switch (message.type) {
			case 'REQUEST_FULL_STATE':
				this.handleRequestFullState(message.senderId);
				break;

			case 'FULL_STATE':
				this.handleFullState(message.state);
				break;

			case 'STATE_UPDATE':
				this.handleStateUpdate(message.state, message.timestamp);
				break;

			case 'HEARTBEAT':
				// Just update lastHeartbeatReceived (done above)
				break;

			case 'SEQUENCE_MISMATCH_WARNING':
				for (const callback of this.sequenceMismatchCallbacks) {
					callback(message.peerSequenceId);
				}
				break;
		}
	}

	private handleRequestFullState(requesterId: string): void {
		// Only host responds to full state requests
		if (!this.connectionState.isHost) return;

		this.peerManager.broadcast({
			type: 'FULL_STATE',
			timestamp: Date.now(),
			senderId: this.connectionState.peerId || 'unknown',
			state: this._playbackState
		});

		// Check for sequence mismatch
		if (this._playbackState.sequenceId) {
			// We'll detect mismatch when we receive their state update
		}
	}

	private handleFullState(state: SyncedPlaybackState): void {
		this._playbackState = state;
		this.notifyPlaybackStateChange(state);
	}

	private handleStateUpdate(update: Partial<SyncedPlaybackState>, timestamp: number): void {
		// Last-write-wins conflict resolution
		if (timestamp >= this._playbackState.timestamp) {
			const newState = {
				...this._playbackState,
				...update,
				timestamp
			};

			this._playbackState = newState;
			this.notifyPlaybackStateChange(newState);

			// Check for sequence mismatch
			if (
				update.sequenceId !== undefined &&
				update.sequenceId !== this._playbackState.sequenceId
			) {
				for (const callback of this.sequenceMismatchCallbacks) {
					callback(update.sequenceId);
				}
			}
		}
	}

	private notifyPlaybackStateChange(state: SyncedPlaybackState): void {
		for (const callback of this.playbackStateCallbacks) {
			callback(state);
		}
	}

	private startHeartbeat(): void {
		this.lastHeartbeatReceived = Date.now();

		// Send heartbeats
		this.heartbeatInterval = setInterval(() => {
			if (this.connectionState.status === 'connected') {
				this.peerManager.broadcast({
					type: 'HEARTBEAT',
					timestamp: Date.now(),
					senderId: this.connectionState.peerId || 'unknown'
				});
			}
		}, this.config.heartbeatIntervalMs);

		// Check for heartbeat timeout
		this.heartbeatCheckInterval = setInterval(() => {
			if (this.connectionState.status === 'connected') {
				const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatReceived;
				if (timeSinceLastHeartbeat > this.config.heartbeatTimeoutMs) {
					console.warn('Heartbeat timeout - peer may be disconnected');
					// The PeerJS connection will handle actual disconnect detection
				}
			}
		}, this.config.heartbeatIntervalMs);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
		if (this.heartbeatCheckInterval) {
			clearInterval(this.heartbeatCheckInterval);
			this.heartbeatCheckInterval = null;
		}
	}
}
