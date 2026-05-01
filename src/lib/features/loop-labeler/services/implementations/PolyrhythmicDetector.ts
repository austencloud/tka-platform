import {
  analyzeZoneCoverage,
  type ZoneCoverageAnalysis,
} from "$lib/features/create/generate/circular/domain/constants/circular-position-maps";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

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
  isUniform: boolean;
  pattern: string;
}

export interface PeriodAnalysis {
  period: number;
  numGroups: number;
  positionGroups: number[][];
  consistentProperties: PropertyConsistency[];
  consistencyScore: number;
  dominantPropertyType: "motion" | "spatial" | "both" | "other" | "none";
}

export interface PolyrhythmicLOOPResult {
  isPolyrhythmic: boolean;
  polyrhythm: string | null;
  periods: PeriodAnalysis[];
  motionPeriod: PeriodAnalysis | null;
  spatialPeriod: PeriodAnalysis | null;
  description: string;
  confidence: number;
  zoneCoverage?: ZoneCoverageAnalysis;
}

function getProperFactors(n: number): number[] {
  const factors: number[] = [];
  for (let i = 2; i < n; i++) {
    if (n % i === 0) {
      factors.push(i);
    }
  }
  return factors;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

function allSame(values: string[]): boolean {
  if (values.length === 0) return true;
  return values.every((v) => v === values[0]);
}

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

function getPropertyValue(props: StepProperties, property: string): string {
  return String(props[property] ?? "unknown");
}

function describePattern(property: string, values: string[]): string {
  const unique = [...new Set(values)];
  if (unique.length === 1) {
    return `all ${unique[0]}`;
  }
  return values.join(" → ");
}

function getPropertyType(property: string): "motion" | "spatial" | "other" {
  if (property.includes("MotionType")) return "motion";
  if (property.includes("Loc")) return "spatial";
  return "other";
}

export class PolyrhythmicDetector {
  detectPolyrhythmic(
    rawSequence: Record<string, unknown>[]
  ): PolyrhythmicLOOPResult {
    const stepRecords = rawSequence.filter(
      (item) => typeof item.beat === "number" && item.beat > 0
    );
    const steps = stepRecords.map(extractBeatProperties);

    const endPositions = stepRecords.map((item) => {
      const endPos = item.endPos as string | undefined;
      if (!endPos) return null;
      return endPos as GridPosition;
    });

    const length = steps.length;

    if (length < 4) {
      return this.noPolyrhythmResult(
        "Sequence too short for polyrhythmic analysis"
      );
    }

    const factors = getProperFactors(length);

    if (factors.length < 2) {
      return this.noPolyrhythmResult(
        "Sequence length has insufficient factors"
      );
    }

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

    const validPairs: Array<{
      p1: PeriodAnalysis;
      p2: PeriodAnalysis;
      lcmValue: number;
    }> = [];

    const halvedPeriod = length / 2;
    const quarteredPeriod = length / 4;
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
          const p1IsStandard = isStandardLOOPInterval(p1.period);
          const p2IsStandard = isStandardLOOPInterval(p2.period);

          if (p1IsStandard && p2IsStandard) {
            continue;
          }

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

    let bestPair: {
      motionPeriod: PeriodAnalysis;
      spatialPeriod: PeriodAnalysis;
    } | null = null;
    let bestScore = -Infinity;

    for (const { p1, p2 } of validPairs) {
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

      const assignments: Array<{
        motion: PeriodAnalysis;
        spatial: PeriodAnalysis;
        score: number;
      }> = [];

      if (p1MotionCount > 0 || p2SpatialCount > 0) {
        let score = 0;
        if (
          p1.dominantPropertyType === "motion" &&
          p2.dominantPropertyType === "spatial"
        ) {
          score += 100;
        }
        score += p1MotionCount * 10 + p2SpatialCount * 10;
        score -= p1SpatialCount * 5 + p2MotionCount * 5;
        score -= p1.period + p2.period;
        assignments.push({ motion: p1, spatial: p2, score });
      }

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

  private analyzePeriod(
    steps: StepProperties[],
    period: number
  ): PeriodAnalysis {
    const length = steps.length;
    const numGroups = length / period;

    const positionGroups: number[][] = [];
    for (let pos = 0; pos < period; pos++) {
      const group: number[] = [];
      for (let g = 0; g < numGroups; g++) {
        group.push(pos + 1 + g * period);
      }
      positionGroups.push(group);
    }

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

  private checkPropertyConsistency(
    steps: StepProperties[],
    positionGroups: number[][],
    property: string
  ): PropertyConsistency | null {
    const valuesPerPosition: string[] = [];

    for (const group of positionGroups) {
      const values = group.map((stepNum) => {
        const matchingStep = steps.find((b) => b.step === stepNum);
        return matchingStep ? getPropertyValue(matchingStep, property) : "unknown";
      });

      if (!allSame(values)) {
        return null;
      }

      const firstValue = values[0];
      if (firstValue === undefined) {
        return null;
      }
      valuesPerPosition.push(firstValue);
    }

    return {
      property,
      valuesPerPosition,
      isUniform: allSame(valuesPerPosition),
      pattern: describePattern(property, valuesPerPosition),
    };
  }

  private findBestPeriodByType(
    analyses: PeriodAnalysis[],
    type: "motion" | "spatial",
    excludePeriod?: number
  ): PeriodAnalysis | null {
    const available = excludePeriod
      ? analyses.filter((a) => a.period !== excludePeriod)
      : analyses;

    const pureMatches = available.filter(
      (a) => a.dominantPropertyType === type
    );
    if (pureMatches.length > 0) {
      return pureMatches.reduce((best, curr) =>
        curr.consistencyScore > best.consistencyScore ? curr : best
      );
    }

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

  private calculateConfidence(
    motionPeriod: PeriodAnalysis,
    spatialPeriod: PeriodAnalysis
  ): number {
    const totalScore =
      motionPeriod.consistencyScore + spatialPeriod.consistencyScore;
    return Math.min(1, totalScore / 10);
  }

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

export const polyrhythmicDetector = new PolyrhythmicDetector();
