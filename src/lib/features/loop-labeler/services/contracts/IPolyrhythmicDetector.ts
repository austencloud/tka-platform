/**
 * Polyrhythmic LOOP Detection Service Contract
 *
 * Detects traditional polyrhythmic LOOP patterns (e.g., 3:4 = 12 steps)
 * where different periods control different aspects of the motion.
 */

import type { ZoneCoverageAnalysis } from "$lib/features/create/generate/circular/domain/constants/circular-position-maps";

export interface StepProperties {
  beat: number;
  blueMotionType: string;
  redMotionType: string;
  blueRotDir: string;
  redRotDir: string;
  blueStartLoc: string;
  redStartLoc: string;
  blueEndLoc: string;
  redEndLoc: string;
  timing: string;
  letterType: string;
  letter: string;
}

export interface PropertyConsistency {
  /** Property name (e.g., "blueMotionType", "redStartLoc") */
  property: string;
  /** Value at each position within the period */
  valuesPerPosition: string[];
  /** True if all positions have the same value */
  isUniform: boolean;
  /** Human-readable pattern description */
  pattern: string;
}

export interface PeriodAnalysis {
  /** The period length being analyzed */
  period: number;
  /** Number of complete cycles in the sequence */
  numGroups: number;
  /** Beat numbers at each position, e.g., [[1,4,7,10], [2,5,8,11], [3,6,9,12]] for period 3 */
  positionGroups: number[][];
  /** Properties that are consistent within each position group */
  consistentProperties: PropertyConsistency[];
  /** Count of consistent properties */
  consistencyScore: number;
  /** What type of properties dominate this period's consistency */
  dominantPropertyType: "motion" | "spatial" | "both" | "other" | "none";
}

export interface PolyrhythmicLOOPResult {
  /** Whether a polyrhythmic pattern was detected */
  isPolyrhythmic: boolean;
  /** The polyrhythm ratio, e.g., "3:4" */
  polyrhythm: string | null;
  /** All period analyses performed */
  periods: PeriodAnalysis[];
  /** The period that controls motion type patterns */
  motionPeriod: PeriodAnalysis | null;
  /** The period that controls spatial position patterns */
  spatialPeriod: PeriodAnalysis | null;
  /** Human-readable description of the pattern */
  description: string;
  /** Confidence score from 0-1 */
  confidence: number;
  /** Zone coverage analysis for end positions */
  zoneCoverage?: ZoneCoverageAnalysis;
}

export interface IPolyrhythmicDetector {
  /**
   * Analyze a sequence for polyrhythmic LOOP patterns
   * @param rawSequence The raw sequence data array (including metadata at index 0)
   * @returns Analysis result with detected polyrhythm information
   */
  detectPolyrhythmic(
    rawSequence: Record<string, unknown>[]
  ): PolyrhythmicLOOPResult;
}
