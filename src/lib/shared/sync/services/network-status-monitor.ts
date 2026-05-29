import type { NetworkStatus, NetworkConnectionType, EffectiveConnectionType, NetworkStatusChangeEvent } from "./types";

interface NetworkInformation extends EventTarget {
	type?: string;
	effectiveType?: string;
	downlink?: number;
	downlinkMax?: number;
	rtt?: number;
	saveData?: boolean;
	onchange?: EventListener | null;
}

interface NavigatorWithConnection extends Navigator {
	connection?: NetworkInformation;
	mozConnection?: NetworkInformation;
	webkitConnection?: NetworkInformation;
}

export class NetworkStatusMonitor {
	private _status: NetworkStatus;
	private _isRunning: boolean = false;
	private _isNetworkInfoSupported: boolean = false;

	private boundOnlineHandler: () => void;
	private boundOfflineHandler: () => void;
	private boundConnectionChangeHandler: () => void;

	private onlineChangeCallbacks: Set<(isOnline: boolean) => void> = new Set();
	private changeCallbacks: Set<(event: NetworkStatusChangeEvent) => void> = new Set();
	private connectionTypeCallbacks: Set<(type: NetworkConnectionType) => void> = new Set();

	constructor() {
		this._status = this.getCurrentStatus();
		this._isNetworkInfoSupported = this.checkNetworkInfoSupport();

		this.boundOnlineHandler = this.handleOnline.bind(this);
		this.boundOfflineHandler = this.handleOffline.bind(this);
		this.boundConnectionChangeHandler = this.handleConnectionChange.bind(this);
	}

	get status(): NetworkStatus {
		return this._status;
	}

	get isOnline(): boolean {
		return this._status.isOnline;
	}

	get isWifi(): boolean {
		return this._status.connectionType === 'wifi' || this._status.connectionType === 'ethernet';
	}

	get isMetered(): boolean {
		return this._status.isMetered;
	}

	get isNetworkInfoSupported(): boolean {
		return this._isNetworkInfoSupported;
	}

	start(): void {
		if (this._isRunning) return;
		this._isRunning = true;

		this._status = this.getCurrentStatus();

		if (typeof window !== 'undefined') {
			window.addEventListener('online', this.boundOnlineHandler);
			window.addEventListener('offline', this.boundOfflineHandler);
		}

		const connection = this.getNetworkConnection();
		if (connection) {
			connection.addEventListener('change', this.boundConnectionChangeHandler);
		}
	}

	stop(): void {
		if (!this._isRunning) return;
		this._isRunning = false;

		if (typeof window !== 'undefined') {
			window.removeEventListener('online', this.boundOnlineHandler);
			window.removeEventListener('offline', this.boundOfflineHandler);
		}

		const connection = this.getNetworkConnection();
		if (connection) {
			connection.removeEventListener('change', this.boundConnectionChangeHandler);
		}
	}

	destroy(): void {
		this.stop();
		this.onlineChangeCallbacks.clear();
		this.changeCallbacks.clear();
		this.connectionTypeCallbacks.clear();
	}

	refresh(): void {
		const previous = { ...this._status };
		this._status = this.getCurrentStatus();

		if (this.hasStatusChanged(previous, this._status)) {
			this.emitChanges(previous, this._status);
		}
	}

	onOnlineChange(callback: (isOnline: boolean) => void): () => void {
		this.onlineChangeCallbacks.add(callback);
		return () => this.onlineChangeCallbacks.delete(callback);
	}

	onChange(callback: (event: NetworkStatusChangeEvent) => void): () => void {
		this.changeCallbacks.add(callback);
		return () => this.changeCallbacks.delete(callback);
	}

	onConnectionTypeChange(callback: (type: NetworkConnectionType) => void): () => void {
		this.connectionTypeCallbacks.add(callback);
		return () => this.connectionTypeCallbacks.delete(callback);
	}

