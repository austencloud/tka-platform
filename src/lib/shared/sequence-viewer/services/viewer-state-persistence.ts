export type ContentType = 'animation' | 'animation-3d' | 'card' | 'videos';
export type ViewerMode = 'split' | ContentType;
export type ExportContext = 'animation-export' | 'image-export' | null;

export interface SplitConfig {
	leftPane: ContentType;
	rightPane: ContentType;
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
		if (raw === 'animation' || raw === 'animation-3d' || raw === 'card' || raw === 'videos' || raw === 'split') {
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
	return value === 'animation' || value === 'animation-3d' || value === 'card' || value === 'videos';
}
