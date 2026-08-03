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

/** One elementary fragment in a CAP assembly. */
export interface CAPSegment {
  theta1: number;
  theta2: number;
  rho1: number;
  rho2: number;
  /** Fraction of this elementary curve used by the assembly. */
  d: number;
}

/** CAP assembly: Pattern A ; d1 & Pattern B ; d2 */
export interface CAPAssembly {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** The notation string, e.g. "1 0 ; 1 3/4 ; 1/2 & -1 4 ; 1 3/4 ; 1/2" */
  notation: string;
  /** Structured fragments. Consumers must not re-parse the notation string. */
  segments: CAPSegment[];
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

const ORIGIN_THREAD =
  "https://www.homeofpoi.com/en/community/forums/topics/891193/What-are-CAP-s";

function source(claim: string): SourcedClaim {
  return {
    claim,
    sourceType: "document",
    sourceRef: ORIGIN_THREAD,
  };
}

export const CAP_MATH_MODEL: CAPMathModel = {
  elementaryPatterns: [
    {
      id: "rosette-1-4",
      name: "Four-petal inspin rosette",
      theta1: 1,
      theta2: 4,
      rho1: 1,
      rho2: 1,
      d: 1,
      patternType: "rosette",
      source: source("Elementary rosette example 1 4 ; 1 1"),
    },
    {
      id: "rosette-1-neg6",
      name: "Six-petal antispin rosette",
      theta1: 1,
      theta2: -6,
      rho1: 1,
      rho2: 1,
      d: 1,
      patternType: "rosette",
      source: source("Elementary rosette example 1 -6 ; 1 1"),
    },
    {
      id: "cycloid-1-4",
      name: "Four-cusp cycloid",
      theta1: 1,
      theta2: 4,
      rho1: 1,
      rho2: 1 / 5,
      d: 1,
      patternType: "cycloid",
      source: source("Elementary cycloid example 1 4 ; 1 1/5"),
    },
    {
      id: "antispin-1-neg3",
      name: "Three-petal antispin rosette",
      theta1: 1,
      theta2: -3,
      rho1: 1,
      rho2: 1,
      d: 1,
      patternType: "rosette",
      source: source("Elementary rosette example 1 -3 ; 1 1"),
    },
    {
      id: "cycloid-1-neg3",
      name: "Three-cusp antispin cycloid",
      theta1: 1,
      theta2: -3,
      rho1: 1,
      rho2: 1 / 2,
      d: 1,
      patternType: "cycloid",
      source: source("Elementary cycloid example 1 -3 ; 1 1/2"),
    },
    {
      id: "pattern-2-neg5",
      name: "Two-turn antispin rosette",
      theta1: 2,
      theta2: -5,
      rho1: 1,
      rho2: 1,
      d: 1,
      patternType: "rosette",
      source: source("Elementary pattern example 2 -5 ; 1 1"),
    },
    {
      id: "pattern-3-2",
      name: "Three-turn inspin rosette",
      theta1: 3,
      theta2: 2,
      rho1: 1,
      rho2: 1,
      d: 1,
      patternType: "rosette",
      source: source("Elementary pattern example 3 2 ; 1 1"),
    },
  ],
  assemblies: [
    {
      id: "yuta-cap",
      name: "The Yuta CAP (half cycle)",
      notation: "1 0 ; 1 3/4 ; 1/2 & -1 4 ; 1 3/4 ; 1/2",
      segments: [
        { theta1: 1, theta2: 0, rho1: 1, rho2: 3 / 4, d: 1 / 2 },
        { theta1: -1, theta2: 4, rho1: 1, rho2: 3 / 4, d: 1 / 2 },
      ],
      patternA: "1 0 ; 1 3/4",
      d1: 1 / 2,
      patternB: "-1 4 ; 1 3/4",
      d2: 1 / 2,
      description: "An extension half-cycle joined to an antispin half-cycle.",
      source: source(
        "The Yuta move analysis CAP assembled from two half-cycles"
      ),
    },
    {
      id: "yuta-cap-three-quarter",
      name: "The Yuta CAP at d = 3/4",
      notation: "1 0 ; 1 3/4 ; 3/4 & -1 4 ; 1 3/4 ; 3/4",
      segments: [
        { theta1: 1, theta2: 0, rho1: 1, rho2: 3 / 4, d: 3 / 4 },
        { theta1: -1, theta2: 4, rho1: 1, rho2: 3 / 4, d: 3 / 4 },
      ],
      patternA: "1 0 ; 1 3/4",
      d1: 3 / 4,
      patternB: "-1 4 ; 1 3/4",
      d2: 3 / 4,
      description:
        "The same extension and antispin pair, using three quarters of each cycle.",
      source: source("Published CAP example using d = 3/4 for both fragments"),
    },
    {
      id: "cap-1-3-composition",
      name: "The 1 3 composition",
      notation: "1 3 ; 1 3/4 ; 2/3 & -1 3 ; 1 3/4 ; 2/3",
      segments: [
        { theta1: 1, theta2: 3, rho1: 1, rho2: 3 / 4, d: 2 / 3 },
        { theta1: -1, theta2: 3, rho1: 1, rho2: 3 / 4, d: 2 / 3 },
      ],
      patternA: "1 3 ; 1 3/4",
      d1: 2 / 3,
      patternB: "-1 3 ; 1 3/4",
      d2: 2 / 3,
      description:
        "Two two-thirds-cycle fragments joined into a closed composite curve.",
      source: source("Published CAP example assembling 1 3 and -1 3 fragments"),
    },
  ],
  feasibilityRules: [],
  trigParameters: [],
};
