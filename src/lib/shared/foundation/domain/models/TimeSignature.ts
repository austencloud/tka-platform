/**
 * Time signature support for musical duration calculations.
 *
 * Positions are expressed as decimals (e.g., 1.5, 6.75) rather than
 * musical notation suffixes (e.g., "1&", "1e").
 */

export interface TimeSignature {
	numerator: number; // steps per measure (4, 3, 6)
	denominator: number; // note value that gets one beat (4, 4, 8)
}

export const TIME_SIGNATURES = {
	'4/4': { numerator: 4, denominator: 4 },
	'3/4': { numerator: 3, denominator: 4 },
	'6/8': { numerator: 6, denominator: 8 }
} as const;

export type TimeSignatureKey = keyof typeof TIME_SIGNATURES;
export const DEFAULT_TIME_SIGNATURE: TimeSignatureKey = '4/4';

/**
 * Compound meters (6/8, 9/8, 12/8) group steps in threes
 * and use triplet subdivision.
 */
export function isCompoundMeter(ts: TimeSignature): boolean {
	return ts.denominator === 8 && ts.numerator % 3 === 0;
}

/**
 * Returns subdivisions per beat based on meter type.
 * - Simple meters (4/4, 3/4): 4 subdivisions (sixteenth notes)
 * - Compound meters (6/8): 3 subdivisions (triplets)
 */
export function getSubdivisionsPerBeat(ts: TimeSignature): number {
	return isCompoundMeter(ts) ? 3 : 4;
}

/**
 * Format a position as a decimal string.
 *
 * Examples with 4 subdivisions (4/4, 3/4):
 *   - beat 1, subdivision 0 → "1"
 *   - beat 1, subdivision 1 → "1.25"
 *   - beat 1, subdivision 2 → "1.5"
 *   - beat 1, subdivision 3 → "1.75"
 *   - beat 6, subdivision 3 → "6.75"
 *
 * Examples with 3 subdivisions (6/8):
 *   - beat 1, subdivision 0 → "1"
 *   - beat 1, subdivision 1 → "1.33"
 *   - beat 1, subdivision 2 → "1.67"
 */
export function formatStepPosition(
	stepNumber: number,
	subdivisionIndex: number,
	subdivisionsPerBeat: number
): string {
	if (subdivisionIndex === 0) {
		return String(stepNumber);
	}

	const fraction = subdivisionIndex / subdivisionsPerBeat;
	const decimal = stepNumber + fraction;

	// Format to avoid floating point weirdness
	// Use 2 decimal places, trim trailing zeros
	const formatted = decimal.toFixed(2).replace(/\.?0+$/, '');
	return formatted;
}

/**
 * Parse a decimal beat position back to beat number and subdivision.
 *
 * Examples:
 *   - "1" → { beat: 1, subdivision: 0 }
 *   - "1.5" → { beat: 1, subdivision: 2 } (for 4 subdivisions)
 *   - "6.75" → { beat: 6, subdivision: 3 } (for 4 subdivisions)
 */
export function parseStepPosition(
	position: string,
	subdivisionsPerBeat: number
): { beat: number; subdivision: number } {
	const decimal = parseFloat(position);
	const beat = Math.floor(decimal);
	const fraction = decimal - beat;

	// Round to nearest subdivision
	const subdivision = Math.round(fraction * subdivisionsPerBeat);

	return { beat, subdivision };
}
