import type { HeartbeatMode, HeartbeatStats, HeartbeatEvent } from "./types";
import type {
	AdaptiveHeartbeatConfig,
	ConnectionQuality
} from '../domain/sync-types';
import { DEFAULT_ADAPTIVE_HEARTBEAT_CONFIG } from '../domain/sync-types';

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

interface NavigatorWithBattery extends Navigator {
	getBattery?: () => Promise<BatteryManager>;
}

export class AdaptiveHeartbeat {
	private config: AdaptiveHeartbeatConfig;

	private _mode: HeartbeatMode = 'normal';
	private _currentIntervalMs: number;
	private _isRunning: boolean = false;

	private _sentCount: number = 0;
	private _ackedCount: number = 0;
	private _timedOutCount: number = 0;
	private _consecutiveSuccess: number = 0;
	private _consecutiveFailures: number = 0;
	private _rttSamples: number[] = [];
	private _batteryLevel: number | null = null;
	private _isCharging: boolean | null = null;

	private heartbeatTimerId: ReturnType<typeof setTimeout> | null = null;
	private forcedModeTimerId: ReturnType<typeof setTimeout> | null = null;

	private pendingHeartbeats: Map<number, number> = new Map();

	private batteryManager: BatteryManager | null = null;
	private boundBatteryChangeHandler: () => void;

	private heartbeatDueCallbacks: Set<() => number> = new Set();
	private eventCallbacks: Set<(event: HeartbeatEvent) => void> = new Set();
	private intervalChangeCallbacks: Set<(intervalMs: number) => void> = new Set();

	constructor(config: Partial<AdaptiveHeartbeatConfig> = {}) {
		this.config = { ...DEFAULT_ADAPTIVE_HEARTBEAT_CONFIG, ...config };
		this._currentIntervalMs = this.config.defaultIntervalMs;
		this.boundBatteryChangeHandler = this.handleBatteryChange.bind(this);
		this.initBatteryMonitoring();
	}

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

		if (this.batteryManager) {
			this.batteryManager.removeEventListener('levelchange', this.boundBatteryChangeHandler);
			this.batteryManager.removeEventListener('chargingchange', this.boundBatteryChangeHandler);
			this.batteryManager = null;
		}

