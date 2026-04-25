/**
 * Polyrhythmic LOOP Detection Service
 *
 * Detects "traditional" LOOP patterns based on polyrhythmic periodicity
 * (e.g., 3:4 = 12 steps where period-3 controls motion type and period-4 controls spatial position)
 *
 * This runs alongside the step-pair detection, providing a complementary analysis.
 */

import {
  analyzeZoneCoverage,
  type ZoneCoverageAnalysis,
} from "$lib/features/create/generate/circular/domain/constants/circular-position-maps";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

// ============================================================================
// TYPES
// ============================================================================

export interface StepProperties {
  step: number;
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
  [key: string]: string | number;
}

export interface PropertyConsistency {
  property: string;
  valuesPerPosition: string[];
  isUniform: boolean; // true if all positions have the same value
  pattern: string; // human-readable description of the pattern
}

export interface PeriodAnalysis {
  period: number;
  numGroups: number; // sequence length / period
  positionGroups: number[][]; // steps at each position, e.g., [[1,4,7,10], [2,5,8,11], [3,6,9,12]]
  consistentProperties: PropertyConsistency[];
  consistencyScore: number;
  dominantPropertyType: "motion" | "spatial" | "both" | "other" | "none";
}

export interface PolyrhythmicLOOPResult {
  isPolyrhythmic: boolean;
  polyrhythm: string | null; // e.g., "3:4"
  periods: PeriodAnalysis[];
  motionPeriod: PeriodAnalysis | null; // period that controls motion type
  spatialPeriod: PeriodAnalysis | null; // period that controls spatial position
  description: string;
  confidence: number; // 0-1 score
  zoneCoverage?: ZoneCoverageAnalysis; // positional zone coverage analysis
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get proper factors of a number (excluding 1 and the number itself)
 */
function getProperFactors(n: number): number[] {
  const factors: number[] = [];
  for (let i = 2; i < n; i++) {
    if (n % i === 0) {
      factors.push(i);
    }
  }
  return factors;
}

/**
 * Calculate greatest common divisor
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Calculate least common multiple
 */
function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

/**
 * Check if all values in an array are the same
 */
function allSame(values: string[]): boolean {
  if (values.length === 0) return true;
  return values.every((v) => v === values[0]);
}

/**
 * Extract properties from a raw beat object
 */
function extractBeatProperties(
  rawStep: Record<string, unknown>
): StepProperties {
  const blue = (rawStep.blueAttributes as Record<string, unknown>) || {};
  const red = (rawStep.redAttributes as Record<string, unknown>) || {};

  return {
    step: (rawStep.beat as number) || 0,
    blueMotionType: (blue.motionType as string) || "unknown",
    redMotionType: (red.motionType as string) || "unknown",
    blueRotDir: (blue.propRotDir as string) || "unknown",
    redRotDir: (red.propRotDir as string) || "unknown",
    blueStartLoc: (blue.startLoc as string) || "unknown",
    redStartLoc: (red.startLoc as string) || "unknown",
    blueEndLoc: (blue.endLoc as string) || "unknown",
    redEndLoc: (red.endLoc as string) || "unknown",
    timing: (rawStep.timing as string) || "none",
    letterType: (rawStep.letterType as string) || "unknown",
    letter: (rawStep.letter as string) || "",
  };
}

/**
 * Get a specific property value from beat properties
 */
function getPropertyValue(props: StepProperties, property: string): string {
  return String(props[property] ?? "unknown");
}

/**
 * Generate a human-readable pattern description
 */
function describePattern(property: string, values: string[]): string {
  const unique = [...new Set(values)];
  if (unique.length === 1) {
    return `all ${unique[0]}`;
  }
  return values.join(" → ");
}

/**
 * Determine what type of property this is
 */
function getPropertyType(property: string): "motion" | "spatial" | "other" {
  if (property.includes("MotionType")) return "motion";
  if (property.includes("Loc")) return "spatial";
  return "other";
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class PolyrhythmicDetector {
  /**
   * Analyze a sequence for polyrhythmic LOOP patterns
   */
  detectPolyrhythmic(
    rawSequence: Record<string, unknown>[]
  ): PolyrhythmicLOOPResult {
    // Filter to actual steps (exclude metadata at index 0)
    const stepRecords = rawSequence.filter(
      (item) => typeof item.beat === "number" && item.beat > 0
    );
    const steps = stepRecords.map(extractBeatProperties);

    // Extract end positions for zone coverage analysis
    // The field is 'endPos' (string like "alpha1", "gamma12") which matches GridPosition enum values
    const endPositions = stepRecords.map((item) => {
      const endPos = item.endPos as string | undefined;
      if (!endPos) return null;
      // The JSON strings match GridPosition enum values directly
      return endPos as GridPosition;
    });

    const length = steps.length;

    if (length < 4) {
      return this.noPolyrhythmResult(
        "Sequence too short for polyrhythmic analysis"
      );
    }

    // Get factors to analyze
    const factors = getProperFactors(length);

    if (factors.length < 2) {
      return this.noPolyrhythmResult(
        "Sequence length has insufficient factors"
      );
    }

    // Analyze each period
    const analyses: PeriodAnalysis[] = [];

    for (const period of factors) {
      const analysis = this.analyzePeriod(steps, period);
      if (analysis.consistencyScore > 0) {
        analyses.push(analysis);
      }
    }

    if (analyses.length === 0) {
      return this.noPolyrhythmResult("No periodic patterns found");
    }

    // NEW APPROACH: Find valid polyrhythm pairs first, then check motion/spatial
    // A valid pair has LCM(p1, p2) = sequence length
    const validPairs: Array<{
      p1: PeriodAnalysis;
      p2: PeriodAnalysis;
      lcmValue: number;
    }> = [];

    // IMPORTANT: Standard LOOP intervals (halved/quartered) should NOT be considered
    // for polyrhythmic detection - those are handled by step-pair analysis
    const halvedPeriod = length / 2; // period that would indicate halved LOOP
    const quarteredPeriod = length / 4; // period that would indicate quartered LOOP
    const isStandardLOOPInterval = (period: number): boolean => {
      return period === halvedPeriod || period === quarteredPeriod;
    };

    for (let i = 0; i < analyses.length; i++) {
      for (let j = i + 1; j < analyses.length; j++) {
        const p1 = analyses[i];
        const p2 = analyses[j];
        if (!p1 || !p2) continue;
        const lcmValue = lcm(p1.period, p2.period);
        if (lcmValue === length) {
          // Skip pairs where BOTH periods are standard LOOP intervals
          // (this would just be a halved or quartered LOOP, not polyrhythmic)
          const p1IsStandard = isStandardLOOPInterval(p1.period);
          const p2IsStandard = isStandardLOOPInterval(p2.period);

          if (p1IsStandard && p2IsStandard) {
            continue;
          }

          // Also skip if EITHER period is halved or quartered - these are standard LOOP intervals
          // A repeated word (like 5-letter word repeated 4 times = 20 steps) is NOT polyrhythmic
          if (
            p1.period === halvedPeriod ||
            p2.period === halvedPeriod ||
            p1.period === quarteredPeriod ||
            p2.period === quarteredPeriod
          ) {
            continue;
          }

          validPairs.push({ p1, p2, lcmValue });
        }
      }
    }

    // Find the best pair where one is motion-dominant and one is spatial-dominant
    // Priority: 1) Pure motion + pure spatial, 2) Smaller period values, 3) Higher consistency
    let bestPair: {
      motionPeriod: PeriodAnalysis;
      spatialPeriod: PeriodAnalysis;
    } | null = null;
    let bestScore = -Infinity;

    for (const { p1, p2 } of validPairs) {
      // Count motion and spatial properties for each period
      const p1MotionCount = p1.consistentProperties.filter(
        (p) => getPropertyType(p.property) === "motion"
      ).length;
      const p1SpatialCount = p1.consistentProperties.filter(
        (p) => getPropertyType(p.property) === "spatial"
      ).length;
      const p2MotionCount = p2.consistentProperties.filter(
        (p) => getPropertyType(p.property) === "motion"
      ).length;
      const p2SpatialCount = p2.consistentProperties.filter(
        (p) => getPropertyType(p.property) === "spatial"
      ).length;

      // Try both assignments and pick the one that makes more sense
      const assignments: Array<{
        motion: PeriodAnalysis;
        spatial: PeriodAnalysis;
        score: number;
      }> = [];

      // Assignment 1: p1 = motion, p2 = spatial
      if (p1MotionCount > 0 || p2SpatialCount > 0) {
        let score = 0;
        // Bonus for pure type matches (not "both")
        if (
          p1.dominantPropertyType === "motion" &&
          p2.dominantPropertyType === "spatial"
        ) {
          score += 100; // Strong preference for pure matches
        }
        // Bonus for having the expected properties
        score += p1MotionCount * 10 + p2SpatialCount * 10;
        // Penalty for having "wrong" properties in each role
        score -= p1SpatialCount * 5 + p2MotionCount * 5;
        // Smaller periods are more "canonical" polyrhythms
        score -= p1.period + p2.period;
        assignments.push({ motion: p1, spatial: p2, score });
      }

      // Assignment 2: p2 = motion, p1 = spatial
      if (p2MotionCount > 0 || p1SpatialCount > 0) {
        let score = 0;
        if (
          p2.dominantPropertyType === "motion" &&
          p1.dominantPropertyType === "spatial"
        ) {
          score += 100;
        }
        score += p2MotionCount * 10 + p1SpatialCount * 10;
        score -= p2SpatialCount * 5 + p1MotionCount * 5;
        score -= p1.period + p2.period;
        assignments.push({ motion: p2, spatial: p1, score });
      }

      // Pick the best assignment for this pair
      for (const { motion, spatial, score } of assignments) {
        if (score > bestScore) {
          bestScore = score;
          bestPair = { motionPeriod: motion, spatialPeriod: spatial };
        }
      }
    }

    if (bestPair) {
      const { motionPeriod, spatialPeriod } = bestPair;
      const [smaller, larger] =
        motionPeriod.period < spatialPeriod.period
          ? [motionPeriod.period, spatialPeriod.period]
          : [spatialPeriod.period, motionPeriod.period];

      // Compute zone coverage for the sequence
      const zoneCoverage = analyzeZoneCoverage(endPositions);

      return {
        isPolyrhythmic: true,
        polyrhythm: `${smaller}:${larger}`,
        periods: analyses,
        motionPeriod,
        spatialPeriod,
        description: this.generateDescription(
          motionPeriod,
          spatialPeriod,
          length
        ),
        confidence: this.calculateConfidence(motionPeriod, spatialPeriod),
        zoneCoverage,
      };
    }

    // Check for single-period patterns (still interesting but not polyrhythmic)
    const bestPeriod = analyses.reduce((best, curr) =>
      curr.consistencyScore > best.consistencyScore ? curr : best
    );

    if (bestPeriod.consistencyScore >= 2) {
      return {
        isPolyrhythmic: false,
        polyrhythm: null,
        periods: analyses,
        motionPeriod:
          bestPeriod.dominantPropertyType === "motion" ? bestPeriod : null,
        spatialPeriod:
          bestPeriod.dominantPropertyType === "spatial" ? bestPeriod : null,
        description: `Periodic pattern with period ${bestPeriod.period} detected`,
        confidence: 0.5,
      };
    }

    return this.noPolyrhythmResult("No significant periodic patterns found");
  }

  /**
   * Analyze a specific period
   */
  private analyzePeriod(
    steps: StepProperties[],
    period: number
  ): PeriodAnalysis {
    const length = steps.length;
    const numGroups = length / period;

    // Group steps by position within period
    const positionGroups: number[][] = [];
    for (let pos = 0; pos < period; pos++) {
      const group: number[] = [];
      for (let g = 0; g < numGroups; g++) {
        // Beat numbers are 1-indexed
        group.push(pos + 1 + g * period);
      }
      positionGroups.push(group);
    }

    // Properties to check
    const propertiesToCheck = [
      "blueMotionType",
      "redMotionType",
      "blueRotDir",
      "redRotDir",
      "blueStartLoc",
      "redStartLoc",
      "blueEndLoc",
      "redEndLoc",
      "timing",
      "letterType",
    ];

    const consistentProperties: PropertyConsistency[] = [];
    let motionCount = 0;
    let spatialCount = 0;

    for (const property of propertiesToCheck) {
      const result = this.checkPropertyConsistency(
        steps,
        positionGroups,
        property
      );
      if (result) {
        consistentProperties.push(result);
        const propType = getPropertyType(property);
        if (propType === "motion") motionCount++;
        if (propType === "spatial") spatialCount++;
      }
    }

    // Determine dominant property type
    let dominantPropertyType: "motion" | "spatial" | "both" | "other" | "none" =
      "none";
    if (motionCount > 0 && spatialCount > 0) {
      dominantPropertyType = "both";
    } else if (motionCount > spatialCount) {
      dominantPropertyType = "motion";
    } else if (spatialCount > motionCount) {
      dominantPropertyType = "spatial";
    } else if (consistentProperties.length > 0) {
      dominantPropertyType = "other";
    }

    return {
      period,
      numGroups,
      positionGroups,
      consistentProperties,
      consistencyScore: consistentProperties.length,
      dominantPropertyType,
    };
  }

  /**
   * Check if a property is consistent within each position group
   */
  private checkPropertyConsistency(
    steps: StepProperties[],
    positionGroups: number[][],
    property: string
  ): PropertyConsistency | null {
    const valuesPerPosition: string[] = [];

    for (const group of positionGroups) {
      // Get property values for all steps in this position
      const values = group.map((stepNum) => {
        const matchingStep = steps.find((b) => b.step === stepNum);
        return matchingStep ? getPropertyValue(matchingStep, property) : "unknown";
      });

      // Check if all steps at this position have the same value
      if (!allSame(values)) {
        return null; // Not consistent within this position
      }

      const firstValue = values[0];
      if (firstValue === undefined) {
        return null; // No value found
      }
      valuesPerPosition.push(firstValue);
    }

    // All positions are internally consistent
    return {
      property,
      valuesPerPosition,
      isUniform: allSame(valuesPerPosition),
      pattern: describePattern(property, valuesPerPosition),
    };
  }

  /**
   * Find the best period for a given property type.
   * Prefers pure type matches (motion-only or spatial-only) over "both",
   * to ensure we find distinct periods for polyrhythmic detection.
   */
  private findBestPeriodByType(
    analyses: PeriodAnalysis[],
    type: "motion" | "spatial",
    excludePeriod?: number
  ): PeriodAnalysis | null {
    // Filter out excluded period (used to find distinct periods for polyrhythm)
    const available = excludePeriod
      ? analyses.filter((a) => a.period !== excludePeriod)
      : analyses;

    // First, try to find periods with pure type match (not "both")
    const pureMatches = available.filter(
      (a) => a.dominantPropertyType === type
    );
    if (pureMatches.length > 0) {
      // Return the one with highest consistency score among pure matches
      return pureMatches.reduce((best, curr) =>
        curr.consistencyScore > best.consistencyScore ? curr : best
      );
    }

    // Fall back to periods with "both" type
    const bothMatches = available.filter(
      (a) => a.dominantPropertyType === "both"
    );
    if (bothMatches.length > 0) {
      return bothMatches.reduce((best, curr) =>
        curr.consistencyScore > best.consistencyScore ? curr : best
      );
    }

    return null;
  }

  /**
   * Generate a human-readable description
   */
  private generateDescription(
    motionPeriod: PeriodAnalysis,
    spatialPeriod: PeriodAnalysis,
    length: number
  ): string {
    const motionProps = motionPeriod.consistentProperties
      .filter((p) => getPropertyType(p.property) === "motion")
      .map((p) => `${p.property}: ${p.pattern}`)
      .join(", ");

    const spatialProps = spatialPeriod.consistentProperties
      .filter((p) => getPropertyType(p.property) === "spatial")
      .map((p) => `${p.property}: ${p.pattern}`)
      .join(", ");

    return (
      `Polyrhythmic ${motionPeriod.period}:${spatialPeriod.period} pattern. ` +
      `Period-${motionPeriod.period} controls motion (${motionProps || "pattern"}). ` +
      `Period-${spatialPeriod.period} controls spatial position (${spatialProps || "pattern"}). ` +
      `LCM(${motionPeriod.period},${spatialPeriod.period}) = ${length} steps.`
    );
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    motionPeriod: PeriodAnalysis,
    spatialPeriod: PeriodAnalysis
  ): number {
    // Base confidence on consistency scores
    const totalScore =
      motionPeriod.consistencyScore + spatialPeriod.consistencyScore;
    // Normalize to 0-1 range (assuming max ~10 properties each)
    return Math.min(1, totalScore / 10);
  }

  /**
   * Return a "no polyrhythm" result
   */
  private noPolyrhythmResult(reason: string): PolyrhythmicLOOPResult {
    return {
      isPolyrhythmic: false,
      polyrhythm: null,
      periods: [],
      motionPeriod: null,
      spatialPeriod: null,
      description: reason,
      confidence: 0,
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================

export const polyrhythmicDetector = new PolyrhythmicDetector();
