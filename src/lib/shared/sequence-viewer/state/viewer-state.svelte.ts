import {
	type ViewerMode,
	type ExportContext,
	type ContentType,
	type SplitConfig,
	loadViewerMode,
	loadSplitConfig,
	persistViewerMode,
	persistSplitConfig
} from '../services/viewer-state-persistence';
import { coerce3DContent, coerce3DSplit } from '../services/viewer-modes';
import { viewportFits3D } from '$lib/shared/3d/capabilities/viewport-3d-gate.svelte';

export type { ViewerMode, ExportContext, ContentType, SplitConfig };

function deriveInitialExportContext(mode: ViewerMode): ExportContext {
	if (mode === 'animation' || mode === 'animation-3d') return 'animation-export';
	if (mode === 'card') return 'image-export';
	return null;
}

export function createViewerState() {
	const initialMode = loadViewerMode();
	let viewerMode = $state<ViewerMode>(initialMode);
	let exportContext = $state<ExportContext>(deriveInitialExportContext(initialMode));
	let splitConfig = $state<SplitConfig>(loadSplitConfig());

	function setViewerMode(mode: ViewerMode) {
		viewerMode = mode;
		persistViewerMode(mode);
	}

	function setExportContext(ctx: ExportContext) {
		exportContext = ctx;
	}

	function setSplitPaneContent(pane: 'left' | 'right', content: ContentType) {
		if (pane === 'left') {
			splitConfig = { ...splitConfig, leftPane: content };
		} else {
			splitConfig = { ...splitConfig, rightPane: content };
		}
		persistSplitConfig(splitConfig);
	}

	function setSplitConfig(config: SplitConfig) {
		splitConfig = { ...config };
		persistSplitConfig(splitConfig);
	}

	function enterExport(type: 'animation-export' | 'image-export', contentType?: 'animation' | 'animation-3d') {
		if (type === 'animation-export') {
			viewerMode = contentType ?? 'animation';
		} else {
			viewerMode = 'card';
		}
		exportContext = type;
		persistViewerMode(viewerMode);
	}

	function exitExport() {
		exportContext = null;
	}


	// wants3D reflects the RAW stored preference (not the viewport-coerced getters
	// below), so folding a Z Fold suppresses 3D via the orchestrator's fits3D
	// guard while the preference survives — unfolding re-enters 3D automatically.
	const wants3D = $derived(
		viewerMode === 'animation-3d' ||
		(viewerMode === 'split' &&
			(splitConfig.leftPane === 'animation-3d' || splitConfig.rightPane === 'animation-3d'))
	);

	// Effective (viewport-gated) views for RENDERING. When the viewport can't host
	// 3D, a persisted 3D mode/pane renders as 2D without overwriting storage. Live
	// via viewportFits3D() — grows back to 3D the instant the screen fits again.
	const effectiveViewerMode = $derived<ViewerMode>(
		viewerMode === 'animation-3d' ? coerce3DContent('animation-3d', viewportFits3D()) : viewerMode
	);
	const effectiveSplitConfig = $derived<SplitConfig>(coerce3DSplit(splitConfig, viewportFits3D()));

	return {
		get viewerMode() {
			return effectiveViewerMode;
		},
		get exportContext() {
			return exportContext;
		},
		get splitConfig() {
			return effectiveSplitConfig;
		},
		get wants3D() {
			return wants3D;
		},
		setViewerMode,
		setExportContext,
		setSplitPaneContent,
		setSplitConfig,
		enterExport,
		exitExport
	};
}
