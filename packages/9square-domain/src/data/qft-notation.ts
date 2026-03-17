/**
 * QFT (Quantized Field Theory) Notation
 *
 * Written shorthand by Charlie Cushing. Breaks continuous poi motion into
 * 8 discrete positions numbered 1-8 clockwise (1=up-right through 8=up).
 *
 * Tracks per increment:
 * - Poi departure and arrival positions (1-8)
 * - Poi direction at each point
 * - Hand departure and arrival positions
 * - Hand path radius (in poi-length units)
 *
 * Full formula: a,b(h(+/-x+/-y+/-z)h'){Class}a',b'
 *
 * Can describe any poi pattern: static spin, extensions, flowers,
 * isolations, cateyes, triquetras, CAPs.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** One of the 8 discrete positions in the QFT clock (1-8, clockwise from up-right) */
export type QFTPositionNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** A single QFT position with its spatial meaning */
export interface QFTPosition {
	/** Position number (1-8) */
	number: QFTPositionNumber;
	/** Spatial description (e.g., "up-right", "right", "down-right") */
	spatialLabel: string;
	/** Angle in degrees from top, clockwise */
	angleDegrees: number;
	/** Where this position definition comes from */
	source: SourcedClaim;
}

/** Direction of poi rotation at a given point */
export type QFTDirection = "clockwise" | "counterclockwise";

/** A single increment in QFT notation tracking poi and hand movement */
export interface QFTIncrement {
	/** Poi departure position */
	poiDeparture: QFTPositionNumber;
	/** Poi arrival position */
	poiArrival: QFTPositionNumber;
	/** Poi direction at this point */
	poiDirection: QFTDirection;
	/** Hand departure position */
	handDeparture: QFTPositionNumber;
	/** Hand arrival position */
	handArrival: QFTPositionNumber;
	/** Hand path radius in poi-length units */
	handRadius: number;
}

/**
 * A complete QFT formula: a,b(h(+/-x+/-y+/-z)h'){Class}a',b'
 *
 * - a,b: poi departure/arrival
 * - h,h': hand departure/arrival
 * - (+/-x+/-y+/-z): hand path vector
 * - {Class}: pattern classification
 * - a',b': poi end state
 */
export interface QFTFormula {
	/** Unique identifier */
	id: string;
	/** The raw formula string */
	formula: string;
	/** Human-readable name of the pattern this formula describes */
	patternName: string;
	/** The increments that make up this formula */
	increments: QFTIncrement[];
	/** Pattern classification (e.g., "extension", "antispin", "isolation") */
	patternClass: string;
	/** Plain-language description of what this formula represents */
	description: string;
	/** Where this formula comes from */
	source: SourcedClaim;
}

// TODO: Populate the 8 QFT positions from Charlie Cushing's notation
export const QFT_POSITIONS: QFTPosition[] = [];

// TODO: Populate with example QFT formulas for common patterns
export const QFT_FORMULAS: QFTFormula[] = [];
