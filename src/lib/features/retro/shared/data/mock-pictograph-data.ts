/**
 * Mock pictograph data for the retro renderer
 *
 * Maps uppercase letters to simplified RetroPictographData. Each letter
 * gets a deterministic grid configuration that looks plausible on the
 * diamond grid. Not accurate TKA - this is the Bellweather Institute's
 * best approximation circa 1995.
 *
 * Domain: Retro SCRIBE App
 */

import type { RetroPictographData } from "../domain/pictograph-types";
import {
	GridLocation,
	GridMode,
	MotionType,
	HandSide,
	Orientation,
	RotationDirection,
} from "../domain/pictograph-types";

/**
 * Position pairs for deterministic letter layouts.
 * Each pair is [blueLocation, redLocation].
 * Cycles through visually distinct positions.
 */
const POSITION_PAIRS: [GridLocation, GridLocation][] = [
	[GridLocation.NORTH, GridLocation.SOUTH], // opposite cardinal - alpha-like
	[GridLocation.NORTH, GridLocation.NORTH], // same cardinal - beta-like
	[GridLocation.NORTH, GridLocation.EAST], // adjacent cardinal - gamma-like
	[GridLocation.EAST, GridLocation.WEST], // opposite cardinal
	[GridLocation.EAST, GridLocation.EAST], // same cardinal
	[GridLocation.SOUTH, GridLocation.WEST], // adjacent cardinal
	[GridLocation.SOUTH, GridLocation.SOUTH], // same cardinal
	[GridLocation.WEST, GridLocation.NORTH], // adjacent cardinal
	[GridLocation.NORTH, GridLocation.WEST], // adjacent cardinal
	[GridLocation.EAST, GridLocation.SOUTH], // adjacent cardinal
	[GridLocation.NORTHEAST, GridLocation.SOUTHWEST], // opposite intercardinal
	[GridLocation.NORTHEAST, GridLocation.NORTHEAST], // same intercardinal
	[GridLocation.SOUTHEAST, GridLocation.NORTHWEST], // opposite intercardinal
	[GridLocation.NORTHWEST, GridLocation.SOUTHEAST], // opposite intercardinal (reverse)
	[GridLocation.NORTH, GridLocation.SOUTHEAST], // cardinal + intercardinal mix
	[GridLocation.SOUTH, GridLocation.NORTHEAST], // cardinal + intercardinal mix
	[GridLocation.EAST, GridLocation.NORTHWEST], // cardinal + intercardinal mix
	[GridLocation.WEST, GridLocation.SOUTHEAST], // cardinal + intercardinal mix
	[GridLocation.NORTHEAST, GridLocation.SOUTH], // intercardinal + cardinal mix
	[GridLocation.SOUTHWEST, GridLocation.NORTH], // intercardinal + cardinal mix
	[GridLocation.NORTHWEST, GridLocation.EAST], // intercardinal + cardinal mix
	[GridLocation.SOUTHEAST, GridLocation.WEST], // intercardinal + cardinal mix
	[GridLocation.NORTH, GridLocation.SOUTHWEST], // cardinal + intercardinal
	[GridLocation.EAST, GridLocation.NORTHEAST], // adjacent
	[GridLocation.SOUTH, GridLocation.NORTHWEST], // cardinal + intercardinal
	[GridLocation.WEST, GridLocation.SOUTHWEST], // adjacent
];

const MOTION_TYPES: MotionType[] = [
	MotionType.PRO,
	MotionType.ANTI,
	MotionType.DASH,
	MotionType.STATIC,
];

const ORIENTATIONS: Orientation[] = [
	Orientation.IN,
	Orientation.OUT,
	Orientation.CLOCK,
	Orientation.COUNTER,
];

/**
 * End locations for motion arrows. Shifts the start by one position
 * clockwise for pro, counter-clockwise for anti, opposite for dash.
 */
