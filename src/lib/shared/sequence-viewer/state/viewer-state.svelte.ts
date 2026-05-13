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

	function enterExport(type: 'animation-export' | 'image-export') {
		const mode: ViewerMode = type === 'animation-export' ? 'animation' : 'card';
		viewerMode = mode;
		exportContext = type;
		persistViewerMode(mode);
	}

	function exitExport() {
		exportContext = null;
	}

	function backToSplit() {
		viewerMode = 'split';
		exportContext = null;
		persistViewerMode('split');
	}

	return {
		get viewerMode() {
			return viewerMode;
		},
		get exportContext() {
			return exportContext;
		},
		get splitConfig() {
			return splitConfig;
		},
		setViewerMode,
		setExportContext,
		setSplitPaneContent,
		enterExport,
		exitExport,
		backToSplit
	};
}
