/**
 * IMobileConnectionAdapter
 *
 * Wraps WebRTC connections with mobile-specific optimizations:
 * - Exponential backoff reconnection strategy
 * - Network change detection (wifi <-> cellular transitions)
 * - Connection state recovery
 * - Graceful handling of backgrounding/foregrounding
 */

import type { ConnectionQuality } from '../../domain/sync-types';

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
export interface IMobileConnectionAdapter {
	/**
	 * Current recovery state.
	 */
	readonly recoveryState: RecoveryState;

	/**
	 * Current network type.
	 */
	readonly networkType: NetworkType;

	/**
	 * Whether the device is currently online.
	 */
	readonly isOnline: boolean;

	/**
	 * Current reconnection attempt number (0 when connected).
	 */
	readonly reconnectAttempt: number;

	/**
	 * Time until next reconnection attempt in ms (null if not backing off).
	 */
	readonly nextRetryIn: number | null;

	/**
	 * Estimated connection quality based on network conditions.
	 */
	readonly estimatedQuality: ConnectionQuality;

	/**
	 * Start monitoring connection and network state.
	 * Should be called when sync begins.
	 */
	start(): void;

	/**
	 * Stop monitoring and cancel any pending reconnection.
	 * Should be called when sync ends.
	 */
	stop(): void;

	/**
	 * Notify the adapter of a successful connection.
	 * Resets retry state if configured to do so.
	 */
	notifyConnected(): void;

	/**
	 * Notify the adapter of a disconnection.
	 * Triggers reconnection logic with exponential backoff.
	 *
	 * @param reason - Optional reason for disconnection
	 */
	notifyDisconnected(reason?: string): void;

	/**
	 * Manually trigger a reconnection attempt.
	 * Useful when user explicitly requests retry.
	 *
	 * @returns Promise that resolves when reconnection is attempted
	 */
	triggerReconnect(): Promise<void>;

	/**
	 * Cancel any pending reconnection attempt.
	 */
	cancelReconnect(): void;

	/**
	 * Register a callback to be invoked when reconnection should be attempted.
	 * The coordinator should wire this to actually perform the reconnection.
	 *
	 * @param callback - Function to call when reconnection should be attempted
	 * @returns Unsubscribe function
	 */
	onReconnectNeeded(callback: () => Promise<void>): () => void;

	/**
	 * Subscribe to network change events.
	 *
	 * @param callback - Function called when network type changes
	 * @returns Unsubscribe function
	 */
	onNetworkChange(callback: (event: NetworkChangeEvent) => void): () => void;

	/**
	 * Subscribe to recovery state changes.
	 *
	 * @param callback - Function called when recovery state changes
	 * @returns Unsubscribe function
	 */
	onRecoveryStateChange(callback: (event: RecoveryStateEvent) => void): () => void;

	/**
	 * Update configuration at runtime.
	 *
	 * @param config - Partial configuration to merge
	 */
	updateConfig(config: Partial<MobileConnectionConfig>): void;

	/**
	 * Clean up all resources.
	 */
	destroy(): void;
}
