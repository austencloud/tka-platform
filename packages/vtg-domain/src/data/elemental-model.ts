/**
 * Elemental Model
 *
 * IMPORTANT: The elemental model is a SEPARATE classification system that maps
 * to VTG categories but is NOT part of VTG itself. VTG's creator Noel Yee does
 * not endorse this overlay.
 *
 * The four classical elements (Earth, Water, Air, Fire) were popularized by
 * Leonardo Icaza (@poidanceflow, Vancouver BC) and taught in video form by
 * Ronan McLoughlin. They provide intuitive metaphors for the four VTG
 * timing/direction categories but are a community overlay, not VTG vocabulary.
 *
 * Sun and Moon are Austen Cloud's unpublished additions that extend the
 * elemental model to cover quarter-time (gamma) patterns. Nobody else in the
 * flow arts community uses these yet.
 */

import type { SourcedClaim } from "@flow-arts/core";

export interface ElementDefinition {
	/** Unique identifier */
	id: string;
	/** Element name: Earth, Water, Air, Fire, Sun, Moon */
	name: string;
	/** VTG category this element maps to */
	vtgCategoryId: string;
	/** Metaphorical description */
	metaphor: string;
	/** Movement quality this element represents */
	movementQuality: string;
	/**
	 * Origin of this element mapping.
	 * "community" = Earth/Water/Air/Fire (Leonardo Icaza, Ronan McLoughlin)
	 * "tka-interpretation" = Sun/Moon (Austen Cloud, unpublished)
	 */
	sourceType: "community" | "tka-interpretation";
	/** Where this mapping comes from */
	source: SourcedClaim;
	/**
	 * TKA letter types that share this element.
	 * For same-direction elements, letters are grid-mode invariant (one letter per slot).
	 * For opposite-direction elements, letters permute between diamond and box mode,
	 * so each slot is a pair like "DJ" meaning D in one mode, J in the other.
	 */
	tkaLetterTypes?: string[];
}

/**
 * The six elements that map to VTG timing/direction categories.
 *
 * This is a SEPARATE classification system, not part of VTG. It is included
 * here because it is widely used in the flow arts community alongside VTG
 * categories, and because TKA's 6-Element Model builds on it. But querying
 * a VTG category should not return an elemental name -- the two systems are
 * independent.
 */
export const VTG_ELEMENTS: ElementDefinition[] = [
	{
		id: "earth",
		name: "Earth",
		vtgCategoryId: "together-same",
		metaphor: "Grounded, stable, both hands moving in unison like roots holding firm",
		movementQuality: "Together timing, same direction (TS)",
		sourceType: "community",
		source: {
			claim:
				"Earth maps to Together-Same (TS). The four classical elements (Earth, Water, Air, Fire) " +
				"were popularized by Leonardo Icaza (@poidanceflow, Vancouver BC) and taught in video form " +
				"by Ronan McLoughlin. This is a community overlay, not part of VTG itself.",
			sourceType: "community",
			sourceRef: "Leonardo Icaza (@poidanceflow), Ronan McLoughlin",
		},
		tkaLetterTypes: ["G", "H", "I"],
	},
	{
		id: "water",
		name: "Water",
		vtgCategoryId: "split-same",
		metaphor: "Flowing, alternating like waves while traveling the same direction",
		movementQuality: "Split timing, same direction (SS)",
		sourceType: "community",
		source: {
			claim:
				"Water maps to Split-Same (SS). Popularized by Leonardo Icaza, " +
				"taught by Ronan McLoughlin. Community overlay, not part of VTG.",
			sourceType: "community",
			sourceRef: "Leonardo Icaza (@poidanceflow), Ronan McLoughlin",
		},
		tkaLetterTypes: ["A", "B", "C"],
	},
	{
		id: "sun",
		name: "Sun",
		vtgCategoryId: "quarter-same",
		metaphor: "Radiant, quarter-time offset while both hands trace the same direction",
		movementQuality: "Quarter timing, same direction (QS)",
		sourceType: "tka-interpretation",
		source: {
			claim:
				"Sun maps to Quarter-Same (QS). Added by Austen Cloud to complete the " +
				"six-element model for gamma/quarter-time patterns not covered by the original four elements. " +
				"Unpublished -- not yet known in the wider flow arts community.",
			sourceType: "tka-interpretation",
			sourceRef: "Austen Cloud",
		},
		tkaLetterTypes: ["S", "T", "U", "V"],
	},
	{
		id: "air",
		name: "Air",
		vtgCategoryId: "together-opposite",
		metaphor: "Light and open, hands meeting then separating like breath",
		movementQuality: "Together timing, opposite direction (TO)",
		sourceType: "community",
		source: {
			claim:
				"Air maps to Together-Opposite (TO). Popularized by Leonardo Icaza, " +
				"taught by Ronan McLoughlin. Community overlay, not part of VTG. " +
				"Opposite-direction elements permute between diamond and box grid modes.",
			sourceType: "community",
			sourceRef: "Leonardo Icaza (@poidanceflow), Ronan McLoughlin",
		},
		tkaLetterTypes: ["DJ", "EK", "FL"],
	},
	{
		id: "fire",
		name: "Fire",
		vtgCategoryId: "split-opposite",
		metaphor: "Intense, alternating hands that clash in opposite directions like flames",
		movementQuality: "Split timing, opposite direction (SO)",
		sourceType: "community",
		source: {
			claim:
				"Fire maps to Split-Opposite (SO). Popularized by Leonardo Icaza, " +
				"taught by Ronan McLoughlin. Community overlay, not part of VTG. " +
				"Opposite-direction elements permute between diamond and box grid modes.",
			sourceType: "community",
			sourceRef: "Leonardo Icaza (@poidanceflow), Ronan McLoughlin",
		},
		tkaLetterTypes: ["DJ", "EK", "FL"],
	},
	{
		id: "moon",
		name: "Moon",
		vtgCategoryId: "quarter-opposite",
		metaphor: "Mysterious, quarter-time offset with hands traveling in opposite directions",
		movementQuality: "Quarter timing, opposite direction (QO)",
		sourceType: "tka-interpretation",
		source: {
			claim:
				"Moon maps to Quarter-Opposite (QO). Added by Austen Cloud to complete the " +
				"six-element model. Unpublished -- not yet known in the wider flow arts community. " +
				"Opposite-direction elements permute between diamond and box grid modes.",
			sourceType: "tka-interpretation",
			sourceRef: "Austen Cloud",
		},
		tkaLetterTypes: ["MP", "NQ", "OR"],
	},
];
