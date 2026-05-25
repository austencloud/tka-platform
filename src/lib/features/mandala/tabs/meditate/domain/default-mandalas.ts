import type { StepLike, MotionLike } from "$lib/shared/mandala/services/contracts/types";

export interface DefaultMandala {
	id: string;
	name: string;
	steps: StepLike[];
	variant: "blue" | "red" | "both";
	bluePropType: string;
	redPropType: string;
}

const LOCATIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

function loc(i: number): string {
	return LOCATIONS[((i % 8) + 8) % 8]!;
}

function makeMotion(
	motionType: string,
	rotDir: string,
	startLoc: string,
	endLoc: string,
	turns: number = 0,
): MotionLike {
	return {
		motionType,
		rotationDirection: rotDir,
		startLocation: startLoc,
		endLocation: endLoc,
		turns,
	};
}

function makeStep(blue: MotionLike, red: MotionLike): StepLike {
	return { motions: { blue, red } };
}

// Radial symmetry — both hands trace opposing arcs around all 8 cardinal/intercardinal points
const RADIAL_BLOOM: StepLike[] = Array.from({ length: 8 }, (_, i) => {
	return makeStep(
		makeMotion("pro", "cw", loc(i), loc(i + 1), 1),
		makeMotion("pro", "ccw", loc(i + 4), loc(i + 5), 1),
	);
});

// Spiral — hands chase each other with 2-position jumps
const SPIRAL_FLOW: StepLike[] = Array.from({ length: 8 }, (_, i) => {
	return makeStep(
		makeMotion("pro", "cw", loc(i), loc(i + 2), 1),
		makeMotion("anti", "ccw", loc(i + 3), loc(i + 5), 1),
	);
});

// Lotus — static holds at opposing points, creating petal-like symmetry
const LOTUS: StepLike[] = Array.from({ length: 8 }, (_, i) => {
	return makeStep(
		makeMotion("static", "no_rot", loc(i), loc(i), 0),
		makeMotion("static", "no_rot", loc(i + 4), loc(i + 4), 0),
	);
});

// Wave — alternating dash/pro creating flowing motion
const WAVE: StepLike[] = Array.from({ length: 8 }, (_, i) => {
	const type = i % 2 === 0 ? "dash" : "pro";
	const redType = i % 2 === 0 ? "pro" : "dash";
	return makeStep(
		makeMotion(type, "cw", loc(i), loc(i + 1), i % 2 === 0 ? 0 : 1),
		makeMotion(redType, "ccw", loc(i + 1), loc(i), i % 2 === 0 ? 1 : 0),
	);
});

// Star — sharp angular jumps creating star points
const STAR: StepLike[] = Array.from({ length: 8 }, (_, i) => {
	return makeStep(
		makeMotion("anti", "ccw", loc(i), loc(i + 3), 1),
		makeMotion("anti", "cw", loc(i + 1), loc(i + 6), 1),
	);
});

export const DEFAULT_MANDALAS: DefaultMandala[] = [
	{
		id: "default-radial-bloom",
		name: "Radial Bloom",
		steps: RADIAL_BLOOM,
		variant: "both",
		bluePropType: "staff",
		redPropType: "staff",
	},
	{
		id: "default-spiral-flow",
		name: "Spiral Flow",
		steps: SPIRAL_FLOW,
		variant: "both",
		bluePropType: "staff",
		redPropType: "staff",
	},
	{
		id: "default-lotus",
		name: "Lotus",
		steps: LOTUS,
		variant: "both",
		bluePropType: "staff",
		redPropType: "staff",
	},
	{
		id: "default-wave",
		name: "Wave",
		steps: WAVE,
		variant: "both",
		bluePropType: "staff",
		redPropType: "staff",
	},
	{
		id: "default-star",
		name: "Star",
		steps: STAR,
		variant: "both",
		bluePropType: "staff",
		redPropType: "staff",
	},
];