const CW_SHIFT: Record<GridLocation, GridLocation> = {
	[GridLocation.NORTH]: GridLocation.NORTHEAST,
	[GridLocation.NORTHEAST]: GridLocation.EAST,
	[GridLocation.EAST]: GridLocation.SOUTHEAST,
	[GridLocation.SOUTHEAST]: GridLocation.SOUTH,
	[GridLocation.SOUTH]: GridLocation.SOUTHWEST,
	[GridLocation.SOUTHWEST]: GridLocation.WEST,
	[GridLocation.WEST]: GridLocation.NORTHWEST,
	[GridLocation.NORTHWEST]: GridLocation.NORTH,
	[GridLocation.CENTER]: GridLocation.CENTER,
};

const CCW_SHIFT: Record<GridLocation, GridLocation> = {
	[GridLocation.NORTH]: GridLocation.NORTHWEST,
	[GridLocation.NORTHWEST]: GridLocation.WEST,
	[GridLocation.WEST]: GridLocation.SOUTHWEST,
	[GridLocation.SOUTHWEST]: GridLocation.SOUTH,
	[GridLocation.SOUTH]: GridLocation.SOUTHEAST,
	[GridLocation.SOUTHEAST]: GridLocation.EAST,
	[GridLocation.EAST]: GridLocation.NORTHEAST,
	[GridLocation.NORTHEAST]: GridLocation.NORTH,
	[GridLocation.CENTER]: GridLocation.CENTER,
};

const OPPOSITE: Record<GridLocation, GridLocation> = {
	[GridLocation.NORTH]: GridLocation.SOUTH,
	[GridLocation.SOUTH]: GridLocation.NORTH,
	[GridLocation.EAST]: GridLocation.WEST,
	[GridLocation.WEST]: GridLocation.EAST,
	[GridLocation.NORTHEAST]: GridLocation.SOUTHWEST,
	[GridLocation.SOUTHWEST]: GridLocation.NORTHEAST,
	[GridLocation.NORTHWEST]: GridLocation.SOUTHEAST,
	[GridLocation.SOUTHEAST]: GridLocation.NORTHWEST,
	[GridLocation.CENTER]: GridLocation.CENTER,
};

function getEndLocation(
	start: GridLocation,
	motion: MotionType,
): GridLocation {
	switch (motion) {
		case MotionType.PRO:
			return CW_SHIFT[start];
		case MotionType.ANTI:
			return CCW_SHIFT[start];
		case MotionType.DASH:
			return OPPOSITE[start];
		case MotionType.STATIC:
		case MotionType.FLOAT:
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

	const leftMotion = MOTION_TYPES[code % MOTION_TYPES.length]!;
	const rightMotion = MOTION_TYPES[(code + 1) % MOTION_TYPES.length]!;

	const leftOrientation = ORIENTATIONS[code % ORIENTATIONS.length]!;
	const rightOrientation = ORIENTATIONS[(code + 2) % ORIENTATIONS.length]!;

	const leftTurns = (code % 4) * 0.5; // 0, 0.5, 1, 1.5
	const rightTurns = ((code + 1) % 4) * 0.5;

	// Use box mode for letters that naturally use intercardinal positions
	const needsBox =
		!isCardinal(pair[0]) && !isCardinal(pair[1]);

	return {
		letter: upper,
		gridMode: needsBox ? GridMode.BOX : GridMode.DIAMOND,
		leftHand: {
			color: HandSide.LEFT,
			location: pair[0],
			orientation: leftOrientation,
			motionType: leftMotion,
			endLocation: getEndLocation(pair[0], leftMotion),
			turns: leftTurns,
			rotationDirection: RotationDirection.NO_ROTATION,
		},
		rightHand: {
			color: HandSide.RIGHT,
			location: pair[1],
			orientation: rightOrientation,
			motionType: rightMotion,
			endLocation: getEndLocation(pair[1], rightMotion),
			turns: rightTurns,
			rotationDirection: RotationDirection.NO_ROTATION,
		},
	};
}

function isCardinal(loc: GridLocation): boolean {
	return (
		loc === GridLocation.NORTH ||
		loc === GridLocation.EAST ||
		loc === GridLocation.SOUTH ||
		loc === GridLocation.WEST
	);
}
