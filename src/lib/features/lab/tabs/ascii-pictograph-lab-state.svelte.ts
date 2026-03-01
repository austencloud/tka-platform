/**
 * Reactive state for the ASCII Pictograph Lab.
 *
 * Two modes:
 * - Single: prev/next through all pictograph variations from CSV
 * - Sequence: type a word, generate via existing spell services, render side by side
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
import { container } from "$lib/shared/di";
import type { IVariationExplorationOrchestrator } from "$lib/features/create/spell/services/contracts/IVariationExplorationOrchestrator";
import type { IRandomSequenceGenerator } from "$lib/features/create/spell/services/contracts/IRandomSequenceGenerator";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import { DifficultyLevel } from "$lib/features/create/generate/shared/domain/models/generate-models";

/** Which rendering layers are active */
export interface RenderLayers {
	grid: boolean;
	hands: boolean;
	staves: boolean;
	arrows: boolean;
}

export type LabMode = "single" | "sequence";

// ============================================================================
// CSV LOADING (Single mode)
// ============================================================================

interface PictographEntry {
	letter: string;
	gridMode: GridMode;
	blueStartLocation: GridLocation;
	blueEndLocation: GridLocation;
	blueMotionType: MotionType;
	redStartLocation: GridLocation;
	redEndLocation: GridLocation;
	redMotionType: MotionType;
}

function entryToPictograph(entry: PictographEntry): RetroPictographData {
	const blueHand: RetroHandData = {
		color: MotionColor.BLUE,
		location: entry.blueStartLocation,
		endLocation: entry.blueEndLocation,
		motionType: entry.blueMotionType,
		orientation: Orientation.IN,
		turns: 0,
	};
	const redHand: RetroHandData = {
		color: MotionColor.RED,
		location: entry.redStartLocation,
		endLocation: entry.redEndLocation,
		motionType: entry.redMotionType,
		orientation: Orientation.IN,
		turns: 0,
	};
	return { letter: entry.letter, blueHand, redHand, gridMode: entry.gridMode };
}

function parseCsv(text: string, gridMode: GridMode): PictographEntry[] {
	const lines = text.trim().split("\n");
	if (lines.length < 2) return [];

	const headers = lines[0]!.split(",").map((h) => h.trim());
	const col = (name: string) => headers.indexOf(name);
	const entries: PictographEntry[] = [];

	for (let i = 1; i < lines.length; i++) {
		const v = lines[i]!.split(",").map((s) => s.trim());
		entries.push({
			letter: v[col("letter")] ?? "",
			gridMode,
			blueStartLocation: (v[col("blueStartLocation")] as GridLocation) || GridLocation.NORTH,
			blueEndLocation: (v[col("blueEndLocation")] as GridLocation) || GridLocation.NORTH,
			blueMotionType: (v[col("blueMotionType")] as MotionType) || MotionType.STATIC,
			redStartLocation: (v[col("redStartLocation")] as GridLocation) || GridLocation.SOUTH,
			redEndLocation: (v[col("redEndLocation")] as GridLocation) || GridLocation.SOUTH,
			redMotionType: (v[col("redMotionType")] as MotionType) || MotionType.STATIC,
		});
	}
	return entries;
}

// ============================================================================
// STEP CONVERSION (Sequence mode)
// ============================================================================

function stepToRetro(step: StepData): RetroPictographData {
	const blue = step.motions[MotionColor.BLUE];
	const red = step.motions[MotionColor.RED];

	const blueHand: RetroHandData = {
		color: MotionColor.BLUE,
		location: blue?.startLocation ?? GridLocation.NORTH,
		endLocation: blue?.endLocation ?? GridLocation.NORTH,
		motionType: blue?.motionType ?? MotionType.STATIC,
		orientation: blue?.startOrientation ?? Orientation.IN,
		turns: typeof blue?.turns === "number" ? blue.turns : 0,
	};
	const redHand: RetroHandData = {
		color: MotionColor.RED,
		location: red?.startLocation ?? GridLocation.SOUTH,
		endLocation: red?.endLocation ?? GridLocation.SOUTH,
		motionType: red?.motionType ?? MotionType.STATIC,
		orientation: red?.startOrientation ?? Orientation.IN,
		turns: typeof red?.turns === "number" ? red.turns : 0,
	};

	return {
		letter: step.letter ?? "",
		blueHand,
		redHand,
		gridMode: step.gridMode ?? GridMode.DIAMOND,
	};
}

// ============================================================================
// STATE FACTORY
// ============================================================================

