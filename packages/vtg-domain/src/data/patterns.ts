/**
 * VTG Base Patterns
 *
 * The 40 base patterns formed by combining 10 minimal beat shapes with
 * 4 timing/direction categories. Each pattern is a specific two-hand
 * movement with a known shape and category.
 *
 * Source: VTG V1 p.3-4 (Noel Yee, "Necessity of 40 Patterns")
 *
 * The 1:1 set derives from a 6x6 grid of possible shape combinations.
 * Each cell in the grid represents a shape combination where one prop
 * traces one shape and the other prop traces another. Noel Yee identified
 * that only 10 of these cells produce unique minimal beat shapes (the
 * remaining cells are duplicates due to symmetry). These 10 shapes, applied
 * across 4 timing/direction categories, yield exactly 40 base patterns.
 *
 * Pages 8-11 of VTG V1 show all 10 shapes for each category:
 *   p.8: Split Same (S/S)
 *   p.9: Split Opposite (S/O)
 *   p.10: Together Same (t/s)
 *   p.11: Together Opposite (t/o)
 */

import type { SourcedClaim } from "@flow-arts/core";

export interface VTGPattern {
	/** Unique identifier */
	id: string;
	/** Pattern name (e.g., "butterfly", "windmill") */
	name: string;
	/** Alternative names used in the community */
	aliases?: string[];
	/** Which shape this pattern uses */
	shapeId: string;
	/** Which timing/direction category */
	categoryId: string;
	/** Plain-language description */
	description: string;
	/** Where this pattern definition comes from */
	source: SourcedClaim;
	/** Common variations or extensions */
	variations?: string[];
}

/**
 * Helper: page reference for each category in VTG V1.
 * Used to generate consistent sourceRef values.
 */
const CATEGORY_PAGES: Record<string, string> = {
	"split-same": "VTG V1 p.8",
	"split-opp": "VTG V1 p.9",
	"tog-same": "VTG V1 p.10",
	"tog-opp": "VTG V1 p.11",
};

/**
 * Example: "extension" + "tog-opp" => "tog-opp-extension"
 */
function patternId(categoryId: string, shapeId: string): string {
	return `${categoryId}-${shapeId}`;
}

function patternSource(categoryId: string, shapeId: string): SourcedClaim {
	return {
		claim: `${shapeId} in ${categoryId} is one of 40 base patterns in the VTG 1:1 set.`,
		sourceType: "document",
		sourceRef: CATEGORY_PAGES[categoryId],
	};
}

// ─── Extension patterns ───────────────────────────────────────────────
// Extension is the most intuitive shape: the prop extends outward from
// the hand's orbit. These four are the patterns most beginners learn first.

const EXTENSION_PATTERNS: VTGPattern[] = [
	{
		id: patternId("tog-opp", "extension"),
		name: "Butterfly",
		aliases: ["opposites", "tog-opp extension"],
		shapeId: "extension",
		categoryId: "tog-opp",
		description:
			"Both props extend outward, spinning in opposite directions and in phase. The most recognizable poi pattern: props cross at top and bottom.",
		source: {
			claim:
				"Butterfly is together-time opposite-direction extension, one of 40 base patterns in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.11",
		},
		variations: ["reverse butterfly", "behind-the-back butterfly"],
	},
	{
		id: patternId("split-same", "extension"),
		name: "Weave",
		aliases: ["3-beat weave", "split-same extension"],
		shapeId: "extension",
		categoryId: "split-same",
		description:
			"Both props extend outward, spinning in the same direction but 180 degrees out of phase. The classic weave pattern where props alternate sides of the body.",
		source: {
			claim:
				"Weave is split-time same-direction extension, one of 40 base patterns in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.8",
		},
		variations: ["2-beat weave", "5-beat weave", "reverse weave"],
	},
	{
		id: patternId("tog-same", "extension"),
		name: "Buzzsaw",
		aliases: ["chase", "chasing the sun", "tog-same extension", "double spin"],
		shapeId: "extension",
		categoryId: "tog-same",
		description:
			"Both props extend outward, spinning in the same direction and in phase. Both poi travel together around the same circle, creating a doubling effect.",
		source: {
			claim:
				"Buzzsaw is together-time same-direction extension, one of 40 base patterns in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.10",
		},
		variations: ["reverse buzzsaw"],
	},
	{
		id: patternId("split-opp", "extension"),
		name: "Corkscrew",
		aliases: ["windmill", "split-opp extension"],
		shapeId: "extension",
		categoryId: "split-opp",
		description:
			"Both props extend outward, spinning in opposite directions and 180 degrees out of phase. The trick appears to reflect across a horizontal line of symmetry. Called windmill when performed in the wall plane, corkscrew when in the wheel plane.",
		source: {
			claim:
				"Corkscrew/Windmill is split-time opposite-direction extension, one of 40 base patterns in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.9",
		},
		variations: ["reverse windmill", "reverse corkscrew"],
	},
];

