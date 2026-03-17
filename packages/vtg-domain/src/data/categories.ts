/**
 * VTG Timing/Direction Categories
 *
 * The four original categories from VTG V1 (Noel Yee, ~2011)
 * plus two community extensions (quarter-same, quarter-opp).
 */

import type { SourcedClaim } from "@flow-arts/core";

export interface VTGCategory {
	/** Unique identifier: "tog-same", "tog-opp", "split-same", "split-opp", "quarter-same", "quarter-opp" */
	id: string;
	/** Display name */
	name: string;
	/** Short abbreviation: "TS", "TO", "SS", "SO", "QS", "QO" */
	abbreviation: string;
	/** Timing relationship between hands */
	timing: "together" | "split" | "quarter";
	/** Direction relationship between hands */
	direction: "same" | "opposite";
	/** Plain-language description */
	description: string;
	/** Where this category definition comes from */
	source: SourcedClaim;
	/** TKA letters that map to this category (cross-domain reference) */
	tkaLetters?: string[];
}

export const VTG_CATEGORIES: VTGCategory[] = [
	{
		id: "split-same",
		name: "Split Same",
		abbreviation: "SS",
		timing: "split",
		direction: "same",
		description:
			"Both props spin in the same rotational direction, 180 degrees out of phase (one prop is at the top of its circle when the other is at the bottom).",
		source: {
			claim:
				"Split/Same is one of four timing/direction combinations in VTG Transition Theory.",
			sourceType: "document",
			sourceRef: "VTG V1 p.5",
		},
		tkaLetters: ["A", "B", "C"],
	},
	{
		id: "tog-same",
		name: "Together Same",
		abbreviation: "TS",
		timing: "together",
		direction: "same",
		description:
			"Both props spin in the same rotational direction, at the same point in their circles simultaneously (in phase).",
		source: {
			claim:
				"Tog/Same is one of four timing/direction combinations in VTG Transition Theory.",
			sourceType: "document",
			sourceRef: "VTG V1 p.5",
		},
		tkaLetters: ["G", "H", "I"],
	},
	{
		id: "split-opp",
		name: "Split Opposite",
		abbreviation: "SO",
		timing: "split",
		direction: "opposite",
		description:
			"Props spin in opposite rotational directions, 180 degrees out of phase.",
		source: {
			claim:
				"Split/Opp is one of four timing/direction combinations in VTG Transition Theory.",
			sourceType: "document",
			sourceRef: "VTG V1 p.5",
		},
		tkaLetters: ["J", "K", "L"],
	},
	{
		id: "tog-opp",
		name: "Together Opposite",
		abbreviation: "TO",
		timing: "together",
		direction: "opposite",
		description:
			"Props spin in opposite rotational directions, at the same point in their circles simultaneously (in phase).",
		source: {
			claim:
				"Tog/Opp is one of four timing/direction combinations in VTG Transition Theory.",
			sourceType: "document",
			sourceRef: "VTG V1 p.5",
		},
		tkaLetters: ["D", "E", "F"],
	},
	{
		id: "quarter-same",
		name: "Quarter Same",
		abbreviation: "QS",
		timing: "quarter",
		direction: "same",
		description:
			"Props spin in the same rotational direction, 90 degrees out of phase. A community extension beyond the original four VTG categories.",
		source: {
			claim:
				"Quarter-Same describes patterns where hands are 90 degrees apart spinning in the same direction. This was added by the community after VTG V1.",
			sourceType: "community",
		},
		tkaLetters: ["S", "T", "U", "V"],
	},
	{
		id: "quarter-opp",
		name: "Quarter Opposite",
		abbreviation: "QO",
		timing: "quarter",
		direction: "opposite",
		description:
			"Props spin in opposite rotational directions, 90 degrees out of phase. A community extension beyond the original four VTG categories.",
		source: {
			claim:
				"Quarter-Opposite describes patterns where hands are 90 degrees apart spinning in opposite directions. This was added by the community after VTG V1.",
			sourceType: "community",
		},
		tkaLetters: ["M", "N", "O", "P", "Q", "R"],
	},
];