export function createAsciiLabState() {
	// Shared
	let mode = $state<LabMode>("single");
	let loading = $state(true);
	let error = $state<string | null>(null);
	let layers = $state<RenderLayers>({
		grid: true,
		hands: true,
		staves: false,
		arrows: false,
	});

	// Single mode
	let entries = $state<PictographEntry[]>([]);
	let gridModeFilter = $state<GridMode>(GridMode.DIAMOND);
	let currentIndex = $state(0);

	// Sequence mode
	let sequenceSteps = $state<RetroPictographData[]>([]);
	let sequenceWord = $state("");
	let sequenceExpanded = $state("");
	let generating = $state(false);

	// ── Single mode derived ──

	const filteredEntries = $derived(
		entries.filter((e) => e.gridMode === gridModeFilter),
	);

	const currentEntry = $derived(filteredEntries[currentIndex] ?? null);

	const pictographData = $derived<RetroPictographData | null>(
		currentEntry ? entryToPictograph(currentEntry) : null,
	);

	const label = $derived(
		currentEntry
			? `${currentEntry.letter}  ${currentIndex + 1} / ${filteredEntries.length}`
			: "No data loaded",
	);

	// ── Actions ──

	async function loadData(): Promise<void> {
		loading = true;
		error = null;
		try {
			const [diamondResp, boxResp] = await Promise.all([
				fetch("/data/pictographs/DiamondPictographDataframe.csv"),
				fetch("/data/pictographs/BoxPictographDataframe.csv"),
			]);
			if (!diamondResp.ok || !boxResp.ok) throw new Error("Failed to fetch CSV files");

			const [diamondText, boxText] = await Promise.all([
				diamondResp.text(),
				boxResp.text(),
			]);

			entries = [
				...parseCsv(diamondText, GridMode.DIAMOND),
				...parseCsv(boxText, GridMode.BOX),
			];
			currentIndex = 0;
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load pictograph data";
		} finally {
			loading = false;
		}
	}

	function next(): void {
		if (filteredEntries.length === 0) return;
		currentIndex = (currentIndex + 1) % filteredEntries.length;
	}

	function prev(): void {
		if (filteredEntries.length === 0) return;
		currentIndex = (currentIndex - 1 + filteredEntries.length) % filteredEntries.length;
	}

	function setGridModeFilter(mode: GridMode): void {
		gridModeFilter = mode;
		currentIndex = 0;
	}

	function toggleLayer(layer: keyof RenderLayers): void {
		layers = { ...layers, [layer]: !layers[layer] };
	}

	function setMode(m: LabMode): void {
		mode = m;
		error = null;
	}

	async function generateSequence(word: string): Promise<void> {
		if (!word.trim()) return;

		generating = true;
		error = null;
		sequenceSteps = [];
		sequenceWord = word.trim().toUpperCase();

		try {
			const spellOrch = container.items
				.variationExplorationOrchestrator as IVariationExplorationOrchestrator;
			const generator = container.items
				.randomSequenceGenerator as IRandomSequenceGenerator;

			// Parse word with bridge letters
			const parseResult = await spellOrch.parseWord(sequenceWord, {
				preferences: {
					constraintPreset: "smooth",
					handPathMode: "mixed",
					motionTypeFilter: null,
					highContinuity: true,
					makeCircular: false,
					selectedLOOPType: null,
					targetStepCount: null,
					maxReversals: null,
				},
			});

			if (!parseResult.success || !parseResult.expandedLetters) {
				throw new Error(parseResult.error ?? "Failed to parse word");
			}

			sequenceExpanded = parseResult.expandedWord ?? sequenceWord;

			// Generate sequence
			const sequence = await generator.generateRandomSequence(
				parseResult.expandedLetters,
				{
					gridMode: GridMode.DIAMOND,
					letterSources: parseResult.letterSources,
					level: DifficultyLevel.INTERMEDIATE,
					turnIntensity: 1.0,
				},
			);

			if (!sequence) {
				throw new Error("No valid sequence found");
			}

			// Convert steps to retro format (skip step 0 which is the start position)
			sequenceSteps = sequence.steps
				.filter((step) => step.stepNumber > 0)
				.map(stepToRetro);
		} catch (e) {
			error = e instanceof Error ? e.message : "Sequence generation failed";
		} finally {
			generating = false;
		}
	}

	return {
		get mode() { return mode; },
		get loading() { return loading; },
		get error() { return error; },
		get label() { return label; },
		get layers() { return layers; },
		get gridModeFilter() { return gridModeFilter; },
		get pictographData() { return pictographData; },
		get sequenceSteps() { return sequenceSteps; },
		get sequenceWord() { return sequenceWord; },
		get sequenceExpanded() { return sequenceExpanded; },
		get generating() { return generating; },
		loadData,
		next,
		prev,
		toggleLayer,
		setMode,
		setGridModeFilter,
		generateSequence,
	};
}
