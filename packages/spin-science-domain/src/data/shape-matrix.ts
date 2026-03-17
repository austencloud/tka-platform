/**
 * Shape Matrix
 *
 * Lorq Nichols' multiplication table for tricks: left-hand flower shapes
 * crossed with right-hand flower shapes in an 8x8 visual grid.
 *
 * Originally created 2012, reworked 2014. Went viral on Poi Chat in 2016
 * (353 shares). Each cell represents the combined pattern when the left
 * hand performs one flower shape and the right hand performs another.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** A single flower shape used as a row or column header in the matrix */
export interface FlowerShape {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Alternative names used in the community */
	aliases?: string[];
	/** Plain-language description of the shape */
	description: string;
	/** Where this shape definition comes from */
	source: SourcedClaim;
}

/** A single cell in the Shape Matrix: left shape x right shape = combined pattern */
export interface ShapeMatrixEntry {
	/** Row shape (left hand) */
	leftShapeId: string;
	/** Column shape (right hand) */
	rightShapeId: string;
	/** Name of the resulting combined pattern */
	resultName: string;
	/** Plain-language description of the combined pattern */
	description: string;
	/** Where this mapping comes from */
	source: SourcedClaim;
}

// TODO: Populate with the 8 flower shapes used as row/column headers
export const SHAPE_MATRIX_SHAPES: FlowerShape[] = [];

// TODO: Populate with the 8x8 = 64 matrix entries
export const SHAPE_MATRIX_ENTRIES: ShapeMatrixEntry[] = [];
