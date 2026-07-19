/**
 * CAP Contributors
 *
 * People who created, coined, formalized, or popularized
 * Continuous Assembly Patterns and related theory.
 *
 * Primary source: "What are CAP's?" — Home of Poi forums, topic 891193
 * (read in full 2026-07-19). Secondary: DrexFactor and PlayPoi pages read
 * directly the same day.
 */

import type { Contributor } from "@flow-arts/core";

export const CAP_CONTRIBUTORS: Contributor[] = [
	{
		name: "Damien",
		aliases: ["French_Saltimbanque", "Zaltymbunk", "Trochoïd Master"],
		role: "Coined the term CAPs and built its mathematical framework",
		contributions: [
			"Coined 'Continuous Assembly Patterns' in the Yuta move analysis thread on Home of Poi (attribution in-thread by Alien Jon: 'I got the term from Damien')",
			"Built the trochoid model of elementary patterns: shoulder/hand/extremity circles with harmonic component (θ1 θ2) and modulus component (ρ1 ρ2)",
			"Defined the canonical CAP: a cyclic assembly of 2+ elementary patterns iterated 1+ times, notated θ1 θ2 ; ρ1 ρ2 ; d",
			"Framed the CAP/hybrid duality: CAPs as serial per-hand assembly, hybrids as parallel two-hand superposition",
			"Derived feasibility rules for inspin/antispin patterns and the wrap-fraction table for ρ2 values",
			"Authored 'The Math of CAPs' (hosted as a DrexFactor reference)",
		],
		activeYears: "2007-2010",
		links: [
			{
				url: "https://www.homeofpoi.com/en/community/forums/topics/891193/What-are-CAP-s",
				title: "What are CAP's? (Home of Poi forums)",
				type: "forum-post",
				author: "multiple; framework posts by Zaltymbunk",
				year: 2009,
				accessDate: "2026-07-19",
			},
			{
				url: "https://drexfactor.com/reference/math_caps",
				title: "The Math of CAPs",
				type: "document",
				author: "Zaltymbunk",
				accessDate: "2026-07-19",
			},
		],
	},
	{
		name: "Alien Jon",
		role: "Articulated and promoted the CAP concept",
		contributions: [
			"Part of the Burning Man 2007 OMCC group where the ideas germinated (with Noel, Greg, Jordan, Zan)",
			"Adopted and spread Damien's term; articulated CAPs as assembling fractional building blocks of simpler-symmetry moves into complexly layered ones",
			"Distinguished CAPs from hybrids (a way of thinking about movement, not 'a move')",
			"Teaching technique for triquetras cited as the basis of DrexFactor's C-CAP tutorial",
			"Co-created Encyclo-poi-dia Vol. 2 (contains a CAP chapter)",
		],
		activeYears: "2007-2015",
	},
	{
		name: "Nick Woolsey",
		aliases: ["PlayPoi"],
		role: "Popularized CAPs for learners",
		contributions: [
			"Published the PlayPoi tutorial 'Learning CAPs (Capped Antispin Patterns)' (2016) — source of the 'Capped Antispin Patterns' expansion of the acronym",
		],
		links: [
			{
				url: "https://playpoi.com/learn/learning-caps-capped-antispin-patterns/",
				title: "Learning CAPs (Capped Antispin Patterns)",
				type: "website",
				author: "Nick Woolsey",
				year: 2016,
				accessDate: "2026-07-19",
			},
		],
	},
	{
		name: "Charlie Cushing",
		aliases: ["Charlie"],
		role: "Extended CAP theory",
		contributions: [
			"Introduced the 8-step CAP ('The idea comes to us from Charlie's 9-square theory' — DrexFactor)",
			"Created 9-Square Theory",
			"QFT notation (per project scaffold notes; not independently web-verified)",
		],
		links: [
			{
				url: "https://www.drexfactor.com/weirdscience/2016/09/27/tutorial_double_staff_8_step_cap_recipe",
				title: "Tutorial: Double Staff 8-Step CAP Recipe",
				type: "website",
				author: "DrexFactor",
				year: 2016,
				accessDate: "2026-07-19",
			},
		],
	},
	{
		name: "Drex",
		aliases: ["DrexFactor"],
		role: "Documented CAPs",
		contributions: [
			"Documented CAPs across the Tech Poi Blog series (2009-2016), the C-CAPs tutorial (2012), and the 8-Step CAP Recipe (2016)",
			"Hosts Zaltymbunk's 'The Math of CAPs' as a reference document",
			"Defended framework-naming in the origin thread: umbrella terms bundle movements into a common frame of reference",
		],
		activeYears: "2009-present",
		links: [
			{
				url: "https://drexfactor.com/index.php?q=weirdscience%2F2012%2F08%2F21%2Fbasic_poi_dancing_tutorial_c_caps",
				title: "Basic Poi Dancing Tutorial: C-CAPs",
				type: "website",
				author: "DrexFactor",
				year: 2012,
				accessDate: "2026-07-19",
			},
		],
	},
	{
		name: "Noel Yee",
		role: "Transition Theory co-creator",
		contributions: [
			"Part of the Burning Man 2007 OMCC group where CAP ideas germinated",
			"Co-created Transition Theory, the mechanism connecting pattern fragments (per project scaffold notes)",
		],
	},
	{
		name: "Jordan Campbell",
		role: "Transition Theory co-creator",
		contributions: [
			"Part of the Burning Man 2007 OMCC group where CAP ideas germinated",
			"Co-created Transition Theory, the mechanism connecting pattern fragments (per project scaffold notes)",
		],
	},
];
