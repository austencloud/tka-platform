/**
 * Device Sync Coordinator Implementation
 *
 * The main orchestrator for multi-device synchronization.
 * Coordinates all sync primitives to achieve frame-accurate playback sync.
 *
 * Architecture:
 * - Uses HybridLogicalClock for causal ordering of events
 * - Uses PlaybackPositionCalculator for deterministic position calculation
 * - Uses StateMerger for CRDT-based conflict resolution
 * - Uses SequenceLocalCache for instant sequence loading
 * - Uses PeerConnectionManager for WebRTC communication
 *
 * Mobile Optimizations (optional):
 * - AdaptiveHeartbeat for battery-aware heartbeat timing
 * - MessageBatcher for reducing radio wake-ups
 * - MobileConnectionAdapter for exponential backoff reconnection
 */

import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type { IDeviceSyncCoordinator } from '../contracts/IDeviceSyncCoordinator';
import type { IHybridLogicalClock } from '../contracts/IHybridLogicalClock';
import type { IPlaybackPositionCalculator } from '../contracts/IPlaybackPositionCalculator';
import type { IStateMerger } from '../contracts/IStateMerger';
import type { ISequenceLocalCache } from '../contracts/ISequenceLocalCache';
import type { IPeerConnectionManager } from '$lib/shared/lan-sync/services/contracts/IPeerConnectionManager';
import type { IAdaptiveHeartbeat } from '../contracts/IAdaptiveHeartbeat';
import type { IMessageBatcher, MessagePriority } from '../contracts/IMessageBatcher';
import type { IMobileConnectionAdapter } from '../contracts/IMobileConnectionAdapter';
import type {
	SyncConnectionState,
	SyncedRoomState,
	SyncConfig,
	ViewMode,
	PeerInfo,
	ConnectionQuality
} from '../../domain/sync-types';
import type { SyncMessage } from '../../domain/sync-messages';
import {
	generateNodeId,
	createInitialRoomState,
	createInitialConnectionState,
	DEFAULT_SYNC_CONFIG,
	CONNECTION_QUALITY_THRESHOLDS
} from '../../domain/sync-types';
import {
	createJoinMessage,
	createWelcomeMessage,
	createIntentMessage,
	createPeerUpdateMessage,
	createPeerLeaveMessage,
	createHeartbeatMessage,
	createHeartbeatAckMessage,
	createStateRequestMessage,
	createStateResponseMessage,
	deserializeRoomState,
	serializeMessage,
	deserializeMessage
} from '../../domain/sync-messages';
import { HybridLogicalClock } from './HybridLogicalClock';
import { PlaybackPositionCalculator } from './PlaybackPositionCalculator';
import { StateMerger } from './StateMerger';
import { SequenceLocalCache } from './SequenceLocalCache';

/**
 * Pending heartbeat tracking for RTT calculation.
 */
interface PendingHeartbeat {
	seq: number;
	sentAt: number;
}

/**
 * DeviceSyncCoordinator orchestrates multi-device playback synchronization.
 *
 * The sync algorithm:
 * 1. When sync() is called, we derive a room code from the sequence ID
 * 2. We try to join an existing room first (someone else may be hosting)
 * 3. If no room exists, we create one and become the host
 * 4. All playback controls create new PlaybackIntents with HLC timestamps
 * 5. Intents are broadcast to peers and merged using CRDT LWW semantics
 * 6. Each device calculates its position from the current intent locally
 * 7. Heartbeats maintain connection quality and detect disconnections
 */
/**
 * Optional mobile optimization services.
 */
export interface MobileOptimizations {
	adaptiveHeartbeat?: IAdaptiveHeartbeat;
	messageBatcher?: IMessageBatcher;
	connectionAdapter?: IMobileConnectionAdapter;
}

export class DeviceSyncCoordinator implements IDeviceSyncCoordinator {
	// Core primitives
	private readonly hlc: IHybridLogicalClock;
	private readonly positionCalculator: IPlaybackPositionCalculator;
	private readonly stateMerger: IStateMerger;
	private readonly sequenceCache: ISequenceLocalCache;

	// Mobile optimization services (optional)
	private readonly adaptiveHeartbeat: IAdaptiveHeartbeat | null;
	private readonly messageBatcher: IMessageBatcher | null;
	private readonly connectionAdapter: IMobileConnectionAdapter | null;

	// Configuration
	private readonly config: SyncConfig;

