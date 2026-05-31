/**
 * VTG Sequence Data
 *
 * Defines 4-step cycle chains for all VTG modes.
 * Each chain represents one complete VTG pattern that can be
 * rendered as a horizontal strip of pictographs.
 *
 * Hand paths are derived from the CSV (DiamondPictographDataframe.csv)
 * and verified against all 22 Type 1 letters. The core insight:
 * within a single chain, both hands rotate around the grid at 90°
 * per beat - only the motion type and rotation direction differ
 * between letters.
 */

import { Letter } from "$lib/shared/foundation/domain/models/letter";
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
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { VTGMode } from "$lib/features/learn/domain/constants/vtg-experience-data";
import type { RotationStyle } from "./vtg-lab-types";

// Shortcuts
const L = GridLocation;
const P = GridPosition;
const M = MotionType;
const R = RotationDirection;

type FivePoints = [GridLocation, GridLocation, GridLocation, GridLocation, GridLocation];

/** Compact chain definition for a 4-step VTG cycle */
export interface ChainDef {
	/** Display label (letter or compound name) */
	label: string;
	/** Compound mnemonic (e.g. "Disco Jam") */
	mnemonic?: string;
	/** Rotation style for UI badges */
	rotationStyle: RotationStyle;
	/** Letters in the cycle - 1 for same-position, 2 for compounds (alternating) */
	letters: [Letter] | [Letter, Letter];
	/** Blue hand motion properties (constant across all 4 beats) */
	blue: { motion: MotionType; rotation: RotationDirection };
	/** Red hand motion properties (constant across all 4 beats) */
	red: { motion: MotionType; rotation: RotationDirection };
	/** 5 blue hand waypoints defining 4 beats (beat N: bluePath[N] → bluePath[N+1]) */
	bluePath: FivePoints;
	/** 5 red hand waypoints defining 4 beats */
	redPath: FivePoints;
}

/**
 * Map (blue location, red location) → GridPosition.
 * Derived from the Diamond mode grid geometry.
 */
const LOCATION_TO_POSITION: Record<string, GridPosition> = {
	// Alpha - hands at opposite points
	[`${L.SOUTH},${L.NORTH}`]: P.ALPHA1,
	[`${L.WEST},${L.EAST}`]: P.ALPHA3,
	[`${L.NORTH},${L.SOUTH}`]: P.ALPHA5,
	[`${L.EAST},${L.WEST}`]: P.ALPHA7,
	// Beta - hands at the same point
	[`${L.NORTH},${L.NORTH}`]: P.BETA1,
	[`${L.EAST},${L.EAST}`]: P.BETA3,
	[`${L.SOUTH},${L.SOUTH}`]: P.BETA5,
	[`${L.WEST},${L.WEST}`]: P.BETA7,
	// Gamma set 1 - blue one step CCW of red (90° apart)
	[`${L.WEST},${L.NORTH}`]: P.GAMMA1,
	[`${L.NORTH},${L.EAST}`]: P.GAMMA3,
	[`${L.EAST},${L.SOUTH}`]: P.GAMMA5,
	[`${L.SOUTH},${L.WEST}`]: P.GAMMA7,
	// Gamma set 2 - blue one step CW of red (90° apart, other chirality)
	[`${L.EAST},${L.NORTH}`]: P.GAMMA9,
	[`${L.SOUTH},${L.EAST}`]: P.GAMMA11,
	[`${L.WEST},${L.SOUTH}`]: P.GAMMA13,
	[`${L.NORTH},${L.WEST}`]: P.GAMMA15,
};

function positionAt(blueLoc: GridLocation, redLoc: GridLocation): GridPosition {
	const key = `${blueLoc},${redLoc}`;
	const pos = LOCATION_TO_POSITION[key];
	if (!pos) throw new Error(`No position for blue=${blueLoc}, red=${redLoc}`);
	return pos;
}

// ─── Shared hand paths ────────────────────────────────────────────────
// Hand paths are the same within a mode - only motion type/rotation differ.

// SS: Blue shifts CCW, Red shifts CW (alpha → alpha)
const SS_BLUE: FivePoints = [L.WEST, L.NORTH, L.EAST, L.SOUTH, L.WEST];
const SS_RED: FivePoints = [L.EAST, L.SOUTH, L.WEST, L.NORTH, L.EAST];

// TS: Both hands shift CW together (beta → beta)
const TS_BLUE: FivePoints = [L.EAST, L.SOUTH, L.WEST, L.NORTH, L.EAST];
const TS_RED: FivePoints = [L.EAST, L.SOUTH, L.WEST, L.NORTH, L.EAST];