// ─── Isolation patterns ───────────────────────────────────────────────
// Isolation: the prop appears to stay fixed in space while the hand orbits.

const ISOLATION_PATTERNS: VTGPattern[] = [
	{
		id: patternId("tog-opp", "isolation"),
		name: "Together Opposite Isolation",
		aliases: ["isolated butterfly", "tog-opp iso"],
		shapeId: "isolation",
		categoryId: "tog-opp",
		description:
			"Both props hold isolation (fixed in space) while hands orbit in opposite directions and in phase.",
		source: patternSource("tog-opp", "isolation"),
	},
	{
		id: patternId("split-same", "isolation"),
		name: "Split Same Isolation",
		aliases: ["split-same iso"],
		shapeId: "isolation",
		categoryId: "split-same",
		description:
			"Both props hold isolation while hands orbit in the same direction, 180 degrees out of phase.",
		source: patternSource("split-same", "isolation"),
	},
	{
		id: patternId("tog-same", "isolation"),
		name: "Together Same Isolation",
		aliases: ["tog-same iso"],
		shapeId: "isolation",
		categoryId: "tog-same",
		description:
			"Both props hold isolation while hands orbit in the same direction and in phase.",
		source: patternSource("tog-same", "isolation"),
	},
	{
		id: patternId("split-opp", "isolation"),
		name: "Split Opposite Isolation",
		aliases: ["split-opp iso"],
		shapeId: "isolation",
		categoryId: "split-opp",
		description:
			"Both props hold isolation while hands orbit in opposite directions, 180 degrees out of phase.",
		source: patternSource("split-opp", "isolation"),
	},
];

// ─── Vertical Antispin patterns ───────────────────────────────────────
// Vertical antispin: the prop spins opposite to the hand's orbit,
// creating a vertically-oriented flower pattern.

const VERTICAL_ANTISPIN_PATTERNS: VTGPattern[] = [
	{
		id: patternId("tog-opp", "vertical-antispin"),
		name: "Together Opposite Vertical Antispin",
		aliases: ["tog-opp v-antispin", "opposite vertical flower"],
		shapeId: "vertical-antispin",
		categoryId: "tog-opp",
		description:
			"Both props trace vertical antispin flowers while hands orbit in opposite directions and in phase.",
		source: patternSource("tog-opp", "vertical-antispin"),
	},
	{
		id: patternId("split-same", "vertical-antispin"),
		name: "Split Same Vertical Antispin",
		aliases: ["split-same v-antispin"],
		shapeId: "vertical-antispin",
		categoryId: "split-same",
		description:
			"Both props trace vertical antispin flowers while hands orbit in the same direction, 180 degrees out of phase.",
		source: patternSource("split-same", "vertical-antispin"),
	},
	{
		id: patternId("tog-same", "vertical-antispin"),
		name: "Together Same Vertical Antispin",
		aliases: ["tog-same v-antispin"],
		shapeId: "vertical-antispin",
		categoryId: "tog-same",
		description:
			"Both props trace vertical antispin flowers while hands orbit in the same direction and in phase.",
		source: patternSource("tog-same", "vertical-antispin"),
	},
	{
		id: patternId("split-opp", "vertical-antispin"),
		name: "Split Opposite Vertical Antispin",
		aliases: ["split-opp v-antispin"],
		shapeId: "vertical-antispin",
		categoryId: "split-opp",
		description:
			"Both props trace vertical antispin flowers while hands orbit in opposite directions, 180 degrees out of phase.",
		source: patternSource("split-opp", "vertical-antispin"),
	},
];

// ─── Horizontal Antispin patterns ─────────────────────────────────────

const HORIZONTAL_ANTISPIN_PATTERNS: VTGPattern[] = [
	{
		id: patternId("tog-opp", "horizontal-antispin"),
		name: "Together Opposite Horizontal Antispin",
		aliases: ["tog-opp h-antispin", "opposite horizontal flower"],
		shapeId: "horizontal-antispin",
		categoryId: "tog-opp",
		description:
			"Both props trace horizontal antispin flowers while hands orbit in opposite directions and in phase.",
		source: patternSource("tog-opp", "horizontal-antispin"),
	},
	{
		id: patternId("split-same", "horizontal-antispin"),
		name: "Split Same Horizontal Antispin",
		aliases: ["split-same h-antispin"],
		shapeId: "horizontal-antispin",
		categoryId: "split-same",
		description:
			"Both props trace horizontal antispin flowers while hands orbit in the same direction, 180 degrees out of phase.",
		source: patternSource("split-same", "horizontal-antispin"),
	},
	{
		id: patternId("tog-same", "horizontal-antispin"),
		name: "Together Same Horizontal Antispin",
		aliases: ["tog-same h-antispin"],
		shapeId: "horizontal-antispin",
		categoryId: "tog-same",
		description:
			"Both props trace horizontal antispin flowers while hands orbit in the same direction and in phase.",
		source: patternSource("tog-same", "horizontal-antispin"),
	},
	{
		id: patternId("split-opp", "horizontal-antispin"),
		name: "Split Opposite Horizontal Antispin",
		aliases: ["split-opp h-antispin"],
		shapeId: "horizontal-antispin",
		categoryId: "split-opp",
		description:
			"Both props trace horizontal antispin flowers while hands orbit in opposite directions, 180 degrees out of phase.",
		source: patternSource("split-opp", "horizontal-antispin"),
	},
];

