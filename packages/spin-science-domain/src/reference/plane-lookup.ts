/**
 * Plane Lookup
 *
 * Functions for querying the 3 Planes System.
 */

import type { PlaneDefinition } from "../data/three-planes.js";
import { PLANES } from "../data/three-planes.js";

export function getPlane(id: string): PlaneDefinition | undefined {
	// TODO: Implement lookup once plane data is populated
	return PLANES.find((p) => p.id === id);
}

export function getPlaneByAbbreviation(
	abbreviation: string,
): PlaneDefinition | undefined {
	return PLANES.find((p) => p.abbreviation === abbreviation);
}

export function listPlanes(): PlaneDefinition[] {
	return PLANES;
}
