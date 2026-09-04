export type { VTGCategory } from "./data/categories.js";
export type { MinimalBeatShape } from "./data/shapes.js";
export type { VTGPattern } from "./data/patterns.js";
export type {
	VTGTransition,
	TransitionType,
	TransitionMatrix,
	TransitionMatrixEntry,
} from "./data/transitions.js";
export type {
	VTGOrientation,
	GridOrientation,
	PlaneOrientation,
} from "./data/orientations.js";
export type { VTGHybrid, HybridType } from "./data/hybrids.js";
export type { DrivingStyle } from "./data/driving-styles.js";
export type { SourceDocument } from "./data/documents.js";

// Types (from reference files)
export type {
	CrossDomainMapping,
} from "./reference/cross-domain.js";
export type {
	VTGSearchResult,
	VTGSearchResultType,
} from "./reference/search.js";
export type {
	ExactTurnFraction,
	SpinRatio,
	SpinStyle,
	TkaTurnEquivalent,
} from "./reference/spin-ratio.js";

export { VTG_CATEGORIES } from "./data/categories.js";
export { VTG_SHAPES } from "./data/shapes.js";
export { VTG_PATTERNS, VTG_PATTERN_MATRIX } from "./data/patterns.js";
export {
	VTG_TRANSITIONS,
	VTG_TRANSITION_MATRICES,
} from "./data/transitions.js";
export { VTG_ORIENTATIONS } from "./data/orientations.js";
export { VTG_HYBRIDS, THREE_D_PATTERN_COUNT } from "./data/hybrids.js";
export { VTG_DRIVING_STYLES } from "./data/driving-styles.js";
export { VTG_CONTRIBUTORS } from "./data/contributors.js";
export { VTG_GLOSSARY } from "./data/glossary.js";
export { VTG_DOCUMENTS } from "./data/documents.js";
export { VTG_EXTERNAL_LINKS } from "./data/external-links.js";

export type { ElementDefinition } from "./data/elemental-model.js";
export { VTG_ELEMENTS } from "./data/elemental-model.js";

export { getVTGPattern, getVTGPatterns } from "./reference/pattern-lookup.js";
export {
	getVTGTransition,
	getTransitionBetween,
	getTransitionsFrom,
} from "./reference/transition-lookup.js";
export { getVTGShape, listVTGShapes } from "./reference/shape-lookup.js";
export {
	getVTGCategory,
	listVTGCategories,
} from "./reference/category-lookup.js";
export { vtgToTKA, tkaToVTG } from "./reference/cross-domain.js";
export { searchVTG } from "./reference/search.js";
export {
	buildBoundedSpinRatios,
	buildTheorySpinRatioAtlas,
	jointSpinRatioClosureHandCycles,
	makeSpinRatio,
	parseSpinRatio,
	spinRatioClosureHandCycles,
	spinRatioEquals,
	spinRatioKey,
	spinRatioPetals,
	spinRatioToTkaTurns,
	spinRatioToTkaTurnFraction,
	THEORY_SPIN_RATIO_MAX_PART,
} from "./reference/spin-ratio.js";
