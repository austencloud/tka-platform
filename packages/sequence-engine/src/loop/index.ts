/**
 * LOOP Module Index
 *
 * Exports all LOOP-related functionality for the MCP server.
 */

// Types and enums
export {
  LOOPType,
  SliceSize,
  LOOP_TYPE_LABELS,
  LOOP_TYPE_DESCRIPTIONS,
  ALL_LOOP_TYPES,
  SUPPORTED_LOOP_TYPES,
  ROTATED_LOOP_TYPES,
  type LOOPOption,
  type LOOPValidationResult,
  type LOOPGenerationOptions,
} from "./loop-types.js";

// Validator
export {
  isLOOPValidForPositionPair,
  isLOOPSupported,
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

// Detector (analyzes sequence steps to identify LOOP patterns)
export {
  detectLOOPFromSteps,
  isSequenceCircular,
  type LOOPComponentId,
  type LOOPDetectionResult,
} from "./detection/LOOPDetector.js";

// Executor
export {
  executeLOOP,
  type LOOPExecutionResult,
  type PictographData,
} from "./execution/LOOPExecutor.js";

// Executor interface
export type { ILOOPExecutor } from "./execution/ILOOPExecutor.js";

// Letter lookup
export { findLetterByMotions } from "./LetterLookup.js";
