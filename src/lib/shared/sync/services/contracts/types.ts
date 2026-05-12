import type { SyncedRoomState } from "../../domain/sync-types";
import {  } from "../../domain/sync-types";
import type { SyncMessage } from "../../domain/sync-messages";

// --- From IMobileConnectionAdapter ---
/**
 * IMobileConnectionAdapter
 *
 * Wraps WebRTC connections with mobile-specific optimizations:
 * - Exponential backoff reconnection strategy
 * - Network change detection (wifi <-> cellular transitions)
 * - Connection state recovery
 * - Graceful handling of backgrounding/foregrounding
 */


/**
 * Network type as reported by Navigator.connection API.
 */
export type NetworkType =
	| 'wifi'
	| 'cellular'
	| 'ethernet'
	| 'bluetooth'
	| 'wimax'
	| 'unknown'
	| 'none';

/**
 * Connection recovery state machine states.
 */
export type RecoveryState =
	| 'connected'
	| 'disconnected'
	| 'reconnecting'
	| 'backing-off'
	| 'failed';

/**
 * Event emitted when network type changes.
 */
export interface NetworkChangeEvent {
	previousType: NetworkType;
	currentType: NetworkType;
	timestamp: number;
}

/**
 * Event emitted when connection recovery state changes.
 */
export interface RecoveryStateEvent {
	previousState: RecoveryState;
	currentState: RecoveryState;
	attempt: number;
	nextRetryMs: number | null;
	timestamp: number;
}

/**
 * Configuration for mobile connection adapter.
 */
export interface MobileConnectionConfig {
	/** Initial reconnection delay in ms (default: 1000) */
	initialRetryDelayMs: number;

	/** Maximum reconnection delay in ms (default: 30000) */
	maxRetryDelayMs: number;

	/** Backoff multiplier (default: 2.0) */
	backoffMultiplier: number;

	/** Maximum reconnection attempts before failing (default: 10) */
	maxReconnectAttempts: number;

	/** Jitter factor for retry delays (0-1, default: 0.2) */
	jitterFactor: number;

	/** Whether to reset retry count on successful connection (default: true) */
	resetOnSuccess: boolean;

	/** Whether to automatically attempt reconnection on network change (default: true) */
	reconnectOnNetworkChange: boolean;

	/** Cooldown period after network change before reconnect (default: 500ms) */
	networkChangeCooldownMs: number;
}

/**
 * Default mobile connection configuration.
 */
export const DEFAULT_MOBILE_CONNECTION_CONFIG: MobileConnectionConfig = {
	initialRetryDelayMs: 1000,
	maxRetryDelayMs: 30000,
	backoffMultiplier: 2.0,
	maxReconnectAttempts: 10,
	jitterFactor: 0.2,
	resetOnSuccess: true,
	reconnectOnNetworkChange: true,
	networkChangeCooldownMs: 500
};

/**
 * Interface for mobile-optimized WebRTC connection handling.
 */

// --- From IMessageBatcher ---
/**
 * IMessageBatcher
 *
 * Batches non-critical messages to reduce radio wake-ups on mobile devices.
 * Critical messages (like playback intents) are sent immediately, while
 * less urgent messages (like peer info updates) are batched and sent together.
 *
 * This reduces battery drain by minimizing the number of times the
 * cellular/wifi radio needs to wake up and transmit.
 */


/**
 * Message priority levels.
 */
export type MessagePriority =
	| 'critical'  // Send immediately (playback intents, heartbeats)
	| 'high'      // Send soon but can batch briefly (state requests)
	| 'normal'    // Can batch for a few seconds (peer updates)
	| 'low';      // Can batch for longer (analytics, metadata)

/**
 * Configuration for message batching.
 */
export interface MessageBatcherConfig {
	/** Maximum time to hold normal priority messages before flushing (ms) */
	normalBatchWindowMs: number;

	/** Maximum time to hold low priority messages before flushing (ms) */
	lowBatchWindowMs: number;

	/** Maximum time to hold high priority messages before flushing (ms) */
	highBatchWindowMs: number;

	/** Maximum number of messages in a batch before auto-flush */
	maxBatchSize: number;

	/** Whether to enable batching at all (can be disabled for debugging) */
	enabled: boolean;

	/** Whether to use shorter batch windows when on wifi */
	adaptToNetwork: boolean;

	/** Multiplier for batch windows on wifi (e.g., 0.5 = half the window) */
	wifiBatchMultiplier: number;
}

/**
 * Default message batcher configuration.
 */
export const DEFAULT_MESSAGE_BATCHER_CONFIG: MessageBatcherConfig = {
	normalBatchWindowMs: 2000,
	lowBatchWindowMs: 5000,
	highBatchWindowMs: 500,
	maxBatchSize: 20,
	enabled: true,
	adaptToNetwork: true,
	wifiBatchMultiplier: 0.5
};

/**
 * Queued message with priority and timestamp.
 */
export interface QueuedMessage {
	message: SyncMessage;
	priority: MessagePriority;
	queuedAt: number;
}

/**
 * Batch flush event.
 */
export interface BatchFlushEvent {
	messages: SyncMessage[];
	reason: 'timer' | 'max-size' | 'urgent' | 'manual' | 'shutdown';
	timestamp: number;
}

/**
 * Interface for message batching.
 */

