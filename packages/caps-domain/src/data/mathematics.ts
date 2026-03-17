/**
 * CAP Mathematics
 *
 * Zaltymbunk (Damien) created the formal mathematical framework for describing
 * CAPs. This includes elementary pattern notation using theta/rho parameters,
 * pattern classification (rosettes, cycloids), assembly notation for combining
 * patterns, feasibility rules, and the trigonometric model that maps all poi
 * patterns to parametric equations.
 *
 * The trigonometric model is genuinely generative: plug in untried parameter
 * values and you discover new patterns.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** Elementary pattern notation: Theta1 Theta2 ; Rho1 Rho2 ; d */
export interface ElementaryPatternNotation {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Harmonic frequency 1 (rotation count) */
	theta1: number;
	/** Harmonic frequency 2 (rotation count) */
	theta2: number;
	/** Modulus component 1 (radius/length) */
	rho1: number;
	/** Modulus component 2 (radius/length) */
	rho2: number;
	/** Division factor: fraction of full cycle used (0 < d <= 1) */
	d: number;
	/** Pattern classification */
	patternType: CAPPatternType;
	/** Where this notation comes from */
	source: SourcedClaim;
}

export type CAPPatternType = "rosette" | "cycloid" | "other";

/** CAP assembly: Pattern A ; d1 & Pattern B ; d2 */
export interface CAPAssembly {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** The notation string, e.g. "1 0 ; 1 3/4 ; 1/2 & -1 4 ; 1 3/4 ; 1/2" */
	notation: string;
	/** First pattern in the assembly */
	patternA: string;
	/** Division factor for pattern A */
	d1: number;
	/** Second pattern in the assembly */
	patternB: string;
	/** Division factor for pattern B */
	d2: number;
	/** Plain-language description */
	description: string;
	/** Where this assembly comes from */
	source: SourcedClaim;
}

/** Feasibility rules for CAP construction */
export interface CAPFeasibilityRule {
	/** Unique identifier */
	id: string;
	/** The rule stated plainly */
	rule: string;
	/** Mathematical expression, e.g. "abs(Theta1) < abs(Theta2)" */
	formula?: string;
	/** Which pattern types this applies to */
	appliesTo: CAPPatternType[];
	/** Where this rule comes from */
	source: SourcedClaim;
}

/**
 * Trigonometric model: x = h*sin(t) + p*sin(dt), y = h*cos(t) + p*cos(dt)
 *
 * h = handpath radius, p = poi phasing, d = relative downbeats.
 * Positive d = inspin, negative d = antispin.
 * Petal count = |1 - d|.
 */
export interface CAPTrigModel {
	/** Parameter name */
	parameter: string;
	/** What it represents */
	description: string;
	/** How sign or value affects the pattern */
	effect: string;
	/** Where this comes from */
	source: SourcedClaim;
}

/** The full math model export */
export interface CAPMathModel {
	elementaryPatterns: ElementaryPatternNotation[];
	assemblies: CAPAssembly[];
	feasibilityRules: CAPFeasibilityRule[];
	trigParameters: CAPTrigModel[];
}

// TODO: Populate from Zaltymbunk's mathematical framework:
//   - Elementary pattern notation examples
//   - CAP assembly examples (e.g. "1 0 ; 1 3/4 ; 1/2 & -1 4 ; 1 3/4 ; 1/2")
//   - Feasibility rules (e.g. antispin requires abs(Theta1) < abs(Theta2))
//   - Trigonometric model parameters (h, p, d, petal count formula)
export const CAP_MATH_MODEL: CAPMathModel = {
	elementaryPatterns: [],
	assemblies: [],
	feasibilityRules: [],
	trigParameters: [],
};
