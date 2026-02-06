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
import { openSequenceOverlay } from '../../state/sequence-viewer-overlay-state.svelte';

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
		import('$lib/shared/di').then(({ container }) => {
			const promptTrigger = container?.items?.attributionPromptTrigger as { recordInteraction?: (type: string) => void } | undefined;
			if (promptTrigger?.recordInteraction) {
				promptTrigger.recordInteraction('sequence_view');
			}
		});
	} catch {
		// Silently fail - attribution tracking is non-critical
	}

	// Always use drawer overlay - keeps the underlying module mounted
	// so content is immediately visible behind the drawer on dismiss
	openSequenceOverlay(sequence, {
		returnLabel: options.returnLabel,
		initialBpm: options.initialBpm,
		initialStep: options.initialStep,
	});
}