// --- From INetworkStatusMonitor ---
/**
 * INetworkStatusMonitor
 *
 * Monitors network connectivity and type changes.
 * Provides reactive state for components and coordinates network-aware
 * behavior across the sync system.
 *
 * Uses browser APIs:
 * - navigator.onLine for online/offline detection
 * - Navigator.connection (Network Information API) for connection type
 */

/**
 * Network connection type.
 */
export type NetworkConnectionType =
	| 'wifi'
	| 'cellular'
	| 'ethernet'
	| 'bluetooth'
	| 'wimax'
	| 'unknown'
	| 'none';

/**
 * Effective connection type (represents actual speed, not physical connection).
 */
export type EffectiveConnectionType =
	| 'slow-2g'
	| '2g'
	| '3g'
	| '4g'
	| 'unknown';

/**
 * Complete network status snapshot.
 */
export interface NetworkStatus {
	/** Whether the device has any network connectivity */
	isOnline: boolean;

	/** Physical connection type (wifi, cellular, etc.) */
	connectionType: NetworkConnectionType;

	/** Effective connection type based on measured performance */
	effectiveType: EffectiveConnectionType;

	/** Estimated downlink speed in Mbps (if available) */
	downlinkMbps: number | null;

	/** Estimated round-trip time in ms (if available) */
	rttMs: number | null;

	/** Whether the user has requested reduced data usage */
	saveData: boolean;

	/** Whether on a metered connection (cellular usually) */
	isMetered: boolean;

	/** Timestamp of last status update */
	lastUpdated: number;
}

/**
 * Network status change event (from NetworkStatusMonitor).
 */
export interface NetworkStatusChangeEvent {
	previous: NetworkStatus;
	current: NetworkStatus;
	timestamp: number;
}

/**
 * Interface for network status monitoring.
 */

// --- From IAdaptiveHeartbeat ---
/**
 * IAdaptiveHeartbeat
 *
 * Adaptive heartbeat system that adjusts timing based on:
 * - Connection quality (faster when unstable, slower when stable)
 * - Battery level (slower heartbeats when battery is low)
 * - Network type (slower on cellular to conserve data)
 *
 * The goal is to balance:
 * - Connection reliability (detect disconnects quickly)
 * - Battery efficiency (minimize radio wake-ups)
 * - Data usage (fewer messages on metered connections)
 */


/**
 * Current heartbeat mode.
 */
export type HeartbeatMode =
	| 'normal'        // Standard operation
	| 'verifying'     // Fast heartbeats to verify connection
	| 'stable'        // Slow heartbeats (connection is reliable)
	| 'battery-saver' // Reduced frequency due to low battery
	| 'paused';       // Heartbeats paused (e.g., app backgrounded)

/**
 * Heartbeat statistics for debugging and UI display.
 */
export interface HeartbeatStats {
	/** Current heartbeat interval in ms */
	currentIntervalMs: number;

	/** Number of heartbeats sent in this session */
	sentCount: number;

	/** Number of heartbeat acknowledgments received */
	ackedCount: number;

	/** Number of heartbeats that timed out (no ack) */
	timedOutCount: number;

	/** Consecutive successful heartbeats */
	consecutiveSuccess: number;

	/** Consecutive failed heartbeats */
	consecutiveFailures: number;

	/** Average round-trip time in ms */
	averageRttMs: number | null;

	/** Current mode */
	mode: HeartbeatMode;

	/** Battery level (0-1) if available */
	batteryLevel: number | null;

	/** Whether battery is charging */
	isCharging: boolean | null;
}

/**
 * Event emitted when heartbeat state changes significantly.
 */
export interface HeartbeatEvent {
	type: 'sent' | 'acked' | 'timeout' | 'mode-change' | 'interval-change';
	timestamp: number;
	rttMs?: number;
	newMode?: HeartbeatMode;
	newIntervalMs?: number;
	seq?: number;
}

/**
 * Interface for adaptive heartbeat management.
 */

// --- From IStateMerger ---
/**
 * State Merger Contract
 *
 * Handles CRDT-based merging of room state from multiple peers.
 * Uses Last-Writer-Wins semantics based on HLC timestamps.
 */


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

// --- From ISequenceLocalCache ---
/**
 * ISequenceLocalCache
 *
 * IndexedDB-based local cache for sequence data.
 * Provides instant access to sequences for multi-device sync scenarios.
 * When Device B joins a sync room, cached sequences load instantly
 * instead of waiting for Firebase round-trip.
 */


export interface SequenceLocalCacheStats {
  count: number;
  sizeBytes: number;
}

// --- From IPlaybackPositionCalculator ---
/**
 * Playback Position Calculator Contract
 *
 * Calculates the current playback position from a PlaybackIntent.
 * This enables frame-accurate sync without constant network messages.
 */


/**
 * Result of a position calculation.
 */
export interface PositionResult {
	/** The calculated step (may be fractional during animation) */
	step: number;

	/** The integer beat number (for step grid display) */
	beat: number;

	/** Progress within the current beat (0.0 to 1.0) */
	beatProgress: number;

	/** Whether playback has reached the end */
	isAtEnd: boolean;

	/** Whether playback is looping */
	isLooping: boolean;
}

/**
 * Interface for calculating playback position from intent.
 */
