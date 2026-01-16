/**
 * Musical Position Calculator
 *
 * Calculates the musical position of steps based on their durations.
 * Supports two display modes:
 * - Decimal mode: "1", "1.25", "1.5", "2", etc.
 * - Musician mode: "1", "1e", "1&", "1a", "2", etc.
 *
 * Supports configurable time signatures:
 * - Simple meters (4/4, 3/4): 4 subdivisions per beat
 * - Compound meters (6/8): 3 subdivisions per beat
 */

import type { StepData } from '../../domain/models/StepData';
import {
	TIME_SIGNATURES,
	getSubdivisionsPerBeat,
	type TimeSignature,
	type TimeSignatureKey,
	DEFAULT_TIME_SIGNATURE
} from '$lib/shared/foundation/domain/models/TimeSignature';

/** @deprecated Use getSubdivisionsPerBeat(timeSignature) instead */
export const SUBDIVISIONS_PER_BEAT = 4;

/**
 * Get the number of subdivisions per beat for a time signature
 */
export function getSubdivisions(timeSignature?: TimeSignatureKey): number {
	if (!timeSignature) {
		return 4; // Default to 4/4
	}
	const ts = TIME_SIGNATURES[timeSignature];
	return getSubdivisionsPerBeat(ts);
}

/**
 * Calculate the cumulative subdivision index for a beat
 * @param stepIndex - 0-based index in the steps array
 * @param steps - Array of beat data
 * @param timeSignature - Time signature key (e.g., "4/4", "6/8")
 * @returns The subdivision index where this beat starts (0-based)
 */
export function calculateSubdivisionIndex(
	stepIndex: number,
	steps: readonly StepData[],
	timeSignature?: TimeSignatureKey
): number {
	const subdivisions = getSubdivisions(timeSignature);
	let total = 0;
	for (let i = 0; i < stepIndex && i < steps.length; i++) {
		const duration = steps[i].duration ?? 1;
		total += duration * subdivisions;
	}
	return Math.round(total); // Round to handle floating point imprecision
}

/**
 * Format a subdivision index as a decimal position
 * @param subdivisionIndex - The subdivision index (0-based)
 * @param timeSignature - Time signature key (e.g., "4/4", "6/8")
 * @returns Formatted string like "1", "1.25", "1.5", "6.75", etc.
 */
export function formatPositionDecimal(
	subdivisionIndex: number,
	timeSignature?: TimeSignatureKey
): string {
	const subdivisions = getSubdivisions(timeSignature);
	const beat = Math.floor(subdivisionIndex / subdivisions) + 1;
	const subdivision = subdivisionIndex % subdivisions;

	if (subdivision === 0) {
		return beat.toString();
	}

	// Convert subdivision to decimal
	const fraction = subdivision / subdivisions;
	const decimal = beat + fraction;

	// Format to 2 decimal places, remove trailing zeros
	return decimal.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Format a subdivision index as musical notation
 * @param subdivisionIndex - The subdivision index (0-based)
 * @param timeSignature - Time signature key (e.g., "4/4", "6/8")
 * @returns Formatted string like "1", "1e", "1&", "1a", "2", etc.
 */
export function formatPositionNotation(
	subdivisionIndex: number,
	timeSignature?: TimeSignatureKey
): string {
	const subdivisions = getSubdivisions(timeSignature);
	const beat = Math.floor(subdivisionIndex / subdivisions) + 1;
	const subdivision = subdivisionIndex % subdivisions;

	// Notation suffixes depend on subdivision count
	// 4 subdivisions (simple meter): "", "e", "&", "a"
	// 3 subdivisions (compound meter): "", "&", "a"
	const suffixes = subdivisions === 3 ? ['', '&', 'a'] : ['', 'e', '&', 'a'];

	return `${beat}${suffixes[subdivision] ?? ''}`;
}

/**
 * Format a subdivision index based on the current mode
 * @param subdivisionIndex - The subdivision index (0-based)
 * @param musicianMode - Whether to use musician notation (true) or decimal (false)
 * @param timeSignature - Time signature key (e.g., "4/4", "6/8")
 * @returns Formatted position string
 */
export function formatPosition(
	subdivisionIndex: number,
	musicianMode: boolean,
	timeSignature?: TimeSignatureKey
): string {
	return musicianMode
		? formatPositionNotation(subdivisionIndex, timeSignature)
		: formatPositionDecimal(subdivisionIndex, timeSignature);
}

/**
 * Calculate all beat positions for a sequence
 * @param steps - Array of beat data
 * @param musicianMode - Whether to use musician notation
 * @param timeSignature - Time signature key (e.g., "4/4", "6/8")
 * @returns Array of formatted position strings, one per beat
 */
export function calculateAllPositions(
	steps: readonly StepData[],
	musicianMode: boolean,
	timeSignature?: TimeSignatureKey
): string[] {
	return steps.map((_, index) => {
		const subdivisionIndex = calculateSubdivisionIndex(index, steps, timeSignature);
		return formatPosition(subdivisionIndex, musicianMode, timeSignature);
	});
}
