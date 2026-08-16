import type { ViewerMode } from '../state/viewer-state.svelte';
import type { ContentType, SplitConfig } from './viewer-state-persistence';

/** One switchable view in the sequence viewer (rail + mobile bottom bar). */
export interface ViewerModeOption {
	/** The ViewerMode this option selects. */
	id: ViewerMode;
	/** Font Awesome class fragment, e.g. 'fa-play'. */
	icon: string;
	label: string;
	/** When true, the option is hidden unless WebGL2 is available. */
	requiresWebgl2?: boolean;
	/**
	 * When true, the option is hidden unless the viewport is large enough to host
	 * 3D (see `MIN_3D_VIEWPORT_PX` / `viewportFits3D`). The 3D viewer is not
	 * phone-friendly yet, so it is withheld on small screens.
	 */
	requiresLargeViewport?: boolean;
}

/**
 * Single source of truth for the viewer's switchable views.
 * Consumed by ViewerContentRail (desktop) and ViewerModeBottomBar (mobile).
 * Order is intentional: Side-by-Side first, then single views by value.
 */
export const VIEWER_MODE_OPTIONS: ViewerModeOption[] = [
	{ id: 'split', icon: 'fa-columns', label: 'Side by Side' },
	{ id: 'animation', icon: 'fa-play', label: '2D Animation' },
	{ id: 'animation-3d', icon: 'fa-cube', label: '3D Animation', requiresWebgl2: true, requiresLargeViewport: true },
	{ id: 'card', icon: 'fa-grip', label: 'Card' },
	{ id: 'videos', icon: 'fa-video', label: 'Videos' },
	// Tunnel remains a direct art view. Mandala opens from the workspace card,
	// where its collection and creation controls already live.
	{ id: 'tunnel', icon: 'fa-fan', label: 'Tunnel' }
];

/** Practice is a toggle, not a ViewerMode. Rendered as its own item in both switchers. */
export const PRACTICE_OPTION = { icon: 'fa-signal', label: 'Practice' } as const;

/**
 * Filter helper: drops WebGL2-only options when WebGL2 is unavailable, and
 * large-viewport-only options (3D) when the viewport is too small to host them.
 */
export function viewerModeOptions(
	webgl2Available: boolean,
	viewportFits3D = true
): ViewerModeOption[] {
	return VIEWER_MODE_OPTIONS.filter(
		(m) =>
			(!m.requiresWebgl2 || webgl2Available) &&
			(!m.requiresLargeViewport || viewportFits3D)
	);
}

/**
 * Coerce a single content type away from 3D when the viewport can't host it.
 * `'animation-3d' → 'animation'` when `!fits3D`; everything else untouched.
 * Pure — used by the viewer-state getters so a persisted 3D preference renders
 * as 2D on a small screen without overwriting the stored preference.
 */
export function coerce3DContent(content: ContentType, fits3D: boolean): ContentType {
	return !fits3D && content === 'animation-3d' ? 'animation' : content;
}

/** Coerce both panes of a split config away from 3D when the viewport can't host it. */
export function coerce3DSplit(config: SplitConfig, fits3D: boolean): SplitConfig {
	if (fits3D) return config;
	return {
		leftPane: coerce3DContent(config.leftPane, fits3D),
		rightPane: coerce3DContent(config.rightPane, fits3D)
	};
}
