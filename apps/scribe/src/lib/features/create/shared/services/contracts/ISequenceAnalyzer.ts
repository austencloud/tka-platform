import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "../../domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Circular Sequence Type
 *
 * Defines the relationship between start and end positions:
 * - 'same': Ends at exact same position (e.g., beta1 to beta1)
 * - 'halved': Ends at opposite position (e.g., beta1 to beta5)
 * - 'quartered': Ends at adjacent 90° position (e.g., beta1 to beta3 or beta7)
 */
export type CircularType = "same" | "halved" | "quartered";

/**
 * LOOP (Linked Orbital Offset Pattern) Type
 *
 * Strict variations based on rotation and mirroring:
 * - 'rotated': Pure rotation without mirroring
 * - 'mirrored': Pure mirroring without rotation
 * - 'rotated-mirrored': Combination of rotation and mirroring
 * - 'static': No rotation or mirroring (same position)
 */
export type StrictLoopType =
  | "rotated"
  | "mirrored"
  | "rotated-mirrored"
  | "static";

/**
 * Circularity Analysis Result
 *
 * Complete analysis of a sequence's circular properties.
 */
export interface CircularityAnalysis {
  /** Whether the sequence forms a valid circular pattern */
  readonly isCircular: boolean;

  /** Type of circular relationship (same/halved/quartered) */
  readonly circularType: CircularType | null;

  /** Starting position of the sequence */
  readonly startPosition: GridPosition | null;

  /** Ending position of the sequence */
  readonly endPosition: GridPosition | null;

  /** Whether start position is a beta position */
  readonly startIsBeta: boolean;

  /** Whether end position is a beta position */
  readonly endIsBeta: boolean;

  /** Possible LOOP types this sequence could become */
  readonly possibleLoopTypes: readonly StrictLoopType[];

  /** Human-readable description of the circular relationship */
  readonly description: string;
}

/**
 * Sequence Analysis Service Contract
 *
 * Service for analyzing sequences to detect circular patterns,
 * LOOP (Linked Orbital Offset Pattern) potential, and autocomplete capability.
 *
 * This service is used to:
 * - Detect if a sequence can form a circular pattern
 * - Determine what type of LOOP pattern is possible
 * - Enable autocomplete functionality for the user
 */
export interface ISequenceAnalyzer {
  /**
   * Analyze a sequence for circular properties
   *
   * Determines if a sequence has the potential to be completed as a
   * circular pattern (LOOP - Continuous Assembly Pattern).
   *
   * A sequence is circular-capable if:
   * 1. It has at least one beat with pictograph data
   * 2. Both start and end positions are defined
   * 3. Both positions are in the same position group (alpha→alpha, beta→beta, or gamma→gamma)
   * 4. End position relates to start position in a valid way (same/halved/quartered)
   *
   * Valid circular relationships:
   * - Alpha to Alpha (any variation, e.g., alpha1→alpha3)
   * - Beta to Beta (any variation, e.g., beta1→beta5)
   * - Gamma to Gamma (any variation, e.g., gamma1→gamma8)
   *
   * @param sequence - The sequence to analyze
   * @returns Complete circularity analysis
   *
   * @example
   * const analysis = service.analyzeCircularity(sequence);
   * if (analysis.isCircular) {
   *   console.log(`Circular type: ${analysis.circularType}`);
   *   console.log(`Possible LOOPs: ${analysis.possibleLoopTypes.join(', ')}`);
   * }
   */
  analyzeCircularity(sequence: SequenceData): CircularityAnalysis;

  /**
   * Check if a sequence is circular-capable (simple boolean check)
   *
   * @param sequence - The sequence to check
   * @returns true if the sequence can be completed as a circular pattern
   *
   * @example
   * if (service.isCircularCapable(sequence)) {
   *   // Show sparkles indicator
   * }
   */
  isCircularCapable(sequence: SequenceData): boolean;

  /**
   * Get possible LOOP types for a circular sequence
   *
   * Based on the circular type, returns which LOOP patterns are possible:
   * - 'same' (distance 0): Returns to exact same position → mirrored/swapped/inverted
   * - 'halved' (distance 4 or 8): Opposite position → halved rotated
   * - 'quartered' (distance 2 or 4): Quarter-turn position → quartered rotated
   *
   * @param sequence - The sequence to analyze
   * @returns Array of possible strict LOOP types
   *
   * @example
   * const loopTypes = service.getPossibleLoopTypes(sequence);
   * // ['rotated'] for quartered sequences (e.g., alpha1→alpha3)
   * // ['mirrored'] for halved sequences (e.g., beta1→beta5)
   * // ['static'] for same-position sequences (e.g., gamma1→gamma1)
   */
  getPossibleLoopTypes(sequence: SequenceData): readonly StrictLoopType[];

