import type { ViewerMode } from '../state/viewer-state.svelte';

/** One switchable view in the sequence viewer (rail + mobile bottom bar). */
export interface ViewerModeOption {
	/** The ViewerMode this option selects. */
	id: ViewerMode;
	/** Font Awesome class fragment, e.g. 'fa-play'. */
	icon: string;
	label: string;
	/** When true, the option is hidden unless WebGL2 is available. */
	requiresWebgl2?: boolean;
}

/**
 * Single source of truth for the viewer's switchable views.
 * Consumed by ViewerContentRail (desktop) and ViewerModeBottomBar (mobile).
 * Order is intentional: Side-by-Side first, then single views by value.
 */
export const VIEWER_MODE_OPTIONS: ViewerModeOption[] = [
	{ id: 'split', icon: 'fa-columns', label: 'Side by Side' },
	{ id: 'animation', icon: 'fa-play', label: '2D Animation' },
	{ id: 'animation-3d', icon: 'fa-cube', label: '3D Animation', requiresWebgl2: true },
	{ id: 'card', icon: 'fa-grip', label: 'Card' },
	// "Art" umbrella: generative outputs of the sequence (Mandala, Tunnel, …).
	// The internal id stays 'mandala' (the pane/persistence key) — only the
	// user-facing label/icon change. See ArtPane.svelte for the type picker.
	{ id: 'mandala', icon: 'fa-palette', label: 'Art' }
];

/** Practice is a toggle, not a ViewerMode. Rendered as its own item in both switchers. */
export const PRACTICE_OPTION = { icon: 'fa-signal', label: 'Practice' } as const;

/** Filter helper: drops WebGL2-only options when WebGL2 is unavailable. */
export function viewerModeOptions(webgl2Available: boolean): ViewerModeOption[] {
	return webgl2Available
		? VIEWER_MODE_OPTIONS
		: VIEWER_MODE_OPTIONS.filter((m) => !m.requiresWebgl2);
}
