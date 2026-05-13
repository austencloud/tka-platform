/**
 * SequenceViewerNavigator
 *
 * Centralized function that opens the sequence viewer in the appropriate way:
 * - Mobile: Opens the drawer overlay (no route change, module stays mounted)
 * - Desktop: Navigates to /sequence/[id] route (view transition, SSR support)
 *
 * Replaces all direct calls to:
 *   saveSequenceRouteHandoff(...) + goto(sequenceEncoder.generateSequenceRoutePath(...))
 */

import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type { ViewingContext } from "../presentation-resolver";
import { openSequenceOverlay } from '../../state/sequence-viewer-overlay-state.svelte';
import { cellPreWarmer } from './CellPreWarmer';
import { getAttributionPromptTrigger } from "$lib/shared/attribution/getAttributionPromptTrigger";
import { getSequenceDataProvider } from "$lib/shared/sequence-viewer/getSequenceDataProvider";

export interface OpenSequenceViewerOptions {
	/** Path to return to when closing (e.g., "/browse/gallery") */
	returnPath: string;
	/** Label for back button (e.g., "Browse", "My Library") */
	returnLabel?: string;
	/** Scroll position to restore on return */
	scrollY?: number;
	/** Initial BPM for playback */
	initialBpm?: number;
	/** Initial playback step */
	initialStep?: number;
	/** All variations of this sequence (same word). Enables variation navigation. */
	variations?: SequenceData[];
	/** Controls how props are resolved: "notation" uses viewer settings, "creator-expression" uses creator's intent. */
	viewingContext?: ViewingContext;
	/** When true, renders hand path visualization (HAND props, float arrows, no TKA). */
	handPathMode?: boolean;
}

/**
 * Open the sequence viewer as a drawer overlay.
 *
 * Always uses the drawer overlay for in-app navigation, regardless of viewport size.
 * The current module stays mounted behind the drawer, so returning is instant.
 * Includes swipe-to-dismiss on all viewports.
 *
 * The /sequence/[id] route still exists for external links (QR codes, shared URLs)
 * where no app shell is loaded yet.
 */
export function openSequenceViewer(
	sequence: SequenceData,
	options: OpenSequenceViewerOptions
): void {
	// Track sequence view for attribution prompt eligibility
	try {
		const promptTrigger = getAttributionPromptTrigger();
		if (promptTrigger?.recordInteraction) {
			promptTrigger.recordInteraction('sequence_view');
		}
	} catch {
		// Silently fail - attribution tracking is non-critical
	}

	// Use prefetched hydrated data if available (hover prefetch completed)
	// Preserve ownership metadata from the original sequence since cached/hydrated
	// versions loaded from IndexedDB or public index may lack ownerId.
	let seqToOpen = sequence;
	try {
		const provider = getSequenceDataProvider();
		const cached = provider?.getCached(sequence);
		if (cached) {
			seqToOpen = sequence.ownerId && !cached.ownerId
				? { ...cached, ownerId: sequence.ownerId }
				: cached;
		}
	} catch {
		// DI not available - proceed with original sequence
	}

	// Pre-warm pictograph cells at highest priority while the drawer animates.
	// By the time ChoreoCard mounts, cells are already in IndexedDB.
	cellPreWarmer.preWarmSequence(seqToOpen, "user-blocking");

	// Always use drawer overlay - keeps the underlying module mounted
	// so content is immediately visible behind the drawer on dismiss
	openSequenceOverlay(seqToOpen, {
		returnLabel: options.returnLabel,
		initialBpm: options.initialBpm,
		initialStep: options.initialStep,
		variations: options.variations,
		viewingContext: options.viewingContext,
		handPathMode: options.handPathMode,
	});
}
