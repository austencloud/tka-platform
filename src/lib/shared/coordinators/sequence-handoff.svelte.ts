/**
 * Sequence Handoff Coordinator
 *
 * Manages handoff of sequences between modules (e.g., from Browse's SequenceDetailsModal
 * to Compose for stagger/multi-performer visualization).
 *
 * Uses sessionStorage to persist handoff data across navigation.
 */

import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';

const HANDOFF_STORAGE_KEY = 'tka_sequence_handoff';

/**
 * Handoff data passed from SequenceDetailsModal to Compose
 */
export interface SequenceHandoff {
	/** The sequence to visualize */
	sequence: SequenceData;

	/** Current playback state to restore */
	playbackState?: {
		currentStep: number;
		bpm: number;
		isPlaying: boolean;
	};

	/** Which visualization preset to open (stagger for multi-performer, mirror for mirrored view) */
	preferredPreset?: 'stagger' | 'mirror';

	/** Path to return to when closing Compose (e.g., "/browse") */
	returnPath?: string;
}

/**
 * Save handoff data to sessionStorage for consumption after navigation.
 * Called by SequenceDetailsModal before navigating to Compose.
 */
export function saveSequenceHandoff(handoff: SequenceHandoff): void {
	try {
		const serialized = JSON.stringify(handoff);
		sessionStorage.setItem(HANDOFF_STORAGE_KEY, serialized);
	} catch (err) {
		console.error('[SequenceHandoff] Failed to save handoff:', err);
	}
}

/**
 * Consume handoff data from sessionStorage.
 * Called by Compose module on mount when handoff=true query param is present.
 * Returns null if no handoff data exists or parsing fails.
 * Automatically clears the storage after consuming.
 */
export function consumeSequenceHandoff(): SequenceHandoff | null {
	try {
		const serialized = sessionStorage.getItem(HANDOFF_STORAGE_KEY);
		if (!serialized) return null;

		// Clear after reading (one-time consumption)
		sessionStorage.removeItem(HANDOFF_STORAGE_KEY);

		const handoff = JSON.parse(serialized) as SequenceHandoff;

		// Basic validation
		if (!handoff.sequence || !handoff.sequence.id) {
			console.warn('[SequenceHandoff] Invalid handoff data - missing sequence');
			return null;
		}

		return handoff;
	} catch (err) {
		console.error('[SequenceHandoff] Failed to consume handoff:', err);
		sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
		return null;
	}
}

/**
 * Check if there's pending handoff data without consuming it.
 * Useful for conditional rendering before fully loading the handoff.
 */
export function hasSequenceHandoff(): boolean {
	return sessionStorage.getItem(HANDOFF_STORAGE_KEY) !== null;
}

/**
 * Clear any pending handoff data.
 * Called if navigation is cancelled or handoff is no longer needed.
 */
export function clearSequenceHandoff(): void {
	sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
}
