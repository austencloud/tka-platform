/**
 * MessageBatcher
 *
 * Batches non-critical sync messages to reduce radio wake-ups on mobile.
 * Critical messages (playback intents, heartbeats) always send immediately.
 * Normal/low priority messages are batched and sent together.
 *
 * Battery optimization strategy:
 * - Cellular radios have significant wake-up power cost
 * - Batching multiple small messages into one transmission saves battery
 * - Adaptive batch windows based on network type (shorter on wifi)
 */

import type {
	IMessageBatcher,
	MessageBatcherConfig,
	MessagePriority,
	QueuedMessage,
	BatchFlushEvent
} from '../contracts/IMessageBatcher';
import { DEFAULT_MESSAGE_BATCHER_CONFIG } from '../contracts/IMessageBatcher';
import type { SyncMessage } from '../../domain/sync-messages';

/**
 * Priority level to batch window mapping.
 */
interface BatchTimers {
	high: ReturnType<typeof setTimeout> | null;
	normal: ReturnType<typeof setTimeout> | null;
	low: ReturnType<typeof setTimeout> | null;
}

/**
 * MessageBatcher implementation.
 */
export class MessageBatcher implements IMessageBatcher {
	// Configuration
	private config: MessageBatcherConfig;

	// State
	private _isEnabled: boolean;
	private _isUrgent: boolean = false;
	private _isRunning: boolean = false;
	private _isWifi: boolean = true;

	// Message queues by priority
	private queues: {
		high: QueuedMessage[];
		normal: QueuedMessage[];
		low: QueuedMessage[];
	} = {
		high: [],
		normal: [],
		low: []
	};

	// Batch timers by priority
	private timers: BatchTimers = {
		high: null,
		normal: null,
		low: null
	};

	// Callbacks
	private flushCallbacks: Set<(event: BatchFlushEvent) => void> = new Set();

	constructor(config: Partial<MessageBatcherConfig> = {}) {
		this.config = { ...DEFAULT_MESSAGE_BATCHER_CONFIG, ...config };
		this._isEnabled = this.config.enabled;
	}

	// =========================================================================
	// Public Getters
	// =========================================================================

	get queuedCount(): number {
		return this.queues.high.length + this.queues.normal.length + this.queues.low.length;
	}

	get isEnabled(): boolean {
		return this._isEnabled;
	}

	get isUrgent(): boolean {
		return this._isUrgent;
	}

	// =========================================================================
	// Lifecycle Methods
	// =========================================================================

	start(): void {
		if (this._isRunning) return;
		this._isRunning = true;
	}

	stop(): void {
		if (!this._isRunning) return;
		this._isRunning = false;

		// Flush remaining messages before stopping
		if (this.queuedCount > 0) {
			this.flushAll('shutdown');
		}

		this.clearAllTimers();
	}

	destroy(): void {
		this.stop();
		this.clear();
		this.flushCallbacks.clear();
	}

	// =========================================================================
	// Queue Management
	// =========================================================================

	queue(message: SyncMessage, priority: MessagePriority = 'normal'): void {
		// Critical messages always bypass batching
		if (priority === 'critical') {
			this.sendImmediately([message], 'urgent');
			return;
		}

		// If disabled, urgent mode, or not running, send immediately
		if (!this._isEnabled || this._isUrgent || !this._isRunning) {
			this.sendImmediately([message], 'urgent');
			return;
		}

		// Queue the message
		const queuedMessage: QueuedMessage = {
			message,
			priority,
			queuedAt: Date.now()
		};

		switch (priority) {
			case 'high':
				this.queues.high.push(queuedMessage);
				this.ensureTimerRunning('high');
				break;
			case 'normal':
				this.queues.normal.push(queuedMessage);
				this.ensureTimerRunning('normal');
				break;
			case 'low':
				this.queues.low.push(queuedMessage);
				this.ensureTimerRunning('low');
				break;
		}

		// Check if we've hit max batch size
		if (this.queuedCount >= this.config.maxBatchSize) {
			this.flushAll('max-size');
		}
	}

	flush(): void {
		this.flushAll('manual');
	}

