/**
 * Sequence Viewer Context
 *
 * Provides shared state for SequenceViewer compound components.
 * Uses Svelte's Context API to share state between parent and children.
 */

import { getContext, setContext } from "svelte";
import type { MediaType } from "../domain/types";
import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

const SEQUENCE_VIEWER_CONTEXT_KEY = Symbol("sequence-viewer-context");

/**
 * Context shape for SequenceViewer compound components
 */
export interface SequenceViewerContext {
	// Media type state
	readonly activeMediaType: MediaType;
	readonly hasImages: boolean;
	readonly hasAnimation: boolean;
	readonly hasVideo: boolean;
	selectMediaType: (type: MediaType) => void;

	// Dark mode state (shared between image and animation)
	readonly darkMode: boolean;
	toggleDarkMode: () => void;

	// Copy to clipboard
	readonly isCopying: boolean;
	readonly copySuccess: boolean;
	readonly copyError: boolean;
	copyImageToClipboard: () => Promise<void>;

	// Image settings
	readonly showVisibilitySettings: boolean;
	readonly addWord: boolean;
	readonly addBeatNumbers: boolean;
	readonly includeStartPosition: boolean;
	readonly addDifficultyLevel: boolean;
	readonly showCreatorName: boolean;
	readonly showNotes: boolean;
	readonly showBirthday: boolean;
	toggleWord: () => void;
	toggleBeatNumbers: () => void;
	toggleStartPosition: () => void;
	toggleDifficulty: () => void;
	toggleShowCreatorName: () => void;
	toggleShowNotes: () => void;
	toggleShowBirthday: () => void;

	// Animation settings
	readonly animGridVisible: boolean;
	readonly animBeatNumbers: boolean;
	readonly animTkaGlyph: boolean;
	readonly animWordHeader: boolean;
	readonly animTrails: boolean;
	toggleAnimGrid: () => void;
	toggleAnimBeatNumbers: () => void;
	toggleAnimTkaGlyph: () => void;
	toggleAnimWordHeader: () => void;
	toggleAnimTrails: () => void;

	// Controls level (for animation chips visibility)
	readonly controlsLevel: "minimal" | "standard" | "full";

	// Haptic feedback
	readonly hapticService: IHapticFeedback | null;
}

/**
 * Set the SequenceViewer context (called by parent component)
 */
export function setSequenceViewerContext(ctx: SequenceViewerContext): void {
	setContext(SEQUENCE_VIEWER_CONTEXT_KEY, ctx);
}

/**
 * Get the SequenceViewer context (called by child components)
 */
export function getSequenceViewerContext(): SequenceViewerContext {
	const ctx = getContext<SequenceViewerContext>(SEQUENCE_VIEWER_CONTEXT_KEY);
	if (!ctx) {
		throw new Error(
			"SequenceViewerContext not found. Ensure component is used within SequenceViewer."
		);
	}
	return ctx;
}

/**
 * Try to get the SequenceViewer context (returns null if not found)
 */
export function tryGetSequenceViewerContext(): SequenceViewerContext | null {
	return getContext<SequenceViewerContext>(SEQUENCE_VIEWER_CONTEXT_KEY) ?? null;
}
