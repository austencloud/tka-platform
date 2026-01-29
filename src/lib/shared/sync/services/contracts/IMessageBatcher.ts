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

import type { SyncMessage } from '../../domain/sync-messages';

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
export interface IMessageBatcher {
	/**
	 * Number of messages currently queued.
	 */
	readonly queuedCount: number;

	/**
	 * Whether batching is currently enabled.
	 */
	readonly isEnabled: boolean;

	/**
	 * Whether the batcher is in urgent mode (all messages sent immediately).
	 */
	readonly isUrgent: boolean;

	/**
	 * Queue a message for batched sending.
	 * Critical priority messages bypass the queue entirely.
	 *
	 * @param message - The message to send
	 * @param priority - Message priority (default: 'normal')
	 */
	queue(message: SyncMessage, priority?: MessagePriority): void;

	/**
	 * Immediately flush all queued messages.
	 * Use when you need to ensure all pending messages are sent.
	 */
	flush(): void;

	/**
	 * Set urgent mode on or off.
	 * When urgent, all messages bypass batching and send immediately.
	 *
	 * @param urgent - Whether to enable urgent mode
	 */
	setUrgent(urgent: boolean): void;

	/**
	 * Enable or disable batching.
	 * When disabled, all messages are sent immediately.
	 *
	 * @param enabled - Whether to enable batching
	 */
	setEnabled(enabled: boolean): void;

	/**
	 * Notify of network type change.
	 * May adjust batch windows based on connection type.
	 *
	 * @param isWifi - Whether currently on wifi
	 */
	notifyNetworkType(isWifi: boolean): void;

	/**
	 * Register callback for when messages should be sent.
	 * The coordinator should wire this to actually broadcast.
	 *
	 * @param callback - Function to call with messages to send
	 * @returns Unsubscribe function
	 */
	onFlush(callback: (event: BatchFlushEvent) => void): () => void;

	/**
	 * Update configuration at runtime.
	 *
	 * @param config - Partial configuration to merge
	 */
	updateConfig(config: Partial<MessageBatcherConfig>): void;

	/**
	 * Clear all queued messages without sending them.
	 * Use when disconnecting or shutting down.
	 */
	clear(): void;

	/**
	 * Start the batcher.
	 * Must be called before queuing messages.
	 */
	start(): void;

	/**
	 * Stop the batcher and flush any remaining messages.
	 */
	stop(): void;

	/**
	 * Clean up all resources.
	 */
	destroy(): void;
}
