/**
 * Mock pictograph data for the retro renderer
 *
 * Maps uppercase letters to simplified RetroPictographData. Each letter
 * gets a deterministic grid configuration that looks plausible on the
 * diamond grid. Not accurate TKA — this is the Bellweather Institute's
 * best approximation circa 1995.
 *
 * Domain: Retro SCRIBE App
 */

import type {
	RetroPictographData,
	RetroGridLocation,
	RetroMotionType,
	RetroOrientation,
} from "../../services/contracts/IPixelRenderer";

/**
 * Position pairs for deterministic letter layouts.
 * Each pair is [blueLocation, redLocation].
 * Cycles through visually distinct positions.
 */
const POSITION_PAIRS: [RetroGridLocation, RetroGridLocation][] = [
	["n", "s"], // opposite cardinal — alpha-like
	["n", "n"], // same cardinal — beta-like
	["n", "e"], // adjacent cardinal — gamma-like
	["e", "w"], // opposite cardinal
	["e", "e"], // same cardinal
	["s", "w"], // adjacent cardinal
	["s", "s"], // same cardinal
	["w", "n"], // adjacent cardinal
	["n", "w"], // adjacent cardinal
	["e", "s"], // adjacent cardinal
	["ne", "sw"], // opposite intercardinal
	["ne", "ne"], // same intercardinal
	["se", "nw"], // opposite intercardinal
	["nw", "se"], // opposite intercardinal (reverse)
	["n", "se"], // cardinal + intercardinal mix
	["s", "ne"], // cardinal + intercardinal mix
	["e", "nw"], // cardinal + intercardinal mix
	["w", "se"], // cardinal + intercardinal mix
	["ne", "s"], // intercardinal + cardinal mix
	["sw", "n"], // intercardinal + cardinal mix
	["nw", "e"], // intercardinal + cardinal mix
	["se", "w"], // intercardinal + cardinal mix
	["n", "sw"], // cardinal + intercardinal
	["e", "ne"], // adjacent
	["s", "nw"], // cardinal + intercardinal
	["w", "sw"], // adjacent
];

const MOTION_TYPES: RetroMotionType[] = ["pro", "anti", "dash", "static"];

const ORIENTATIONS: RetroOrientation[] = ["in", "out", "clock", "counter"];

/**
 * End locations for motion arrows. Shifts the start by one position
 * clockwise for pro, counter-clockwise for anti, opposite for dash.
 */
const CW_SHIFT: Record<RetroGridLocation, RetroGridLocation> = {
	n: "ne",
	ne: "e",
	e: "se",
	se: "s",
	s: "sw",
	sw: "w",
	w: "nw",
	nw: "n",
	c: "c",
};

const CCW_SHIFT: Record<RetroGridLocation, RetroGridLocation> = {
	n: "nw",
	nw: "w",
	w: "sw",
	sw: "s",
	s: "se",
	se: "e",
	e: "ne",
	ne: "n",
	c: "c",
};

const OPPOSITE: Record<RetroGridLocation, RetroGridLocation> = {
	n: "s",
	s: "n",
	e: "w",
	w: "e",
	ne: "sw",
	sw: "ne",
	nw: "se",
	se: "nw",
	c: "c",
};

function getEndLocation(
	start: RetroGridLocation,
	motion: RetroMotionType,
): RetroGridLocation {
	switch (motion) {
		case "pro":
			return CW_SHIFT[start];
		case "anti":
			return CCW_SHIFT[start];
		case "dash":
			return OPPOSITE[start];
		case "static":
			return start;
	}
}

/**
 * Generate mock pictograph data for a given letter.
 * Uses the letter's char code to deterministically pick positions,
 * motion types, and orientations.
 */
export function createMockPictographData(
	letter: string,
): RetroPictographData {
	const upper = letter.toUpperCase();
	const code = upper.charCodeAt(0) - 65; // A=0, B=1, ...Z=25
	const idx = Math.abs(code) % POSITION_PAIRS.length;
	const pair = POSITION_PAIRS[idx]!;

	const blueMotion = MOTION_TYPES[code % MOTION_TYPES.length]!;
	const redMotion = MOTION_TYPES[(code + 1) % MOTION_TYPES.length]!;

	const blueOrientation = ORIENTATIONS[code % ORIENTATIONS.length]!;
	const redOrientation = ORIENTATIONS[(code + 2) % ORIENTATIONS.length]!;

	const blueTurns = (code % 4) * 0.5; // 0, 0.5, 1, 1.5
	const redTurns = ((code + 1) % 4) * 0.5;

	// Use box mode for letters that naturally use intercardinal positions
	const needsBox =
		!isCardinal(pair[0]) && !isCardinal(pair[1]);

	return {
		letter: upper,
		gridMode: needsBox ? "box" : "diamond",
		blueHand: {
			color: "blue",
			location: pair[0],
			orientation: blueOrientation,
			motionType: blueMotion,
			endLocation: getEndLocation(pair[0], blueMotion),
			turns: blueTurns,
		},
		redHand: {
			color: "red",
			location: pair[1],
			orientation: redOrientation,
			motionType: redMotion,
			endLocation: getEndLocation(pair[1], redMotion),
			turns: redTurns,
		},
	};
}

function isCardinal(loc: RetroGridLocation): boolean {
	return loc === "n" || loc === "e" || loc === "s" || loc === "w";
}
