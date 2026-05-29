import type { MobileConnectionConfig, NetworkType, RecoveryState, NetworkChangeEvent, RecoveryStateEvent } from "./types";
import { DEFAULT_MOBILE_CONNECTION_CONFIG } from "./types";
import type { ConnectionQuality } from '../domain/sync-types';

interface NetworkInformation extends EventTarget {
	type?: string;
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	saveData?: boolean;
	onchange?: EventListener | null;
}

interface NavigatorWithConnection extends Navigator {
	connection?: NetworkInformation;
	mozConnection?: NetworkInformation;
	webkitConnection?: NetworkInformation;
}

export class MobileConnectionAdapter {
	private config: MobileConnectionConfig;

	private _recoveryState: RecoveryState = 'disconnected';
	private _networkType: NetworkType = 'unknown';
	private _isOnline: boolean = true;
	private _reconnectAttempt: number = 0;
	private _nextRetryIn: number | null = null;

	private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private retryCountdownId: ReturnType<typeof setInterval> | null = null;
	private networkCooldownId: ReturnType<typeof setTimeout> | null = null;

	private boundOnlineHandler: () => void;
	private boundOfflineHandler: () => void;
	private boundConnectionChangeHandler: () => void;
	private boundVisibilityChangeHandler: () => void;

	private reconnectCallbacks: Set<() => Promise<void>> = new Set();
	private networkChangeCallbacks: Set<(event: NetworkChangeEvent) => void> = new Set();
	private recoveryStateCallbacks: Set<(event: RecoveryStateEvent) => void> = new Set();

	private isStarted: boolean = false;
	private lastReconnectTime: number = 0;

	constructor(config: Partial<MobileConnectionConfig> = {}) {
		this.config = { ...DEFAULT_MOBILE_CONNECTION_CONFIG, ...config };

		this.boundOnlineHandler = this.handleOnline.bind(this);
		this.boundOfflineHandler = this.handleOffline.bind(this);
		this.boundConnectionChangeHandler = this.handleConnectionChange.bind(this);
		this.boundVisibilityChangeHandler = this.handleVisibilityChange.bind(this);

		this.updateNetworkType();
	}

	get recoveryState(): RecoveryState {
		return this._recoveryState;
	}

	get networkType(): NetworkType {
		return this._networkType;
	}

	get isOnline(): boolean {
		return this._isOnline;
	}

	get reconnectAttempt(): number {
		return this._reconnectAttempt;
	}

	get nextRetryIn(): number | null {
		return this._nextRetryIn;
	}

	get estimatedQuality(): ConnectionQuality {
		if (!this._isOnline) return 'disconnected';

		const connection = this.getNetworkConnection();
		if (!connection) {
			return this.estimateQualityFromType();
		}

		const effectiveType = connection.effectiveType;
		const rtt = connection.rtt;

		if (rtt !== undefined) {
			if (rtt <= 50) return 'excellent';
			if (rtt <= 150) return 'good';
			if (rtt <= 500) return 'degraded';
			return 'poor';
		}

		switch (effectiveType) {
			case '4g':
				return 'excellent';
			case '3g':
				return 'good';
			case '2g':
				return 'degraded';
			case 'slow-2g':
				return 'poor';
			default:
				return this.estimateQualityFromType();
		}
	}

	start(): void {
		if (this.isStarted) return;
		this.isStarted = true;

		this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
		this.updateNetworkType();

		if (typeof window !== 'undefined') {
			window.addEventListener('online', this.boundOnlineHandler);
			window.addEventListener('offline', this.boundOfflineHandler);
			document.addEventListener('visibilitychange', this.boundVisibilityChangeHandler);
		}

		const connection = this.getNetworkConnection();
		if (connection) {
			connection.addEventListener('change', this.boundConnectionChangeHandler);
		}
	}

	stop(): void {
		if (!this.isStarted) return;
		this.isStarted = false;

		this.cancelReconnect();

		if (typeof window !== 'undefined') {
			window.removeEventListener('online', this.boundOnlineHandler);
			window.removeEventListener('offline', this.boundOfflineHandler);
			document.removeEventListener('visibilitychange', this.boundVisibilityChangeHandler);
		}

		const connection = this.getNetworkConnection();
		if (connection) {
			connection.removeEventListener('change', this.boundConnectionChangeHandler);
		}

		if (this.networkCooldownId !== null) {
			clearTimeout(this.networkCooldownId);
			this.networkCooldownId = null;
		}
	}

	destroy(): void {
		this.stop();
		this.reconnectCallbacks.clear();
		this.networkChangeCallbacks.clear();
		this.recoveryStateCallbacks.clear();
	}

	notifyConnected(): void {
		this.setRecoveryState('connected');

		if (this.config.resetOnSuccess) {
			this._reconnectAttempt = 0;
		}

		this.cancelReconnect();
	}

	notifyDisconnected(_reason?: string): void {
		if (this._recoveryState === 'connected' || this._recoveryState === 'disconnected') {
			this.setRecoveryState('disconnected');
		}

		if (this._isOnline && this.isStarted) {
			this.scheduleReconnect();
		}
	}

	async triggerReconnect(): Promise<void> {
		this.cancelReconnect();
		await this.attemptReconnect();
	}

	cancelReconnect(): void {
		if (this.retryTimeoutId !== null) {
			clearTimeout(this.retryTimeoutId);
			this.retryTimeoutId = null;
		}

		if (this.retryCountdownId !== null) {
			clearInterval(this.retryCountdownId);
			this.retryCountdownId = null;
		}

		this._nextRetryIn = null;

		if (this._recoveryState === 'backing-off') {
			this.setRecoveryState('disconnected');
		}
	}