	private handleOnline(): void {
		const previous = { ...this._status };
		this._status = this.getCurrentStatus();

		for (const callback of this.onlineChangeCallbacks) {
			callback(true);
		}

		this.emitChanges(previous, this._status);
	}

	private handleOffline(): void {
		const previous = { ...this._status };
		this._status = {
			...this._status,
			isOnline: false,
			connectionType: 'none',
			lastUpdated: Date.now()
		};

		for (const callback of this.onlineChangeCallbacks) {
			callback(false);
		}

		this.emitChanges(previous, this._status);
	}

	private handleConnectionChange(): void {
		const previous = { ...this._status };
		this._status = this.getCurrentStatus();

		if (previous.connectionType !== this._status.connectionType) {
			for (const callback of this.connectionTypeCallbacks) {
				callback(this._status.connectionType);
			}
		}

		this.emitChanges(previous, this._status);
	}

	private getCurrentStatus(): NetworkStatus {
		const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
		const connection = this.getNetworkConnection();

		if (!isOnline) {
			return {
				isOnline: false,
				connectionType: 'none',
				effectiveType: 'unknown',
				downlinkMbps: null,
				rttMs: null,
				saveData: false,
				isMetered: false,
				lastUpdated: Date.now()
			};
		}

		if (!connection) {
			return {
				isOnline: true,
				connectionType: 'unknown',
				effectiveType: 'unknown',
				downlinkMbps: null,
				rttMs: null,
				saveData: false,
				isMetered: false,
				lastUpdated: Date.now()
			};
		}

		return {
			isOnline: true,
			connectionType: this.mapConnectionType(connection.type),
			effectiveType: this.mapEffectiveType(connection.effectiveType),
			downlinkMbps: connection.downlink ?? null,
			rttMs: connection.rtt ?? null,
			saveData: connection.saveData ?? false,
			isMetered: this.isConnectionMetered(connection.type),
			lastUpdated: Date.now()
		};
	}

	private getNetworkConnection(): NetworkInformation | undefined {
		if (typeof navigator === 'undefined') return undefined;

		const nav = navigator as NavigatorWithConnection;
		return nav.connection || nav.mozConnection || nav.webkitConnection;
	}

	private checkNetworkInfoSupport(): boolean {
		return this.getNetworkConnection() !== undefined;
	}

	private mapConnectionType(type?: string): NetworkConnectionType {
		if (!type) return 'unknown';

		switch (type) {
			case 'wifi':
				return 'wifi';
			case 'cellular':
				return 'cellular';
			case 'ethernet':
				return 'ethernet';
			case 'bluetooth':
				return 'bluetooth';
			case 'wimax':
				return 'wimax';
			case 'none':
				return 'none';
			default:
				return 'unknown';
		}
	}

	private mapEffectiveType(effectiveType?: string): EffectiveConnectionType {
		if (!effectiveType) return 'unknown';

		switch (effectiveType) {
			case 'slow-2g':
				return 'slow-2g';
			case '2g':
				return '2g';
			case '3g':
				return '3g';
			case '4g':
				return '4g';
			default:
				return 'unknown';
		}
	}

	private isConnectionMetered(type?: string): boolean {
		switch (type) {
			case 'cellular':
			case 'wimax':
				return true;
			case 'wifi':
			case 'ethernet':
				return false;
			default:
				return true;
		}
	}

	private hasStatusChanged(previous: NetworkStatus, current: NetworkStatus): boolean {
		return (
			previous.isOnline !== current.isOnline ||
			previous.connectionType !== current.connectionType ||
			previous.effectiveType !== current.effectiveType ||
			previous.saveData !== current.saveData
		);
	}

	private emitChanges(previous: NetworkStatus, current: NetworkStatus): void {
		const event: NetworkStatusChangeEvent = {
			previous,
			current,
			timestamp: Date.now()
		};

		for (const callback of this.changeCallbacks) {
			try {
				callback(event);
			} catch (error) {
				console.warn('[NetworkStatusMonitor] Change callback error:', error);
			}
		}
	}
}