  /**
   * Determine the circular relationship between two positions
   *
   * Works for positions within the same group (alpha→alpha, beta→beta, gamma→gamma).
   *
   * @param startPosition - Starting position (any group)
   * @param endPosition - Ending position (must be same group as start)
   * @returns The circular type or null if not circular
   *
   * @example
   * service.getCircularType(GridPosition.BETA1, GridPosition.BETA3);
   * // Returns: 'quartered' (90° turn)
   *
   * service.getCircularType(GridPosition.ALPHA1, GridPosition.ALPHA5);
   * // Returns: 'halved' (180° turn)
   *
   * service.getCircularType(GridPosition.GAMMA1, GridPosition.GAMMA1);
   * // Returns: 'same' (returns to same position)
   */
  getCircularType(
    startPosition: GridPosition,
    endPosition: GridPosition
  ): CircularType | null;

  /**
   * Check if a position is a beta position
   *
   * @param position - Grid position to check
   * @returns true if the position is a beta position
   *
   * @example
   * service.isBetaPosition(GridPosition.BETA1); // true
   * service.isBetaPosition(GridPosition.ALPHA1); // false
   */
  isBetaPosition(position: GridPosition): boolean;

  /**
   * Get the first beat with valid pictograph data (start beat)
   *
   * @param sequence - The sequence to analyze
   * @returns The first beat with pictograph data, or null
   */
  getStartBeat(sequence: SequenceData): StepData | null;

  /**
   * Get the last beat with valid pictograph data (end beat)
   *
   * @param sequence - The sequence to analyze
   * @returns The last beat with pictograph data, or null
   */
  getEndBeat(sequence: SequenceData): StepData | null;

  /**
   * Get a human-readable description of the circular relationship
   *
   * @param analysis - The circularity analysis
   * @returns Descriptive string explaining the relationship
   *
   * @example
   * const desc = service.getCircularDescription(analysis);
   * // "Quartered sequence: beta1 → beta3 (adjacent 90°)"
   */
  getCircularDescription(analysis: CircularityAnalysis): string;

  /**
   * Detect the actual LOOP type of a COMPLETED sequence
   *
   * Analyzes all consecutive beat transformations to determine what type
   * of completed LOOP pattern the sequence represents.
   *
   * Logic:
   * 1. Static LOOP: All steps at the same position
   * 2. Rotated LOOP: Each consecutive pair shows 90° rotation
   * 3. Mirrored LOOP: Each consecutive pair shows mirroring relationship
   *
   * @param sequence - The completed sequence to analyze
   * @returns Array of LOOP types this sequence represents (can be multiple)
   *
   * @example
   * // For a rotated sequence: alpha1 → alpha3 → alpha5 → alpha7 → alpha1
   * service.detectCompletedLoopTypes(sequence); // ['rotated']
   *
   * // For a mirrored sequence: gamma1 → gamma9 → gamma1 → gamma9 → gamma1
   * service.detectCompletedLoopTypes(sequence); // ['mirrored']
   *
   * // For a static sequence: beta1 → beta1 → beta1 → beta1
   * service.detectCompletedLoopTypes(sequence); // ['static']
   */
  detectCompletedLoopTypes(sequence: SequenceData): readonly StrictLoopType[];

  // ============ Position Extraction Methods ============

  /**
   * Get the starting position from a sequence.
   * Checks multiple possible locations: startPosition object, startingPosition, beat 0.
   *
   * @param sequence - The sequence to extract start position from
   * @returns The start position or null if not found
   */
  getStartPosition(sequence: SequenceData): GridPosition | null;

  /**
   * Get the current end position from the last beat in a sequence.
   * Finds the highest beat number (excluding beat 0) and returns its end position.
   *
   * @param sequence - The sequence to extract end position from
   * @returns The end position or null if not found
   */
  getCurrentEndPosition(sequence: SequenceData): GridPosition | null;

  /**
   * Convert a SequenceData to StepData array for LOOP executor.
   * The LOOP executor expects: [startPosition (beat 0), beat 1, beat 2, ...]
   *
   * @param sequence - The sequence to convert
   * @returns Array of steps including synthesized beat 0 if needed
   */
  convertSequenceToBeats(sequence: SequenceData): StepData[];
}
