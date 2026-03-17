/**
 * VTG Source Documents
 *
 * Metadata for primary source documents: VTG V1 PDF, VTG V2 (if released),
 * and other foundational texts that define the framework.
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

export const VTG_DOCUMENTS: SourceDocument[] = [
	{
		url: "https://noelyee.com/instruction/vulcan-tech-gospel/",
		title: "Vulcan Tech Gospel V.1",
		type: "document",
		author: "Noel Yee (compiler), Forest Sterns (cover artwork)",
		year: 2011,
		version: "1.0",
		pageCount: 13,
		summary:
			"Core VTG theory document. Covers: Transition Theory (Noel Yee & Jordan Campbell), " +
			"Minimal Beat Shapes (Brian Thompson), Necessity of 40 Patterns (Noel Yee), " +
			"Transitions Between Shapes (David Cantor), 3D Hybrid Shapes (Maiki Nope, Ben Drexler, Noel Yee). " +
			"Establishes the timing/direction classification framework that became the foundation of VTG.",
	},
	{
		url: "https://noelyee.com/instruction/vulcan-tech-gospel/",
		title: "VTG #2 Beta — Antispin vs Spin Transition Theory",
		type: "document",
		author: "David Cantor, Noel Yee",
		year: 2011,
		version: "2.0-beta",
		pageCount: 50,
		summary:
			"Chapter 2: Antispin vs Spin Transition Theory. Covers Diamond/Box Antispin vs " +
			"Two Petal Spin Flower in Vertical and Horizontal orientations. " +
			"Accompanied by Index volumes 1/3, 2/3, 3/3 with shapes illustrated by Alien Jon. " +
			"Published October 2011.",
	},
	{
		url: "https://sirlorq.wordpress.com/tech-tiles/",
		title: "Book of P.H.A.T. Vol 1 — Patterns, Hybrids, And Transitions",
		type: "document",
		author: "Lorq Nichols",
		summary:
			"Two-part document. Part 1: theory manual covering VTG patterns and transitions. " +
			"Part 2: 64 patterns rendered in Tech Tiles notation. " +
			"Extends VTG with Lorq's Tech Tiles visual notation system.",
	},
	{
		url: "https://flowartsinstitute.com/fai-swag-vtg-poster/",
		title: "VTG Poster",
		type: "document",
		author: "Flow Arts Institute",
		summary:
			"Visual reference poster highlighting content from VTG V.1 and V.2. " +
			"Available as physical print from the Flow Arts Institute.",
	},
];
