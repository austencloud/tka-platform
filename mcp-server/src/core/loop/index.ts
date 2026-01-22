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
  type LOOPOption,
  type LOOPValidationResult,
} from "./loop-types.js";

// Validator
export {
  isLOOPValidForPositionPair,
  isLOOPSupported,
  getLOOPOptionsForPositionPair,
  getExpectedEndPosition,
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "./loop-validator.js";

// Executor
export {
  executeLOOP,
  type LOOPExecutionResult,
  type PictographData,
} from "./loop-executor.js";

// Letter lookup
export { findLetterByMotions } from "./letter-lookup.js";
