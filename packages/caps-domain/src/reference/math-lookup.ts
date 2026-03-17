/**
 * Math Lookup
 *
 * Functions for retrieving CAP mathematical constructs:
 * elementary pattern formulas, assembly notation, and feasibility rules.
 */

import type {
	ElementaryPatternNotation,
	CAPAssembly,
	CAPFeasibilityRule,
} from "../data/mathematics.js";
import { CAP_MATH_MODEL } from "../data/mathematics.js";

/** Get an elementary pattern formula by ID */
export function getCAPFormula(id: string): ElementaryPatternNotation | undefined {
	return CAP_MATH_MODEL.elementaryPatterns.find((p) => p.id === id);
}

/** Get a CAP assembly by ID */
export function getCAPAssembly(id: string): CAPAssembly | undefined {
	return CAP_MATH_MODEL.assemblies.find((a) => a.id === id);
}

/** List all feasibility rules */
export function listCAPFeasibilityRules(): CAPFeasibilityRule[] {
	return [...CAP_MATH_MODEL.feasibilityRules];
}
