/**
 * MobileConnectionAdapter
 *
 * Provides mobile-optimized WebRTC connection handling:
 * - Exponential backoff with jitter for reconnection
 * - Network change detection (wifi <-> cellular)
 * - Connection state recovery
 * - Battery-conscious retry timing
 */

import type {
	IMobileConnectionAdapter,
	MobileConnectionConfig,
	NetworkType,
	RecoveryState,
	NetworkChangeEvent,
	RecoveryStateEvent
} from '../contracts/IMobileConnectionAdapter';
import {
	DEFAULT_MOBILE_CONNECTION_CONFIG
} from '../contracts/IMobileConnectionAdapter';
import type { ConnectionQuality } from '../../domain/sync-types';

/**
 * Extended NetworkInformation interface for Navigator.connection.
 * Not all browsers support this API fully.
 */
interface NetworkInformation extends EventTarget {
	type?: string;
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	saveData?: boolean;
	onchange?: EventListener | null;
}

/**
 * Navigator with optional connection property.
 */
interface NavigatorWithConnection extends Navigator {
	connection?: NetworkInformation;
	mozConnection?: NetworkInformation;
	webkitConnection?: NetworkInformation;
}

/**
 * MobileConnectionAdapter implementation.
 *
 * Handles reconnection with exponential backoff and jitter,
 * monitors network changes, and provides estimated connection quality.
 */
export class MobileConnectionAdapter implements IMobileConnectionAdapter {
	// Configuration
	private config: MobileConnectionConfig;

	// State
	private _recoveryState: RecoveryState = 'disconnected';
	private _networkType: NetworkType = 'unknown';
	private _isOnline: boolean = true;
	private _reconnectAttempt: number = 0;
	private _nextRetryIn: number | null = null;

	// Timers
	private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private retryCountdownId: ReturnType<typeof setInterval> | null = null;
	private networkCooldownId: ReturnType<typeof setTimeout> | null = null;

	// Event handlers
	private boundOnlineHandler: () => void;
	private boundOfflineHandler: () => void;
	private boundConnectionChangeHandler: () => void;
	private boundVisibilityChangeHandler: () => void;

	// Callbacks
	private reconnectCallbacks: Set<() => Promise<void>> = new Set();
	private networkChangeCallbacks: Set<(event: NetworkChangeEvent) => void> = new Set();
	private recoveryStateCallbacks: Set<(event: RecoveryStateEvent) => void> = new Set();

	// Tracking
	private isStarted: boolean = false;
	private lastReconnectTime: number = 0;

	constructor(config: Partial<MobileConnectionConfig> = {}) {
		this.config = { ...DEFAULT_MOBILE_CONNECTION_CONFIG, ...config };

		// Bind handlers for proper removal later
		this.boundOnlineHandler = this.handleOnline.bind(this);
		this.boundOfflineHandler = this.handleOffline.bind(this);
		this.boundConnectionChangeHandler = this.handleConnectionChange.bind(this);
		this.boundVisibilityChangeHandler = this.handleVisibilityChange.bind(this);

		// Initialize network type if browser supports it
		this.updateNetworkType();
	}

