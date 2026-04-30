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
  SUPPORTED_LOOP_TYPES,
  type LOOPOption,
  type LOOPValidationResult,
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
} from "./loop-validator.js";

// Detector (analyzes sequence steps to identify LOOP patterns)
export {
  detectLOOPFromSteps,
  isSequenceCircular,
  type LOOPComponentId,
  type LOOPDetectionResult,
} from "./loop-detector.js";

// Executor
export {
  executeLOOP,
  type LOOPExecutionResult,
  type PictographData,
} from "./loop-executor.js";

// Letter lookup
export { findLetterByMotions } from "./letter-lookup.js";
