export type ContentType = 'animation' | 'animation-3d' | 'card' | 'videos' | 'mandala' | 'tunnel';
export type ViewerMode = 'split' | ContentType;
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

function migrateFromLegacy(): { viewerMode: ViewerMode; exportContext: ExportContext } | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(LEGACY_EDITING_PANE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		const pane = parsed.pane as string | undefined;
		localStorage.removeItem(LEGACY_EDITING_PANE_KEY);

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

export function loadViewerMode(): ViewerMode {
	if (typeof localStorage === 'undefined') return 'split';

	const migrated = migrateFromLegacy();
	if (migrated) {
		persistViewerMode(migrated.viewerMode);
		return migrated.viewerMode;
	}

	try {
		const raw = localStorage.getItem(VIEWER_MODE_KEY);
		if (raw === 'animation' || raw === 'animation-3d' || raw === 'card' || raw === 'videos' || raw === 'mandala' || raw === 'tunnel' || raw === 'split') {
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

export function loadSplitConfig(): SplitConfig {
	if (typeof localStorage === 'undefined') return { leftPane: 'animation', rightPane: 'card' };
	try {
		const raw = localStorage.getItem(SPLIT_CONFIG_KEY);
		if (!raw) return { leftPane: 'animation', rightPane: 'card' };
		const parsed = JSON.parse(raw) as SplitConfig;
		if (isValidContentType(parsed.leftPane) && isValidContentType(parsed.rightPane)) {
			return parsed;
		}
		return { leftPane: 'animation', rightPane: 'card' };
	} catch {
		return { leftPane: 'animation', rightPane: 'card' };
	}
}

export function persistSplitConfig(config: SplitConfig): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SPLIT_CONFIG_KEY, JSON.stringify(config));
	} catch {
		/* ignore */
	}
}

function isValidContentType(value: unknown): value is ContentType {
	return value === 'animation' || value === 'animation-3d' || value === 'card' || value === 'videos' || value === 'mandala' || value === 'tunnel';
}
