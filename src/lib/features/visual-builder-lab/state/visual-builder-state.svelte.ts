/**
 * Visual Builder State
 *
 * Svelte 5 reactive state for the visual sequence builder.
 * Beat-by-beat construction: each beat captures both hands independently.
 *
 * Flow per beat:
 * 1. Click grid point → set active hand's start position
 * 2. Click another grid point → set active hand's end position, motion auto-derived
 * 3. Switch hands or confirm beat
 * 4. When both hands have start+end → beat auto-confirms
 * 5. End position becomes next beat's start position
 */

import {
	GridLocation,
	GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
	MotionColor,
	RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData, type MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/createPictographData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { BeatMotionDeriver } from "../services/implementations/BeatMotionDeriver";

export type BuildPhase = "select-start" | "select-end";

export interface HandBeatData {
	start: GridLocation;
	end: GridLocation;
}

export interface CompletedBeat {
	blue: HandBeatData;
	red: HandBeatData;
	blueMotion: MotionData;
	redMotion: MotionData;
}

export interface VisualBuilderConfig {
	gridMode?: GridMode;
}

export function createVisualBuilderState(config: VisualBuilderConfig = {}) {
	const deriver = new BeatMotionDeriver();

	// Core state
	let activeHand = $state<MotionColor>(MotionColor.BLUE);
	let gridMode = $state<GridMode>(config.gridMode ?? GridMode.DIAMOND);
	let blueRotation = $state<RotationDirection>(RotationDirection.CLOCKWISE);
	let redRotation = $state<RotationDirection>(RotationDirection.CLOCKWISE);
	let buildPhase = $state<BuildPhase>("select-start");

	// Current beat in progress
	let blueStart = $state<GridLocation | null>(null);
	let blueEnd = $state<GridLocation | null>(null);
	let redStart = $state<GridLocation | null>(null);
	let redEnd = $state<GridLocation | null>(null);

	// Completed beats
	let completedBeats = $state<CompletedBeat[]>([]);

	// Derived: active hand's current start position
	const activeHandStart = $derived(
		activeHand === MotionColor.BLUE ? blueStart : redStart
	);

	// Derived: active hand's current end position
	const activeHandEnd = $derived(
		activeHand === MotionColor.BLUE ? blueEnd : redEnd
	);

	// Derived: is the current hand's beat complete (has both start and end)?
	const isCurrentHandComplete = $derived(
		activeHandStart !== null && activeHandEnd !== null
	);

	// Derived: are both hands complete for the current beat?
	const isBeatReady = $derived(
		blueStart !== null && blueEnd !== null &&
		redStart !== null && redEnd !== null
	);

	// Derived: live preview of current beat as PictographData
	const currentBeatPreview = $derived.by((): PictographData | null => {
		const motions: Partial<Record<MotionColor, MotionData | undefined>> = {};

		if (blueStart !== null && blueEnd !== null) {
			motions[MotionColor.BLUE] = deriver.deriveMotion(
				blueStart, blueEnd, MotionColor.BLUE, blueRotation, gridMode,
			);
		} else if (blueStart !== null) {
			// Show prop at start position (static)
			motions[MotionColor.BLUE] = createMotionData({
				color: MotionColor.BLUE,
				startLocation: blueStart,
				endLocation: blueStart,
				gridMode,
				isVisible: true,
			});
		}

		if (redStart !== null && redEnd !== null) {
			motions[MotionColor.RED] = deriver.deriveMotion(
				redStart, redEnd, MotionColor.RED, redRotation, gridMode,
			);
		} else if (redStart !== null) {
			motions[MotionColor.RED] = createMotionData({
				color: MotionColor.RED,
				startLocation: redStart,
				endLocation: redStart,
				gridMode,
				isVisible: true,
			});
		}

		if (Object.keys(motions).length === 0) return null;

		return createPictographData({ motions, gridMode });
	});

	// Derived: all completed beats as PictographData[]
	const sequencePictographs = $derived<PictographData[]>(
		completedBeats.map((beat) =>
			createPictographData({
				motions: {
					[MotionColor.BLUE]: beat.blueMotion,
					[MotionColor.RED]: beat.redMotion,
				},
				gridMode,
			})
		)
	);

	// Derived: total beat count
	const beatCount = $derived(completedBeats.length);

	/**
	 * Main interaction: handle a grid point click
	 */
	function handlePointClick(location: GridLocation): void {
		if (buildPhase === "select-start") {
			setActiveHandStart(location);
			buildPhase = "select-end";
		} else {
			setActiveHandEnd(location);
			buildPhase = "select-start";

			// Check if both hands are now complete → auto-confirm
			if (
				blueStart !== null && blueEnd !== null &&
				redStart !== null && redEnd !== null
			) {
				confirmBeat();
			} else {
				// Auto-switch to the other hand
				activeHand = activeHand === MotionColor.BLUE ? MotionColor.RED : MotionColor.BLUE;
			}
		}
	}

	function setActiveHandStart(location: GridLocation): void {
		if (activeHand === MotionColor.BLUE) {
			blueStart = location;
			blueEnd = null;
		} else {
			redStart = location;
			redEnd = null;
		}
	}

	function setActiveHandEnd(location: GridLocation): void {
		if (activeHand === MotionColor.BLUE) {
			blueEnd = location;
		} else {
			redEnd = location;
		}
	}

	/**
	 * Switch active hand
	 */
	function switchHand(color: MotionColor): void {
		activeHand = color;
		// Reset build phase to match the new hand's state
		if (activeHand === MotionColor.BLUE) {
			buildPhase = blueStart !== null && blueEnd === null ? "select-end" : "select-start";
		} else {
			buildPhase = redStart !== null && redEnd === null ? "select-end" : "select-start";
		}
	}

	/**
	 * Set rotation direction for a hand
	 */
	function setRotation(color: MotionColor, direction: RotationDirection): void {
		if (color === MotionColor.BLUE) {
			blueRotation = direction;
		} else {
			redRotation = direction;
		}
	}

	/**
	 * Confirm the current beat and advance
	 */
	function confirmBeat(): void {
		if (blueStart === null || blueEnd === null || redStart === null || redEnd === null) {
			return;
		}

		const blueMotion = deriver.deriveMotion(blueStart, blueEnd, MotionColor.BLUE, blueRotation, gridMode);
		const redMotion = deriver.deriveMotion(redStart, redEnd, MotionColor.RED, redRotation, gridMode);

		completedBeats = [
			...completedBeats,
			{
				blue: { start: blueStart, end: blueEnd },
				red: { start: redStart, end: redEnd },
				blueMotion,
				redMotion,
			},
		];

		// End positions become start positions for next beat
		const nextBlueStart = blueEnd;
		const nextRedStart = redEnd;

		blueStart = nextBlueStart;
		blueEnd = null;
		redStart = nextRedStart;
		redEnd = null;
		activeHand = MotionColor.BLUE;
		buildPhase = "select-end";
	}

	/**
	 * Undo the last action (within beat or remove last beat)
	 */
	function undoLastAction(): void {
		// If we have an end position set, clear it
		if (activeHand === MotionColor.BLUE && blueEnd !== null) {
			blueEnd = null;
			buildPhase = "select-end";
			return;
		}
		if (activeHand === MotionColor.RED && redEnd !== null) {
			redEnd = null;
			buildPhase = "select-end";
			return;
		}

		// If we have a start position set, clear it
		if (activeHand === MotionColor.BLUE && blueStart !== null) {
			blueStart = null;
			buildPhase = "select-start";
			return;
		}
		if (activeHand === MotionColor.RED && redStart !== null) {
			redStart = null;
			buildPhase = "select-start";
			return;
		}

		// Otherwise, undo last completed beat
		if (completedBeats.length > 0) {
			const lastBeat = completedBeats[completedBeats.length - 1]!;
			completedBeats = completedBeats.slice(0, -1);

			// Restore the last beat for re-editing
			blueStart = lastBeat.blue.start;
			blueEnd = lastBeat.blue.end;
			redStart = lastBeat.red.start;
			redEnd = lastBeat.red.end;
			activeHand = MotionColor.BLUE;
			buildPhase = "select-start";
		}
	}

	/**
	 * Reset everything
	 */
	function reset(): void {
		activeHand = MotionColor.BLUE;
		buildPhase = "select-start";
		blueStart = null;
		blueEnd = null;
		redStart = null;
		redEnd = null;
		completedBeats = [];
	}

	/**
	 * Update grid mode (resets state)
	 */
	function updateGridMode(mode: GridMode): void {
		gridMode = mode;
		reset();
	}

	return {
		// Reactive getters
		get activeHand() { return activeHand; },
		get gridMode() { return gridMode; },
		get blueRotation() { return blueRotation; },
		get redRotation() { return redRotation; },
		get buildPhase() { return buildPhase; },
		get blueStart() { return blueStart; },
		get blueEnd() { return blueEnd; },
		get redStart() { return redStart; },
		get redEnd() { return redEnd; },

		// Derived state
		get activeHandStart() { return activeHandStart; },
		get activeHandEnd() { return activeHandEnd; },
		get isCurrentHandComplete() { return isCurrentHandComplete; },
		get isBeatReady() { return isBeatReady; },
		get currentBeatPreview() { return currentBeatPreview; },
		get sequencePictographs() { return sequencePictographs; },
		get completedBeats() { return completedBeats; },
		get beatCount() { return beatCount; },

		// Actions
		handlePointClick,
		switchHand,
		setRotation,
		confirmBeat,
		undoLastAction,
		reset,
		updateGridMode,
	};
}

export type VisualBuilderState = ReturnType<typeof createVisualBuilderState>;
