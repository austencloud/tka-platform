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

import { pushState, replaceState } from '$app/navigation';
import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type { ViewingContext } from '../services/contracts/IPresentationResolver';
import { container } from '$lib/shared/di';
import { authState } from '$lib/shared/auth/state/authState.svelte';

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
/** Tracks whether the drawer was opened from a URL (hard-reload / shared link)
 *  versus by an in-app action. When true, close strips the ?v= param in place
 *  instead of calling history.back() which would leave the user nowhere. */
let _openedFromUrl = $state(false);
/** The short code currently reflected in the URL, if any. Lets us detect
 *  self-initiated URL changes so the bootstrap watcher doesn't re-open. */
let _activeShortCode = $state<string | null>(null);
/** Monotonic token incremented on each open; lets in-flight short-code mints
 *  bail out if the user opened a different sequence before the await resolved. */
let _openToken = 0;


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
		/** True when this open was driven by a ?v= param on page load. Tells the
		 *  bootstrap watcher not to mint a new code and tells close() to strip the
		 *  param in place rather than popping history. */
		fromUrl?: boolean;
		/** When fromUrl is true, the resolved short code. Stored so close() can
		 *  strip it from the URL and so the bootstrap watcher can ignore the
		 *  param it just acted on. */
		shortCode?: string;
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
	_openedFromUrl = options?.fromUrl ?? false;
	_activeShortCode = options?.shortCode ?? null;
	_isOpen = true;
	const token = ++_openToken;

	// Push history entry so browser back button closes the drawer
	if (!options?.skipHistoryPush) {
		pushState('', { sequenceOverlay: true });
	}

	// Reflect the sequence in the URL using the same short-code system QR codes
	// use. This way, HMR and hard-refresh land back on the same viewer — the
	// drawer bootstrap watcher picks up ?v=<code> and reopens the drawer.
	// Content-addressed: replaying the same sequence returns the same code.
	if (!options?.fromUrl && typeof window !== 'undefined') {
		// Strip any stale ?v= from a prior sequence synchronously — if we
		// don't, the URL will show the previous code until the new mint
		// completes, and if the new mint fails silently the wrong code stays.
		const url = new URL(window.location.href);
		if (url.searchParams.has('v')) {
			url.searchParams.delete('v');
			replaceState(url.pathname + url.search + url.hash, { sequenceOverlay: true });
		}
		void mintAndSyncShortCode(sequence, token);
	} else if (options?.shortCode) {
		_activeShortCode = options.shortCode;
	}
}

/** Resolves once authState.loading flips false — lets mint wait for Firebase
 *  auth to settle before writing, so the fast-click-after-reload case still
 *  gets the canonical 6-char code instead of falling back to the long inline
 *  encoding. Gives up after 5s (Firebase auth usually settles in <1s; if it
 *  hasn't by 5s we're probably offline or unauthenticated, fallback is fine). */
async function waitForAuthSettled(timeoutMs = 5000): Promise<void> {
	if (!authState.loading) return;
	const start = Date.now();
	while (authState.loading && Date.now() - start < timeoutMs) {
		await new Promise((r) => setTimeout(r, 50));
	}
}

async function mintAndSyncShortCode(sequence: SequenceData, token: number): Promise<void> {
	const manager = container.items.shortCodeManager;
	if (!manager) return;

	// Wait for Firebase auth to settle before attempting the Firestore write.
	// Without this, a Play-click immediately after a hard-reload races auth
	// init, createShortCode throws on the isAuthenticated() rule, and we
	// fall back to the long inline encoding even for signed-in users.
	await waitForAuthSettled();
	if (token !== _openToken || !_isOpen) return;

	// Try the canonical 6-char Firestore-backed code first. If that fails
	// (user not authenticated, write rules rejected, network offline, etc.),
	// fall back to an offline inline-encoded code so the URL still reflects
	// the drawer state. Inline codes are longer but the resolver handles
	// them natively, so refresh / share still works.
	let code: string | null = null;
	try {
		// Embed sequenceData so the shortcode still resolves even if the
		// sequence isn't persisted anywhere else (e.g., the user played a
		// generated sequence without saving it to their library). Without
		// this, a hard-refresh on the URL hits the dangling-reference case
		// and all resolver strategies fail.
		const result = await manager.createShortCode(sequence, {
			embedSequenceData: true,
		});
		code = result.code;
	} catch (firebaseError) {
		try {
			const offline = await manager.createOfflineCode(sequence);
			code = offline.code;
		} catch (offlineError) {
			console.warn(
				'[SequenceViewerOverlay] URL sync failed — neither Firestore nor offline encoding succeeded.',
				{ firebaseError, offlineError },
			);
			return;
		}
	}

	// Bail out if the user already opened something else or closed the drawer
	if (!code || token !== _openToken || !_isOpen) return;
	_activeShortCode = code;
	const url = new URL(window.location.href);
	url.searchParams.set('v', code);
	replaceState(url.pathname + url.search + url.hash, { sequenceOverlay: true });
}

/**
 * Close the sequence viewer drawer overlay.
 * Does NOT call history.back() - the caller should handle that
 * (or popstate handler will call this when back is pressed).
 */
export function closeSequenceOverlay(): void {
	// Strip ?v= from the URL unconditionally — the drawer is closing, so no
	// sequence should be reflected in the URL. Doing this here instead of
	// relying on the dismiss handler's history.back() means the URL stays
	// in sync even when the in-app mint never ran (offline, unauthenticated,
	// rejected Firestore write) or when the user closes via swipe-dismiss.
	if (typeof window !== 'undefined') {
		const url = new URL(window.location.href);
		if (url.searchParams.has('v')) {
			url.searchParams.delete('v');
			const target = url.pathname + (url.search ? url.search : '') + url.hash;
			replaceState(target, {});
		}
	}
	_isOpen = false;
	_sequence = null;
	_variations = [];
	_variationIndex = 0;
	_returnLabel = 'Back';
	_initialBpm = 60;
	_initialStep = 0;
	_dismissPath = null;
	_viewingContext = 'notation';
	_openedFromUrl = false;
	_activeShortCode = null;
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
		get openedFromUrl() { return _openedFromUrl; },
		get activeShortCode() { return _activeShortCode; },
	};
}
