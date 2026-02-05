/**
 * Sequence Viewer Overlay State
 *
 * Module-level reactive state for the mobile drawer overlay.
 * When a user taps a sequence card on mobile, this state opens
 * a drawer overlay instead of navigating to a new route.
 *
 * The drawer lives in SequenceViewerDrawerHost.svelte (rendered in
 * MainApplication.svelte outside the auth gate), so it works for
 * both authenticated and unauthenticated users.
 */

import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';

// ============================================================================
// STATE
// ============================================================================

let _isOpen = $state(false);
let _sequence = $state<SequenceData | null>(null);
let _returnLabel = $state('Back');
let _initialBpm = $state(60);
let _initialStep = $state(0);
let _dismissPath = $state<string | null>(null);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Open the sequence viewer drawer overlay.
 * Pushes a history entry so the back button closes the drawer.
 */
export function openSequenceOverlay(
	sequence: SequenceData,
	options?: {
		returnLabel?: string;
		initialBpm?: number;
		initialStep?: number;
		/** Skip pushing a history entry (used when the caller handles navigation separately) */
		skipHistoryPush?: boolean;
		/** Path to navigate to on dismiss (instead of history.back). Used for external links. */
		dismissPath?: string;
	}
): void {
	_sequence = sequence;
	_returnLabel = options?.returnLabel || 'Back';
	_initialBpm = options?.initialBpm || 60;
	_initialStep = options?.initialStep || 0;
	_dismissPath = options?.dismissPath || null;
	_isOpen = true;

	// Push history entry so browser back button closes the drawer
	if (!options?.skipHistoryPush) {
		window.history.pushState({ sequenceOverlay: true }, '');
	}
}

/**
 * Close the sequence viewer drawer overlay.
 * Does NOT call history.back() - the caller should handle that
 * (or popstate handler will call this when back is pressed).
 */
export function closeSequenceOverlay(): void {
	_isOpen = false;
	_sequence = null;
	_returnLabel = 'Back';
	_initialBpm = 60;
	_initialStep = 0;
	_dismissPath = null;
}

/**
 * Check if the overlay is currently open.
 */
export function isSequenceOverlayOpen(): boolean {
	return _isOpen;
}

/**
 * Get the current overlay state.
 * Returns reactive values for use in Svelte components.
 */
export function getSequenceOverlayState() {
	return {
		get isOpen() { return _isOpen; },
		get sequence() { return _sequence; },
		get returnLabel() { return _returnLabel; },
		get initialBpm() { return _initialBpm; },
		get initialStep() { return _initialStep; },
		get dismissPath() { return _dismissPath; },
	};
}
