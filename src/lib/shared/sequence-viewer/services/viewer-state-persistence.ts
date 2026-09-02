import { VIDEO_UPLOAD_ENABLED } from '../config/viewer-feature-flags';

export type ContentType = 'animation' | 'animation-3d' | 'card' | 'videos' | 'mandala' | 'tunnel';
/**
 * `post-studio` is a viewer mode but deliberately NOT a ContentType: it is a
 * full-body composition workspace, not something that can sit in half of a
 * split pane. It is also never restored on load (see `loadViewerMode`) —
 * opening a sequence should show the sequence, never drop you into an editor.
 */
export type ViewerMode = 'split' | 'post-studio' | ContentType;
export type ExportContext = 'animation-export' | 'image-export' | null;

export interface SplitConfig {
	leftPane: ContentType;
	rightPane: ContentType;
}

export type ComparisonMode = '2d-card' | '3d-card' | '2d-3d' | '2d-mandala';

export const COMPARISON_MODE_LAYOUTS: Record<ComparisonMode, SplitConfig> = {
	'2d-card': { leftPane: 'animation', rightPane: 'card' },
	'3d-card': { leftPane: 'animation-3d', rightPane: 'card' },
	'2d-3d': { leftPane: 'animation', rightPane: 'animation-3d' },
	'2d-mandala': { leftPane: 'animation', rightPane: 'mandala' }
};

/**
 * Resolve a stored SplitConfig to the comparison mode that highlights it.
 * Dropped/legacy pairings (e.g. 3d-mandala, card-card) fall back to '2d-card'
 * without mutating storage — the user's next pick rewrites it.
 */
export function splitConfigToMode(config: SplitConfig): ComparisonMode {
	for (const mode of Object.keys(COMPARISON_MODE_LAYOUTS) as ComparisonMode[]) {
		const layout = COMPARISON_MODE_LAYOUTS[mode];
		if (layout.leftPane === config.leftPane && layout.rightPane === config.rightPane) {
			return mode;
		}
	}
	return '2d-card';
}

const VIEWER_MODE_KEY = 'tka-viewer-mode';
const SPLIT_CONFIG_KEY = 'tka-viewer-split-config';
const LEGACY_EDITING_PANE_KEY = 'tka-viewer-editing-pane';

function migrateFromLegacy(
	allowWrites = true
): { viewerMode: ViewerMode; exportContext: ExportContext } | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(LEGACY_EDITING_PANE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		const pane = parsed.pane as string | undefined;
		if (allowWrites) localStorage.removeItem(LEGACY_EDITING_PANE_KEY);

		switch (pane) {
			case 'animation':
				return { viewerMode: 'animation', exportContext: 'animation-export' };
			case 'image':
				return { viewerMode: 'card', exportContext: 'image-export' };
			default:
				return { viewerMode: 'split', exportContext: null };
		}
	} catch {
		return null;
	}
}

/**
 * `persist: false` makes this a pure read: the legacy/mandala migrations still
 * resolve in memory but never touch disk. View-only viewer mounts (a URL that
 * overrides the user's own state) use it so nothing about the visit is written.
 */
export function loadViewerMode(options?: { persist?: boolean }): ViewerMode {
	if (typeof localStorage === 'undefined') return 'split';
	const allowWrites = options?.persist ?? true;

	const migrated = migrateFromLegacy(allowWrites);
	if (migrated) {
		if (allowWrites) persistViewerMode(migrated.viewerMode);
		return migrated.viewerMode;
	}

	try {
		const raw = localStorage.getItem(VIEWER_MODE_KEY);
		// Mandala now opens from the workspace card. A remembered viewer mode
		// should not bring someone back to a surface they can no longer choose.
		if (raw === 'mandala') {
			if (allowWrites) persistViewerMode('split');
			return 'split';
		}
		// 'videos' is gated off (VIDEO_UPLOAD_ENABLED) — never restore a stale
		// video-gallery preference when its supporting upload tools are withheld.
		if (raw === 'videos' && !VIDEO_UPLOAD_ENABLED) return 'split';
		// 'post-studio' is intentionally absent from this whitelist — restoring an
		// editor would mean opening a sequence lands you in a workspace instead of
		// on the sequence you came to look at.
		if (raw === 'animation' || raw === 'animation-3d' || raw === 'card' || raw === 'videos' || raw === 'tunnel' || raw === 'split') {
			return raw;
		}
		return 'split';
	} catch {
		return 'split';
	}
}

export function persistViewerMode(mode: ViewerMode): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(VIEWER_MODE_KEY, mode);
	} catch {
		/* ignore */
	}
}

/** `persist: false` behaves as a pure read — see `loadViewerMode`. */
export function loadSplitConfig(options?: { persist?: boolean }): SplitConfig {
	if (typeof localStorage === 'undefined') return { leftPane: 'animation', rightPane: 'card' };
	const allowWrites = options?.persist ?? true;
	try {
		const raw = localStorage.getItem(SPLIT_CONFIG_KEY);
		if (!raw) return { leftPane: 'animation', rightPane: 'card' };
		const parsed = JSON.parse(raw) as SplitConfig;
		if (isValidContentType(parsed.leftPane) && isValidContentType(parsed.rightPane)) {
			const migrated = retireMandalaFromSplit(parsed);
			if (migrated !== parsed && allowWrites) persistSplitConfig(migrated);
			return migrated;
		}
		return { leftPane: 'animation', rightPane: 'card' };
	} catch {
		return { leftPane: 'animation', rightPane: 'card' };
	}
}

function retireMandalaFromSplit(config: SplitConfig): SplitConfig {
	if (config.leftPane !== 'mandala' && config.rightPane !== 'mandala') return config;

	// Old side-by-side layouts could place Mandala in either pane. Replace it
	// with the matching standard view so reopening a sequence stays useful.
	return {
		leftPane: config.leftPane === 'mandala' ? 'animation' : config.leftPane,
		rightPane: config.rightPane === 'mandala' ? 'card' : config.rightPane
	};
}

export function persistSplitConfig(config: SplitConfig): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SPLIT_CONFIG_KEY, JSON.stringify(config));
	} catch {
		/* ignore */
	}
}

export function isValidContentType(value: unknown): value is ContentType {
	return value === 'animation' || value === 'animation-3d' || value === 'card' || value === 'videos' || value === 'mandala' || value === 'tunnel';
}

/**
 * Every mode a viewer can legitimately be in, including `post-studio` — which
 * `loadViewerMode` refuses to RESTORE but a URL may legitimately REQUEST.
 * Hand-edited garbage (`?pane=lol`) fails here and falls back to defaults.
 */
export function isValidViewerMode(value: unknown): value is ViewerMode {
	return value === 'split' || value === 'post-studio' || isValidContentType(value);
}

/** A `SplitConfig` whose panes are both real content types. */
export function isValidSplitConfig(value: unknown): value is SplitConfig {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<SplitConfig>;
	return isValidContentType(candidate.leftPane) && isValidContentType(candidate.rightPane);
}
