/**
 * Layered Path LOOP Detection Service
 *
 * Detects LOOPs constructed from independent hand paths layered together.
 * Each hand has its own repeating cycle, and the combination creates the full sequence.
 */

import type {
  ILayeredPathDetector,
  LayeredPathResult,
  HandPathCycle,
  ZoneCoverageAnalysis,
  PositionalCategory,
} from "../contracts/ILayeredPathDetector";

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
function _gcd(a: number, b: number): number {
  return b === 0 ? a : _gcd(b, a % b);
}

/**
 * Check if an array has a repeating pattern of given length
 */
function hasRepeatingPattern<T>(arr: T[], patternLength: number): boolean {
  if (arr.length % patternLength !== 0) return false;
  if (patternLength >= arr.length) return false;

  const repeatCount = arr.length / patternLength;
  if (repeatCount < 2) return false;

  const pattern = arr.slice(0, patternLength);

  for (let i = 1; i < repeatCount; i++) {
    const segment = arr.slice(i * patternLength, (i + 1) * patternLength);
    for (let j = 0; j < patternLength; j++) {
      if (pattern[j] !== segment[j]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Categorize a grid position into one of 4 categories
 */
function categorizePosition(endPos: string): PositionalCategory | null {
  if (!endPos) return null;

  if (endPos.startsWith("alpha")) return "alpha";
  if (endPos.startsWith("beta")) return "beta";

  if (endPos.startsWith("gamma")) {
    // Extract the number from gammaX
    const num = parseInt(endPos.replace("gamma", ""), 10);
    if (isNaN(num)) return null;

    // gamma1-8 is first half, gamma9-16 is second half
    return num <= 8 ? "gamma1" : "gamma2";
  }

  return null;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class LayeredPathDetector implements ILayeredPathDetector {
  /**
   * Detect layered path patterns in a sequence
   */
  detectLayeredPath(rawSequence: Record<string, unknown>[]): LayeredPathResult {
    // Filter to actual steps (exclude metadata at index 0)
    const stepRecords = rawSequence.filter(
      (item) => typeof item.beat === "number" && item.beat > 0
    );

    const length = stepRecords.length;

    if (length < 4) {
      return this.noLayeredPathResult(
        "Sequence too short for layered path analysis"
      );
    }

    // Analyze each hand's path
    const blueCycle = this.analyzeHandPath(rawSequence, "blue");
    const redCycle = this.analyzeHandPath(rawSequence, "red");

    // Both hands need detectable cycles for layered path
    if (!blueCycle && !redCycle) {
      return this.noLayeredPathResult("No hand path cycles detected");
    }

    // Determine rhythm type
    let rhythmType: "isorhythmic" | "polyrhythmic" | null = null;
    let polyrhythmRatio: string | null = null;

    if (blueCycle && redCycle) {
      if (blueCycle.cycleLength === redCycle.cycleLength) {
        rhythmType = "isorhythmic";
      } else {
        rhythmType = "polyrhythmic";
        const smaller = Math.min(blueCycle.cycleLength, redCycle.cycleLength);
        const larger = Math.max(blueCycle.cycleLength, redCycle.cycleLength);
        polyrhythmRatio = `${smaller}:${larger}`;
      }
    } else if (blueCycle || redCycle) {
      // Only one hand has a clear cycle - still counts as layered path
      rhythmType = "isorhythmic"; // Default assumption
    }

    // Analyze zone coverage
    const zoneCoverage = this.analyzeZoneCoverage(rawSequence);

    // Build description
    const description = this.buildDescription(
      blueCycle,
      redCycle,
      rhythmType,
      polyrhythmRatio,
      zoneCoverage
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(blueCycle, redCycle);

    return {
      isLayeredPath: true,
      blueCycle,
      redCycle,
      rhythmType,
      polyrhythmRatio,
      zoneCoverage,
      description,
      confidence,
    };
  }

  /**
   * Analyze a single hand's path for periodicity
   */
  analyzeHandPath(
    rawSequence: Record<string, unknown>[],
    hand: "blue" | "red"
  ): HandPathCycle | null {
    const stepRecords = rawSequence.filter(
      (item) => typeof item.beat === "number" && item.beat > 0
    );

    if (stepRecords.length < 4) return null;

    const attrKey = hand === "blue" ? "blueAttributes" : "redAttributes";

    // Extract path data for this hand
    const pathData = stepRecords.map((step) => {
      const attrs = (step[attrKey] as Record<string, unknown>) || {};
      return {
        startLoc: (attrs.startLoc as string) || "unknown",
        endLoc: (attrs.endLoc as string) || "unknown",
        motionType: (attrs.motionType as string) || "unknown",
        propRotDir: (attrs.propRotDir as string) || "unknown",
      };
    });

    // Create path sequence string array for pattern matching
    const pathSequence = pathData.map((p) => `${p.startLoc}→${p.endLoc}`);
    const motionPattern = pathData.map((p) => p.motionType);
    const rotationPattern = pathData.map((p) => p.propRotDir);

    const length = pathData.length;
    const factors = getProperFactors(length);

    // Try each factor as a potential cycle length
    // Start with smaller factors (shorter cycles are more interesting)
    for (const cycleLength of factors) {
      const repeatCount = length / cycleLength;

      // Check if path sequence repeats
      const pathRepeats = hasRepeatingPattern(pathSequence, cycleLength);
      // Check if motion pattern repeats
      const motionRepeats = hasRepeatingPattern(motionPattern, cycleLength);

      // Both should repeat for a strong layered path pattern
      if (pathRepeats && motionRepeats) {
        // Check if it's a closed loop (ends where it started for each cycle)
        const cycleStartLoc = pathData[0]?.startLoc;
        const cycleEndLoc = pathData[cycleLength - 1]?.endLoc;
        const isClosedLoop = cycleStartLoc === cycleEndLoc;

        const confidence = this.calculateCycleConfidence(
          pathRepeats,
          motionRepeats,
          isClosedLoop,
          repeatCount
        );

        return {
          hand,
          cycleLength,
          repeatCount,
          pathSequence: pathSequence.slice(0, cycleLength),
          motionPattern: motionPattern.slice(0, cycleLength),
          rotationPattern: rotationPattern.slice(0, cycleLength),
          isClosedLoop,
          confidence,
        };
      }
    }

    // Check if just motion pattern repeats (weaker signal)
    for (const cycleLength of factors) {
      const motionRepeats = hasRepeatingPattern(motionPattern, cycleLength);

      if (motionRepeats) {
        const repeatCount = length / cycleLength;

        return {
          hand,
          cycleLength,
          repeatCount,
          pathSequence: pathSequence.slice(0, cycleLength),
          motionPattern: motionPattern.slice(0, cycleLength),
          rotationPattern: rotationPattern.slice(0, cycleLength),
          isClosedLoop: false,
          confidence: 0.5, // Lower confidence for motion-only
        };
      }
    }

    return null;
  }

  /**
   * Analyze positional zone coverage
   */
  analyzeZoneCoverage(
    rawSequence: Record<string, unknown>[]
  ): ZoneCoverageAnalysis {
    const stepRecords = rawSequence.filter(
      (item) => typeof item.beat === "number" && item.beat > 0
    );

    const length = stepRecords.length;
    const halfLength = Math.floor(length / 2);

    const firstHalf: Record<PositionalCategory, number> = {
      alpha: 0,
      beta: 0,
      gamma1: 0,
      gamma2: 0,
    };
    const secondHalf: Record<PositionalCategory, number> = {
      alpha: 0,
      beta: 0,
      gamma1: 0,
      gamma2: 0,
    };

    stepRecords.forEach((step, index) => {
      const endPos = step.endPos as string;
      const category = categorizePosition(endPos);

      if (category) {
        if (index < halfLength) {
          firstHalf[category]++;
        } else {
          secondHalf[category]++;
        }
      }
    });

    // Check for complete coverage (each half has all 4 categories)
    const firstHasCoverage =
      firstHalf.alpha > 0 &&
      firstHalf.beta > 0 &&
      firstHalf.gamma1 > 0 &&
      firstHalf.gamma2 > 0;
    const secondHasCoverage =
      secondHalf.alpha > 0 &&
      secondHalf.beta > 0 &&
      secondHalf.gamma1 > 0 &&
      secondHalf.gamma2 > 0;

    const hasCompleteCoverage = firstHasCoverage && secondHasCoverage;

    // Check for Latin Square pattern (each half has exactly 1 of each)
    const firstIsLatinSquare =
      firstHalf.alpha === 1 &&
      firstHalf.beta === 1 &&
      firstHalf.gamma1 === 1 &&
      firstHalf.gamma2 === 1;
    const secondIsLatinSquare =
      secondHalf.alpha === 1 &&
      secondHalf.beta === 1 &&
      secondHalf.gamma1 === 1 &&
      secondHalf.gamma2 === 1;

    const hasLatinSquarePattern = firstIsLatinSquare && secondIsLatinSquare;

    // Build summary
    let summary = "";
    if (hasLatinSquarePattern) {
      summary =
        "Perfect Latin Square: each half has exactly one of each positional category";
    } else if (hasCompleteCoverage) {
      summary =
        "Complete coverage: each half visits all 4 positional categories";
    } else {
      const missingFirst = Object.entries(firstHalf)
        .filter(([, count]) => count === 0)
        .map(([cat]) => cat);
      const missingSecond = Object.entries(secondHalf)
        .filter(([, count]) => count === 0)
        .map(([cat]) => cat);
      summary = `Partial coverage: first half missing ${missingFirst.join(", ") || "none"}, second half missing ${missingSecond.join(", ") || "none"}`;
    }

    return {
      perHalf: { first: firstHalf, second: secondHalf },
      hasCompleteCoverage,
      hasLatinSquarePattern,
      summary,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private calculateCycleConfidence(
    pathRepeats: boolean,
    motionRepeats: boolean,
    isClosedLoop: boolean,
    repeatCount: number
  ): number {
    let confidence = 0;

    if (pathRepeats) confidence += 0.4;
    if (motionRepeats) confidence += 0.3;
    if (isClosedLoop) confidence += 0.2;
    if (repeatCount >= 2) confidence += 0.1;

    return Math.min(1, confidence);
  }

  private calculateConfidence(
    blueCycle: HandPathCycle | null,
    redCycle: HandPathCycle | null
  ): number {
    if (!blueCycle && !redCycle) return 0;

    const blueConf = blueCycle?.confidence || 0;
    const redConf = redCycle?.confidence || 0;

    // Average confidence, with bonus if both hands have cycles
    let confidence = (blueConf + redConf) / (blueCycle && redCycle ? 2 : 1);

    // Bonus for both hands having cycles
    if (blueCycle && redCycle) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  private buildDescription(
    blueCycle: HandPathCycle | null,
    redCycle: HandPathCycle | null,
    rhythmType: "isorhythmic" | "polyrhythmic" | null,
    polyrhythmRatio: string | null,
    zoneCoverage: ZoneCoverageAnalysis | null
  ): string {
    const parts: string[] = ["Layered Path LOOP:"];

    if (rhythmType === "polyrhythmic" && polyrhythmRatio) {
      parts.push(`Polyrhythmic ${polyrhythmRatio}`);
    } else if (rhythmType === "isorhythmic") {
      const cycleLen = blueCycle?.cycleLength || redCycle?.cycleLength;
      parts.push(`Isorhythmic (${cycleLen}:${cycleLen})`);
    }

    if (blueCycle) {
      parts.push(
        `Blue: ${blueCycle.cycleLength}-beat cycle × ${blueCycle.repeatCount}`
      );
    }
    if (redCycle) {
      parts.push(
        `Red: ${redCycle.cycleLength}-beat cycle × ${redCycle.repeatCount}`
      );
    }

    if (zoneCoverage?.hasLatinSquarePattern) {
      parts.push("(Latin Square coverage)");
    } else if (zoneCoverage?.hasCompleteCoverage) {
      parts.push("(Complete zone coverage)");
    }

    return parts.join(" ");
  }

  private noLayeredPathResult(reason: string): LayeredPathResult {
    return {
      isLayeredPath: false,
      blueCycle: null,
      redCycle: null,
      rhythmType: null,
      polyrhythmRatio: null,
      zoneCoverage: null,
      description: reason,
      confidence: 0,
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================

export const layeredPathDetector = new LayeredPathDetector();
