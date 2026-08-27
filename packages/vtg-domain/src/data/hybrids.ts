/**
 * VTG Hybrids
 *
 * 3D shapes, hands-vs-prop distinctions, and hybrid movement concepts
 * that extend beyond the basic 2D pattern framework.
 *
 * Three categories of hybrid:
 *
 * 1. **3D hybrid shapes** (VTG V1 p.12): shapes that involve movement
 *    across multiple planes. These use "vanish" shapes where part of
 *    the prop path disappears behind/below the spinner. Combined across
 *    3 contexts (Split L, Together L, Infinite L), they yield 144 patterns.
 *
 * 2. **Hands-vs-poi timing/direction divergence** (VTG2): in hybrid
 *    patterns, the hands and poi can have DIFFERENT timing/direction
 *    classifications. A single pattern might be "Together Same" from
 *    the hands' perspective but "Split Opposite" from the poi's perspective.
 *
 * 3. **Plane blends**: movements that combine wall, wheel, and floor
 *    plane elements.
 */

import type { SourcedClaim } from "@flow-arts/core";

export type HybridType = "3d-shape" | "hands-vs-poi" | "plane-blend";

export interface VTGHybrid {
	/** Unique identifier */
	id: string;
	/** Hybrid name */
	name: string;
	/** Type of hybrid concept */
	hybridType: HybridType;
	/** Plain-language description */
	description: string;
	/** Component patterns or shapes involved */
	components?: string[];
	/** Where this hybrid definition comes from */
	source: SourcedClaim;
}

// ─── 3D Vanish Shapes ─────────────────────────────────────────────────
// VTG V1 p.12 introduces three vanish primitives that create 3D movement:
//   - Vertical Vanish: prop path disappears above/below
//   - Horizontal Vanish: prop path disappears to the side
//   - Horizontal Vanish / Vertical Vanish: combined vanish
//
// These vanish shapes are combined with the 4 base single-beat shapes
// (Isolation, Extension, Vertical Antispin, Horizontal Antispin) to
// produce compound 3D shapes. Each compound shape can be performed in
// 3 contexts: Split L, Together L, and Infinite L.

/**
 * The 3D compound shapes listed on VTG V1 p.12.
 *
 * Each entry is a combination of two single-beat shapes where at least
 * one involves cross-plane movement (a "vanish"). The shapes are listed
 * as A/B pairs where A is one hand's shape and B is the other's.
 */
