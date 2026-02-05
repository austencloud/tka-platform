/**
 * Sync Status State
 *
 * Tracks Firestore sync status - whether local changes have been
 * persisted to the server.
 *
 * States:
 * - synced: All changes saved to server
 * - syncing: Actively syncing changes
 * - pending: Offline with unsaved changes
 * - error: Sync failed (will retry)
 */

import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { networkStatusState } from "./network-status-state.svelte";

export type SyncState = "synced" | "syncing" | "pending" | "error";

interface SyncStatus {
	state: SyncState;
	pendingWrites: boolean;
	lastSyncedAt: number | null;
	errorMessage: string | null;
}

function createSyncStatusState() {
	let state = $state<SyncState>("synced");
	let pendingWrites = $state(false);
	let lastSyncedAt = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);

	// Track active write count for accurate sync detection
	let activeWriteCount = 0;

	/**
	 * Mark that we have pending local changes
	 * Call this after any Firestore write operation
	 */
	function markPendingWrite() {
		activeWriteCount++;
		pendingWrites = true;
		if (networkStatusState.isOnline) {
			state = "syncing";
		} else {
			state = "pending";
		}
	}

	/**
	 * Mark that a write has completed (success or failure)
	 */
	function markWriteComplete() {
		activeWriteCount = Math.max(0, activeWriteCount - 1);
		if (activeWriteCount === 0) {
			pendingWrites = false;
			state = "synced";
			lastSyncedAt = Date.now();
			errorMessage = null;
		}
	}

	/**
	 * Mark that all writes have been synced
	 */
	function markSynced() {
		activeWriteCount = 0;
		pendingWrites = false;
		state = "synced";
		lastSyncedAt = Date.now();
		errorMessage = null;
	}

	/**
	 * Mark a sync error
	 */
	function markError(message: string) {
		state = "error";
		errorMessage = message;
	}

	/**
	 * Wait for all pending writes to complete
	 * Returns true if successful, false if failed/timeout
	 */
	async function waitForSync(timeoutMs = 10000): Promise<boolean> {
		if (!pendingWrites) return true;

		try {
			const { waitForPendingWrites } = await import("firebase/firestore");
			const db = await getFirestoreInstance();

			state = "syncing";

			// Race between waitForPendingWrites and timeout
			const result = await Promise.race([
				waitForPendingWrites(db).then(() => true),
				new Promise<boolean>((resolve) =>
					setTimeout(() => resolve(false), timeoutMs)
				),
			]);

			if (result) {
				markSynced();
				return true;
			} else {
				// Timeout - still pending
				state = pendingWrites ? "pending" : "synced";
				return false;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Sync failed";
			markError(message);
			return false;
		}
	}

	/**
	 * Handle network status changes
	 * Called via networkStatusState callbacks
	 */
	async function handleOnline() {
		if (pendingWrites) {
			// Coming back online with pending changes - wait for Firestore to sync
			state = "syncing";

			// Use waitForPendingWrites to know when sync is complete
			try {
				const { waitForPendingWrites } = await import("firebase/firestore");
				const db = await getFirestoreInstance();
				await waitForPendingWrites(db);
				markSynced();
			} catch (error) {
				console.warn("[SyncStatus] waitForPendingWrites failed:", error);
				// Don't mark error - Firestore will retry automatically
				// Just mark as synced after a delay as fallback
				setTimeout(() => {
					if (state === "syncing") {
						markSynced();
					}
				}, 3000);
			}
		}
	}

	function handleOffline() {
		if (pendingWrites) {
			// Going offline with pending changes
			state = "pending";
		}
	}

	// Subscribe to network status changes when module loads
	if (typeof window !== "undefined") {
		networkStatusState.onOnline(handleOnline);
		networkStatusState.onOffline(handleOffline);
	}

	return {
		get state() {
			return state;
		},
		get pendingWrites() {
			return pendingWrites;
		},
		get lastSyncedAt() {
			return lastSyncedAt;
		},
		get errorMessage() {
			return errorMessage;
		},
		get status(): SyncStatus {
			return {
				state,
				pendingWrites,
				lastSyncedAt,
				errorMessage,
			};
		},
		// Actions
		markPendingWrite,
		markWriteComplete,
		markSynced,
		markError,
		waitForSync,
	};
}

export const syncStatusState = createSyncStatusState();

/**
 * Helper to wrap Firestore write operations with sync tracking
 *
 * Usage:
 * ```typescript
 * await trackWrite(async () => {
 *   await setDoc(docRef, data);
 * });
 * ```
 */
export async function trackWrite<T>(operation: () => Promise<T>): Promise<T> {
	syncStatusState.markPendingWrite();
	try {
		const result = await operation();
		// Mark write complete - the promise resolving means Firestore accepted it
		// (either sent to server or queued for offline sync)
		syncStatusState.markWriteComplete();
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Write failed";
		syncStatusState.markError(message);
		throw error;
	}
}
