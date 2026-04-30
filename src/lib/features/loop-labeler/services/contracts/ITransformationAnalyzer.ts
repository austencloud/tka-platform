import type { InternalStepPair } from "../../domain/models/internal-step-models";
import type { StepPairGroups } from "../../domain/models/label-models";

/**
 * Result from axis-alternating pattern detection.
 */
export interface AxisAlternatingResult {
  isAxisAlternating: boolean;
  transformationFamily: string[];
  metaPatternType: "palindromic" | "alternating" | "symmetric" | "structured";
  patternSequence: string[];
  description: string;
}

/**
 * Swap rhythm pattern within each cycle.
 * Examples: "1-2-2-1" = NO_SWAP, SWAP, SWAP, NO_SWAP
 *           "1-2-1-2" = alternating
 *           "1-1-2-2" = first half no swap, second half swap
 */
export type SwapRhythmPattern =
  | "1-2-2-1"
  | "1-2-1-2"
  | "1-1-2-2"
  | "2-1-1-2"
  | "2-1-2-1"
  | "2-2-1-1"
  | "uniform"
  | "unknown";

/**
 * Describes the behavior of a single column (position within cycle).
 */
export interface ColumnBehavior {
  /** Column position (1-based, e.g., 1,2,3,4 for quartered) */
  position: number;
  /** Base transformation for this column (without swap/invert modifiers) */
  baseTransformation: string;
  /** Is this column swapped relative to base? */
  isSwapped: boolean;
  /** Is this column inverted relative to base? */
  isInverted: boolean;
  /** Is this column mirrored relative to base? */
  isMirrored: boolean;
  /** Is this column flipped relative to base? */
  isFlipped: boolean;
  /** Beat numbers in this column */
  steps: number[];
  /** All transformations detected for this column */
  transformations: string[];
}

/**
 * Result from modular sequence detection.
 * A modular sequence has different column behaviors within each cycle.
 */
export interface ModularAnalysisResult {
  isModular: boolean;
  /** Behaviors for each column */
  columnBehaviors: ColumnBehavior[];
  /** Detected swap rhythm pattern */
  swapRhythm: SwapRhythmPattern;
  /** Positions that are swapped (1-based) */
  swappedPositions: number[];
  /** Base transformation shared across columns */
  baseTransformation: string | null;
  /** Human-readable description */
  description: string;
}

/**
 * Service for analyzing transformation patterns across beat pairs.
 */
export interface ITransformationAnalyzer {
  /**
   * Find all common transformations shared by ALL beat pairs.
   */
  findAllCommonTransformations(stepPairs: InternalStepPair[]): string[];

  /**
   * Group step pairs by their primary transformation pattern.
   */
  groupStepPairsByPattern(stepPairs: InternalStepPair[]): StepPairGroups;

  /**
   * Re-prioritize beat pairs based on common transformations.
   * Mutates the beat pairs in place.
   */
  reprioritizeBeatPairs(stepPairs: InternalStepPair[]): void;

  /**
   * Detect if a sequence follows an axis-alternating pattern.
   */
  detectAxisAlternatingPattern(
    stepPairs: InternalStepPair[],
    stepPairGroups: StepPairGroups
  ): AxisAlternatingResult | null;

  /**
   * Detect if a sequence follows a modular pattern.
   * A modular pattern has different column behaviors within each cycle.
   */
  detectModularPattern(
    stepPairs: InternalStepPair[],
    cycleLength: number
  ): ModularAnalysisResult | null;

  /**
   * Normalize a transformation to its base form (remove _inverted suffix).
   */
  normalizeToBase(transformation: string): string;
}
