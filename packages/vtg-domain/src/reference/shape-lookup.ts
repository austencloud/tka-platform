/**
 * Shape Lookup
 *
 * Functions for retrieving VTG minimal beat shapes.
 */

import type { MinimalBeatShape } from "../data/shapes.js";
import { VTG_SHAPES } from "../data/shapes.js";

export function getVTGShape(id: string): MinimalBeatShape | undefined {
	const lower = id.toLowerCase();
	return VTG_SHAPES.find((s) => s.id.toLowerCase() === lower);
}

export function listVTGShapes(): MinimalBeatShape[] {
	return VTG_SHAPES;
}