// TO: Blue CCW, Red CW - entering from β (β→α→β→α)
const TO_BLUE: FivePoints = [L.EAST, L.NORTH, L.WEST, L.SOUTH, L.EAST];
const TO_RED: FivePoints = [L.EAST, L.SOUTH, L.WEST, L.NORTH, L.EAST];

// SO: Same compound cycle as TO, entering from α (α→β→α→β)
const SO_BLUE: FivePoints = [L.NORTH, L.WEST, L.SOUTH, L.EAST, L.NORTH];
const SO_RED: FivePoints = [L.SOUTH, L.WEST, L.NORTH, L.EAST, L.SOUTH];

// QS set 1: Both CW (γ3→γ5→γ7→γ1)
const QS1_BLUE: FivePoints = [L.NORTH, L.EAST, L.SOUTH, L.WEST, L.NORTH];
const QS1_RED: FivePoints = [L.EAST, L.SOUTH, L.WEST, L.NORTH, L.EAST];

// QS set 2: Both CW (γ11→γ13→γ15→γ9)
const QS2_BLUE: FivePoints = [L.SOUTH, L.WEST, L.NORTH, L.EAST, L.SOUTH];
const QS2_RED: FivePoints = [L.EAST, L.SOUTH, L.WEST, L.NORTH, L.EAST];

// QO: Blue CCW, Red CW - cross-set compound (γ3→γ13→γ7→γ9)
const QO_BLUE: FivePoints = [L.NORTH, L.WEST, L.SOUTH, L.EAST, L.NORTH];
const QO_RED: FivePoints = [L.EAST, L.SOUTH, L.WEST, L.NORTH, L.EAST];

// ─── Chain definitions per mode ───────────────────────────────────────

