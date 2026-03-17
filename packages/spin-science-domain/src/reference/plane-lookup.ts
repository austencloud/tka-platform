/**
 * Plane Lookup
 *
 * Functions for querying the 3 Planes System.
 */

import type { PlaneDefinition } from "../data/three-planes.js";
import { PLANES } from "../data/three-planes.js";

/** Get a plane by ID ("wall", "wheel", or "floor") */
export function getPlane(id: string): PlaneDefinition | undefined {
	// TODO: Implement lookup once plane data is populated
	return PLANES.find((p) => p.id === id);
}

/** Get a plane by its single-letter abbreviation ("W", "H", or "F") */
export function getPlaneByAbbreviation(
	abbreviation: string,
): PlaneDefinition | undefined {
	return PLANES.find((p) => p.abbreviation === abbreviation);
}

/** List all three planes */
export function listPlanes(): PlaneDefinition[] {
	return PLANES;
}
