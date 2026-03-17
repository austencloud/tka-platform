/**
 * Shape Lookup
 *
 * Functions for retrieving VTG minimal beat shapes.
 */

import type { MinimalBeatShape } from "../data/shapes.js";
import { VTG_SHAPES } from "../data/shapes.js";

/** Get a single shape by ID (case-insensitive) */
export function getVTGShape(id: string): MinimalBeatShape | undefined {
	const lower = id.toLowerCase();
	return VTG_SHAPES.find((s) => s.id.toLowerCase() === lower);
}

/** List all minimal beat shapes */
export function listVTGShapes(): MinimalBeatShape[] {
	return VTG_SHAPES;
}
