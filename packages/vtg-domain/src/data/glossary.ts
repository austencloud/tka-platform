/**
 * VTG Glossary
 *
 * Term definitions specific to the Vulcan Tech Gospel framework.
 * Uses the shared FlowArtsGlossaryEntry type from @flow-arts/core.
 */

import type { FlowArtsGlossaryEntry } from "@flow-arts/core";

export const VTG_GLOSSARY: FlowArtsGlossaryEntry[] = [
	{
		term: "together",
		aliases: ["tog"],
		definition:
			"Timing where both props pass the downbeat (south/bottom of the circle) simultaneously.",
		source: {
			claim:
				"Together (tog): both props pass the downbeat simultaneously",
			sourceType: "document",
			sourceRef: "VTG V.1, Timing and Direction section",
		},
		relatedTerms: ["split", "downbeat"],
		category: "timing",
		framework: "VTG",
	},
	{
		term: "split",
		definition:
			"Timing where the two props are 180 degrees out of phase — when one is at the downbeat, the other is at the top of its circle.",
		source: {
			claim: "Split: props are 180 degrees out of phase",
			sourceType: "document",
			sourceRef: "VTG V.1, Timing and Direction section",
		},
		relatedTerms: ["together", "downbeat"],
		category: "timing",
		framework: "VTG",
	},
	{
		term: "same",
		definition:
			"Direction where both props rotate the same way (both clockwise or both counterclockwise from the spinner's perspective).",
		source: {
			claim: "Same: both props rotating the same direction",
			sourceType: "document",
			sourceRef: "VTG V.1, Timing and Direction section",
		},
		relatedTerms: ["opposite"],
		category: "direction",
		framework: "VTG",
	},
	{
		term: "opposite",
		definition:
			"Direction where the two props rotate in opposite directions (one clockwise, one counterclockwise).",
		source: {
			claim: "Opposite: props rotating in opposite directions",
			sourceType: "document",
			sourceRef: "VTG V.1, Timing and Direction section",
		},
		relatedTerms: ["same"],
		category: "direction",
		framework: "VTG",
	},
	{
		term: "downbeat",
		definition:
			"The reference point for VTG timing, located at the south (bottom) of the prop's circular path. All timing classifications are determined by the relative position of each prop as it passes through the downbeat.",
		source: {
			claim:
				"The downbeat is the south/bottom of the circle, used as the reference point for timing",
			sourceType: "document",
			sourceRef: "VTG V.1, Timing and Direction section",
		},
		relatedTerms: ["together", "split"],
		category: "timing",
		framework: "VTG",
	},
	{
		term: "snapshot",
		definition:
			"What a pattern looks like at a specific moment in its path. Props are described as 'pointing in' (toward center) or 'pointing out' (away from center), captured at cardinal axis crossings.",
		source: {
			claim:
				"Snapshots: the way a specific pattern will look at a specific moment in its path around the pattern",
			sourceType: "document",
			sourceRef: "VTG V.1, Snapshots/Prop Facing section",
		},
		relatedTerms: ["pattern", "VTG Trinity"],
		category: "analysis",
		framework: "VTG",
	},
	{
		term: "pattern",
		aliases: ["shape"],
		definition:
			"The flower shape traced by the prop over a full 360-degree cycle. VTG writes the ratio hand:prop, hand cycles first and prop rotations second, so the classic families are 1:1, 1:3, and 1:5: one hand circle to one, three, or five prop rotations. This app displays the same order. The 1:1 set contains 40 patterns; the 1:3 set contains 64.",
		source: {
			claim:
				"Patterns/Shapes: the shapes made from timing and direction, categorized by rotation ratios",
			sourceType: "document",
			sourceRef: "VTG V.1, Pattern/Shape section",
		},
		relatedTerms: [
			"1:0 ratio",
			"2:1 ratio",
			"minimal beat shape",
			"snapshot",
			"VTG Trinity",
		],
		category: "analysis",
		framework: "VTG",
	},
	{
		term: "1:0 ratio",
		aliases: ["1:0", "float ratio"],
		definition:
			"The VTG hand:prop rotation ratio for TKA Float: the hand completes one cycle while the prop makes zero rotations.",
		source: {
			claim: "VTG 1:0 corresponds to TKA Float",
			sourceType: "community",
			sourceRef: "Austen Cloud domain correction, 2026-09-02",
		},
		relatedTerms: ["2:1 ratio", "pattern"],
		category: "analysis",
		framework: "VTG",
	},
	{
		term: "2:1 ratio",
		aliases: ["2:1"],
		definition:
			"The reduced VTG hand:prop rotation ratio corresponding to the TKA -0.25 turn value: two hand cycles for one prop rotation (1:0.5 reduced to 2:1). It is numeric and distinct from Float.",
		source: {
			claim: "VTG 2:1 corresponds to TKA -0.25",
			sourceType: "community",
			sourceRef: "Austen Cloud domain correction, 2026-09-02",
		},
		relatedTerms: ["1:0 ratio", "pattern"],
		category: "analysis",
		framework: "VTG",
	},
	{
		term: "minimal beat shape",
		definition:
			"One of the 10 foundational flower shapes in VTG. These are the simplest distinct patterns from which more complex shapes are derived. Brian Thompson contributed the minimal beat shapes section of VTG V.1.",
		source: {
			claim:
				"10 minimal beat shapes form the foundational set of flower patterns",
			sourceType: "document",
			sourceRef: "VTG V.1, Minimal Beat Shapes section (Brian Thompson)",
		},
		relatedTerms: ["pattern"],
		category: "analysis",
		framework: "VTG",
	},
	{
		term: "soft transition",
		definition:
			"A transition where both hand and prop maintain their direction of rotation. Preserves the arc/loop character of the figure being performed.",
		source: {
			claim:
				"Soft transition: both hand and poi maintain direction of rotation",
			sourceType: "document",
			sourceRef:
				"Transition Theory (Noel Yee & Jordan Campbell, 2010)",
		},
		relatedTerms: [
			"hard transition",
			"mixed transition",
			"arc",
			"loop (VTG)",
		],
		category: "transitions",
		framework: "VTG",
	},
	{
		term: "hard transition",
		definition:
			"A transition where both hand and prop reverse their direction of rotation. Produces a mirror image of the original figure traveling in the opposite direction. Arc/loop character is preserved.",
		source: {
			claim:
				"Hard transition: both hand and poi reverse direction, producing mirror image in opposite direction",
			sourceType: "document",
			sourceRef:
				"Transition Theory (Noel Yee & Jordan Campbell, 2010)",
		},
		relatedTerms: [
			"soft transition",
			"mixed transition",
			"arc",
			"loop (VTG)",
		],
		category: "transitions",
		framework: "VTG",
	},
	{
		term: "mixed transition",
		definition:
			"A transition where one element (hand or prop) reverses direction while the other maintains. Converts arcs to loops and vice versa. This is the mechanism behind CAPs.",
		source: {
			claim:
				"Mixed transition: one reverses, one maintains. Converts arcs to loops and vice versa.",
			sourceType: "document",
			sourceRef:
				"Transition Theory (Noel Yee & Jordan Campbell, 2010)",
		},
		relatedTerms: [
			"soft transition",
			"hard transition",
			"arc",
			"loop (VTG)",
		],
		category: "transitions",
		framework: "VTG",
	},
	{
		term: "arc",
		definition:
			"A movement where hand and prop paths run parallel and do not intersect. Extensions are arcs. Contrasted with loops in Transition Theory.",
		source: {
			claim:
				"Arcs: extensions where hand and poi paths run parallel, don't intersect",
			sourceType: "document",
			sourceRef:
				"Transition Theory (Noel Yee & Jordan Campbell, 2010)",
		},
		relatedTerms: ["loop (VTG)", "mixed transition"],
		category: "transitions",
		framework: "VTG",
	},
	{
		term: "loop (VTG)",
		definition:
			"A movement where the prop and hand paths intersect, producing antispin petals or isolations. Contrasted with arcs in Transition Theory. NOTE: This is VTG's arc/loop concept from Transition Theory, NOT the TKA LOOP system (which describes cyclic sequences built from transformation algebra).",
		source: {
			claim:
				"Loops: antispin/inspin petals and isolations where poi and hand paths intersect",
			sourceType: "document",
			sourceRef:
				"Transition Theory (Noel Yee & Jordan Campbell, 2010)",
		},
		relatedTerms: ["arc", "mixed transition"],
		category: "transitions",
		framework: "VTG",
	},
	{
		term: "quarter time",
		definition:
			"A 90-degree phase offset between the two props. Neither together (0 degrees) nor split (180 degrees). A community extension beyond VTG's original binary timing classification.",
		source: {
			claim:
				"Quarter time is a community extension describing 90-degree phase offset, not part of original VTG binary timing",
			sourceType: "community",
			sourceRef: "Community usage, not in VTG V.1 or V.2",
		},
		relatedTerms: ["together", "split"],
		category: "timing",
		framework: "VTG",
	},
	{
		term: "driving style",
		definition:
			"A categorization of movement approaches in poi. Eight recognized styles: isolation, antispin, atomics, pendulums, extension, cateye, CAP, and hybrid. Taxonomy attributed to Insignia.",
		source: {
			claim:
				"Eight driving styles categorized by Insignia: isolation, antispin, atomics, pendulums, extension, cateye, CAP, hybrid",
			sourceType: "community",
			sourceRef: "Insignia's driving style taxonomy",
		},
		relatedTerms: ["pattern"],
		category: "classification",
		framework: "VTG",
	},
	{
		term: "VTG Trinity",
		aliases: ["trinity"],
		definition:
			"The three interconnected foundational concepts of VTG: (1) timing and direction, (2) snapshots/prop facing, and (3) pattern/shape. Together, these three areas make up what is called transition theory. Understanding all three and their relationships is central to VTG literacy.",
		source: {
			claim:
				"The 3 areas in the VTG Trinity make up what is called transition theory: timing/direction, snapshots/prop facing, and pattern/shape.",
			sourceType: "document",
			sourceRef: "Flow Arts Institute VTG page (Noel Yee)",
		},
		relatedTerms: ["together", "split", "same", "opposite", "snapshot", "pattern"],
		category: "core concepts",
		framework: "VTG",
	},
];