	// State
	private _connectionState: SyncConnectionState = createInitialConnectionState();
	private _roomState: SyncedRoomState | null = null;
	private _viewMode: ViewMode = 'animation';
	private _displayName: string = '';
	private lastRenderedStep: number = 0;

	// Heartbeat tracking
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private heartbeatTimeoutCheck: ReturnType<typeof setInterval> | null = null;
	private pendingHeartbeats: Map<number, PendingHeartbeat> = new Map();
	private heartbeatSeq: number = 0;
	private lastPeerActivity: number = 0;

	// Callbacks
	private roomStateCallbacks: Set<(state: SyncedRoomState | null) => void> = new Set();
	private connectionStateCallbacks: Set<(state: SyncConnectionState) => void> = new Set();
	private unsubscribers: Array<() => void> = [];

	/**
	 * Validate room code format.
	 * Room codes must be 4-8 alphanumeric characters.
	 */
	private validateRoomCode(code: string): boolean {
		return /^[A-Z0-9]{4,8}$/.test(code);
	}

	/**
	 * Sanitize display name to prevent injection.
	 * Strips HTML-like characters and limits length.
	 */
	private sanitizeDisplayName(name: string): string {
		return name
			.replace(/[<>'"&]/g, '')
			.substring(0, 50)
			.trim() || 'Anonymous';
	}

	/**
	 * Create a new DeviceSyncCoordinator.
	 *
	 * @param peerManager - WebRTC peer connection manager
	 * @param config - Optional configuration overrides
	 * @param sequenceCache - Optional custom sequence cache (for testing)
	 * @param mobileOptimizations - Optional mobile optimization services
	 */
	constructor(
		private readonly peerManager: IPeerConnectionManager,
		config: Partial<SyncConfig> = {},
		sequenceCache?: ISequenceLocalCache,
		mobileOptimizations?: MobileOptimizations
	) {
		// Generate unique node ID for this device
		const nodeId = generateNodeId();

		// Initialize primitives
		this.hlc = new HybridLogicalClock(nodeId);
		this.positionCalculator = new PlaybackPositionCalculator();
		this.stateMerger = new StateMerger(this.hlc);
		this.sequenceCache = sequenceCache ?? new SequenceLocalCache();

		// Store mobile optimization services
		this.adaptiveHeartbeat = mobileOptimizations?.adaptiveHeartbeat ?? null;
		this.messageBatcher = mobileOptimizations?.messageBatcher ?? null;
		this.connectionAdapter = mobileOptimizations?.connectionAdapter ?? null;

		// Merge config with defaults
		this.config = { ...DEFAULT_SYNC_CONFIG, ...config };

		// Set up connection state tracking
		this._connectionState = {
			...createInitialConnectionState(),
			nodeId
		};

		// Wire up message handler
		this.setupMessageHandler();
		this.setupConnectionStateForwarding();
		this.setupMobileOptimizations();
	}

	// =========================================================================
	// Public Getters
	// =========================================================================

	get connectionState(): SyncConnectionState {
		return this._connectionState;
	}

	get roomState(): SyncedRoomState | null {
		return this._roomState;
	}

	get viewMode(): ViewMode {
		return this._viewMode;
	}

	set viewMode(mode: ViewMode) {
		this._viewMode = mode;
		// Broadcast view mode change to peers
		if (this._roomState && this._connectionState.status === 'connected') {
			const peerInfo = this.stateMerger.createPeerInfo(this._displayName, mode);
			this._roomState = this.stateMerger.mergePeerInfo(this._roomState, peerInfo);
			this.broadcastPeerUpdate(peerInfo);
			this.notifyRoomStateChange();
		}
	}

	get displayName(): string {
		return this._displayName;
	}

	// =========================================================================
	// Connection Methods
	// =========================================================================

	async sync(sequence: SequenceData, displayName: string): Promise<string> {
		// Sanitize display name
		this._displayName = this.sanitizeDisplayName(displayName);

		// Derive room code from sequence ID (first 6 chars uppercase)
		const roomCode = this.deriveRoomCode(sequence.id);

		// Cache the sequence locally for instant loading
		await this.sequenceCache.set(sequence.id, sequence);

		// Update connection state
		this.updateConnectionState({
			status: 'joining-room',
			roomCode,
			errorMessage: null
		});

		try {
			// Try to join existing room first
			await this.peerManager.joinRoom(roomCode);

			// Successfully joined - we're a peer
			this.updateConnectionState({
				status: 'connected',
				peerCount: 1
			});

			// Send JOIN message to request state from host
			const joinMessage = createJoinMessage(
				this.hlc.now(),
				this.hlc.nodeId,
				displayName,
				this._viewMode
			);
			this.broadcast(joinMessage);

			this.startHeartbeat();
			return roomCode;
		} catch {
			// No existing room - create one and become host
			return this.createRoom(sequence, displayName, roomCode);
		}
	}

	async joinRoom(roomCode: string, displayName: string): Promise<void> {
		// Sanitize display name
		this._displayName = this.sanitizeDisplayName(displayName);

		// Normalize and validate room code
		const normalizedCode = roomCode.toUpperCase().trim();
		if (!this.validateRoomCode(normalizedCode)) {
			this.updateConnectionState({
				status: 'error',
				errorMessage: 'Invalid room code. Must be 4-8 alphanumeric characters.'
			});
			throw new Error('Invalid room code format');
		}

		this.updateConnectionState({
			status: 'joining-room',
			roomCode: normalizedCode,
			errorMessage: null
		});

		try {
			await this.peerManager.joinRoom(normalizedCode);

			this.updateConnectionState({
				status: 'connected',
				peerCount: 1
			});

			// Send JOIN message
			const joinMessage = createJoinMessage(
				this.hlc.now(),
				this.hlc.nodeId,
				displayName,
				this._viewMode
			);
			this.broadcast(joinMessage);

			this.startHeartbeat();
		} catch (error) {
			this.updateConnectionState({
				status: 'error',
				errorMessage: error instanceof Error ? error.message : 'Failed to join room'
			});
			throw error;
		}
	}

	disconnect(): void {
		// Broadcast graceful leave message
		if (this._connectionState.status === 'connected') {
			const leaveMessage = createPeerLeaveMessage(
				this.hlc.now(),
				this.hlc.nodeId,
				'User disconnected'
			);
			this.broadcast(leaveMessage);
		}

		// Stop heartbeat
		this.stopHeartbeat();

		// Disconnect peer manager
		this.peerManager.disconnect();

		// Reset state
		this._roomState = null;
		this._connectionState = {
			...createInitialConnectionState(),
			nodeId: this.hlc.nodeId
		};

		// Notify listeners
		this.notifyRoomStateChange();
		this.notifyConnectionStateChange();
	}

	// =========================================================================
	// Playback Controls
	// =========================================================================

	play(): void {
		if (!this._roomState) return;

		// Get current position and create new playing intent
		const currentStep = this.getCurrentStep();
		const intent = this.stateMerger.createIntent(
			true,
			currentStep,
			this._roomState.playback.speed,
			this._roomState.playback.loop,
			this._roomState.playback.totalSteps
		);

		this.applyAndBroadcastIntent(intent);
	}

	pause(): void {
		if (!this._roomState) return;

		// Get current position and create paused intent
		const currentStep = this.getCurrentStep();
		const intent = this.stateMerger.createIntent(
			false,
			currentStep,
			this._roomState.playback.speed,
			this._roomState.playback.loop,
			this._roomState.playback.totalSteps
		);

		this.applyAndBroadcastIntent(intent);
	}

	seek(step: number): void {
		if (!this._roomState) return;

		// Clamp step to valid range
		const clampedStep = Math.max(
			0,
			Math.min(step, this._roomState.playback.totalSteps - 1)
		);

		const intent = this.stateMerger.createIntent(
			this._roomState.playback.playing,
			clampedStep,
			this._roomState.playback.speed,
			this._roomState.playback.loop,
			this._roomState.playback.totalSteps
		);

		this.applyAndBroadcastIntent(intent);
	}

	setSpeed(speed: number): void {
		if (!this._roomState) return;

		// Get current position to create properly anchored intent
		const currentStep = this.getCurrentStep();
		const intent = this.stateMerger.createIntent(
			this._roomState.playback.playing,
			currentStep,
			speed,
			this._roomState.playback.loop,
			this._roomState.playback.totalSteps
		);

		this.applyAndBroadcastIntent(intent);
	}

	toggleLoop(): void {
		if (!this._roomState) return;

		const intent = this.stateMerger.createIntent(
			this._roomState.playback.playing,
			this._roomState.playback.anchorStep,
			this._roomState.playback.speed,
			!this._roomState.playback.loop,
			this._roomState.playback.totalSteps
		);

		// For loop toggle, we don't need to recalculate anchor
		// Just update the loop flag while keeping anchor the same
		const adjustedIntent = {
			...intent,
			anchorStep: this._roomState.playback.anchorStep,
			anchorWallTime: this._roomState.playback.anchorWallTime
		};

		this.applyAndBroadcastIntent(adjustedIntent);
	}

	// =========================================================================
	// Position Calculation
	// =========================================================================

	getCurrentStep(): number {
		if (!this._roomState) return 0;

		const result = this.positionCalculator.calculatePosition(
			this._roomState.playback,
			Date.now()
		);
		return result.step;
	}

	getCorrectedStep(lastRenderedStep: number): number {
		if (!this._roomState) return 0;

		const result = this.positionCalculator.calculateCorrectedPosition(
			this._roomState.playback,
			Date.now(),
			lastRenderedStep,
			this.config.maxCorrectionPerFrame
		);

		this.lastRenderedStep = result.step;
		return result.step;
	}

	setStepDuration(durationMs: number): void {
		this.positionCalculator.setStepDuration(durationMs);
	}

	// =========================================================================
	// Event Subscriptions
	// =========================================================================

	onRoomStateChange(callback: (state: SyncedRoomState | null) => void): () => void {
		this.roomStateCallbacks.add(callback);
		return () => this.roomStateCallbacks.delete(callback);
	}

	onConnectionStateChange(callback: (state: SyncConnectionState) => void): () => void {
		this.connectionStateCallbacks.add(callback);
		return () => this.connectionStateCallbacks.delete(callback);
	}

	// =========================================================================
	// Lifecycle
	// =========================================================================

	destroy(): void {
		this.disconnect();

		// Clear all callbacks
		this.roomStateCallbacks.clear();
		this.connectionStateCallbacks.clear();

		// Unsubscribe from peer manager
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}

	// =========================================================================
	// Private: Room Creation
	// =========================================================================

	private async createRoom(
		sequence: SequenceData,
		displayName: string,
		roomCode: string
	): Promise<string> {
		this.updateConnectionState({
			status: 'creating-room',
			roomCode
		});

		try {
			await this.peerManager.createRoomWithCode(roomCode);

			// Initialize room state
			const totalSteps = sequence.steps.length;
			this._roomState = createInitialRoomState(
				this.hlc.nodeId,
				{
					id: sequence.id,
					word: sequence.word,
					data: sequence
				},
				totalSteps
			);

			// Add ourselves to peers
			const peerInfo = this.stateMerger.createPeerInfo(displayName, this._viewMode);
			this._roomState = this.stateMerger.mergePeerInfo(this._roomState, peerInfo);

			this.updateConnectionState({
				status: 'waiting-for-peer',
				peerCount: 0
			});

			this.startHeartbeat();
			this.notifyRoomStateChange();

			return roomCode;
		} catch (error) {
			this.updateConnectionState({
				status: 'error',
				errorMessage: error instanceof Error ? error.message : 'Failed to create room'
			});
			throw error;
		}
	}

	// =========================================================================
	// Private: Message Handling
	// =========================================================================

	private setupMessageHandler(): void {
		const unsub = this.peerManager.onMessage((rawMessage) => {
			// The peer manager gives us parsed JSON, but we need to validate our protocol
			if (this.isDeviceSyncMessage(rawMessage)) {
				this.handleMessage(rawMessage);
			}
		});
		this.unsubscribers.push(unsub);
	}

	private isDeviceSyncMessage(msg: unknown): msg is SyncMessage {
		if (!msg || typeof msg !== 'object') return false;
		const candidate = msg as Record<string, unknown>;
		const validTypes: Set<string> = new Set([
			'JOIN', 'WELCOME', 'INTENT', 'PEER_UPDATE', 'PEER_LEAVE',
			'HEARTBEAT', 'HEARTBEAT_ACK', 'STATE_REQUEST', 'STATE_RESPONSE'
		]);
		return typeof candidate.type === 'string'
			&& validTypes.has(candidate.type)
			&& typeof candidate.senderId === 'string'
			&& candidate.hlc != null;
	}

	private setupConnectionStateForwarding(): void {
		const unsub = this.peerManager.onConnectionStateChange((peerState) => {
			// Map peer connection state to our connection state
			this.updateConnectionState({
				peerCount: peerState.connectedPeerCount
			});

			if (peerState.status === 'error') {
				this.updateConnectionState({
					status: 'error',
					errorMessage: peerState.errorMessage
				});
			}
		});
		this.unsubscribers.push(unsub);

		// Track peer disconnections for state cleanup
		const disconnectUnsub = this.peerManager.onPeerDisconnected((peerId) => {
			this.handlePeerDisconnected(peerId);
		});
		this.unsubscribers.push(disconnectUnsub);
	}

	private handleMessage(message: SyncMessage): void {
		// Update HLC on receive
		this.hlc.receive(message.hlc);

		// Track activity for connection quality
		this.lastPeerActivity = Date.now();

		switch (message.type) {
			case 'JOIN':
				this.handleJoin(message);
				break;
			case 'WELCOME':
				this.handleWelcome(message);
				break;
			case 'INTENT':
				this.handleIntent(message);
				break;
			case 'PEER_UPDATE':
				this.handlePeerUpdate(message);
				break;
			case 'PEER_LEAVE':
				this.handlePeerLeave(message);
				break;
			case 'HEARTBEAT':
				this.handleHeartbeat(message);
				break;
			case 'HEARTBEAT_ACK':
				this.handleHeartbeatAck(message);
				break;
			case 'STATE_REQUEST':
				this.handleStateRequest(message);
				break;
			case 'STATE_RESPONSE':
				this.handleStateResponse(message);
				break;
		}
	}

	private handleJoin(message: SyncMessage & { type: 'JOIN' }): void {
		if (!this._roomState) return;

		// Add the new peer
		const peerInfo: PeerInfo = {
			nodeId: message.senderId,
			displayName: message.payload.displayName,
			viewMode: message.payload.viewMode,
			lastSeen: message.hlc
		};

		this._roomState = this.stateMerger.mergePeerInfo(this._roomState, peerInfo);

		// Send WELCOME with full state (including sequence data)
		const welcomeMessage = createWelcomeMessage(
			this.hlc.now(),
			this.hlc.nodeId,
			this._roomState
		);
		this.broadcast(welcomeMessage);

		this.updateConnectionState({
			status: 'connected',
			peerCount: this._roomState.peers.size - 1 // Exclude ourselves
		});

		this.notifyRoomStateChange();
	}

	private handleWelcome(message: SyncMessage & { type: 'WELCOME' }): void {
		// Deserialize and validate the room state
		let remoteState;
		try {
			remoteState = deserializeRoomState(message.payload.roomState);
		} catch (error) {
			console.error('[DeviceSync] Invalid WELCOME message payload:', error);
			return; // Ignore malformed messages
		}

		if (!this._roomState) {
			// First state - adopt it entirely
			this._roomState = remoteState;
		} else {
			// Merge with existing state
			const mergeResult = this.stateMerger.merge(this._roomState, remoteState);
			this._roomState = mergeResult.state;
		}

		// Add ourselves to peers if not already present
		const myPeerInfo = this.stateMerger.createPeerInfo(this._displayName, this._viewMode);
		this._roomState = this.stateMerger.mergePeerInfo(this._roomState, myPeerInfo);

		// Cache sequence data if present
		if (this._roomState.sequence.data) {
			this.sequenceCache.set(
				this._roomState.sequence.id,
				this._roomState.sequence.data
			).catch(() => {
				// Cache failure is non-fatal
			});
		}

		this.updateConnectionState({
			status: 'connected',
			peerCount: this._roomState.peers.size - 1
		});

		this.notifyRoomStateChange();
	}

	private handleIntent(message: SyncMessage & { type: 'INTENT' }): void {
		if (!this._roomState) return;

		this._roomState = this.stateMerger.mergeIntent(
			this._roomState,
			message.payload.intent
		);

		this.notifyRoomStateChange();
	}

	private handlePeerUpdate(message: SyncMessage & { type: 'PEER_UPDATE' }): void {
		if (!this._roomState) return;

		this._roomState = this.stateMerger.mergePeerInfo(
			this._roomState,
			message.payload.peerInfo
		);

		this.notifyRoomStateChange();
	}

	private handlePeerLeave(message: SyncMessage & { type: 'PEER_LEAVE' }): void {
		if (!this._roomState) return;

		this._roomState = this.stateMerger.removePeer(this._roomState, message.senderId);

		this.updateConnectionState({
			peerCount: Math.max(0, this._roomState.peers.size - 1)
		});

		this.notifyRoomStateChange();
	}

	private handleHeartbeat(message: SyncMessage & { type: 'HEARTBEAT' }): void {
		// Respond with ACK
		const ackMessage = createHeartbeatAckMessage(
			this.hlc.now(),
			this.hlc.nodeId,
			message.payload.seq,
			this.getCurrentStep()
		);
		this.broadcast(ackMessage);
	}

	private handleHeartbeatAck(message: SyncMessage & { type: 'HEARTBEAT_ACK' }): void {
		const pending = this.pendingHeartbeats.get(message.payload.seq);
		if (!pending) return;

		// Calculate RTT
		const rtt = Date.now() - pending.sentAt;
		this.pendingHeartbeats.delete(message.payload.seq);

		// Notify adaptive heartbeat of successful ack
		if (this.adaptiveHeartbeat) {
			this.adaptiveHeartbeat.recordAck(message.payload.seq, pending.sentAt);
		}

		// Update connection quality based on RTT
		const quality = this.calculateQuality(rtt);
		this.updateConnectionState({
			quality,
			lastRttMs: rtt
		});

		// Notify adaptive heartbeat of quality change
		if (this.adaptiveHeartbeat) {
			this.adaptiveHeartbeat.notifyQualityChange(quality);
		}
	}

	private handleStateRequest(message: SyncMessage & { type: 'STATE_REQUEST' }): void {
		if (!this._roomState) return;

		// Send full state response
		const responseMessage = createStateResponseMessage(
			this.hlc.now(),
			this.hlc.nodeId,
			this._roomState
		);
		this.broadcast(responseMessage);
	}

	private handleStateResponse(message: SyncMessage & { type: 'STATE_RESPONSE' }): void {
		// Deserialize and validate the room state
		let remoteState;
		try {
			remoteState = deserializeRoomState(message.payload.roomState);
		} catch (error) {
			console.error('[DeviceSync] Invalid STATE_RESPONSE message payload:', error);
			return; // Ignore malformed messages
		}

		if (!this._roomState) {
			this._roomState = remoteState;
		} else {
			const mergeResult = this.stateMerger.merge(this._roomState, remoteState);
			this._roomState = mergeResult.state;
		}

		// Add ourselves
		const myPeerInfo = this.stateMerger.createPeerInfo(this._displayName, this._viewMode);
		this._roomState = this.stateMerger.mergePeerInfo(this._roomState, myPeerInfo);

		this.notifyRoomStateChange();
	}

	private handlePeerDisconnected(peerId: string): void {
		if (!this._roomState) return;

		// Extract node ID from peer ID (format: tka-sync-ROOMCODE or tka-sync-ROOMCODE-timestamp)
		// We need to find which peer this corresponds to
		// For simplicity, remove any peer that matches the peerId pattern
		for (const [nodeId] of this._roomState.peers) {
			if (peerId.includes(nodeId) || nodeId === peerId) {
				this._roomState = this.stateMerger.removePeer(this._roomState, nodeId);
			}
		}

		this.updateConnectionState({
			peerCount: Math.max(0, this._roomState.peers.size - 1)
		});

		this.notifyRoomStateChange();
	}

	// =========================================================================
	// Private: Heartbeat
	// =========================================================================

	private startHeartbeat(): void {
		this.lastPeerActivity = Date.now();

		// Use adaptive heartbeat if available, otherwise use fixed interval
		if (this.adaptiveHeartbeat) {
			this.adaptiveHeartbeat.start();
			// Also start message batcher if available
			if (this.messageBatcher) {
				this.messageBatcher.start();
			}
			// Start connection adapter monitoring if available
			if (this.connectionAdapter) {
				this.connectionAdapter.start();
				this.connectionAdapter.notifyConnected();
			}
		} else {
			// Fallback to fixed interval heartbeats
			this.heartbeatInterval = setInterval(() => {
				if (this._connectionState.status === 'connected' ||
					this._connectionState.status === 'waiting-for-peer') {
					this.sendHeartbeat();
				}
			}, this.config.heartbeatIntervalMs);
		}

		// Check for timeout (always needed)
		this.heartbeatTimeoutCheck = setInterval(() => {
			this.checkHeartbeatTimeout();
		}, this.config.heartbeatIntervalMs);
	}

	private stopHeartbeat(): void {
		// Stop adaptive heartbeat if available
		if (this.adaptiveHeartbeat) {
			this.adaptiveHeartbeat.stop();
		}
		// Stop message batcher if available
		if (this.messageBatcher) {
			this.messageBatcher.stop();
		}
		// Stop connection adapter if available
		if (this.connectionAdapter) {
			this.connectionAdapter.stop();
		}

		// Stop fixed interval heartbeat if running
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
		if (this.heartbeatTimeoutCheck) {
			clearInterval(this.heartbeatTimeoutCheck);
			this.heartbeatTimeoutCheck = null;
		}
		this.pendingHeartbeats.clear();
	}

	private sendHeartbeat(): void {
		const seq = this.heartbeatSeq++;

		this.pendingHeartbeats.set(seq, {
			seq,
			sentAt: Date.now()
		});

		const heartbeatMessage = createHeartbeatMessage(
			this.hlc.now(),
			this.hlc.nodeId,
			seq,
			this.getCurrentStep()
		);

		this.broadcast(heartbeatMessage);

		// Clean up old pending heartbeats (older than timeout)
		const now = Date.now();
		for (const [pendingSeq, pending] of this.pendingHeartbeats) {
			if (now - pending.sentAt > this.config.heartbeatTimeoutMs) {
				this.pendingHeartbeats.delete(pendingSeq);
			}
		}
	}

	private checkHeartbeatTimeout(): void {
		if (this._connectionState.status !== 'connected') return;

		const timeSinceActivity = Date.now() - this.lastPeerActivity;

		if (timeSinceActivity > this.config.heartbeatTimeoutMs) {
			// Connection may be lost
			this.updateConnectionState({
				quality: 'disconnected'
			});

			// Notify connection adapter to trigger reconnection
			if (this.connectionAdapter) {
				this.connectionAdapter.notifyDisconnected('Heartbeat timeout');
			}
		}
	}

	// =========================================================================
	// Private: Utilities
	// =========================================================================

	private deriveRoomCode(sequenceId: string): string {
		// Use first 6 chars of sequence ID, uppercase
		return sequenceId.substring(0, 6).toUpperCase();
	}

	private broadcast(message: SyncMessage): void {
		// Use message batcher if available, otherwise send directly
		if (this.messageBatcher) {
			const priority = this.getMessagePriority(message);
			this.messageBatcher.queue(message, priority);
		} else {
			this.broadcastDirect(message);
		}
	}

	private broadcastPeerUpdate(peerInfo: PeerInfo): void {
		const message = createPeerUpdateMessage(
			this.hlc.now(),
			this.hlc.nodeId,
			peerInfo
		);
		this.broadcast(message);
	}

	private applyAndBroadcastIntent(intent: ReturnType<IStateMerger['createIntent']>): void {
		if (!this._roomState) return;

		// Apply locally
		this._roomState = this.stateMerger.mergeIntent(this._roomState, intent);

		// Broadcast to peers
		const message = createIntentMessage(
			this.hlc.now(),
			this.hlc.nodeId,
			intent
		);
		this.broadcast(message);

		this.notifyRoomStateChange();
	}

	private calculateQuality(rttMs: number): ConnectionQuality {
		if (rttMs <= CONNECTION_QUALITY_THRESHOLDS.excellent) return 'excellent';
		if (rttMs <= CONNECTION_QUALITY_THRESHOLDS.good) return 'good';
		if (rttMs <= CONNECTION_QUALITY_THRESHOLDS.degraded) return 'degraded';
		if (rttMs <= CONNECTION_QUALITY_THRESHOLDS.poor) return 'poor';
		return 'disconnected';
	}

	private updateConnectionState(partial: Partial<SyncConnectionState>): void {
		this._connectionState = { ...this._connectionState, ...partial };
		this.notifyConnectionStateChange();
	}

	private notifyRoomStateChange(): void {
		for (const callback of this.roomStateCallbacks) {
			try {
				callback(this._roomState);
			} catch (error) {
				console.error('[DeviceSync] Room state callback error:', error);
			}
		}
	}

	private notifyConnectionStateChange(): void {
		for (const callback of this.connectionStateCallbacks) {
			try {
				callback(this._connectionState);
			} catch (error) {
				console.error('[DeviceSync] Connection state callback error:', error);
			}
		}
	}

	// =========================================================================
	// Private: Mobile Optimizations
	// =========================================================================

	private setupMobileOptimizations(): void {
		// Wire adaptive heartbeat if available
		if (this.adaptiveHeartbeat) {
			// When adaptive heartbeat says it's time to send, trigger our heartbeat
			const heartbeatUnsub = this.adaptiveHeartbeat.onHeartbeatDue(() => {
				try {
					if (this._connectionState.status === 'connected' ||
						this._connectionState.status === 'waiting-for-peer') {
						return this.sendHeartbeatWithTracking();
					}
					return -1; // No heartbeat sent
				} catch (error) {
					console.error('[DeviceSync] Heartbeat callback error:', error);
					return -1;
				}
			});
			this.unsubscribers.push(heartbeatUnsub);
		}

		// Wire message batcher if available
		if (this.messageBatcher) {
			// When batcher flushes, send the batched messages
			const flushUnsub = this.messageBatcher.onFlush((event) => {
				try {
					for (const message of event.messages) {
						this.broadcastDirect(message);
					}
				} catch (error) {
					console.error('[DeviceSync] Message flush callback error:', error);
				}
			});
			this.unsubscribers.push(flushUnsub);
		}

		// Wire connection adapter if available
		if (this.connectionAdapter) {
			// When adapter says reconnect, attempt to rejoin the room
			const reconnectUnsub = this.connectionAdapter.onReconnectNeeded(async () => {
				const roomCode = this._connectionState.roomCode;
				if (roomCode) {
					this.updateConnectionState({ status: 'reconnecting' });
					try {
						await this.peerManager.joinRoom(roomCode);
						this.connectionAdapter?.notifyConnected();
						this.updateConnectionState({ status: 'connected' });
						// Request state from peers to resync
						const stateRequest = createStateRequestMessage(
							this.hlc.now(),
							this.hlc.nodeId
						);
						this.broadcast(stateRequest);
					} catch (error) {
						console.error('[DeviceSync] Reconnection failed:', error);
						// Let adapter handle retry logic
					}
				}
			});
			this.unsubscribers.push(reconnectUnsub);

			// Forward recovery state changes to our connection state
			const recoveryUnsub = this.connectionAdapter.onRecoveryStateChange((event) => {
				try {
					if (event.currentState === 'failed') {
						this.updateConnectionState({
							status: 'error',
							errorMessage: 'Failed to reconnect after multiple attempts'
						});
					} else if (event.currentState === 'reconnecting') {
						this.updateConnectionState({ status: 'reconnecting' });
					}
				} catch (error) {
					console.error('[DeviceSync] Recovery state callback error:', error);
				}
			});
			this.unsubscribers.push(recoveryUnsub);
		}
	}

	/**
	 * Send heartbeat and return the sequence number for tracking.
	 * Used by adaptive heartbeat integration.
	 */
	private sendHeartbeatWithTracking(): number {
		const seq = this.heartbeatSeq++;
		const sentAt = Date.now();

		this.pendingHeartbeats.set(seq, { seq, sentAt });

		const heartbeatMessage = createHeartbeatMessage(
			this.hlc.now(),
			this.hlc.nodeId,
			seq,
			this.getCurrentStep()
		);

		// Heartbeats are critical - always send directly
		this.broadcastDirect(heartbeatMessage);

		// Notify adaptive heartbeat that we sent
		if (this.adaptiveHeartbeat) {
			this.adaptiveHeartbeat.recordSent(seq);
		}

		// Clean up old pending heartbeats
		const now = Date.now();
		for (const [pendingSeq, pending] of this.pendingHeartbeats) {
			if (now - pending.sentAt > this.config.heartbeatTimeoutMs) {
				this.pendingHeartbeats.delete(pendingSeq);
				// Notify adaptive heartbeat of timeout
				if (this.adaptiveHeartbeat) {
					this.adaptiveHeartbeat.recordTimeout(pendingSeq);
				}
			}
		}

		return seq;
	}

	/**
	 * Send message directly without batching.
	 * Used for critical messages like heartbeats and intents.
	 */
	private broadcastDirect(message: SyncMessage): void {
		const serialized = serializeMessage(message);
		this.peerManager.broadcast(JSON.parse(serialized));
	}

	/**
	 * Get the priority for a message type.
	 */
	private getMessagePriority(message: SyncMessage): MessagePriority {
		switch (message.type) {
			case 'INTENT':
			case 'HEARTBEAT':
			case 'HEARTBEAT_ACK':
				return 'critical';
			case 'JOIN':
			case 'WELCOME':
			case 'STATE_REQUEST':
			case 'STATE_RESPONSE':
				return 'high';
			case 'PEER_UPDATE':
			case 'PEER_LEAVE':
				return 'normal';
			default:
				return 'normal';
		}
	}
}
