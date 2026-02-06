/**
 * VTG Pictograph Data
 *
 * Default (first) variation for each Type 1 letter (A-V) in Diamond mode.
 * Sourced from DiamondPictographDataframe.csv — one representative variation per letter.
 *
 * Each entry has the motion data needed to render a real pictograph via PictographContainer.
 */

import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
	GridLocation,
	GridMode,
	GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
	MotionType,
	RotationDirection,
	Orientation,
	MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

/** Compact definition for a letter's default variation */
interface LetterDef {
	letter: Letter;
	startPos: GridPosition;
	endPos: GridPosition;
	blue: {
		motion: MotionType;
		rotation: RotationDirection;
		startLoc: GridLocation;
		endLoc: GridLocation;
		turns: number;
	};
	red: {
		motion: MotionType;
		rotation: RotationDirection;
		startLoc: GridLocation;
		endLoc: GridLocation;
		turns: number;
	};
}

// Shortcuts
const L = GridLocation;
const P = GridPosition;
const M = MotionType;
const R = RotationDirection;

/**
 * Default variation for each letter A-V (Diamond mode).
 * Data sourced from DiamondPictographDataframe.csv, first row per letter.
 */
const LETTER_DEFAULTS: LetterDef[] = [
	// SS — Split-Same (alpha→alpha)
	{
		letter: Letter.A, startPos: P.ALPHA3, endPos: P.ALPHA5,
		blue:  { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.WEST,  endLoc: L.NORTH, turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.B, startPos: P.ALPHA3, endPos: P.ALPHA5,
		blue:  { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.WEST,  endLoc: L.NORTH, turns: 1 },
		red:   { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.C, startPos: P.ALPHA3, endPos: P.ALPHA5,
		blue:  { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.WEST,  endLoc: L.NORTH, turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},

	// TO — Together-Opposite (beta→alpha)
	{
		letter: Letter.D, startPos: P.BETA3, endPos: P.ALPHA5,
		blue:  { motion: M.PRO,  rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.NORTH, turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.E, startPos: P.BETA3, endPos: P.ALPHA5,
		blue:  { motion: M.ANTI, rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.NORTH, turns: 1 },
		red:   { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.F, startPos: P.BETA3, endPos: P.ALPHA5,
		blue:  { motion: M.ANTI, rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.NORTH, turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},

	// TS — Together-Same (beta→beta)
	{
		letter: Letter.G, startPos: P.BETA3, endPos: P.BETA5,
		blue:  { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.H, startPos: P.BETA3, endPos: P.BETA5,
		blue:  { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
		red:   { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.I, startPos: P.BETA3, endPos: P.BETA5,
		blue:  { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},

	// SO — Split-Opposite (alpha→beta)
	{
		letter: Letter.J, startPos: P.ALPHA3, endPos: P.BETA5,
		blue:  { motion: M.PRO,  rotation: R.COUNTER_CLOCKWISE, startLoc: L.WEST,  endLoc: L.SOUTH, turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.K, startPos: P.ALPHA3, endPos: P.BETA5,
		blue:  { motion: M.ANTI, rotation: R.CLOCKWISE,         startLoc: L.WEST,  endLoc: L.SOUTH, turns: 1 },
		red:   { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.L, startPos: P.ALPHA3, endPos: P.BETA5,
		blue:  { motion: M.ANTI, rotation: R.CLOCKWISE,         startLoc: L.WEST,  endLoc: L.SOUTH, turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},

	// QO — Quarter-Opposite (gamma→gamma)
	{
		letter: Letter.M, startPos: P.GAMMA3, endPos: P.GAMMA13,
		blue:  { motion: M.PRO,  rotation: R.COUNTER_CLOCKWISE, startLoc: L.NORTH, endLoc: L.WEST,  turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.N, startPos: P.GAMMA3, endPos: P.GAMMA13,
		blue:  { motion: M.ANTI, rotation: R.CLOCKWISE,         startLoc: L.NORTH, endLoc: L.WEST,  turns: 1 },
		red:   { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.O, startPos: P.GAMMA3, endPos: P.GAMMA13,
		blue:  { motion: M.ANTI, rotation: R.CLOCKWISE,         startLoc: L.NORTH, endLoc: L.WEST,  turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.P, startPos: P.GAMMA11, endPos: P.GAMMA5,
		blue:  { motion: M.PRO,  rotation: R.COUNTER_CLOCKWISE, startLoc: L.SOUTH, endLoc: L.EAST,  turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.Q, startPos: P.GAMMA11, endPos: P.GAMMA5,
		blue:  { motion: M.ANTI, rotation: R.CLOCKWISE,         startLoc: L.SOUTH, endLoc: L.EAST,  turns: 1 },
		red:   { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.R, startPos: P.GAMMA11, endPos: P.GAMMA5,
		blue:  { motion: M.ANTI, rotation: R.CLOCKWISE,         startLoc: L.SOUTH, endLoc: L.EAST,  turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},

	// QS — Quarter-Same (gamma→gamma)
	{
		letter: Letter.S, startPos: P.GAMMA3, endPos: P.GAMMA5,
		blue:  { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.NORTH, endLoc: L.EAST,  turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.T, startPos: P.GAMMA3, endPos: P.GAMMA5,
		blue:  { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.NORTH, endLoc: L.EAST,  turns: 1 },
		red:   { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.U, startPos: P.GAMMA11, endPos: P.GAMMA13,
		blue:  { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.SOUTH, endLoc: L.WEST,  turns: 1 },
		red:   { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
	{
		letter: Letter.V, startPos: P.GAMMA11, endPos: P.GAMMA13,
		blue:  { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE, startLoc: L.SOUTH, endLoc: L.WEST,  turns: 1 },
		red:   { motion: M.PRO,  rotation: R.CLOCKWISE,         startLoc: L.EAST,  endLoc: L.SOUTH, turns: 1 },
	},
];

/**
 * Build PictographData from a LetterDef using the user's current prop types.
 */
function buildPictograph(def: LetterDef, bluePropType: PropType, redPropType: PropType): PictographData {
	const blueMotion = createMotionData({
		motionType: def.blue.motion,
		rotationDirection: def.blue.rotation,
		startLocation: def.blue.startLoc,
		endLocation: def.blue.endLoc,
		startOrientation: Orientation.IN,
		endOrientation: Orientation.IN,
		turns: def.blue.turns,
		color: MotionColor.BLUE,
		isVisible: true,
		propType: bluePropType,
		arrowLocation: def.blue.startLoc,
		gridMode: GridMode.DIAMOND,
	});

	const redMotion = createMotionData({
		motionType: def.red.motion,
		rotationDirection: def.red.rotation,
		startLocation: def.red.startLoc,
		endLocation: def.red.endLoc,
		startOrientation: Orientation.IN,
		endOrientation: Orientation.IN,
		turns: def.red.turns,
		color: MotionColor.RED,
		isVisible: true,
		propType: redPropType,
		arrowLocation: def.red.startLoc,
		gridMode: GridMode.DIAMOND,
	});

	return {
		id: `vtg-${def.letter}`,
		letter: def.letter,
		startPosition: def.startPos,
		endPosition: def.endPos,
		gridMode: GridMode.DIAMOND,
		motions: {
			[MotionColor.BLUE]: blueMotion,
			[MotionColor.RED]: redMotion,
		},
	};
}

/** Map of letter string → LetterDef for quick lookup */
const LETTER_DEF_MAP = new Map<string, LetterDef>(
	LETTER_DEFAULTS.map((def) => [def.letter as string, def])
);

/**
 * Get PictographData for a letter string (e.g. "A", "D", "M").
 * Returns null if the letter is not a Type 1 letter (A-V).
 */
export function getLetterPictograph(
	letterStr: string,
	bluePropType: PropType = PropType.STAFF,
	redPropType: PropType = PropType.STAFF,
): PictographData | null {
	const def = LETTER_DEF_MAP.get(letterStr);
	if (!def) return null;
	return buildPictograph(def, bluePropType, redPropType);
}