	clear(): void {
		this.queues.high = [];
		this.queues.normal = [];
		this.queues.low = [];
		this.clearAllTimers();
	}

	// =========================================================================
	// Mode Control
	// =========================================================================

	setUrgent(urgent: boolean): void {
		if (this._isUrgent === urgent) return;

		this._isUrgent = urgent;

		// When entering urgent mode, flush everything
		if (urgent && this.queuedCount > 0) {
			this.flushAll('urgent');
		}
	}

	setEnabled(enabled: boolean): void {
		if (this._isEnabled === enabled) return;

		this._isEnabled = enabled;

		// When disabling batching, flush everything
		if (!enabled && this.queuedCount > 0) {
			this.flushAll('manual');
		}
	}

	notifyNetworkType(isWifi: boolean): void {
		this._isWifi = isWifi;
		// Note: Batch windows will be recalculated on next ensureTimerRunning call
	}

	// =========================================================================
	// Event Subscriptions
	// =========================================================================

	onFlush(callback: (event: BatchFlushEvent) => void): () => void {
		this.flushCallbacks.add(callback);
		return () => this.flushCallbacks.delete(callback);
	}

	// =========================================================================
	// Configuration
	// =========================================================================

	updateConfig(config: Partial<MessageBatcherConfig>): void {
		this.config = { ...this.config, ...config };

		if (config.enabled !== undefined) {
			this._isEnabled = config.enabled;
		}
	}

	// =========================================================================
	// Private: Timer Management
	// =========================================================================

	private ensureTimerRunning(priority: 'high' | 'normal' | 'low'): void {
		if (this.timers[priority] !== null) return;

		const windowMs = this.getBatchWindow(priority);

		this.timers[priority] = setTimeout(() => {
			this.timers[priority] = null;
			this.flushQueue(priority);
		}, windowMs);
	}

	private getBatchWindow(priority: 'high' | 'normal' | 'low'): number {
		let baseWindow: number;

		switch (priority) {
			case 'high':
				baseWindow = this.config.highBatchWindowMs;
				break;
			case 'normal':
				baseWindow = this.config.normalBatchWindowMs;
				break;
			case 'low':
				baseWindow = this.config.lowBatchWindowMs;
				break;
		}

		// Apply wifi multiplier if on wifi and adaptive is enabled
		if (this.config.adaptToNetwork && this._isWifi) {
			baseWindow = Math.round(baseWindow * this.config.wifiBatchMultiplier);
		}

		return baseWindow;
	}

	private clearTimer(priority: 'high' | 'normal' | 'low'): void {
		if (this.timers[priority] !== null) {
			clearTimeout(this.timers[priority]);
			this.timers[priority] = null;
		}
	}

	private clearAllTimers(): void {
		this.clearTimer('high');
		this.clearTimer('normal');
		this.clearTimer('low');
	}

	// =========================================================================
	// Private: Flush Operations
	// =========================================================================

	private flushQueue(priority: 'high' | 'normal' | 'low'): void {
		const queue = this.queues[priority];
		if (queue.length === 0) return;

		const messages = queue.map(q => q.message);
		this.queues[priority] = [];

		this.sendImmediately(messages, 'timer');
	}

	private flushAll(reason: BatchFlushEvent['reason']): void {
		this.clearAllTimers();

		const allMessages: SyncMessage[] = [
			...this.queues.high.map(q => q.message),
			...this.queues.normal.map(q => q.message),
			...this.queues.low.map(q => q.message)
		];

		this.queues.high = [];
		this.queues.normal = [];
		this.queues.low = [];

		if (allMessages.length > 0) {
			this.sendImmediately(allMessages, reason);
		}
	}

	private sendImmediately(messages: SyncMessage[], reason: BatchFlushEvent['reason']): void {
		if (messages.length === 0) return;

		const event: BatchFlushEvent = {
			messages,
			reason,
			timestamp: Date.now()
		};

		for (const callback of this.flushCallbacks) {
			try {
				callback(event);
			} catch (error) {
				console.warn('[MessageBatcher] Flush callback error:', error);
			}
		}
	}
}
