/**
 * Generation Layer - Active pipeline for constrained sequence building
 *
 * Constraints, parsing, presets, builder, analysis, and reporting.
 */

// Constraint types
export type {
  IConstraint,
  IVariationConstraint,
  ISequenceConstraint,
  ConstraintContext,
  ConstraintScore,
  ConstraintSet,
  VariationScore,
  SearchState,
  ConstraintReport,
  ConstraintDetail,
  PictographData,
  MotionData,
} from "./constraints/types.js";

export { ConstraintType, ConstraintCategory, type ConstraintMode } from "./constraints/constraint-types.js";

// Style constraints
export { ContinuityConstraint, type ContinuityMode } from "./constraints/style/continuity-constraint.js";
export {
  MotionTypeConstraint,
  type MotionTypeConstraintOptions,
  type MotionTypeMode,
  type HandTarget,
  allProMotions,
  allAntiMotions,
  noDashMotions,
  noStaticMotions,
  preferProMotions,
  preferAntiMotions,
} from "./constraints/style/motion-type-constraint.js";
export {
  RotationDirectionConstraint,
  type RotationDirectionConstraintOptions,
  type RotationDirectionMode,
  type RotationDirection,
  blueClockwise,
  blueCounterClockwise,
  redClockwise,
  redCounterClockwise,
  allClockwise,
  allCounterClockwise,
} from "./constraints/style/rotation-direction-constraint.js";
export { ReversalConstraint, type ReversalMode } from "./constraints/style/reversal-constraint.js";
export {
  HandPathReversalConstraint,
  type HandPathMode,
  HandPath,
  getHandpathDirection,
  maximizeHandPathContinuity,
  enforceHandPathContinuity,
  handReversalEveryBeat,
} from "./constraints/style/hand-path-constraint.js";
export {
  DashPreferenceConstraint,
  type DashPreferenceMode,
  maximizeDashes,
  requireDashes,
  preferDashes,
  DashAvoidanceConstraint,
  type DashAvoidanceMode,
  minimizeDashes,
  avoidDashes,
  forbidDashes,
} from "./constraints/style/dash-preference-constraint.js";
export {
  PerHandDashConstraint,
  type HandTarget as PerHandTarget,
  type HandDashMode,
  blueHandMaximizeDash,
  blueHandMinimizeDash,
  blueHandRequireDash,
  blueHandForbidDash,
  redHandMaximizeDash,
  redHandMinimizeDash,
  redHandRequireDash,
  redHandForbidDash,
  perHandDash,
} from "./constraints/style/per-hand-dash-constraint.js";

// Parsing
export {
  parseConstraints,
  parseConstraintSet,
  getAvailablePatterns,
  getAvailableSynonyms,
  type ParseResult,
} from "./constraints/parsing/constraint-parser.js";

// Presets
export {
  getPreset,
  getPresetConstraintSet,
  listPresetNames,
  listPresets,
  type PresetName,
  type PresetDefinition,
} from "./constraints/presets/preset-constraints.js";

// Builder
export {
  buildConstrainedSequence,
  emptyConstraintSet,
  type ConstrainedSequenceResult,
  type ConstrainedBuilderOptions,
} from "./builder/constrained-builder.js";

// Reporting
export {
  generateConstraintReport,
  formatConstraintReport,
} from "./constraints/reporting/report-generator.js";

// Scoring
export {
  scoreVariation,
  scoreAndRankVariations,
  filterViableVariations,
  calculateSequenceScore,
} from "./builder/variation-scorer.js";

// Search state
export {
  createInitialState,
  extendState,
  pruneBeam,
  getBestState,
  countReversals,
  calculateContinuityPercentage,
  type BeamSearchConfig,
  DEFAULT_BEAM_CONFIG,
} from "./builder/search-state.js";

// Bridge scoring
export {
  scoreBridgeOptions,
  selectBestBridge,
  generateOptimalBridgeSelections,
  isDashLetter,
  getDashScore,
  getPerHandDashScore,
  getCombinedPerHandDashScore,
} from "./builder/bridge-scorer.js";

// Feasibility analysis
export {
  analyzeTransition,
  analyzeWord,
  analyzeWordFeasibility,
  buildTransitionMatrix,
  getTransitionMatrix,
  clearTransitionMatrixCache,
  suggestAlternatives,
  explainConstraintImpossibility,
  type TransitionAnalysis,
  type WordAnalysis,
  type TransitionFeasibility,
  type TransitionMatrix,
  type WordFeasibility,
} from "./constraints/analysis/index.js";
