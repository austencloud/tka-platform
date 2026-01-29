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

import type { ConnectionQuality, AdaptiveHeartbeatConfig } from '../../domain/sync-types';

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
export interface IAdaptiveHeartbeat {
	/**
	 * Current heartbeat mode.
	 */
	readonly mode: HeartbeatMode;

	/**
	 * Current heartbeat interval in ms.
	 */
	readonly currentIntervalMs: number;

	/**
	 * Get current heartbeat statistics.
	 */
	readonly stats: HeartbeatStats;

	/**
	 * Whether the heartbeat system is running.
	 */
	readonly isRunning: boolean;

	/**
	 * Start the heartbeat system.
	 * Begins sending heartbeats at the configured interval.
	 */
	start(): void;

	/**
	 * Stop the heartbeat system.
	 * Stops sending heartbeats and clears pending timeouts.
	 */
	stop(): void;

	/**
	 * Pause heartbeats temporarily.
	 * Useful when app goes to background.
	 */
	pause(): void;

	/**
	 * Resume heartbeats after pause.
	 */
	resume(): void;

	/**
	 * Report that a heartbeat was sent.
	 * Call this when the coordinator sends a heartbeat message.
	 *
	 * @param seq - Sequence number of the heartbeat
	 * @returns The send timestamp for RTT calculation
	 */
	recordSent(seq: number): number;

	/**
	 * Report that a heartbeat acknowledgment was received.
	 * Call this when the coordinator receives a heartbeat ack.
	 *
	 * @param seq - Sequence number of the acknowledged heartbeat
	 * @param sentAt - Timestamp when the heartbeat was sent
	 */
	recordAck(seq: number, sentAt: number): void;

	/**
	 * Report that a heartbeat timed out (no ack received).
	 * Call this when the heartbeat timeout expires.
	 *
	 * @param seq - Sequence number of the timed out heartbeat
	 */
	recordTimeout(seq: number): void;

	/**
	 * Notify of connection quality change.
	 * May trigger mode adjustments.
	 *
	 * @param quality - New connection quality
	 */
	notifyQualityChange(quality: ConnectionQuality): void;

	/**
	 * Force a specific mode temporarily.
	 * Use to verify connection after suspicious activity.
	 *
	 * @param mode - Mode to switch to
	 * @param durationMs - How long to stay in this mode (optional)
	 */
	forceMode(mode: HeartbeatMode, durationMs?: number): void;

	/**
	 * Register callback for when a heartbeat should be sent.
	 * The coordinator should wire this to actually send the heartbeat.
	 *
	 * @param callback - Function returning the sequence number to use
	 * @returns Unsubscribe function
	 */
	onHeartbeatDue(callback: () => number): () => void;

	/**
	 * Subscribe to heartbeat events.
	 *
	 * @param callback - Function called on heartbeat events
	 * @returns Unsubscribe function
	 */
	onEvent(callback: (event: HeartbeatEvent) => void): () => void;

	/**
	 * Subscribe to interval changes.
	 * Useful for UI to show current heartbeat rate.
	 *
	 * @param callback - Function called when interval changes
	 * @returns Unsubscribe function
	 */
	onIntervalChange(callback: (intervalMs: number) => void): () => void;

	/**
	 * Update configuration at runtime.
	 *
	 * @param config - Partial configuration to merge
	 */
	updateConfig(config: Partial<AdaptiveHeartbeatConfig>): void;

	/**
	 * Reset statistics and state.
	 */
	reset(): void;

	/**
	 * Clean up all resources.
	 */
	destroy(): void;
}