	onReconnectNeeded(callback: () => Promise<void>): () => void {
		this.reconnectCallbacks.add(callback);
		return () => this.reconnectCallbacks.delete(callback);
	}

	onNetworkChange(callback: (event: NetworkChangeEvent) => void): () => void {
		this.networkChangeCallbacks.add(callback);
		return () => this.networkChangeCallbacks.delete(callback);
	}

	onRecoveryStateChange(callback: (event: RecoveryStateEvent) => void): () => void {
		this.recoveryStateCallbacks.add(callback);
		return () => this.recoveryStateCallbacks.delete(callback);
	}

	updateConfig(config: Partial<MobileConnectionConfig>): void {
		this.config = { ...this.config, ...config };
	}

	private handleOnline(): void {
		this._isOnline = true;

		if (this._recoveryState === 'disconnected' || this._recoveryState === 'failed') {
			this._reconnectAttempt = 0;
			this.scheduleReconnect();
		}
	}

	private handleOffline(): void {
		this._isOnline = false;

		this.cancelReconnect();
		this.setRecoveryState('disconnected');
	}

	private handleConnectionChange(): void {
		const previousType = this._networkType;
		this.updateNetworkType();

		const event: NetworkChangeEvent = {
			previousType,
			currentType: this._networkType,
			timestamp: Date.now()
		};

		for (const callback of this.networkChangeCallbacks) {
			callback(event);
		}

		if (
			this.config.reconnectOnNetworkChange &&
			previousType !== this._networkType &&
			this._isOnline &&
			this._recoveryState !== 'connected'
		) {
			if (this.networkCooldownId !== null) {
				clearTimeout(this.networkCooldownId);
			}

			this.networkCooldownId = setTimeout(() => {
				this.networkCooldownId = null;
				this._reconnectAttempt = 0;
				this.scheduleReconnect();
			}, this.config.networkChangeCooldownMs);
		}
	}

	private handleVisibilityChange(): void {
		if (typeof document === 'undefined') return;

		if (document.visibilityState === 'visible') {
			if (this._recoveryState === 'disconnected' && this._isOnline && this.isStarted) {
				this.scheduleReconnect();
			}
		} else {
			if (this._recoveryState === 'backing-off') {
				this.cancelReconnect();
			}
		}
	}

	private scheduleReconnect(): void {
		if (this._reconnectAttempt >= this.config.maxReconnectAttempts) {
			this.setRecoveryState('failed');
			return;
		}

		const delay = this.calculateBackoffDelay();

		this.setRecoveryState('backing-off');
		this._nextRetryIn = delay;

		this.retryCountdownId = setInterval(() => {
			if (this._nextRetryIn !== null && this._nextRetryIn > 100) {
				this._nextRetryIn = Math.max(0, this._nextRetryIn - 100);
			}
		}, 100);

		this.retryTimeoutId = setTimeout(() => {
			this.attemptReconnect();
		}, delay);
	}

	private async attemptReconnect(): Promise<void> {
		if (this.retryCountdownId !== null) {
			clearInterval(this.retryCountdownId);
			this.retryCountdownId = null;
		}
		this._nextRetryIn = null;

		this._reconnectAttempt++;
		this.setRecoveryState('reconnecting');
		this.lastReconnectTime = Date.now();

		const promises: Promise<void>[] = [];
		for (const callback of this.reconnectCallbacks) {
			promises.push(
				callback().catch((error) => {
					console.warn('[MobileConnectionAdapter] Reconnect callback failed:', error);
				})
			);
		}

		await Promise.all(promises);
	}

	private calculateBackoffDelay(): number {
		const baseDelay = this.config.initialRetryDelayMs *
			Math.pow(this.config.backoffMultiplier, this._reconnectAttempt);

		const cappedDelay = Math.min(baseDelay, this.config.maxRetryDelayMs);

		const jitter = cappedDelay * this.config.jitterFactor * (Math.random() * 2 - 1);

		return Math.round(cappedDelay + jitter);
	}

	private setRecoveryState(newState: RecoveryState): void {
		const previousState = this._recoveryState;
		if (previousState === newState) return;

		this._recoveryState = newState;

		const event: RecoveryStateEvent = {
			previousState,
			currentState: newState,
			attempt: this._reconnectAttempt,
			nextRetryMs: this._nextRetryIn,
			timestamp: Date.now()
		};

		for (const callback of this.recoveryStateCallbacks) {
			callback(event);
		}
	}

	private getNetworkConnection(): NetworkInformation | undefined {
		if (typeof navigator === 'undefined') return undefined;

		const nav = navigator as NavigatorWithConnection;
		return nav.connection || nav.mozConnection || nav.webkitConnection;
	}

	private updateNetworkType(): void {
		const connection = this.getNetworkConnection();

		if (!connection?.type) {
			this._networkType = this._isOnline ? 'unknown' : 'none';
			return;
		}

		switch (connection.type) {
			case 'wifi':
				this._networkType = 'wifi';
				break;
			case 'cellular':
				this._networkType = 'cellular';
				break;
			case 'ethernet':
				this._networkType = 'ethernet';
				break;
			case 'bluetooth':
				this._networkType = 'bluetooth';
				break;
			case 'wimax':
				this._networkType = 'wimax';
				break;
			case 'none':
				this._networkType = 'none';
				break;
			default:
				this._networkType = 'unknown';
		}
	}

	private estimateQualityFromType(): ConnectionQuality {
		switch (this._networkType) {
			case 'wifi':
			case 'ethernet':
				return 'good';
			case 'cellular':
				return 'degraded';
			case 'bluetooth':
			case 'wimax':
				return 'degraded';
			case 'none':
				return 'disconnected';
			default:
				return 'good'; 
		}
	}
}
