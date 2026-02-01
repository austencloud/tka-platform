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

import { goto } from '$app/navigation';
import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import { saveSequenceRouteHandoff } from '$lib/shared/coordinators/sequence-handoff.svelte';
import { sequenceEncoder } from '$lib/shared/navigation/services/implementations/SequenceEncoder';
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
 * Open the sequence viewer using the appropriate method for the current device.
 *
 * On mobile (<768px): Opens the drawer overlay. The current module stays mounted
 * behind the drawer, so returning is instant.
 *
 * On desktop (>=768px): Navigates to the /sequence/[id] route with view transitions
 * and saves handoff data for instant loading.
 */
export function openSequenceViewer(
	sequence: SequenceData,
	options: OpenSequenceViewerOptions
): void {
	const isMobile = window.innerWidth < 768;

	if (isMobile) {
		// Mobile: open drawer overlay, no route navigation
		openSequenceOverlay(sequence, {
			returnLabel: options.returnLabel,
			initialBpm: options.initialBpm,
			initialStep: options.initialStep,
		});
	} else {
		// Desktop: navigate to route with handoff for instant loading
		saveSequenceRouteHandoff({
			sequence,
			returnPath: options.returnPath,
			returnLabel: options.returnLabel,
			scrollY: options.scrollY,
		});

		void goto(sequenceEncoder.generateSequenceRoutePath(sequence));
	}
}
