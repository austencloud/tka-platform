/**
 * LOOP Detection Service Contract
 *
 * Service for detecting and classifying Linked Orbital Offset Patterns (LOOPs)
 * in existing sequences. This is the reverse of LOOP generation - given a sequence,
 * determine what LOOP type (if any) it follows.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { LOOPType, Period } from "../../domain/models/circular-models";
import type { LOOPComponent } from "../../../shared/domain/models/generate-models";

/**
 * Describes a transformation at a specific interval
 */
export interface IntervalTransformation {
  /** The interval at which this transformation occurs */
  interval: Period;
  /** The transformation component detected */
  component: LOOPComponent;
  /** Human-readable description */
  description: string;
}

/**
 * Describes a compound LOOP pattern with multiple transformations at different intervals
 */
export interface CompoundPattern {
  /** Whether this is a compound pattern (multiple intervals) */
  isCompound: true;
  /** Transformations at quartered interval (90°) */
  quarteredTransformations: LOOPComponent[];
  /** Transformations at halved interval (180°) */
  halvedTransformations: LOOPComponent[];
  /** Combined human-readable description like "90° CCW Rotated (quartered) + Swapped (halved)" */
  description: string;
}

/**
 * Result of LOOP type detection on a sequence
 */
export interface LOOPDetectionResult {
  /** Does the sequence return to its start position with matching orientations? */
  isCircular: boolean;

  /** The detected LOOP type (null if circular but not a recognized pattern) */
  loopType: LOOPType | null;

  /** Period for rotational patterns (HALVED = 180°, QUARTERED = 90°) */
  period: Period | null;

  /**
   * Detection confidence level:
   * - 'strict': All transformation rules match exactly
   * - 'probable': Most rules match, minor deviations
   * - 'accidental': Circular by coincidence, not a structured LOOP
   */
  confidence: "strict" | "probable" | "accidental";

  /**
   * Compound pattern info when transformations occur at different intervals
   * e.g., rotation at quartered + swap at halved
   */
  compoundPattern?: CompoundPattern;
}

/**
 * Service interface for LOOP detection
 */
export interface ILOOPDetector {
  /**
   * Analyze a sequence and detect its LOOP type
   * @param sequence - The sequence to analyze
   * @returns Detection result with LOOP type, slice size, and confidence
   */
  detectLOOPType(sequence: SequenceData): LOOPDetectionResult;

  /**
   * Batch detect LOOP types for multiple sequences
   * Uses chunked processing to avoid blocking UI
   * @param sequences - Array of sequences to analyze
   * @returns Promise of detection results
   */
  batchDetect(sequences: SequenceData[]): Promise<LOOPDetectionResult[]>;

  /**
   * Quick check if a sequence is circular (without full LOOP analysis)
   * @param sequence - The sequence to check
   * @returns True if sequence returns to start position with matching orientations
   */
  isCircular(sequence: SequenceData): boolean;
}
