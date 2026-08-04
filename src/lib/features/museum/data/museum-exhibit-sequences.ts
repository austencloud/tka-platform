/**
 * Museum Exhibit Sequences - Pre-baked sequence data for exhibit pictographs.
 *
 * Each entry maps an exhibit's sequenceId to the step data needed by
 * PictographContainer. Data generated via MCP get_sequence_data tool
 * and converted to client-side format at import time.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { GridLocation, GridMode, GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionType, RotationDirection, Orientation, MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";

// ── Raw MCP format ──

interface RawMotion {
	color: string;
	startLocation: string;
	endLocation: string;
	motionType: string;
	rotationDirection: string;
	startOrientation: string;
	endOrientation: string;
}

interface RawStep {
	letter: string;
	startPosition: string;
	endPosition: string;
	blueMotion: RawMotion;
	redMotion: RawMotion;
	stepNumber: number;
}

interface RawSequence {
	word: string;
	steps: RawStep[];
}

// ── Conversion ──

function toMotionData(raw: RawMotion, gridMode: GridMode): MotionData {
	return {
		motionType: raw.motionType as MotionType,
		rotationDirection: raw.rotationDirection as RotationDirection,
		startLocation: raw.startLocation as GridLocation,
		endLocation: raw.endLocation as GridLocation,
		turns: 0,
		startOrientation: raw.startOrientation as Orientation,
		endOrientation: raw.endOrientation as Orientation,
		isVisible: true,
		propType: "staff" as PropType,
		arrowLocation: raw.endLocation as GridLocation,
		color: raw.color as MotionColor,
		gridMode,
		arrowPlacementData: { x: 0, y: 0, rotation: 0 },
		propPlacementData: { x: 0, y: 0, rotation: 0 },
	} as unknown as MotionData;
}

function convertRaw(raw: RawSequence, gridMode: GridMode = "diamond" as GridMode): MuseumSequenceData {
	const steps: StepData[] = raw.steps
		.filter((s) => s.stepNumber > 0)
		.map((step) => ({
			id: `museum-${raw.word}-${step.stepNumber}`,
			letter: step.letter as Letter,
			startPosition: step.startPosition as GridPosition,
			endPosition: step.endPosition as GridPosition,
			gridMode,
			motions: {
				blue: toMotionData(step.blueMotion, gridMode),
				red: toMotionData(step.redMotion, gridMode),
			},
			stepNumber: step.stepNumber,
			duration: 1,
			blueReversal: false,
			redReversal: false,
			isBlank: false,
		}));

	const step0 = raw.steps.find((s) => s.stepNumber === 0);
	const startPosition: PictographData | null = step0
		? {
				id: `museum-${raw.word}-start`,
				letter: step0.letter as Letter,
				startPosition: step0.startPosition as GridPosition,
				endPosition: step0.endPosition as GridPosition,
				gridMode,
				motions: {
					blue: toMotionData(step0.blueMotion, gridMode),
					red: toMotionData(step0.redMotion, gridMode),
				},
			}
		: null;

	return { word: raw.word, steps, startPosition };
}

// ── Raw sequence data from MCP get_sequence_data ──

const RAW: Record<string, RawSequence> = {
	// Victorian: Brass Notation Device - simple 3-step pattern (ABD)
	"vic-brass-seq": {
		word: "ABD",
		steps: [
			{ letter: "α", startPosition: "alpha7", endPosition: "alpha7", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha7", endPosition: "alpha5", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "n", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "s", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "B", startPosition: "alpha5", endPosition: "alpha3", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "D", startPosition: "alpha3", endPosition: "alpha7", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "e", motionType: "dash", rotationDirection: "noRotation", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "e", endLocation: "w", motionType: "dash", rotationDirection: "noRotation", startOrientation: "out", endOrientation: "out" } },
		],
	},

	// Digital: The CRT - first digital sequence (ABBD)
	"digital-crt-seq": {
		word: "ABBD",
		steps: [
			{ letter: "α", startPosition: "alpha7", endPosition: "alpha7", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha7", endPosition: "alpha1", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "B", startPosition: "alpha1", endPosition: "alpha7", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "B", startPosition: "alpha7", endPosition: "alpha5", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "n", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "s", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" } },
			{ letter: "D", startPosition: "alpha5", endPosition: "alpha1", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "s", motionType: "dash", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "n", motionType: "dash", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
		],
	},

	// Gallery: The Spiral - centerpiece exhibit (ABCD)
	"gallery-spiral-seq": {
		word: "ABCD",
		steps: [
			{ letter: "α", startPosition: "alpha3", endPosition: "alpha3", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha3", endPosition: "alpha5", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "B", startPosition: "alpha5", endPosition: "alpha3", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "C", startPosition: "alpha3", endPosition: "alpha1", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "s", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "n", motionType: "pro", rotationDirection: "ccw", startOrientation: "out", endOrientation: "out" } },
			{ letter: "D", startPosition: "alpha1", endPosition: "alpha5", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "n", motionType: "dash", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "s", motionType: "dash", rotationDirection: "noRotation", startOrientation: "out", endOrientation: "out" } },
		],
	},

	// Gallery: Scribe Training - beginner pattern (EFGH)
	"gallery-scribes-seq": {
		word: "EFGH",
		steps: [
			{ letter: "β", startPosition: "beta3", endPosition: "beta3", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "E", startPosition: "beta3", endPosition: "alpha5", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "n", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "F", startPosition: "alpha5", endPosition: "alpha1", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "n", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" } },
			{ letter: "G", startPosition: "alpha1", endPosition: "beta1", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "H", startPosition: "beta1", endPosition: "beta3", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" } },
		],
	},

	// Gallery: Practice Area - drills pattern (ABD again, different variation)
	"gallery-practice-seq": {
		word: "ABD",
		steps: [
			{ letter: "α", startPosition: "alpha3", endPosition: "alpha3", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha3", endPosition: "alpha1", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "B", startPosition: "alpha1", endPosition: "alpha7", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "D", startPosition: "alpha7", endPosition: "alpha3", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "w", motionType: "dash", rotationDirection: "noRotation", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "w", endLocation: "e", motionType: "dash", rotationDirection: "noRotation", startOrientation: "out", endOrientation: "out" } },
		],
	},

	// ── Performer station sequences ──

	// Cave performers - simple repeating pattern (ABAB)
	"performer-cave-seq": {
		word: "ABAB",
		steps: [
			{ letter: "α", startPosition: "alpha3", endPosition: "alpha3", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha3", endPosition: "alpha5", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "B", startPosition: "alpha5", endPosition: "alpha3", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "A", startPosition: "alpha3", endPosition: "alpha5", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" } },
			{ letter: "B", startPosition: "alpha5", endPosition: "alpha3", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" } },
		],
	},



	// Earth: together-time / same-direction. The Canyon Overlook's three bosses
	// run GGGG, HHHH and IIII, transcribed VERBATIM from the Tog-Same catalog
	// entries in static/data/hero/tnd-base-words.json (tnd-tog-same-gggg / -hhhh
	// / -iiii). The catalog is the variation authority — the generator's
	// variation-0 default is a different timing family and shipped wrong once
	// already (memory: reference_tnd_catalog_variation_authority).
	"cave-earth-seq-g": {
		word: "GGGG",
		steps: [
			{ letter: "β", startPosition: "beta5", endPosition: "beta5", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "G", startPosition: "beta5", endPosition: "beta7", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "G", startPosition: "beta7", endPosition: "beta1", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "G", startPosition: "beta1", endPosition: "beta3", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "G", startPosition: "beta3", endPosition: "beta5", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
		],
	},

	"cave-earth-seq-h": {
		word: "HHHH",
		steps: [
			{ letter: "β", startPosition: "beta5", endPosition: "beta5", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "H", startPosition: "beta5", endPosition: "beta7", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "H", startPosition: "beta7", endPosition: "beta1", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" } },
			{ letter: "H", startPosition: "beta1", endPosition: "beta3", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "H", startPosition: "beta3", endPosition: "beta5", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" } },
		],
	},

	"cave-earth-seq-i": {
		word: "IIII",
		steps: [
			{ letter: "β", startPosition: "beta5", endPosition: "beta5", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "I", startPosition: "beta5", endPosition: "beta7", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "I", startPosition: "beta7", endPosition: "beta1", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "I", startPosition: "beta1", endPosition: "beta3", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "I", startPosition: "beta3", endPosition: "beta5", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
		],
	},

	// Air: together-time / opposite-direction. Generated and verified through the Flow Arts MCP.
	"cave-air-seq": {
		word: "JKJK",
		steps: [
			{ letter: "α", startPosition: "alpha7", endPosition: "alpha7", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "J", startPosition: "alpha7", endPosition: "beta5", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "s", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "D", startPosition: "beta5", endPosition: "alpha3", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "e", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "K", startPosition: "alpha3", endPosition: "beta1", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "e", endLocation: "n", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "D", startPosition: "beta1", endPosition: "alpha7", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "w", motionType: "pro", rotationDirection: "ccw", startOrientation: "out", endOrientation: "out" } },
			{ letter: "J", startPosition: "alpha7", endPosition: "beta5", stepNumber: 5,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "w", endLocation: "s", motionType: "pro", rotationDirection: "ccw", startOrientation: "out", endOrientation: "out" } },
			{ letter: "D", startPosition: "beta5", endPosition: "alpha3", stepNumber: 6,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "e", motionType: "pro", rotationDirection: "ccw", startOrientation: "out", endOrientation: "out" } },
			{ letter: "K", startPosition: "alpha3", endPosition: "beta5", stepNumber: 7,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "s", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" } },
		],
	},

	// Sun: quarter-time / same-direction. Generated and verified through the Flow Arts MCP.
	"cave-sun-seq": {
		word: "STST",
		steps: [
			{ letter: "γ", startPosition: "gamma9", endPosition: "gamma9", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "n", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "S", startPosition: "gamma9", endPosition: "gamma11", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "T", startPosition: "gamma11", endPosition: "gamma9", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "e", endLocation: "n", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "S", startPosition: "gamma9", endPosition: "gamma11", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" } },
			{ letter: "T", startPosition: "gamma11", endPosition: "gamma13", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" } },
		],
	},

	// Moon: quarter-time / opposite-direction. Generated and verified through the Flow Arts MCP.
	"cave-moon-seq": {
		word: "MNMN",
		steps: [
			{ letter: "γ", startPosition: "gamma7", endPosition: "gamma7", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "M", startPosition: "gamma7", endPosition: "gamma9", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "e", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "N", startPosition: "gamma9", endPosition: "gamma7", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "M", startPosition: "gamma7", endPosition: "gamma9", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "e", motionType: "pro", rotationDirection: "ccw", startOrientation: "out", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "out", endOrientation: "out" } },
			{ letter: "N", startPosition: "gamma9", endPosition: "gamma7", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" } },
		],
	},

	// ── The Drowned Gallery procession: A, B, C ──
	// One base letter per alcove, four beats each, alpha3 → alpha3 so every
	// station loops cleanly. The three differ only in prop rotation: A is
	// blue pro / red pro, B is blue anti / red anti, C is blue anti / red pro.
	// Generated and verified through the Flow Arts MCP (2026-08-02, score 1.00).

	"cave-water-seq-a": {
		word: "AAAA",
		steps: [
			{ letter: "α", startPosition: "alpha3", endPosition: "alpha3", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha3", endPosition: "alpha5", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha5", endPosition: "alpha7", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha7", endPosition: "alpha1", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "A", startPosition: "alpha1", endPosition: "alpha3", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
		],
	},

	"cave-water-seq-b": {
		word: "BBBB",
		steps: [
			{ letter: "α", startPosition: "alpha3", endPosition: "alpha3", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "B", startPosition: "alpha3", endPosition: "alpha5", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "B", startPosition: "alpha5", endPosition: "alpha7", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" } },
			{ letter: "B", startPosition: "alpha7", endPosition: "alpha1", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "B", startPosition: "alpha1", endPosition: "alpha3", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" } },
		],
	},

	"cave-water-seq-c": {
		word: "CCCC",
		steps: [
			{ letter: "α", startPosition: "alpha3", endPosition: "alpha3", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "w", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "e", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "C", startPosition: "alpha3", endPosition: "alpha5", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "n", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "C", startPosition: "alpha5", endPosition: "alpha7", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "C", startPosition: "alpha7", endPosition: "alpha1", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "C", startPosition: "alpha1", endPosition: "alpha3", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "w", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
		],
	},

	// ── The First Fire: the three opposite-direction compound pairs ──
	// DJ pro/pro, EK anti/anti, FL hybrid (blue anti / red pro), in their
	// SPLIT-timing runs: alpha1-anchored, blue at the downbeat (s) while red is
	// at the crest (n), 180° out of phase for the whole cycle. Transcribed
	// verbatim from the canonical T&D base catalog
	// (static/data/hero/tnd-base-words.json, tnd-split-opp-* entries) — the
	// generator's default variation-0 runs are the TOG-timing versions, which
	// belong to Air, and shipped here by mistake once (2026-08-04).

	"cave-fire-seq-dj": {
		word: "JDJD",
		steps: [
			{ letter: "α", startPosition: "alpha1", endPosition: "alpha1", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "n", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "J", startPosition: "alpha1", endPosition: "beta3", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "e", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "D", startPosition: "beta3", endPosition: "alpha5", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "n", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "J", startPosition: "alpha5", endPosition: "beta7", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "w", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "D", startPosition: "beta7", endPosition: "alpha1", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "s", motionType: "pro", rotationDirection: "ccw", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
		],
	},

	"cave-fire-seq-ek": {
		word: "KEKE",
		steps: [
			{ letter: "α", startPosition: "alpha1", endPosition: "alpha1", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "n", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "K", startPosition: "alpha1", endPosition: "beta3", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "E", startPosition: "beta3", endPosition: "alpha5", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "n", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" } },
			{ letter: "K", startPosition: "alpha5", endPosition: "beta7", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "anti", rotationDirection: "ccw", startOrientation: "in", endOrientation: "out" } },
			{ letter: "E", startPosition: "beta7", endPosition: "alpha1", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "s", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "anti", rotationDirection: "ccw", startOrientation: "out", endOrientation: "in" } },
		],
	},

	"cave-fire-seq-fl": {
		word: "LFLF",
		steps: [
			{ letter: "α", startPosition: "alpha1", endPosition: "alpha1", stepNumber: 0,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "s", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "n", endLocation: "n", motionType: "static", rotationDirection: "noRotation", startOrientation: "in", endOrientation: "in" } },
			{ letter: "L", startPosition: "alpha1", endPosition: "beta3", stepNumber: 1,
				blueMotion: { color: "blue", startLocation: "s", endLocation: "e", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "n", endLocation: "e", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "F", startPosition: "beta3", endPosition: "alpha5", stepNumber: 2,
				blueMotion: { color: "blue", startLocation: "e", endLocation: "n", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "e", endLocation: "s", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "L", startPosition: "alpha5", endPosition: "beta7", stepNumber: 3,
				blueMotion: { color: "blue", startLocation: "n", endLocation: "w", motionType: "anti", rotationDirection: "cw", startOrientation: "in", endOrientation: "out" },
				redMotion: { color: "red", startLocation: "s", endLocation: "w", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
			{ letter: "F", startPosition: "beta7", endPosition: "alpha1", stepNumber: 4,
				blueMotion: { color: "blue", startLocation: "w", endLocation: "s", motionType: "anti", rotationDirection: "cw", startOrientation: "out", endOrientation: "in" },
				redMotion: { color: "red", startLocation: "w", endLocation: "n", motionType: "pro", rotationDirection: "cw", startOrientation: "in", endOrientation: "in" } },
		],
	},
};

// ── Public API ──

export interface MuseumSequenceData {
	word: string;
	steps: StepData[];
	startPosition: PictographData | null;
}

const GM = "diamond" as GridMode;

export const MUSEUM_EXHIBIT_SEQUENCES: Record<string, MuseumSequenceData> = Object.fromEntries(
	Object.entries(RAW).map(([id, raw]) => [id, convertRaw(raw, GM)])
);