// ─── Hybrid shape patterns ────────────────────────────────────────────
// The remaining 6 shapes are hybrids: combinations of two different
// single-beat shapes within one beat cycle. Each gets 4 category variants.

function hybridPatterns(
	shapeId: string,
	shapeName: string,
): VTGPattern[] {
	const categories = ["tog-opp", "split-same", "tog-same", "split-opp"] as const;
	const categoryNames: Record<string, string> = {
		"tog-opp": "Together Opposite",
		"split-same": "Split Same",
		"tog-same": "Together Same",
		"split-opp": "Split Opposite",
	};

	return categories.map((catId) => ({
		id: patternId(catId, shapeId),
		name: `${categoryNames[catId]} ${shapeName}`,
		aliases: [`${catId} ${shapeId}`],
		shapeId,
		categoryId: catId,
		description:
			`Both props trace the ${shapeName.toLowerCase()} hybrid shape while hands follow ${categoryNames[catId].toLowerCase()} timing and direction.`,
		source: patternSource(catId, shapeId),
	}));
}

const HYBRID_SHAPE_PATTERNS: VTGPattern[] = [
	...hybridPatterns("ext-vertical-antispin", "Extension / Vertical Antispin"),
	...hybridPatterns("ext-horizontal-antispin", "Extension / Horizontal Antispin"),
	...hybridPatterns("iso-extension", "Isolation / Extension"),
	...hybridPatterns("vertical-antispin-iso", "Vertical Antispin / Isolation"),
	...hybridPatterns("horizontal-antispin-iso", "Horizontal Antispin / Isolation"),
	...hybridPatterns(
		"vertical-antispin-horizontal-antispin",
		"V. Antispin / H. Antispin",
	),
];

/**
 * All 40 base VTG patterns in the 1:1 set.
 *
 * 10 shapes x 4 categories = 40 patterns.
 *
 * The four extension patterns have well-known common names:
 *   - Together Opposite Extension = Butterfly
 *   - Split Same Extension = Weave
 *   - Together Same Extension = Buzzsaw
 *   - Split Opposite Extension = Corkscrew/Windmill
 *
 * The remaining 36 patterns (isolation, antispin, and hybrid shapes)
 * are typically referred to by their shape + category name in the
 * community, as they lack universally agreed-upon single-word names.
 *
 * Source: VTG V1 p.3-4, 8-11 (Noel Yee, "Necessity of 40 Patterns")
 */
export const VTG_PATTERNS: VTGPattern[] = [
	...EXTENSION_PATTERNS,
	...ISOLATION_PATTERNS,
	...VERTICAL_ANTISPIN_PATTERNS,
	...HORIZONTAL_ANTISPIN_PATTERNS,
	...HYBRID_SHAPE_PATTERNS,
];

/**
 * The 10x4 matrix structure, for consumers that want to work with
 * the grid rather than a flat list.
 */
export const VTG_PATTERN_MATRIX = {
	/** The 10 shape IDs (rows) */
	shapeIds: [
		"isolation",
		"extension",
		"vertical-antispin",
		"horizontal-antispin",
		"ext-vertical-antispin",
		"ext-horizontal-antispin",
		"iso-extension",
		"vertical-antispin-iso",
		"horizontal-antispin-iso",
		"vertical-antispin-horizontal-antispin",
	],
	/** The 4 original category IDs (columns) */
	categoryIds: ["split-same", "split-opp", "tog-same", "tog-opp"],
	/** Total patterns: 10 shapes x 4 categories */
	totalPatterns: 40,
	/**
	 * Look up a pattern by shape and category.
	 * Returns undefined if the combination doesn't exist (it always should
	 * for the 10x4 set, but type safety is free).
	 */
	get(shapeId: string, categoryId: string): VTGPattern | undefined {
		return VTG_PATTERNS.find(
			(p) => p.shapeId === shapeId && p.categoryId === categoryId,
		);
	},
	source: {
		claim:
			"The 1:1 set derives from a 6x6 grid of shape combinations. Noel Yee identifies 10 unique minimal beat shapes from this grid. Some grid cells produce identical shapes due to symmetry, so 36 grid squares yield only 10 distinct shapes. Combined with 4 timing/direction categories, these produce 40 total patterns.",
		sourceType: "document" as const,
		sourceRef: "VTG V1 p.3-4, Noel Yee",
	},
} as const;
