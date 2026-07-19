/**
 * CAP Source Documents
 *
 * Metadata for primary source documents that define or formalize
 * Continuous Assembly Patterns theory. All links verified live 2026-07-19.
 */

import type { ExternalReference } from "@flow-arts/core";

export interface SourceDocument extends ExternalReference {
	/** Document version or edition */
	version?: string;
	/** Number of pages */
	pageCount?: number;
	/** Brief summary of the document's scope */
	summary: string;
}

export const CAP_DOCUMENTS: SourceDocument[] = [
	{
		url: "https://www.homeofpoi.com/en/community/forums/topics/891193/What-are-CAP-s",
		title: "What are CAP's? (Home of Poi forums, topic 891193)",
		type: "forum-post",
		author: "Onyx Flame (asker); framework posts by Zaltymbunk; contributions by Alien Jon, DrexFactor, DyamiTK, Danny_, Mother_Natures_Son",
		year: 2009,
		accessDate: "2026-07-19",
		summary:
			"The origin discussion. Contains Alien Jon's coinage attribution to Damien (French_Saltimbanque) and the Burning Man 2007 OMCC origin story, plus Zaltymbunk's full mathematical framework: the O/M/E trochoid model, θ1 θ2 ; ρ1 ρ2 ; d notation, rosettes vs cycloids, wrap-fraction table, feasibility rules, and the canonical CAP definition with worked examples (including the Yuta CAP). Image assets archived in docs/research/caps-archive/.",
	},
	{
		url: "https://drexfactor.com/reference/math_caps",
		title: "The Math of CAPs",
		type: "document",
		author: "Zaltymbunk",
		accessDate: "2026-07-19",
		summary:
			"Zaltymbunk's mathematical CAP framework preserved as a DrexFactor reference page — the same trochoid model and notation presented in the origin thread.",
	},
	{
		url: "https://drexfactor.com/index.php?q=weirdscience%2F2012%2F08%2F21%2Fbasic_poi_dancing_tutorial_c_caps",
		title: "Basic Poi Dancing Tutorial: C-CAPs",
		type: "website",
		author: "DrexFactor",
		year: 2012,
		accessDate: "2026-07-19",
		summary:
			"Documents the C-CAP as the narrowed community usage of the CAP concept; credits an Alien Jon triquetra teaching technique as the method's basis.",
	},
	{
		url: "https://playpoi.com/learn/learning-caps-capped-antispin-patterns/",
		title: "Learning CAPs (Capped Antispin Patterns)",
		type: "website",
		author: "Nick Woolsey",
		year: 2016,
		accessDate: "2026-07-19",
		summary:
			"PlayPoi's learner-facing CAP tutorial; the source of the 'Capped Antispin Patterns' expansion of the acronym.",
	},
	{
		url: "https://www.drexfactor.com/weirdscience/2016/09/27/tutorial_double_staff_8_step_cap_recipe",
		title: "Tutorial: Double Staff 8-Step CAP Recipe",
		type: "website",
		author: "DrexFactor",
		year: 2016,
		accessDate: "2026-07-19",
		summary:
			"Documents the 8-step CAP for double staff with explicit attribution: 'The idea comes to us from Charlie's 9-square theory.'",
	},
];