const SS_CHAINS: ChainDef[] = [
	{
		label: "A", rotationStyle: "pro/pro", letters: [Letter.A],
		blue: { motion: M.PRO, rotation: R.CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: SS_BLUE, redPath: SS_RED,
	},
	{
		label: "B", rotationStyle: "anti/anti", letters: [Letter.B],
		blue: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		bluePath: SS_BLUE, redPath: SS_RED,
	},
	{
		label: "C", rotationStyle: "hybrid", letters: [Letter.C],
		blue: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: SS_BLUE, redPath: SS_RED,
	},
];

const TS_CHAINS: ChainDef[] = [
	{
		label: "G", rotationStyle: "pro/pro", letters: [Letter.G],
		blue: { motion: M.PRO, rotation: R.CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: TS_BLUE, redPath: TS_RED,
	},
	{
		label: "H", rotationStyle: "anti/anti", letters: [Letter.H],
		blue: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		bluePath: TS_BLUE, redPath: TS_RED,
	},
	{
		label: "I", rotationStyle: "hybrid", letters: [Letter.I],
		blue: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: TS_BLUE, redPath: TS_RED,
	},
];

const TO_CHAINS: ChainDef[] = [
	{
		label: "DJ", mnemonic: "Disco Jam", rotationStyle: "pro/pro",
		letters: [Letter.D, Letter.J],
		blue: { motion: M.PRO, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: TO_BLUE, redPath: TO_RED,
	},
	{
		label: "EK", mnemonic: "Exploding Kitten", rotationStyle: "anti/anti",
		letters: [Letter.E, Letter.K],
		blue: { motion: M.ANTI, rotation: R.CLOCKWISE },
		red: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		bluePath: TO_BLUE, redPath: TO_RED,
	},
	{
		label: "FL", mnemonic: "Fruity Loops", rotationStyle: "hybrid",
		letters: [Letter.F, Letter.L],
		blue: { motion: M.ANTI, rotation: R.CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: TO_BLUE, redPath: TO_RED,
	},
];

const SO_CHAINS: ChainDef[] = [
	{
		label: "JD", mnemonic: "Disco Jam", rotationStyle: "pro/pro",
		letters: [Letter.J, Letter.D],
		blue: { motion: M.PRO, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: SO_BLUE, redPath: SO_RED,
	},
	{
		label: "KE", mnemonic: "Exploding Kitten", rotationStyle: "anti/anti",
		letters: [Letter.K, Letter.E],
		blue: { motion: M.ANTI, rotation: R.CLOCKWISE },
		red: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		bluePath: SO_BLUE, redPath: SO_RED,
	},
	{
		label: "LF", mnemonic: "Fruity Loops", rotationStyle: "hybrid",
		letters: [Letter.L, Letter.F],
		blue: { motion: M.ANTI, rotation: R.CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: SO_BLUE, redPath: SO_RED,
	},
];

const QS_CHAINS: ChainDef[] = [
	{
		label: "S", rotationStyle: "pro/pro", letters: [Letter.S],
		blue: { motion: M.PRO, rotation: R.CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: QS1_BLUE, redPath: QS1_RED,
	},
	{
		label: "T", rotationStyle: "anti/anti", letters: [Letter.T],
		blue: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		bluePath: QS1_BLUE, redPath: QS1_RED,
	},
	{
		label: "U", rotationStyle: "hybrid", letters: [Letter.U],
		blue: { motion: M.PRO, rotation: R.CLOCKWISE },
		red: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		bluePath: QS2_BLUE, redPath: QS2_RED,
	},
	{
		label: "V", rotationStyle: "hybrid", letters: [Letter.V],
		blue: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: QS2_BLUE, redPath: QS2_RED,
	},
];

const QO_CHAINS: ChainDef[] = [
	{
		label: "MP", mnemonic: "Magic Potion", rotationStyle: "pro/pro",
		letters: [Letter.M, Letter.P],
		blue: { motion: M.PRO, rotation: R.COUNTER_CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: QO_BLUE, redPath: QO_RED,
	},
	{
		label: "NQ", mnemonic: "Never Quit", rotationStyle: "anti/anti",
		letters: [Letter.N, Letter.Q],
		blue: { motion: M.ANTI, rotation: R.CLOCKWISE },
		red: { motion: M.ANTI, rotation: R.COUNTER_CLOCKWISE },
		bluePath: QO_BLUE, redPath: QO_RED,
	},
	{
		label: "OR", mnemonic: "Open Road", rotationStyle: "hybrid",
		letters: [Letter.O, Letter.R],
		blue: { motion: M.ANTI, rotation: R.CLOCKWISE },
		red: { motion: M.PRO, rotation: R.CLOCKWISE },
		bluePath: QO_BLUE, redPath: QO_RED,
	},
];

const MODE_CHAINS: Record<string, ChainDef[]> = {
	SS: SS_CHAINS,
	TS: TS_CHAINS,
	TO: TO_CHAINS,
	SO: SO_CHAINS,
	QS: QS_CHAINS,
	QO: QO_CHAINS,
};

/** Get the 4-step cycle chains for a VTG mode */
export function getModeChains(mode: VTGMode): ChainDef[] {
	return MODE_CHAINS[mode] ?? [];
}

/** Expand a compact chain definition into 4 renderable PictographData objects */
export function expandChain(
	chain: ChainDef,
	bluePropType: PropType = PropType.STAFF,
	redPropType: PropType = PropType.STAFF,
): PictographData[] {
	return [0, 1, 2, 3].map((i) => {
		const letter = chain.letters.length === 1
			? chain.letters[0]
			: chain.letters[i % 2];

		const blueStart = chain.bluePath[i]!;
		const blueEnd = chain.bluePath[i + 1]!;
		const redStart = chain.redPath[i]!;
		const redEnd = chain.redPath[i + 1]!;

		const startPos = positionAt(blueStart, redStart);
		const endPos = positionAt(blueEnd, redEnd);

		const blueMotion = createMotionData({
			motionType: chain.blue.motion,
			rotationDirection: chain.blue.rotation,
			startLocation: blueStart,
			endLocation: blueEnd,
			startOrientation: Orientation.IN,
			endOrientation: Orientation.IN,
			turns: 1,
			color: MotionColor.BLUE,
			isVisible: true,
			propType: bluePropType,
			arrowLocation: blueStart,
			gridMode: GridMode.DIAMOND,
		});

		const redMotion = createMotionData({
			motionType: chain.red.motion,
			rotationDirection: chain.red.rotation,
			startLocation: redStart,
			endLocation: redEnd,
			startOrientation: Orientation.IN,
			endOrientation: Orientation.IN,
			turns: 1,
			color: MotionColor.RED,
			isVisible: true,
			propType: redPropType,
			arrowLocation: redStart,
			gridMode: GridMode.DIAMOND,
		});

		return {
			id: `vtg-${chain.label}-beat${i + 1}`,
			letter,
			startPosition: startPos,
			endPosition: endPos,
			gridMode: GridMode.DIAMOND,
			motions: {
				[MotionColor.BLUE]: blueMotion,
				[MotionColor.RED]: redMotion,
			},
		};
	});
}
