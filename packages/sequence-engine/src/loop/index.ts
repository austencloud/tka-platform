/**
 * LOOP Module Index
 *
 * Exports all LOOP-related functionality for the MCP server.
 */

// Types and enums
export {
  LOOPType,
  Period,
  LOOP_TYPE_LABELS,
  LOOP_TYPE_DESCRIPTIONS,
  ALL_LOOP_TYPES,
  ROTATED_LOOP_TYPES,
  type LOOPOption,
  type LOOPValidationResult,
  type LOOPGenerationOptions,
} from "./loop-types.js";

// LOOPSpec compositional types
export {
  LOOPComponent,
  RESERVED_ORIENTATION_PRIMITIVES,
  type LOOPDomain,
  type ComponentSpec,
  type PropLOOPSpec,
  type LOOPSpec,
  type ComponentSpecWire,
  type PropLOOPSpecWire,
  type LOOPSpecWire,
  loopSpecToWire,
  loopSpecFromWire,
  loopSpecPeriod,
  PERIOD_HALVED,
  PERIOD_QUARTERED,
  PERIOD_OCTAVED,
  singleComponent,
  symmetricSpec,
  allActiveComponents,
  isEmptySpec,
  specsAreEqual,
  EMPTY_PROP_SPEC,
  loopSpecFromLegacy,
  validateLOOPSpec,
  type LOOPSpecValidationError,
} from "./loop-spec.js";

