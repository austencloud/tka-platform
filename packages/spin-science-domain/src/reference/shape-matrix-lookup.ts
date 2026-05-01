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

export function getShapeMatrixEntry(
	leftShapeId: string,
	rightShapeId: string,
): ShapeMatrixEntry | undefined {
	// TODO: Implement lookup once matrix data is populated
	return SHAPE_MATRIX_ENTRIES.find(
		(e) => e.leftShapeId === leftShapeId && e.rightShapeId === rightShapeId,
	);
}

export function getShapeMatrixRow(leftShapeId: string): ShapeMatrixEntry[] {
	// TODO: Implement once matrix data is populated
	return SHAPE_MATRIX_ENTRIES.filter((e) => e.leftShapeId === leftShapeId);
}

export function getFlowerShape(id: string): FlowerShape | undefined {
	return SHAPE_MATRIX_SHAPES.find((s) => s.id === id);
}

export function listFlowerShapes(): FlowerShape[] {
	return SHAPE_MATRIX_SHAPES;
}
