/**
 * Shape Matrix Lookup
 *
 * Functions for querying the Shape Matrix: look up what happens
 * when you combine a left-hand shape with a right-hand shape.
 */

import type { ShapeMatrixEntry, FlowerShape } from "../data/shape-matrix.js";
import {
	SHAPE_MATRIX_ENTRIES,
	SHAPE_MATRIX_SHAPES,
} from "../data/shape-matrix.js";

/** Get a single matrix entry by left-hand and right-hand shape IDs */
export function getShapeMatrixEntry(
	leftShapeId: string,
	rightShapeId: string,
): ShapeMatrixEntry | undefined {
	// TODO: Implement lookup once matrix data is populated
	return SHAPE_MATRIX_ENTRIES.find(
		(e) => e.leftShapeId === leftShapeId && e.rightShapeId === rightShapeId,
	);
}

/** Get an entire row of the matrix (all combinations for a given left-hand shape) */
export function getShapeMatrixRow(leftShapeId: string): ShapeMatrixEntry[] {
	// TODO: Implement once matrix data is populated
	return SHAPE_MATRIX_ENTRIES.filter((e) => e.leftShapeId === leftShapeId);
}

/** Get a flower shape by ID */
export function getFlowerShape(id: string): FlowerShape | undefined {
	return SHAPE_MATRIX_SHAPES.find((s) => s.id === id);
}

/** List all flower shapes used in the matrix */
export function listFlowerShapes(): FlowerShape[] {
	return SHAPE_MATRIX_SHAPES;
}
