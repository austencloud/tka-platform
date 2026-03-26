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

import { pushState } from '$app/navigation';
import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type { ViewingContext } from '../services/contracts/IPresentationResolver';

// ============================================================================
// STATE
// ============================================================================

let _isOpen = $state(false);
let _sequence = $state<SequenceData | null>(null);
let _variations = $state<SequenceData[]>([]);
let _variationIndex = $state(0);
let _returnLabel = $state('Back');
let _initialBpm = $state(60);
let _initialStep = $state(0);
let _dismissPath = $state<string | null>(null);
let _viewingContext = $state<ViewingContext>('notation');


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
		/** All variations of this sequence (same word). Enables variation navigation in the viewer. */
		variations?: SequenceData[];
		/** Controls how props are resolved: "notation" uses viewer settings, "creator-expression" uses creator's intent. */
		viewingContext?: ViewingContext;
	}
): void {
	_sequence = sequence;
	_variations = options?.variations ?? [sequence];
	_variationIndex = _variations.findIndex(v => v.id === sequence.id);
	if (_variationIndex < 0) _variationIndex = 0;
	_returnLabel = options?.returnLabel || 'Back';
	_initialBpm = options?.initialBpm || 60;
	_initialStep = options?.initialStep || 0;
	_dismissPath = options?.dismissPath || null;
	_viewingContext = options?.viewingContext ?? 'notation';
	_isOpen = true;

	// Push history entry so browser back button closes the drawer
	if (!options?.skipHistoryPush) {
		pushState('', { sequenceOverlay: true });
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
	_variations = [];
	_variationIndex = 0;
	_returnLabel = 'Back';
	_initialBpm = 60;
	_initialStep = 0;
	_dismissPath = null;
	_viewingContext = 'notation';
}

/**
 * Switch to a different variation by index.
 * Updates the active sequence and variation index.
 */
export function switchVariation(index: number): void {
	if (index < 0 || index >= _variations.length) return;
	const variation = _variations[index];
	if (!variation) return;
	_variationIndex = index;
	_sequence = variation;
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
		get variations() { return _variations; },
		get variationIndex() { return _variationIndex; },
		get returnLabel() { return _returnLabel; },
		get initialBpm() { return _initialBpm; },
		get initialStep() { return _initialStep; },
		get dismissPath() { return _dismissPath; },
		get viewingContext() { return _viewingContext; },
	};
}