		this.heartbeatDueCallbacks.clear();
		this.eventCallbacks.clear();
		this.intervalChangeCallbacks.clear();
	}

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

		const rttMs = Date.now() - sentAt;
		this._rttSamples.push(rttMs);

		if (this._rttSamples.length > 10) {
			this._rttSamples.shift();
		}

		this._consecutiveSuccess++;
		this._consecutiveFailures = 0;

		this.emitEvent({
			type: 'acked',
			timestamp: Date.now(),
			rttMs,
			seq
		});

		if (this._consecutiveSuccess >= this.config.stabilityThreshold) {
			this.increaseInterval();
		}
	}

	recordTimeout(seq: number): void {
		if (!this.pendingHeartbeats.has(seq)) return;

		this.pendingHeartbeats.delete(seq);
		this._timedOutCount++;

		this._consecutiveFailures++;
		this._consecutiveSuccess = 0;

		this.emitEvent({
			type: 'timeout',
			timestamp: Date.now(),
			seq
		});

		if (this._consecutiveFailures >= this.config.degradationThreshold) {
			this.decreaseInterval();
		}
	}

	notifyQualityChange(quality: ConnectionQuality): void {
		if (this._mode === 'paused') return;

		switch (quality) {
			case 'disconnected':
				break;

			case 'poor':
			case 'degraded':
				if (this._mode !== 'verifying') {
					this.setMode('verifying');
					this.setInterval(this.config.verifyIntervalMs);
				}
				break;

			case 'good':
			case 'excellent':
				if (this._mode === 'verifying') {
					this.setMode('normal');
					this.setInterval(this.config.defaultIntervalMs);
				}
				break;
		}
	}

	forceMode(mode: HeartbeatMode, durationMs?: number): void {
		if (this.forcedModeTimerId !== null) {
			clearTimeout(this.forcedModeTimerId);
			this.forcedModeTimerId = null;
		}

		this.setMode(mode);

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

		if (durationMs !== undefined && mode !== 'paused') {
			this.forcedModeTimerId = setTimeout(() => {
				this.forcedModeTimerId = null;
				this.setMode(this.determineInitialMode());
				this.setInterval(this.config.defaultIntervalMs);
			}, durationMs);
		}
	}

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

	private increaseInterval(): void {
		if (this._mode === 'paused' || this._mode === 'verifying') return;

		const newInterval = Math.min(
			this._currentIntervalMs * this.config.increaseMultiplier,
			this.config.maxIntervalMs
		);

		if (newInterval !== this._currentIntervalMs) {
			this.setInterval(newInterval);
			this._consecutiveSuccess = 0;
		}

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
			this._consecutiveFailures = 0;
		}

		if (this._mode !== 'verifying') {
			this.setMode('verifying');
		}
	}

	private setInterval(intervalMs: number): void {
		let effectiveInterval = intervalMs;
		if (this._mode === 'battery-saver' || this.shouldEnableBatterySaver()) {
			effectiveInterval = intervalMs * this.config.lowBatteryMultiplier;
		}

		effectiveInterval = Math.max(
			this.config.minIntervalMs,
			Math.min(effectiveInterval, this.config.maxIntervalMs * this.config.lowBatteryMultiplier)
		);

		if (effectiveInterval === this._currentIntervalMs) return;

		this._currentIntervalMs = effectiveInterval;

		for (const callback of this.intervalChangeCallbacks) {
			callback(this._currentIntervalMs);
		}

		this.emitEvent({
			type: 'interval-change',
			timestamp: Date.now(),
			newIntervalMs: this._currentIntervalMs
		});

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

		if (previousMode === 'paused' && newMode !== 'paused' && this._isRunning) {
			this.scheduleNextHeartbeat();
		}
	}

	private scheduleNextHeartbeat(): void {
		if (!this._isRunning || this._mode === 'paused') return;

		this.heartbeatTimerId = setTimeout(() => {
			this.triggerHeartbeat();
		}, this._currentIntervalMs);
	}

	private triggerHeartbeat(): void {
		if (!this._isRunning || this._mode === 'paused') return;

		for (const callback of this.heartbeatDueCallbacks) {
			try {
				callback();
			} catch (error) {
				console.warn('[AdaptiveHeartbeat] Heartbeat callback error:', error);
			}
		}

		this.scheduleNextHeartbeat();
	}

	private clearTimers(): void {
		if (this.heartbeatTimerId !== null) {
			clearTimeout(this.heartbeatTimerId);
			this.heartbeatTimerId = null;
		}
	}

	private async initBatteryMonitoring(): Promise<void> {
		if (typeof navigator === 'undefined') return;
		if (!this.config.batteryAware) return;

		const nav = navigator as NavigatorWithBattery;
		if (!nav.getBattery) return;

		try {
			this.batteryManager = await nav.getBattery();
			this._batteryLevel = this.batteryManager.level;
			this._isCharging = this.batteryManager.charging;

			this.batteryManager.addEventListener('levelchange', this.boundBatteryChangeHandler);
			this.batteryManager.addEventListener('chargingchange', this.boundBatteryChangeHandler);

			if (this.shouldEnableBatterySaver()) {
				this.setMode('battery-saver');
			}
		} catch {
			this.batteryManager = null;
		}
	}

	private handleBatteryChange(): void {
		if (!this.batteryManager) return;

		this._batteryLevel = this.batteryManager.level;
		this._isCharging = this.batteryManager.charging;

		if (this.shouldEnableBatterySaver() && this._mode !== 'battery-saver' && this._mode !== 'paused') {
			this.setMode('battery-saver');
			this.setInterval(this._currentIntervalMs * this.config.lowBatteryMultiplier);
		} else if (!this.shouldEnableBatterySaver() && this._mode === 'battery-saver') {
			this.setMode('normal');
			this.setInterval(this.config.defaultIntervalMs);
		}
	}

	private shouldEnableBatterySaver(): boolean {
		if (!this.config.batteryAware) return false;
		if (this._batteryLevel === null) return false;
		if (this._isCharging) return false;

		return this._batteryLevel < this.config.lowBatteryThreshold;
	}

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
