/**
 * Constraint System - Public API
 *
 * This module provides constraint-based sequence generation for TKA.
 * Users can specify constraints in natural language and the system
 * will find the best matching sequence.
 */

// Types
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
} from "./types.js";

export {
  ConstraintType,
  ConstraintCategory,
  type ConstraintMode,
} from "./constraint-types.js";

// Constraint implementations
export {
  ContinuityConstraint,
  type ContinuityMode,
} from "./implementations/continuity-constraint.js";

export {
  MotionTypeConstraint,
  type MotionTypeConstraintOptions,
  type MotionTypeMode,
  type HandTarget,
  // Convenience factories
  allProMotions,
  allAntiMotions,
  noDashMotions,
  noStaticMotions,
  preferProMotions,
  preferAntiMotions,
} from "./implementations/motion-type-constraint.js";

export {
  RotationDirectionConstraint,
  type RotationDirectionConstraintOptions,
  type RotationDirectionMode,
  type RotationDirection,
  // Convenience factories
  leftClockwise,
  leftCounterClockwise,
  rightClockwise,
  rightCounterClockwise,
  allClockwise,
  allCounterClockwise,
} from "./implementations/rotation-direction-constraint.js";

export {
  ReversalConstraint,
  type ReversalMode,
} from "./implementations/reversal-constraint.js";

export {
  HandPathReversalConstraint,
  type HandPathMode,
  HandPath,
  getHandpathDirection,
  // Convenience factories
  maximizeHandPathContinuity,
  enforceHandPathContinuity,
  handReversalEveryBeat,
} from "./implementations/hand-path-constraint.js";

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
} from "./implementations/dash-preference-constraint.js";

export {
  PerHandDashConstraint,
  type HandTarget as PerHandTarget,
  type HandDashMode,
  // Convenience factories
  leftHandMaximizeDash,
  leftHandMinimizeDash,
  leftHandRequireDash,
  leftHandForbidDash,
  rightHandMaximizeDash,
  rightHandMinimizeDash,
  rightHandRequireDash,
  rightHandForbidDash,
  perHandDash,
} from "./implementations/per-hand-dash-constraint.js";

// Parser
export {
  parseConstraints,
  parseConstraintSet,
  getAvailablePatterns,
  getAvailableSynonyms,
  type ParseResult,
} from "./parser/constraint-parser.js";

// Presets
export {
  getPreset,
  getPresetConstraintSet,
  listPresetNames,
  listPresets,
  type PresetName,
  type PresetDefinition,
} from "./presets/preset-constraints.js";

// Builder
export {
  buildConstrainedSequence,
  emptyConstraintSet,
  type ConstrainedSequenceResult,
  type ConstrainedBuilderOptions,
} from "./search/constrained-builder.js";

// Reporting
export {
  generateConstraintReport,
  formatConstraintReport,
} from "./reporting/report-generator.js";

// Scoring
export {
  scoreVariation,
  scoreAndRankVariations,
  filterViableVariations,
  calculateSequenceScore,
} from "./search/variation-scorer.js";

// Search state utilities
export {
  createInitialState,
  extendState,
  pruneBeam,
  getBestState,
  countReversals,
  calculateContinuityPercentage,
  type BeamSearchConfig,
  DEFAULT_BEAM_CONFIG,
} from "./search/search-state.js";

// Bridge scoring (for constraint-aware bridge selection)
export {
  scoreBridgeOptions,
  selectBestBridge,
  generateOptimalBridgeSelections,
  isDashLetter,
  getDashScore,
  getPerHandDashScore,
  getCombinedPerHandDashScore,
} from "./search/bridge-scorer.js";

// Feasibility analysis (pre-generation constraint checking)
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
} from "./analysis/index.js";
