export type { FlowerShape, ShapeMatrixEntry } from "./data/shape-matrix.js";
export type { PHATPattern } from "./data/phat-chart.js";
export type { PlaneDefinition } from "./data/three-planes.js";
export type { ArmPosition, ArmPath } from "./data/arm-paths.js";
export type { Pattern324, MinimalBeatShapeId } from "./data/patterns-324.js";
export type { AtomicShape, AtomicHybrid } from "./data/atomic-hybrids.js";
export type {
	TechTileElement,
	TechTilesConfig,
	RotationDirection,
} from "./data/tech-tiles.js";
export type { SourceDocument } from "./data/documents.js";

// Types (from reference files)
export type {
	SpinScienceSearchResult,
	SpinScienceSearchResultType,
} from "./reference/search.js";

export {
	SHAPE_MATRIX_SHAPES,
	SHAPE_MATRIX_ENTRIES,
} from "./data/shape-matrix.js";
export { PHAT_PATTERNS } from "./data/phat-chart.js";
export { PLANES } from "./data/three-planes.js";
export { ARM_POSITIONS, ARM_PATHS } from "./data/arm-paths.js";
export { PATTERNS_324 } from "./data/patterns-324.js";
export { ATOMIC_SHAPES, ATOMIC_HYBRIDS } from "./data/atomic-hybrids.js";
export { TECH_TILES_CONFIGS } from "./data/tech-tiles.js";
export { SPIN_SCIENCE_CONTRIBUTORS } from "./data/contributors.js";
export { SPIN_SCIENCE_GLOSSARY } from "./data/glossary.js";
export { SPIN_SCIENCE_DOCUMENTS } from "./data/documents.js";
export { SPIN_SCIENCE_EXTERNAL_LINKS } from "./data/external-links.js";

export {
	getShapeMatrixEntry,
	getShapeMatrixRow,
	getFlowerShape,
	listFlowerShapes,
} from "./reference/shape-matrix-lookup.js";
export {
	get324Pattern,
	get324Patterns,
	getAtomicHybrid,
	getAtomicHybrids,
} from "./reference/pattern-lookup.js";
export {
	getPlane,
	getPlaneByAbbreviation,
	listPlanes,
} from "./reference/plane-lookup.js";
export { searchSpinScience } from "./reference/search.js";
