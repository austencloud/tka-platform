/**
 * Device Sync Initialization
 *
 * Wires the DeviceSyncCoordinator from the DI container to the reactive state.
 * Call this once at app startup (browser context only).
 *
 * Usage:
 *   import { initializeDeviceSync } from '$lib/shared/sync/initialization/initializeDeviceSync';
 *
 *   // In your app initialization (e.g., +layout.svelte onMount)
 *   initializeDeviceSync();
 */

import { browser } from '$app/environment';
import { container } from '$lib/shared/di';
import { deviceSyncState } from '../state/device-sync-state.svelte';

let isInitialized = false;

/**
 * Initialize the device sync system by wiring the DI coordinator to reactive state.
 *
 * Safe to call multiple times - will only initialize once.
 */
export function initializeDeviceSync(): boolean {
	if (!browser) {
		return false;
	}

	if (isInitialized) {
		return true;
	}

	try {
		const coordinator = container?.items?.deviceSyncCoordinator;
		if (!coordinator) {
			console.warn('[DeviceSync] Coordinator not available in container');
			return false;
		}

		deviceSyncState.initialize(coordinator);
		isInitialized = true;
		console.log('[DeviceSync] Initialized');
		return true;
	} catch (error) {
		console.error('[DeviceSync] Initialization failed:', error);
		return false;
	}
}

/**
 * Check if device sync is initialized.
 */
export function isDeviceSyncInitialized(): boolean {
	return isInitialized;
}

/**
 * Clean up device sync resources.
 * Call this when the app is being destroyed or user logs out.
 */
export function cleanupDeviceSync(): void {
	if (!isInitialized) return;

	deviceSyncState.cleanup();
	isInitialized = false;
	console.log('[DeviceSync] Cleaned up');
}
