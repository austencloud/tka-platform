/**
 * AdaptiveHeartbeat
 *
 * Implements adaptive heartbeat timing that adjusts based on:
 * - Connection stability (consecutive successes/failures)
 * - Battery level (via Battery Status API)
 * - Network type (via Network Information API)
 *
 * Optimized for mobile devices to minimize battery drain while
 * maintaining reliable connection detection.
 */

import type {
	IAdaptiveHeartbeat,
	HeartbeatMode,
	HeartbeatStats,
	HeartbeatEvent
} from '../contracts/IAdaptiveHeartbeat';
import type {
	AdaptiveHeartbeatConfig,
	ConnectionQuality
} from '../../domain/sync-types';
import { DEFAULT_ADAPTIVE_HEARTBEAT_CONFIG } from '../../domain/sync-types';

/**
 * Battery Manager interface for Battery Status API.
 */
interface BatteryManager extends EventTarget {
	charging: boolean;
	chargingTime: number;
	dischargingTime: number;
	level: number;
	onchargingchange: EventListener | null;
	onchargingtimechange: EventListener | null;
	ondischargingtimechange: EventListener | null;
	onlevelchange: EventListener | null;
}

/**
 * Navigator with optional getBattery method.
 */
interface NavigatorWithBattery extends Navigator {
	getBattery?: () => Promise<BatteryManager>;
}

/**
 * AdaptiveHeartbeat implementation.
 */
export class AdaptiveHeartbeat implements IAdaptiveHeartbeat {
	// Configuration
	private config: AdaptiveHeartbeatConfig;

	// State
	private _mode: HeartbeatMode = 'normal';
	private _currentIntervalMs: number;
	private _isRunning: boolean = false;

	// Statistics
	private _sentCount: number = 0;
	private _ackedCount: number = 0;
	private _timedOutCount: number = 0;
	private _consecutiveSuccess: number = 0;
	private _consecutiveFailures: number = 0;
	private _rttSamples: number[] = [];
	private _batteryLevel: number | null = null;
	private _isCharging: boolean | null = null;

	// Timers
	private heartbeatTimerId: ReturnType<typeof setTimeout> | null = null;
	private forcedModeTimerId: ReturnType<typeof setTimeout> | null = null;

	// Pending heartbeats
	private pendingHeartbeats: Map<number, number> = new Map(); // seq -> sentAt

	// Battery manager
	private batteryManager: BatteryManager | null = null;
	private boundBatteryChangeHandler: () => void;

	// Callbacks
	private heartbeatDueCallbacks: Set<() => number> = new Set();
	private eventCallbacks: Set<(event: HeartbeatEvent) => void> = new Set();
	private intervalChangeCallbacks: Set<(intervalMs: number) => void> = new Set();

	constructor(config: Partial<AdaptiveHeartbeatConfig> = {}) {
		this.config = { ...DEFAULT_ADAPTIVE_HEARTBEAT_CONFIG, ...config };
		this._currentIntervalMs = this.config.defaultIntervalMs;

		// Bind handlers
		this.boundBatteryChangeHandler = this.handleBatteryChange.bind(this);

		// Initialize battery monitoring if available
		this.initBatteryMonitoring();
	}

	// =========================================================================
	// Public Getters
	// =========================================================================

	get mode(): HeartbeatMode {
		return this._mode;
	}

