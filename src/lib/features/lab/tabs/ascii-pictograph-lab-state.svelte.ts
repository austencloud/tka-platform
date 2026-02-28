/**
 * Reactive state for the ASCII Pictograph Lab.
 *
 * Manages:
 * - The current pictograph data (loaded from MCP or manually configured)
 * - Manual overrides for each hand
 * - Active rendering layers (for phase-by-phase development)
 * - Grid mode toggle (diamond/box)
 *
 * Domain: Retro DOS Terminal Lab
 */

import {
	GridLocation,
	GridMode,
	MotionType,
	Orientation,
	MotionColor,
} from "$lib/features/retro/shared/domain/pictograph-types";
import type {
	RetroPictographData,
	RetroHandData,
} from "$lib/features/retro/shared/domain/pictograph-types";

/** Which rendering layers are active (for phased development) */
export interface RenderLayers {
	grid: boolean;
	hands: boolean;
	staves: boolean;
	arrows: boolean;
}

/** Default hand data (blue at north, static, staff pointing in) */
function defaultBlueHand(): RetroHandData {
	return {
		color: MotionColor.BLUE,
		location: GridLocation.NORTH,
		endLocation: GridLocation.NORTH,
		motionType: MotionType.STATIC,
		orientation: Orientation.IN,
		turns: 0,
	};
}

/** Default hand data (red at south, static, staff pointing in) */
function defaultRedHand(): RetroHandData {
	return {
		color: MotionColor.RED,
		location: GridLocation.SOUTH,
		endLocation: GridLocation.SOUTH,
		motionType: MotionType.STATIC,
		orientation: Orientation.IN,
		turns: 0,
	};
}

export function createAsciiLabState() {
	// Current letter name (for display)
	let letterName = $state<string | null>(null);

	// The "source of truth" data loaded from MCP (for reset)
	let loadedData = $state<RetroPictographData | null>(null);

	// Working copy that the user can override
	let gridMode = $state<GridMode>(GridMode.DIAMOND);
	let blueHand = $state<RetroHandData>(defaultBlueHand());
	let redHand = $state<RetroHandData>(defaultRedHand());

	// Rendering layer toggles (start with only grid for Phase 1)
	let layers = $state<RenderLayers>({
		grid: true,
		hands: false,
		staves: false,
		arrows: false,
	});

	// Derived: assemble the current pictograph data for the renderer
	const pictographData = $derived<RetroPictographData>({
		letter: letterName ?? "",
		blueHand,
		redHand,
		gridMode,
	});

	/** Load data from MCP tool result */
	function loadFromMcp(letter: string, data: RetroPictographData): void {
		letterName = letter;
		loadedData = data;
		gridMode = data.gridMode;
		blueHand = { ...data.blueHand };
		redHand = { ...data.redHand };
	}

	/** Reset overrides to the last loaded MCP data */
	function resetToLoaded(): void {
		if (!loadedData) return;
		gridMode = loadedData.gridMode;
		blueHand = { ...loadedData.blueHand };
		redHand = { ...loadedData.redHand };
	}

	/** Update a single field on the blue hand */
	function updateBlueHand(updates: Partial<RetroHandData>): void {
		blueHand = { ...blueHand, ...updates };
	}

	/** Update a single field on the red hand */
	function updateRedHand(updates: Partial<RetroHandData>): void {
		redHand = { ...redHand, ...updates };
	}

	/** Toggle a rendering layer */
	function toggleLayer(layer: keyof RenderLayers): void {
		layers = { ...layers, [layer]: !layers[layer] };
	}

	/** Set grid mode */
	function setGridMode(mode: GridMode): void {
		gridMode = mode;
	}

	return {
		get letterName() {
			return letterName;
		},
		get loadedData() {
			return loadedData;
		},
		get gridMode() {
			return gridMode;
		},
		get blueHand() {
			return blueHand;
		},
		get redHand() {
			return redHand;
		},
		get layers() {
			return layers;
		},
		get pictographData() {
			return pictographData;
		},
		loadFromMcp,
		resetToLoaded,
		updateBlueHand,
		updateRedHand,
		toggleLayer,
		setGridMode,
	};
}