// Validator
export {
  isLOOPValidForPositionPair,
  getLOOPOptionsForPositionPair,
  getExpectedEndPosition,
  getValidEndPositionsForLoop,
  findBridgeLettersForLoop,
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "./validation/LOOPValidator.js";

// Position maps - circular (rotation-based)
export {
  HALF_POSITION_MAP,
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
  LOCATION_MAP_EIGHTH_CW,
  LOCATION_MAP_CLOCKWISE,
  LOCATION_MAP_COUNTER_CLOCKWISE,
  LOCATION_MAP_DASH,
  LOCATION_MAP_STATIC,
  HAND_ROTATION_DIRECTION_MAP,
  getHandRotationDirection,
  getLocationMapForHandRotation,
  getPositionZone,
  getPositionGroup,
  analyzeZoneCoverage,
  type PositionZone,
  type ZoneCoverageAnalysis,
} from "./position-maps/circular-position-maps.js";

// Position maps - strict (mirror/swap/invert transformations)
export {
  VERTICAL_MIRROR_POSITION_MAP,
  VERTICAL_MIRROR_LOCATION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_LOCATION_MAP,
  SWAPPED_POSITION_MAP,
  INVERTED_LETTER_MAP,
  ALPHA_BETA_COUNTERPART_LETTER_MAP,
  COMPOUND_LETTER_MAP,
  LetterTransformationType,
  getInvertedLetter,
  getAlphaBetaCounterpart,
  getCompoundLetter,
  hasTransformationRelationship,
  getLetterRelationships,
  getRelatedLetters,
  analyzeStepPairTransformation,
  MIRRORED_LOOP_VALIDATION_SET,
  FLIPPED_LOOP_VALIDATION_SET,
  SWAPPED_LOOP_VALIDATION_SET,
  MIRRORED_SWAPPED_VALIDATION_SET,
  INVERTED_LOOP_VALIDATION_SET,
  MIRRORED_INVERTED_VALIDATION_SET,
  ROTATED_SWAPPED_QUARTERED_VALIDATION_SET,
  ROTATED_SWAPPED_HALVED_VALIDATION_SET,
} from "./position-maps/strict-loop-position-maps.js";

// Detection (analyzes sequence steps to identify LOOP patterns)
export {
  detectLOOPFromSteps,
  isSequenceCircular,
  LOOPDetectorClass,
  loopDetectorClass,
  type LOOPComponentId,
  type LOOPDetectionResult,
  type RichLOOPDetectionResult,
  type CompoundPattern,
  type DetectionConfidence,
} from "./detection/LOOPDetector.js";

// Orientation cycle detection
export {
  detectOrientationCycle,
  type OrientationCycleResult,
} from "./detection/OrientationCycleDetector.js";

// Executor
export {
  executeLOOP,
  type LOOPExecutionResult,
  type PictographData,
} from "./execution/LOOPExecutor.js";

// Executor interface
export type { ILOOPExecutor } from "./execution/ILOOPExecutor.js";

// Orientation helpers for executors
export { updateStepOrientations } from "./execution/orientation-helpers.js";

// Class-based LOOP executors (strict)
export { StrictRotatedExecutor, strictRotatedExecutor } from "./execution/StrictRotatedExecutor.js";
export { StrictMirroredExecutor, strictMirroredExecutor } from "./execution/StrictMirroredExecutor.js";
export { StrictFlippedExecutor, strictFlippedExecutor } from "./execution/StrictFlippedExecutor.js";
export { StrictSwappedExecutor, strictSwappedExecutor } from "./execution/StrictSwappedExecutor.js";
export { StrictInvertedExecutor, strictInvertedExecutor } from "./execution/StrictInvertedExecutor.js";
export { RewoundExecutor, rewoundExecutor } from "./execution/RewoundExecutor.js";

// Class-based LOOP executors (compound)
export { MirroredSwappedExecutor, mirroredSwappedExecutor } from "./execution/MirroredSwappedExecutor.js";
export { SwappedInvertedExecutor, swappedInvertedExecutor } from "./execution/SwappedInvertedExecutor.js";
export { MirroredInvertedExecutor, mirroredInvertedExecutor } from "./execution/MirroredInvertedExecutor.js";
export { RotatedSwappedExecutor, rotatedSwappedExecutor } from "./execution/RotatedSwappedExecutor.js";
export { RotatedInvertedExecutor, rotatedInvertedExecutor } from "./execution/RotatedInvertedExecutor.js";
export { MirroredRotatedExecutor, mirroredRotatedExecutor } from "./execution/MirroredRotatedExecutor.js";
export { MirroredRotatedInvertedExecutor, mirroredRotatedInvertedExecutor } from "./execution/MirroredRotatedInvertedExecutor.js";
export { MirroredSwappedInvertedExecutor, mirroredSwappedInvertedExecutor } from "./execution/MirroredSwappedInvertedExecutor.js";
export { MirroredRotatedInvertedSwappedExecutor, mirroredRotatedInvertedSwappedExecutor } from "./execution/MirroredRotatedInvertedSwappedExecutor.js";

// Spec-based execution
export { executeLOOPSpec, executeSymmetricSpec } from "./execution/spec-executor.js";
export { FusedExecutor, type FusedTransformFlags } from "./execution/FusedExecutor.js";

// LOOP executor selector
export { LOOPExecutorSelector, loopExecutorSelector } from "./execution/LOOPExecutorSelector.js";

// Grid position deriver
export { GridPositionDeriver, gridPositionDeriver } from "../core/positions/GridPositionDeriver.js";

// Letter lookup
export { findLetterByMotions } from "./LetterLookup.js";

// Targeting (end position selection for LOOP generation)
export { RotatedEndPositionSelector, rotatedEndPositionSelector } from "./targeting/RotatedEndPositionSelector.js";
export { LOOPEndPositionSelector, loopEndPositionSelector } from "./targeting/LOOPEndPositionSelector.js";
export {
  PartialSequenceGenerator,
  partialSequenceGenerator,
  type IPartialSequenceGenerator,
  type PartialSequenceOptions,
} from "./targeting/PartialSequenceGenerator.js";

// Extension (extending sequences with LOOP patterns)
export {
  SequenceExtender,
  sequenceExtender,
  type ExtensionType,
  type ExtensionAnalysis,
  type ExtensionOptions,
} from "./extension/SequenceExtender.js";

export {
  extendForOrientationCycle,
  type OrientationCycleExtensionResult,
} from "./extension/OrientationCycleExtender.js";
