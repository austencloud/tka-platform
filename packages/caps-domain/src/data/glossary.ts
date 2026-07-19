/**
 * CAP Glossary
 *
 * Term definitions specific to the Continuous Assembly Patterns framework.
 * Uses the shared FlowArtsGlossaryEntry type from @flow-arts/core.
 *
 * Grounded in the primary sources read 2026-07-19: the "What are CAP's?"
 * Home of Poi thread (topic 891193, framework posts by Zaltymbunk) and
 * DrexFactor/PlayPoi tutorial pages. Terms from the scaffold TODO that lack a
 * verified primary source (soft/hard/mixed transitions, arc/loop path
 * taxonomy) are deliberately NOT included yet — add them with sources.
 */

import type { FlowArtsGlossaryEntry } from "@flow-arts/core";

const ORIGIN_THREAD = "https://www.homeofpoi.com/en/community/forums/topics/891193/What-are-CAP-s";

export const CAP_GLOSSARY: FlowArtsGlossaryEntry[] = [
	{
		term: "CAP",
		aliases: ["Continuous Assembly Pattern", "cap"],
		definition:
			"A cyclic pattern assembled from two or more elementary patterns, each iterated one or more times. The canonical definition (Zaltymbunk): a CAP must be cyclic and is the serial assembly of elementary pattern fragments drawn by one prop, notated θ1 θ2 ; ρ1 ρ2 ; d per fragment. The serial counterpart to hybrids: CAPs assemble patterns one after another in time; hybrids superpose two patterns simultaneously, one per hand.",
		source: {
			claim: "A CAP must be cyclic and can be the assembly of 2 or more elementary patterns iterated 1 or more times",
			sourceType: "document",
			sourceRef: ORIGIN_THREAD,
		},
		relatedTerms: ["elementary-pattern", "hybrid", "c-cap", "division-factor"],
		category: "core",
		framework: "caps",
	},
	{
		term: "elementary-pattern",
		aliases: ["elementary pattern", "pattern"],
		definition:
			"The building block of a CAP: a cyclic curve defined uniquely by its harmonic component (θ1 arm turns, θ2 prop turns; negative θ2 = antispin) and its modulus component (ρ1 arm radius, ρ2 prop radius as a wrap fraction). Modeled on three points: O the shoulder, M the hand ('Main' in French), E the prop extremity. Written θ1 θ2 ; ρ1 ρ2.",
		source: {
			claim: "A pattern is a cyclic curve defined uniquely by its harmonic component and its modulus component",
			sourceType: "document",
			sourceRef: ORIGIN_THREAD,
		},
		relatedTerms: ["cap", "rosette", "cycloid"],
		category: "core",
		framework: "caps",
	},
	{
		term: "rosette",
		definition:
			"An elementary pattern whose two radii are equal (ρ1 = ρ2), the simplest case being 1 1. The classic flower shapes — inspin and antispin petals — are rosettes.",
		source: {
			claim: "Patterns with the two radii or lengths equal are called rosettes",
			sourceType: "document",
			sourceRef: ORIGIN_THREAD,
		},
		relatedTerms: ["elementary-pattern", "cycloid"],
		category: "pattern",
		framework: "caps",
	},
	{
		term: "cycloid",
		definition:
			"An elementary pattern where the hand (M) and prop extremity (E) move at equal speeds in the ground frame, requiring ρ2/ρ1 = |θ1/(θ1+θ2)|. Not all cycloids are physically feasible with a stretched arm because ρ2 can only take discrete wrap-fraction values (1/5, 1/4, 1/3, 2/5, 1/2, 3/5, 2/3, 3/4, 4/5, 1).",
		source: {
			claim: "Cycloids occur when the speeds of M and E are equal in the earth reference: ρ2/ρ1 = abs(θ1/(θ1+θ2))",
			sourceType: "document",
			sourceRef: ORIGIN_THREAD,
		},
		relatedTerms: ["elementary-pattern", "rosette"],
		category: "pattern",
		framework: "caps",
	},
	{
		term: "division-factor",
		aliases: ["d", "division"],
		definition:
			"The fraction of an elementary pattern's full cycle used inside a CAP, appended to the notation as θ1 θ2 ; ρ1 ρ2 ; d with 0 < d ≤ 1. d = 1 means the full cycle. The famous Yuta CAP uses two half-cycles: 1 0 ; 1 3/4 ; 1/2 assembled with -1 4 ; 1 3/4 ; 1/2.",
		source: {
			claim: "If we take only a part of the full cycle we add another number d to the definition; d=1 means the full cycle",
			sourceType: "document",
			sourceRef: ORIGIN_THREAD,
		},
		relatedTerms: ["cap", "elementary-pattern"],
		category: "notation",
		framework: "caps",
	},
	{
		term: "hybrid",
		definition:
			"Two elementary patterns performed simultaneously, one per hand/prop — the parallel superposition process, contrasted in the CAP framework with the serial assembly process that produces CAPs. A finished CAP is itself a pattern and can be fed back into hybridisation.",
		source: {
			claim: "Hybrids result from the parallel superposition of patterns with the two hands; CAPs from the serial assembly of elementary patterns with one prop",
			sourceType: "document",
			sourceRef: ORIGIN_THREAD,
		},
		relatedTerms: ["cap"],
		category: "core",
		framework: "caps",
	},
	{
		term: "c-cap",
		aliases: ["C-CAP"],
		definition:
			"The specific CAP most spinners mean by 'a cap': alternation between an extension arc and antispin petals, producing the composite shape documented in DrexFactor's C-CAPs tutorial. Community usage narrowed the originally-broad CAP concept to this technique.",
		source: {
			claim: "C-CAP is the established named subtype combining extension and antispin",
			sourceType: "community",
			sourceRef: "https://drexfactor.com/index.php?q=weirdscience%2F2012%2F08%2F21%2Fbasic_poi_dancing_tutorial_c_caps",
		},
		relatedTerms: ["cap"],
		category: "technique",
		framework: "caps",
	},
	{
		term: "8-step-cap",
		aliases: ["8-step CAP"],
		definition:
			"A CAP technique introduced by Charlie (Cushing), derived from his 9-Square Theory, performing caps in each direction to switch between same-time and split-time. Documented for double staff by DrexFactor (2016).",
		source: {
			claim: "The idea comes to us from Charlie's 9-square theory",
			sourceType: "document",
			sourceRef: "https://www.drexfactor.com/weirdscience/2016/09/27/tutorial_double_staff_8_step_cap_recipe",
		},
		relatedTerms: ["cap", "c-cap"],
		category: "technique",
		framework: "caps",
	},
];