	get currentIntervalMs(): number {
		return this._currentIntervalMs;
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	get stats(): HeartbeatStats {
		return {
			currentIntervalMs: this._currentIntervalMs,
			sentCount: this._sentCount,
			ackedCount: this._ackedCount,
			timedOutCount: this._timedOutCount,
			consecutiveSuccess: this._consecutiveSuccess,
			consecutiveFailures: this._consecutiveFailures,
			averageRttMs: this.calculateAverageRtt(),
			mode: this._mode,
			batteryLevel: this._batteryLevel,
			isCharging: this._isCharging
		};
	}

	// =========================================================================
	// Lifecycle Methods
	// =========================================================================

	start(): void {
		if (this._isRunning) return;
		this._isRunning = true;
		this._mode = this.determineInitialMode();
		this.scheduleNextHeartbeat();
	}

	stop(): void {
		if (!this._isRunning) return;
		this._isRunning = false;

		this.clearTimers();
		this.pendingHeartbeats.clear();
	}

	pause(): void {
		if (this._mode === 'paused') return;

		this.setMode('paused');
		this.clearTimers();
	}

	resume(): void {
		if (this._mode !== 'paused') return;

		this._mode = this.determineInitialMode();
		if (this._isRunning) {
			this.scheduleNextHeartbeat();
		}
	}

	destroy(): void {
		this.stop();

		// Clean up battery monitoring
		if (this.batteryManager) {
			this.batteryManager.removeEventListener('levelchange', this.boundBatteryChangeHandler);
			this.batteryManager.removeEventListener('chargingchange', this.boundBatteryChangeHandler);
			this.batteryManager = null;
		}

		// Clear callbacks
		this.heartbeatDueCallbacks.clear();
		this.eventCallbacks.clear();
		this.intervalChangeCallbacks.clear();
	}

	// =========================================================================
	// Recording Methods
	// =========================================================================

	recordSent(seq: number): number {
		const sentAt = Date.now();
		this.pendingHeartbeats.set(seq, sentAt);
		this._sentCount++;

		this.emitEvent({
			type: 'sent',
			timestamp: sentAt,
			seq
		});

		return sentAt;
	}

	recordAck(seq: number, sentAt: number): void {
		if (!this.pendingHeartbeats.has(seq)) return;

		this.pendingHeartbeats.delete(seq);
		this._ackedCount++;

		// Calculate RTT
		const rttMs = Date.now() - sentAt;
		this._rttSamples.push(rttMs);

		// Keep only last 10 samples
		if (this._rttSamples.length > 10) {
			this._rttSamples.shift();
		}

		// Update consecutive counters
		this._consecutiveSuccess++;
		this._consecutiveFailures = 0;

		this.emitEvent({
			type: 'acked',
			timestamp: Date.now(),
			rttMs,
			seq
		});

		// Check if we should increase interval (connection is stable)
		if (this._consecutiveSuccess >= this.config.stabilityThreshold) {
			this.increaseInterval();
		}
	}

	recordTimeout(seq: number): void {
		if (!this.pendingHeartbeats.has(seq)) return;

		this.pendingHeartbeats.delete(seq);
		this._timedOutCount++;

		// Update consecutive counters
		this._consecutiveFailures++;
		this._consecutiveSuccess = 0;

		this.emitEvent({
			type: 'timeout',
			timestamp: Date.now(),
			seq
		});

		// Check if we should decrease interval (connection is unstable)
		if (this._consecutiveFailures >= this.config.degradationThreshold) {
			this.decreaseInterval();
		}
	}

	// =========================================================================
	// Quality and Mode Management
	// =========================================================================

	notifyQualityChange(quality: ConnectionQuality): void {
		if (this._mode === 'paused') return;

		switch (quality) {
			case 'disconnected':
				// Don't change mode - let the coordinator handle disconnection
				break;

			case 'poor':
			case 'degraded':
				// Switch to verifying mode to confirm connection
				if (this._mode !== 'verifying') {
					this.setMode('verifying');
					this.setInterval(this.config.verifyIntervalMs);
				}
				break;

			case 'good':
			case 'excellent':
				// If we were verifying and quality improved, go back to normal
				if (this._mode === 'verifying') {
					this.setMode('normal');
					this.setInterval(this.config.defaultIntervalMs);
				}
				break;
		}
	}

	forceMode(mode: HeartbeatMode, durationMs?: number): void {
		// Cancel any existing forced mode timer
		if (this.forcedModeTimerId !== null) {
			clearTimeout(this.forcedModeTimerId);
			this.forcedModeTimerId = null;
		}

		this.setMode(mode);

		// Set interval based on mode
		switch (mode) {
			case 'verifying':
				this.setInterval(this.config.verifyIntervalMs);
				break;
			case 'stable':
				this.setInterval(this.config.maxIntervalMs);
				break;
			case 'battery-saver':
				this.setInterval(this._currentIntervalMs * this.config.lowBatteryMultiplier);
				break;
			case 'normal':
				this.setInterval(this.config.defaultIntervalMs);
				break;
		}

		// If duration specified, revert to normal after that time
		if (durationMs !== undefined && mode !== 'paused') {
			this.forcedModeTimerId = setTimeout(() => {
				this.forcedModeTimerId = null;
				this.setMode(this.determineInitialMode());
				this.setInterval(this.config.defaultIntervalMs);
			}, durationMs);
		}
	}

	// =========================================================================
	// Event Subscriptions
	// =========================================================================

	onHeartbeatDue(callback: () => number): () => void {
		this.heartbeatDueCallbacks.add(callback);
		return () => this.heartbeatDueCallbacks.delete(callback);
	}

	onEvent(callback: (event: HeartbeatEvent) => void): () => void {
		this.eventCallbacks.add(callback);
		return () => this.eventCallbacks.delete(callback);
	}

	onIntervalChange(callback: (intervalMs: number) => void): () => void {
		this.intervalChangeCallbacks.add(callback);
		return () => this.intervalChangeCallbacks.delete(callback);
	}

	// =========================================================================
	// Configuration
	// =========================================================================

	updateConfig(config: Partial<AdaptiveHeartbeatConfig>): void {
		this.config = { ...this.config, ...config };
	}

	reset(): void {
		this._sentCount = 0;
		this._ackedCount = 0;
		this._timedOutCount = 0;
		this._consecutiveSuccess = 0;
		this._consecutiveFailures = 0;
		this._rttSamples = [];
		this.pendingHeartbeats.clear();
		this._currentIntervalMs = this.config.defaultIntervalMs;
		this._mode = this.determineInitialMode();
	}

	// =========================================================================
	// Private: Interval Management
	// =========================================================================

	private increaseInterval(): void {
		if (this._mode === 'paused' || this._mode === 'verifying') return;

		const newInterval = Math.min(
			this._currentIntervalMs * this.config.increaseMultiplier,
			this.config.maxIntervalMs
		);

		if (newInterval !== this._currentIntervalMs) {
			this.setInterval(newInterval);
			this._consecutiveSuccess = 0; // Reset counter after adjustment
		}

		// If at max interval, switch to stable mode
		if (newInterval >= this.config.maxIntervalMs && this._mode !== 'stable') {
			this.setMode('stable');
		}
	}

	private decreaseInterval(): void {
		if (this._mode === 'paused') return;

		const newInterval = Math.max(
			this._currentIntervalMs * this.config.decreaseMultiplier,
			this.config.minIntervalMs
		);

		if (newInterval !== this._currentIntervalMs) {
			this.setInterval(newInterval);
			this._consecutiveFailures = 0; // Reset counter after adjustment
		}

		// Switch to verifying mode if not already
		if (this._mode !== 'verifying') {
			this.setMode('verifying');
		}
	}

	private setInterval(intervalMs: number): void {
		// Apply battery multiplier if in battery-saver mode
		let effectiveInterval = intervalMs;
		if (this._mode === 'battery-saver' || this.shouldEnableBatterySaver()) {
			effectiveInterval = intervalMs * this.config.lowBatteryMultiplier;
		}

		// Clamp to valid range
		effectiveInterval = Math.max(
			this.config.minIntervalMs,
			Math.min(effectiveInterval, this.config.maxIntervalMs * this.config.lowBatteryMultiplier)
		);

		if (effectiveInterval === this._currentIntervalMs) return;

		this._currentIntervalMs = effectiveInterval;

		// Notify listeners
		for (const callback of this.intervalChangeCallbacks) {
			callback(this._currentIntervalMs);
		}

		this.emitEvent({
			type: 'interval-change',
			timestamp: Date.now(),
			newIntervalMs: this._currentIntervalMs
		});

		// Reschedule next heartbeat with new interval
		if (this._isRunning && this._mode !== 'paused') {
			this.clearTimers();
			this.scheduleNextHeartbeat();
		}
	}

	private setMode(newMode: HeartbeatMode): void {
		if (newMode === this._mode) return;

		const previousMode = this._mode;
		this._mode = newMode;

		this.emitEvent({
			type: 'mode-change',
			timestamp: Date.now(),
			newMode
		});

		// If transitioning from paused, schedule heartbeat
		if (previousMode === 'paused' && newMode !== 'paused' && this._isRunning) {
			this.scheduleNextHeartbeat();
		}
	}

	// =========================================================================
	// Private: Heartbeat Scheduling
	// =========================================================================

	private scheduleNextHeartbeat(): void {
		if (!this._isRunning || this._mode === 'paused') return;

		this.heartbeatTimerId = setTimeout(() => {
			this.triggerHeartbeat();
		}, this._currentIntervalMs);
	}

	private triggerHeartbeat(): void {
		if (!this._isRunning || this._mode === 'paused') return;

		// Invoke all registered callbacks (they should return seq number)
		for (const callback of this.heartbeatDueCallbacks) {
			try {
				callback();
			} catch (error) {
				console.warn('[AdaptiveHeartbeat] Heartbeat callback error:', error);
			}
		}

		// Schedule next heartbeat
		this.scheduleNextHeartbeat();
	}

	private clearTimers(): void {
		if (this.heartbeatTimerId !== null) {
			clearTimeout(this.heartbeatTimerId);
			this.heartbeatTimerId = null;
		}
	}

	// =========================================================================
	// Private: Battery Management
	// =========================================================================

	private async initBatteryMonitoring(): Promise<void> {
		if (typeof navigator === 'undefined') return;
		if (!this.config.batteryAware) return;

		const nav = navigator as NavigatorWithBattery;
		if (!nav.getBattery) return;

		try {
			this.batteryManager = await nav.getBattery();
			this._batteryLevel = this.batteryManager.level;
			this._isCharging = this.batteryManager.charging;

			// Set up listeners
			this.batteryManager.addEventListener('levelchange', this.boundBatteryChangeHandler);
			this.batteryManager.addEventListener('chargingchange', this.boundBatteryChangeHandler);

			// Check if we should enable battery saver immediately
			if (this.shouldEnableBatterySaver()) {
				this.setMode('battery-saver');
			}
		} catch {
			// Battery API not available or permission denied
			this.batteryManager = null;
		}
	}

	private handleBatteryChange(): void {
		if (!this.batteryManager) return;

		this._batteryLevel = this.batteryManager.level;
		this._isCharging = this.batteryManager.charging;

		// Check if we should enable/disable battery saver
		if (this.shouldEnableBatterySaver() && this._mode !== 'battery-saver' && this._mode !== 'paused') {
			this.setMode('battery-saver');
			// Increase interval for battery saving
			this.setInterval(this._currentIntervalMs * this.config.lowBatteryMultiplier);
		} else if (!this.shouldEnableBatterySaver() && this._mode === 'battery-saver') {
			// Disable battery saver
			this.setMode('normal');
			// Restore normal interval
			this.setInterval(this.config.defaultIntervalMs);
		}
	}

	private shouldEnableBatterySaver(): boolean {
		if (!this.config.batteryAware) return false;
		if (this._batteryLevel === null) return false;
		if (this._isCharging) return false; // Don't save battery while charging

		return this._batteryLevel < this.config.lowBatteryThreshold;
	}

	// =========================================================================
	// Private: Utility Methods
	// =========================================================================

	private determineInitialMode(): HeartbeatMode {
		if (this.shouldEnableBatterySaver()) {
			return 'battery-saver';
		}
		return 'normal';
	}

	private calculateAverageRtt(): number | null {
		if (this._rttSamples.length === 0) return null;

		const sum = this._rttSamples.reduce((acc, val) => acc + val, 0);
		return Math.round(sum / this._rttSamples.length);
	}

	private emitEvent(event: HeartbeatEvent): void {
		for (const callback of this.eventCallbacks) {
			callback(event);
		}
	}
}
