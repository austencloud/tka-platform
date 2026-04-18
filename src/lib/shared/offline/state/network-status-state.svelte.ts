/**
 * Network Status State
 *
 * Reactive network status using Svelte 5 runes.
 * Uses navigator.onLine + online/offline events to track connectivity.
 */

interface NetworkStatus {
	isOnline: boolean;
	lastOnlineAt: number | null;
	wasOffline: boolean;
}

function createNetworkStatusState() {
	// Initialize from browser state (assume online during SSR)
	let isOnline = $state(typeof navigator !== "undefined" ? navigator.onLine : true);
	let lastOnlineAt = $state<number | null>(isOnline ? Date.now() : null);
	let wasOffline = $state(false);

	// Track if we've set up listeners (to avoid duplicate setup)
	let listenersAttached = false;

	// Callbacks that can be registered for online/offline events
	const onOnlineCallbacks: Array<() => void> = [];
	const onOfflineCallbacks: Array<() => void> = [];

	function handleOnline() {
		isOnline = true;
		lastOnlineAt = Date.now();
		wasOffline = false;

		// Notify registered callbacks
		onOnlineCallbacks.forEach((cb) => cb());
	}

	function handleOffline() {
		isOnline = false;
		wasOffline = true;

		// Notify registered callbacks
		onOfflineCallbacks.forEach((cb) => cb());
	}

	function attachListeners() {
		if (listenersAttached || typeof window === "undefined") return;

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		listenersAttached = true;
	}

	function detachListeners() {
		if (!listenersAttached || typeof window === "undefined") return;

		window.removeEventListener("online", handleOnline);
		window.removeEventListener("offline", handleOffline);
		listenersAttached = false;
	}

	/**
	 * Register a callback to be called when coming back online
	 * Returns an unsubscribe function
	 */
	function onOnline(callback: () => void): () => void {
		onOnlineCallbacks.push(callback);
		return () => {
			const index = onOnlineCallbacks.indexOf(callback);
			if (index !== -1) onOnlineCallbacks.splice(index, 1);
		};
	}

	/**
	 * Register a callback to be called when going offline
	 * Returns an unsubscribe function
	 */
	function onOffline(callback: () => void): () => void {
		onOfflineCallbacks.push(callback);
		return () => {
			const index = onOfflineCallbacks.indexOf(callback);
			if (index !== -1) onOfflineCallbacks.splice(index, 1);
		};
	}

	// Auto-attach listeners when module loads in browser
	if (typeof window !== "undefined") {
		attachListeners();
	}

	return {
		get isOnline() {
			return isOnline;
		},
		get lastOnlineAt() {
			return lastOnlineAt;
		},
		get wasOffline() {
			return wasOffline;
		},
		get status(): NetworkStatus {
			return {
				isOnline,
				lastOnlineAt,
				wasOffline,
			};
		},
		// Manual control if needed
		attachListeners,
		detachListeners,
		// Event subscription
		onOnline,
		onOffline,
	};
}

export const networkStatusState = createNetworkStatusState();