	// =========================================================================
	// Public Getters
	// =========================================================================

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
			// No Network Information API - estimate from network type
			return this.estimateQualityFromType();
		}

		// Use effectiveType and RTT if available
		const effectiveType = connection.effectiveType;
		const rtt = connection.rtt;

		if (rtt !== undefined) {
			if (rtt <= 50) return 'excellent';
			if (rtt <= 150) return 'good';
			if (rtt <= 500) return 'degraded';
			return 'poor';
		}

		// Fall back to effective type
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

	// =========================================================================
	// Lifecycle Methods
	// =========================================================================

	start(): void {
		if (this.isStarted) return;
		this.isStarted = true;

		// Update initial state
		this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
		this.updateNetworkType();

		// Set up event listeners
		if (typeof window !== 'undefined') {
			window.addEventListener('online', this.boundOnlineHandler);
			window.addEventListener('offline', this.boundOfflineHandler);
			document.addEventListener('visibilitychange', this.boundVisibilityChangeHandler);
		}

		// Set up network change listener
		const connection = this.getNetworkConnection();
		if (connection) {
			connection.addEventListener('change', this.boundConnectionChangeHandler);
		}
	}

	stop(): void {
		if (!this.isStarted) return;
		this.isStarted = false;

		// Cancel any pending reconnection
		this.cancelReconnect();

		// Remove event listeners
		if (typeof window !== 'undefined') {
			window.removeEventListener('online', this.boundOnlineHandler);
			window.removeEventListener('offline', this.boundOfflineHandler);
			document.removeEventListener('visibilitychange', this.boundVisibilityChangeHandler);
		}

		const connection = this.getNetworkConnection();
		if (connection) {
			connection.removeEventListener('change', this.boundConnectionChangeHandler);
		}

		// Clear network cooldown
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

	// =========================================================================
	// Connection Notifications
	// =========================================================================

	notifyConnected(): void {
		this.setRecoveryState('connected');

		if (this.config.resetOnSuccess) {
			this._reconnectAttempt = 0;
		}

		// Cancel any pending reconnection
		this.cancelReconnect();
	}

	notifyDisconnected(reason?: string): void {
		if (this._recoveryState === 'connected' || this._recoveryState === 'disconnected') {
			this.setRecoveryState('disconnected');
		}

		// Only auto-reconnect if online and started
		if (this._isOnline && this.isStarted) {
			this.scheduleReconnect();
		}
	}

	// =========================================================================
	// Reconnection Logic
	// =========================================================================

	async triggerReconnect(): Promise<void> {
		// Cancel any existing scheduled reconnect
		this.cancelReconnect();

		// Attempt reconnection immediately
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

		// Only update state if we were backing off
		if (this._recoveryState === 'backing-off') {
			this.setRecoveryState('disconnected');
		}
	}

	// =========================================================================
	// Event Subscriptions
	// =========================================================================

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

	// =========================================================================
	// Configuration
	// =========================================================================

	updateConfig(config: Partial<MobileConnectionConfig>): void {
		this.config = { ...this.config, ...config };
	}

	// =========================================================================
	// Private: Event Handlers
	// =========================================================================

	private handleOnline(): void {
		this._isOnline = true;

		// If we were disconnected, try to reconnect
		if (this._recoveryState === 'disconnected' || this._recoveryState === 'failed') {
			// Reset attempt count on coming back online
			this._reconnectAttempt = 0;
			this.scheduleReconnect();
		}
	}

	private handleOffline(): void {
		this._isOnline = false;

		// Cancel any pending reconnection - no point when offline
		this.cancelReconnect();
		this.setRecoveryState('disconnected');
	}

	private handleConnectionChange(): void {
		const previousType = this._networkType;
		this.updateNetworkType();

		// Emit network change event
		const event: NetworkChangeEvent = {
			previousType,
			currentType: this._networkType,
			timestamp: Date.now()
		};

		for (const callback of this.networkChangeCallbacks) {
			callback(event);
		}

		// Trigger reconnection on network change if configured
		if (
			this.config.reconnectOnNetworkChange &&
			previousType !== this._networkType &&
			this._isOnline &&
			this._recoveryState !== 'connected'
		) {
			// Wait for network to stabilize before reconnecting
			if (this.networkCooldownId !== null) {
				clearTimeout(this.networkCooldownId);
			}

			this.networkCooldownId = setTimeout(() => {
				this.networkCooldownId = null;
				// Reset attempt count on network change
				this._reconnectAttempt = 0;
				this.scheduleReconnect();
			}, this.config.networkChangeCooldownMs);
		}
	}

	private handleVisibilityChange(): void {
		if (typeof document === 'undefined') return;

		if (document.visibilityState === 'visible') {
			// App came to foreground
			if (this._recoveryState === 'disconnected' && this._isOnline && this.isStarted) {
				// Try to reconnect when app comes back to foreground
				this.scheduleReconnect();
			}
		} else {
			// App went to background - cancel reconnection attempts to save battery
			if (this._recoveryState === 'backing-off') {
				this.cancelReconnect();
			}
		}
	}

	// =========================================================================
	// Private: Reconnection Scheduling
	// =========================================================================

	private scheduleReconnect(): void {
		// Check if we've exceeded max attempts
		if (this._reconnectAttempt >= this.config.maxReconnectAttempts) {
			this.setRecoveryState('failed');
			return;
		}

		// Calculate delay with exponential backoff and jitter
		const delay = this.calculateBackoffDelay();

		this.setRecoveryState('backing-off');
		this._nextRetryIn = delay;

		// Start countdown for UI updates
		this.retryCountdownId = setInterval(() => {
			if (this._nextRetryIn !== null && this._nextRetryIn > 100) {
				this._nextRetryIn = Math.max(0, this._nextRetryIn - 100);
			}
		}, 100);

		// Schedule the actual reconnection
		this.retryTimeoutId = setTimeout(() => {
			this.attemptReconnect();
		}, delay);
	}

	private async attemptReconnect(): Promise<void> {
		// Clear countdown
		if (this.retryCountdownId !== null) {
			clearInterval(this.retryCountdownId);
			this.retryCountdownId = null;
		}
		this._nextRetryIn = null;

		// Update state
		this._reconnectAttempt++;
		this.setRecoveryState('reconnecting');
		this.lastReconnectTime = Date.now();

		// Invoke all registered reconnect callbacks
		const promises: Promise<void>[] = [];
		for (const callback of this.reconnectCallbacks) {
			promises.push(
				callback().catch((error) => {
					// Log but don't throw - we'll handle failure via notifyDisconnected
					console.warn('[MobileConnectionAdapter] Reconnect callback failed:', error);
				})
			);
		}

		// Wait for all callbacks to complete
		await Promise.all(promises);

		// Note: The coordinator should call notifyConnected() or notifyDisconnected()
		// based on the result. If neither is called, we stay in 'reconnecting' state
		// which may indicate a bug in the integration.
	}

	private calculateBackoffDelay(): number {
		// Exponential backoff: initialDelay * (multiplier ^ attempt)
		const baseDelay = this.config.initialRetryDelayMs *
			Math.pow(this.config.backoffMultiplier, this._reconnectAttempt);

		// Cap at max delay
		const cappedDelay = Math.min(baseDelay, this.config.maxRetryDelayMs);

		// Add jitter to prevent thundering herd
		const jitter = cappedDelay * this.config.jitterFactor * (Math.random() * 2 - 1);

		return Math.round(cappedDelay + jitter);
	}

	// =========================================================================
	// Private: State Management
	// =========================================================================

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

	// =========================================================================
	// Private: Network Detection
	// =========================================================================

	private getNetworkConnection(): NetworkInformation | undefined {
		if (typeof navigator === 'undefined') return undefined;

		const nav = navigator as NavigatorWithConnection;
		return nav.connection || nav.mozConnection || nav.webkitConnection;
	}

	private updateNetworkType(): void {
		const connection = this.getNetworkConnection();

		if (!connection || !connection.type) {
			// Fallback: assume wifi if online, none if offline
			this._networkType = this._isOnline ? 'unknown' : 'none';
			return;
		}

		// Map connection.type to our NetworkType
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
				return 'good'; // Optimistic default
		}
	}
}
