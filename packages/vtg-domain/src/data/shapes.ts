/**
 * VTG Minimal Beat Shapes
 *
 * The 10 minimal beat shapes that form the building blocks of prop movement.
 * Each shape describes the path traced by a single prop in a single beat.
 */

import type { SourcedClaim } from "@flow-arts/core";

export interface MinimalBeatShape {
	/** Unique identifier */
	id: string;
	/** Shape name */
	name: string;
	/** Alternative names used in the community */
	aliases?: string[];
	/** Plain-language description of the path traced */
	description: string;
	/** Number of petals or loops in the shape, if applicable */
	petals?: number;
	/** Where this shape definition comes from */
	source: SourcedClaim;
}

/**
 * The 10 minimal beat shapes from VTG V1 (p.4).
 *
 * These are all possible minimal beat shapes where the prop radius equals
 * 1 unit circle radius and every one rotation of the hand corresponds to
 * one rotation of the prop (the 1:1 set).
 *
 * Combined with the 4 original timing/direction categories, these 10 shapes
 * produce 40 patterns in the 1:1 set.
 */
export const VTG_SHAPES: MinimalBeatShape[] = [
	{
		id: "isolation",
		name: "Isolation",
		aliases: ["iso"],
		description:
			"The prop traces a stationary circle while the hand orbits around it. The prop appears to stay fixed in space.",
		petals: 1,
		source: {
			claim:
				"Isolation is one of 10 minimal beat shapes where prop size is 1 unit circle radius and every hand rotation corresponds to one prop rotation.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "extension",
		name: "Extension",
		aliases: ["ext"],
		description:
			"The prop extends outward from the hand's orbit, tracing a larger circle. The most common and intuitive spinning pattern.",
		petals: 1,
		source: {
			claim:
				"Extension is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "vertical-antispin",
		name: "Vertical Antispin",
		aliases: ["v-antispin", "vertical flower"],
		description:
			"The prop spins opposite to the hand's orbit in the vertical plane, creating a flower-like pattern with petals stacked vertically.",
		petals: 4,
		source: {
			claim:
				"Vertical Antispin is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "horizontal-antispin",
		name: "Horizontal Antispin",
		aliases: ["h-antispin", "horizontal flower"],
		description:
			"The prop spins opposite to the hand's orbit in the horizontal plane, creating a flower-like pattern with petals arranged side by side.",
		petals: 4,
		source: {
			claim:
				"Horizontal Antispin is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "ext-vertical-antispin",
		name: "Extension / Vertical Antispin",
		aliases: ["ext/v-antispin"],
		description:
			"A hybrid shape combining extension and vertical antispin movement within a single beat.",
		source: {
			claim:
				"Extension / Vertical Antispin is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "ext-horizontal-antispin",
		name: "Extension / Horizontal Antispin",
		aliases: ["ext/h-antispin"],
		description:
			"A hybrid shape combining extension and horizontal antispin movement within a single beat.",
		source: {
			claim:
				"Extension / Horizontal Antispin is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "iso-extension",
		name: "Isolation / Extension",
		aliases: ["iso/ext"],
		description:
			"A hybrid shape combining isolation and extension movement within a single beat.",
		source: {
			claim:
				"Isolation / Extension is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "vertical-antispin-iso",
		name: "Vertical Antispin / Isolation",
		aliases: ["v-antispin/iso"],
		description:
			"A hybrid shape combining vertical antispin and isolation movement within a single beat.",
		source: {
			claim:
				"Vertical Antispin / Isolation is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "horizontal-antispin-iso",
		name: "Horizontal Antispin / Isolation",
		aliases: ["h-antispin/iso"],
		description:
			"A hybrid shape combining horizontal antispin and isolation movement within a single beat.",
		source: {
			claim:
				"Horizontal Antispin / Isolation is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
	{
		id: "vertical-antispin-horizontal-antispin",
		name: "V. Antispin / H. Antispin",
		aliases: ["v-antispin/h-antispin"],
		description:
			"A hybrid shape combining vertical antispin and horizontal antispin movement within a single beat.",
		source: {
			claim:
				"V. Antispin / H. Antispin is one of 10 minimal beat shapes in the VTG 1:1 set.",
			sourceType: "document",
			sourceRef: "VTG V1 p.4",
		},
	},
];