const THREE_D_SHAPES: VTGHybrid[] = [
	// ── Vertical Antispin combinations ────────────────────────────
	{
		id: "3d-va-va",
		name: "V.A. / V.A.",
		hybridType: "3d-shape",
		description:
			"Both hands perform vertical antispin across planes, creating a 3D flower where both prop paths vanish and reappear vertically.",
		components: ["vertical-antispin", "vertical-antispin"],
		source: {
			claim:
				"V.A./V.A. is listed as a 3-D hybrid shape. All shapes are presented in the wall plane and yield 144 total patterns when completed in Split L, Together L, and Infinite L.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-va-ext",
		name: "V.A. / Ext",
		hybridType: "3d-shape",
		description:
			"One hand performs vertical antispin while the other extends, creating an asymmetric 3D pattern.",
		components: ["vertical-antispin", "extension"],
		source: {
			claim: "V.A./Ext is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-va-iso",
		name: "V.A. / Iso",
		hybridType: "3d-shape",
		description:
			"One hand performs vertical antispin while the other holds isolation across planes.",
		components: ["vertical-antispin", "isolation"],
		source: {
			claim: "V.A./Iso is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-va-ha",
		name: "V.A. / H.A.",
		hybridType: "3d-shape",
		description:
			"One hand performs vertical antispin while the other performs horizontal antispin, blending vertical and horizontal flower patterns across planes.",
		components: ["vertical-antispin", "horizontal-antispin"],
		source: {
			claim: "V.A./H.A. is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},

	// ── Horizontal Antispin combinations ──────────────────────────
	{
		id: "3d-ha-ha",
		name: "H.A. / H.A.",
		hybridType: "3d-shape",
		description:
			"Both hands perform horizontal antispin across planes, creating a 3D flower where both prop paths vanish and reappear horizontally.",
		components: ["horizontal-antispin", "horizontal-antispin"],
		source: {
			claim: "H.A./H.A. is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-ha-iso",
		name: "H.A. / Iso",
		hybridType: "3d-shape",
		description:
			"One hand performs horizontal antispin while the other holds isolation across planes.",
		components: ["horizontal-antispin", "isolation"],
		source: {
			claim: "H.A./Iso is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-ha-va",
		name: "H.A. / V.A.",
		hybridType: "3d-shape",
		description:
			"One hand performs horizontal antispin while the other performs vertical antispin across planes.",
		components: ["horizontal-antispin", "vertical-antispin"],
		source: {
			claim: "H.A./V.A. is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-ha-ext",
		name: "H.A. / Ext",
		hybridType: "3d-shape",
		description:
			"One hand performs horizontal antispin while the other extends across planes.",
		components: ["horizontal-antispin", "extension"],
		source: {
			claim: "H.A./Ext is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},

	// ── Extension combinations ────────────────────────────────────
	{
		id: "3d-ext-ext",
		name: "Ext / Ext",
		hybridType: "3d-shape",
		description:
			"Both hands extend across planes, creating a 3D extension pattern.",
		components: ["extension", "extension"],
		source: {
			claim: "Ext/Ext is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-ext-va",
		name: "Ext / V.A.",
		hybridType: "3d-shape",
		description:
			"One hand extends while the other performs vertical antispin across planes.",
		components: ["extension", "vertical-antispin"],
		source: {
			claim: "Ext/V.A. is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-ext-iso",
		name: "Ext / Iso",
		hybridType: "3d-shape",
		description:
			"One hand extends while the other holds isolation across planes.",
		components: ["extension", "isolation"],
		source: {
			claim: "Ext/Iso is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-ext-ha",
		name: "Ext / H.A.",
		hybridType: "3d-shape",
		description:
			"One hand extends while the other performs horizontal antispin across planes.",
		components: ["extension", "horizontal-antispin"],
		source: {
			claim: "Ext/H.A. is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},

	// ── Isolation combinations ────────────────────────────────────
	{
		id: "3d-iso-ext",
		name: "Iso / Ext",
		hybridType: "3d-shape",
		description:
			"One hand holds isolation while the other extends across planes.",
		components: ["isolation", "extension"],
		source: {
			claim: "Iso/Ext is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-iso-va",
		name: "Iso / V.A.",
		hybridType: "3d-shape",
		description:
			"One hand holds isolation while the other performs vertical antispin across planes.",
		components: ["isolation", "vertical-antispin"],
		source: {
			claim: "Iso/V.A. is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-iso-iso",
		name: "Iso / Iso",
		hybridType: "3d-shape",
		description:
			"Both hands hold isolation across planes, creating a 3D double isolation.",
		components: ["isolation", "isolation"],
		source: {
			claim: "Iso/Iso is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "3d-iso-ha",
		name: "Iso / H.A.",
		hybridType: "3d-shape",
		description:
			"One hand holds isolation while the other performs horizontal antispin across planes.",
		components: ["isolation", "horizontal-antispin"],
		source: {
			claim: "Iso/H.A. is listed as a 3-D hybrid shape.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
];

// VTG2 introduced the insight that in hybrid patterns, the hands and
// poi can have DIFFERENT timing/direction classifications. This is the
// key conceptual leap from VTG1 to VTG2.
//
// In VTG1, timing/direction is described from ONE perspective (the
// overall pattern). In VTG2, each pattern is described with THREE
// properties:
//   1. Driving Style (the shape/flower type)
//   2. Hands timing/direction
//   3. Poi timing/direction
//
// Example from VTG2 Index:
//   Driving Style: Diamond Antispin vs 2 Petal Spin Flower Vertical
//   Hands: Together Time / Same Direction
//   Poi: Split Time / Opposite Direction
//   Label: TogSame/SplitOpp

const HANDS_VS_POI_CONCEPTS: VTGHybrid[] = [
	{
		id: "hands-vs-poi-divergence",
		name: "Hands-vs-Poi Timing/Direction Divergence",
		hybridType: "hands-vs-poi",
		description:
			"In hybrid patterns, the hands and poi can have different timing/direction classifications. A pattern might be 'Together Same' from the hands' perspective but 'Split Opposite' from the poi's perspective. VTG2 describes each pattern with three properties: driving style, hands timing/direction, and poi timing/direction.",
		source: {
			claim:
				"VTG2 Index PDFs describe each pattern with three properties: Driving Style, Hands timing/direction, and Poi timing/direction. Example: Driving Style 'Diamond Antispin vs 2 Petal Spin Flower Vertical', Hands 'Together Time / Same Direction', Poi 'Split Time / Opposite Direction', labeled 'TogSame/SplitOpp'.",
			sourceType: "document",
			sourceRef: "VTG2 Index PDFs",
		},
	},
	{
		id: "hands-vs-poi-tog-same-split-opp",
		name: "TogSame/SplitOpp",
		hybridType: "hands-vs-poi",
		description:
			"Hands move in Together Time / Same Direction while poi move in Split Time / Opposite Direction. The hands and poi diverge in both timing and direction. This is one of the most common hybrid classifications in VTG2.",
		components: ["tog-same", "split-opp"],
		source: {
			claim:
				"TogSame/SplitOpp is a hands-vs-poi hybrid classification found in VTG2 Index entries.",
			sourceType: "document",
			sourceRef: "VTG2 Index PDFs",
		},
	},
	{
		id: "hands-vs-poi-split-same-tog-opp",
		name: "SplitSame/TogOpp",
		hybridType: "hands-vs-poi",
		description:
			"Hands move in Split Time / Same Direction while poi move in Together Time / Opposite Direction. The inverse of TogSame/SplitOpp.",
		components: ["split-same", "tog-opp"],
		source: {
			claim:
				"SplitSame/TogOpp is a hands-vs-poi hybrid classification found in VTG2 Index entries.",
			sourceType: "document",
			sourceRef: "VTG2 Index PDFs",
		},
	},
	{
		id: "hands-vs-poi-tog-opp-split-same",
		name: "TogOpp/SplitSame",
		hybridType: "hands-vs-poi",
		description:
			"Hands move in Together Time / Opposite Direction while poi move in Split Time / Same Direction.",
		components: ["tog-opp", "split-same"],
		source: {
			claim:
				"TogOpp/SplitSame is a hands-vs-poi hybrid classification found in VTG2 Index entries.",
			sourceType: "document",
			sourceRef: "VTG2 Index PDFs",
		},
	},
	{
		id: "hands-vs-poi-split-opp-tog-same",
		name: "SplitOpp/TogSame",
		hybridType: "hands-vs-poi",
		description:
			"Hands move in Split Time / Opposite Direction while poi move in Together Time / Same Direction.",
		components: ["split-opp", "tog-same"],
		source: {
			claim:
				"SplitOpp/TogSame is a hands-vs-poi hybrid classification found in VTG2 Index entries.",
			sourceType: "document",
			sourceRef: "VTG2 Index PDFs",
		},
	},
];


const VANISH_PRIMITIVES: VTGHybrid[] = [
	{
		id: "vertical-vanish",
		name: "Vertical Vanish",
		hybridType: "3d-shape",
		description:
			"A 3D shape primitive where part of the prop's path moves into a plane perpendicular to the viewer, making it appear to vanish vertically. One of three vanish primitives introduced in VTG V1.",
		source: {
			claim:
				"Vertical Vanish is one of three 3-D hybrid shape primitives: Vertical Vanish, Horizontal Vanish, and Horizontal Vanish / Vertical Vanish.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "horizontal-vanish",
		name: "Horizontal Vanish",
		hybridType: "3d-shape",
		description:
			"A 3D shape primitive where part of the prop's path moves into a plane perpendicular to the viewer, making it appear to vanish horizontally. One of three vanish primitives introduced in VTG V1.",
		source: {
			claim:
				"Horizontal Vanish is one of three 3-D hybrid shape primitives.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
	{
		id: "horizontal-vertical-vanish",
		name: "Horizontal Vanish / Vertical Vanish",
		hybridType: "3d-shape",
		description:
			"A 3D shape primitive combining horizontal and vertical vanish, where the prop path disappears in both dimensions. The most complex of the three vanish primitives.",
		source: {
			claim:
				"Horizontal Vanish / Vertical Vanish is the third 3-D hybrid shape primitive.",
			sourceType: "document",
			sourceRef: "VTG V1 p.12",
		},
	},
];

/**
 * All VTG hybrid concepts.
 *
 * The 3D shapes (16 compound shapes + 3 vanish primitives) come from VTG V1 p.12.
 * When performed in 3 contexts (Split L, Together L, Infinite L), the compound
 * shapes yield 144 total 3D patterns.
 *
 * The hands-vs-poi concepts come from VTG2 and represent the conceptual
 * leap where a single pattern can have different timing/direction
 * classifications depending on whether you analyze the hands or the poi.
 */
export const VTG_HYBRIDS: VTGHybrid[] = [
	...VANISH_PRIMITIVES,
	...THREE_D_SHAPES,
	...HANDS_VS_POI_CONCEPTS,
];

/**
 * Summary of the 3D pattern count derivation.
 *
 * VTG V1 p.12 states: "All of the following shapes created in both possible
 * combinations, only presented in the wall plane. When completed in Split L,
 * Together L and Infinite L, these Yield 144 total Patterns."
 *
 * Derivation (best reconstruction):
 * - 16 compound 3D shapes are listed on p.12
 * - "Both possible combinations" likely means each A/B pair also has a B/A
 *   ordering, but since many pairs are already listed in both orders
 *   (e.g., V.A./Ext and Ext/V.A.), the distinct ordered pairs may differ.
 * - 3 contexts: Split L, Together L, Infinite L
 * - 16 shapes x 3 contexts = 48. To reach 144, a factor of 3 remains:
 *   possibly the 3 vanish primitives applied to each, or a timing/direction
 *   multiplier not explicitly stated on the page.
 *
 * NOTE: The exact multiplication path from 16 shapes to 144 patterns is not
 * fully spelled out in VTG V1. The 144 figure is taken at face value from
 * the source text. Further clarification from the authors would resolve this.
 */
export const THREE_D_PATTERN_COUNT = {
	compoundShapes: 16,
	contexts: ["Split L", "Together L", "Infinite L"] as const,
	totalPatterns: 144,
	source: {
		claim:
			"All of the following shapes created in both possible combinations, only presented in the wall plane. When completed in Split L, Together L and Infinite L, these Yield 144 total Patterns.",
		sourceType: "document" as const,
		sourceRef: "VTG V1 p.12",
	},
} as const;
