import type { MessageBatcherConfig, MessagePriority, QueuedMessage, BatchFlushEvent } from "./types";
import { DEFAULT_MESSAGE_BATCHER_CONFIG } from "./types";
import type { SyncMessage } from '../domain/sync-messages';

interface BatchTimers {
	high: ReturnType<typeof setTimeout> | null;
	normal: ReturnType<typeof setTimeout> | null;
	low: ReturnType<typeof setTimeout> | null;
}

export class MessageBatcher {
	private config: MessageBatcherConfig;

	private _isEnabled: boolean;
	private _isUrgent: boolean = false;
	private _isRunning: boolean = false;
	private _isWifi: boolean = true;

	private queues: {
		high: QueuedMessage[];
		normal: QueuedMessage[];
		low: QueuedMessage[];
	} = {
		high: [],
		normal: [],
		low: []
	};

	private timers: BatchTimers = {
		high: null,
		normal: null,
		low: null
	};

	private flushCallbacks: Set<(event: BatchFlushEvent) => void> = new Set();

	constructor(config: Partial<MessageBatcherConfig> = {}) {
		this.config = { ...DEFAULT_MESSAGE_BATCHER_CONFIG, ...config };
		this._isEnabled = this.config.enabled;
	}

	get queuedCount(): number {
		return this.queues.high.length + this.queues.normal.length + this.queues.low.length;
	}

	get isEnabled(): boolean {
		return this._isEnabled;
	}

	get isUrgent(): boolean {
		return this._isUrgent;
	}

	start(): void {
		if (this._isRunning) return;
		this._isRunning = true;
	}

	stop(): void {
		if (!this._isRunning) return;
		this._isRunning = false;

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

	queue(message: SyncMessage, priority: MessagePriority = 'normal'): void {
		if (priority === 'critical') {
			this.sendImmediately([message], 'urgent');
			return;
		}

		if (!this._isEnabled || this._isUrgent || !this._isRunning) {
			this.sendImmediately([message], 'urgent');
			return;
		}

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

	setUrgent(urgent: boolean): void {
		if (this._isUrgent === urgent) return;

		this._isUrgent = urgent;

		if (urgent && this.queuedCount > 0) {
			this.flushAll('urgent');
		}
	}

	setEnabled(enabled: boolean): void {
		if (this._isEnabled === enabled) return;

		this._isEnabled = enabled;

		if (!enabled && this.queuedCount > 0) {
			this.flushAll('manual');
		}
	}

	notifyNetworkType(isWifi: boolean): void {
		this._isWifi = isWifi;
	}

	onFlush(callback: (event: BatchFlushEvent) => void): () => void {
		this.flushCallbacks.add(callback);
		return () => this.flushCallbacks.delete(callback);
	}

	updateConfig(config: Partial<MessageBatcherConfig>): void {
		this.config = { ...this.config, ...config };

		if (config.enabled !== undefined) {
			this._isEnabled = config.enabled;
		}
	}

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
