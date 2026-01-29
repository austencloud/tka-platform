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
 * Network change event.
 */
export interface NetworkChangeEvent {
	previous: NetworkStatus;
	current: NetworkStatus;
	timestamp: number;
}

/**
 * Interface for network status monitoring.
 */
export interface INetworkStatusMonitor {
	/**
	 * Current network status.
	 */
	readonly status: NetworkStatus;

	/**
	 * Whether the device is online.
	 */
	readonly isOnline: boolean;

	/**
	 * Whether on wifi.
	 */
	readonly isWifi: boolean;

	/**
	 * Whether on a metered connection.
	 */
	readonly isMetered: boolean;

	/**
	 * Whether the Network Information API is supported.
	 */
	readonly isNetworkInfoSupported: boolean;

	/**
	 * Start monitoring network status.
	 */
	start(): void;

	/**
	 * Stop monitoring network status.
	 */
	stop(): void;

	/**
	 * Force a status check.
	 * Useful after events that might have changed network state.
	 */
	refresh(): void;

	/**
	 * Subscribe to online/offline changes only.
	 *
	 * @param callback - Function called when online status changes
	 * @returns Unsubscribe function
	 */
	onOnlineChange(callback: (isOnline: boolean) => void): () => void;

	/**
	 * Subscribe to any network status change.
	 *
	 * @param callback - Function called when any network property changes
	 * @returns Unsubscribe function
	 */
	onChange(callback: (event: NetworkChangeEvent) => void): () => void;

	/**
	 * Subscribe to connection type changes specifically.
	 *
	 * @param callback - Function called when connection type changes
	 * @returns Unsubscribe function
	 */
	onConnectionTypeChange(callback: (type: NetworkConnectionType) => void): () => void;

	/**
	 * Clean up all resources.
	 */
	destroy(): void;
}
