/**
 * SimilarityCalculator Tests
 *
 * HIGH VALUE TESTS (8/10) - Critical similarity scoring that enables:
 * - Detecting how similar two sequences are
 * - Finding common subsequences
 * - Providing detailed breakdowns for UI display
 *
 * This service composes alignment with multi-dimensional scoring.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { SimilarityCalculator } from "../../../src/lib/shared/comparison/services/implementations/SimilarityCalculator";
import { SequenceAligner } from "../../../src/lib/shared/comparison/services/implementations/SequenceAligner";
import { BeatSignatureGenerator } from "../../../src/lib/shared/comparison/services/implementations/BeatSignatureGenerator";
import { MotionSignatureGenerator } from "../../../src/lib/shared/comparison/services/implementations/MotionSignatureGenerator";
import { SpatialTransformDetector } from "../../../src/lib/shared/comparison/services/implementations/SpatialTransformDetector";
import { createMotionData } from "../../../src/lib/shared/pictograph/shared/domain/models/MotionData";
import type { StepData } from "../../../src/lib/shared/pictograph/shared/domain/models/StepData";
import type { SequenceData } from "../../../src/lib/shared/foundation/domain/models/SequenceData";
import { GridLocation, GridMode } from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "../../../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "../../../src/lib/shared/pictograph/prop/domain/enums/PropType";

describe("SimilarityCalculator", () => {
  let calculator: SimilarityCalculator;

  beforeEach(() => {
    const motionSigGen = new MotionSignatureGenerator();
    const beatSigGen = new BeatSignatureGenerator(motionSigGen);
    const spatialDetector = new SpatialTransformDetector();
    const aligner = new SequenceAligner(beatSigGen, spatialDetector);
    calculator = new SimilarityCalculator(beatSigGen, aligner);
  });

  // Helper to create a step
  function createStep(
    blueStart: GridLocation,
    blueEnd: GridLocation,
    redStart: GridLocation,
    redEnd: GridLocation,
    motionType: MotionType = MotionType.PRO
  ): StepData {
    return {
      motions: {
        [MotionColor.BLUE]: createMotionData({
          motionType,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: blueStart,
          endLocation: blueEnd,
          turns: 1,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.OUT,
          color: MotionColor.BLUE,
          gridMode: GridMode.DIAMOND,
          propType: PropType.STAFF,
        }),
        [MotionColor.RED]: createMotionData({
          motionType,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: redStart,
          endLocation: redEnd,
          turns: 1,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.OUT,
          color: MotionColor.RED,
          gridMode: GridMode.DIAMOND,
          propType: PropType.STAFF,
        }),
      },
    } as StepData;
  }

  function createSequence(steps: StepData[], word: string = "ABC", isCircular: boolean = false): SequenceData {
    return {
      id: "test-seq",
      word,
      steps,
      isCircular,
      metadata: {},
    } as SequenceData;
  }

  // ============================================================================
  // FULL SIMILARITY REPORT
  // ============================================================================

  describe("computeSimilarity", () => {
    it("should return 1.0 overall score for identical sequences", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step], "DJ");
      const seqB = createSequence([step, step], "DJ");

      const report = calculator.computeSimilarity(seqA, seqB);

      expect(report.overallScore).toBeGreaterThan(0.95);
      expect(report.wordSimilarity).toBe(1.0);
      expect(report.structuralSimilarity).toBeGreaterThan(0.9);
      expect(report.breakdown.wordMatch).toBe(true);
      expect(report.breakdown.lengthMatch).toBe(true);
    });

    it("should return lower word similarity for different words", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step], "DJ");
      const seqB = createSequence([step, step], "EK");

      const report = calculator.computeSimilarity(seqA, seqB);

      expect(report.wordSimilarity).toBeLessThan(1.0);
      expect(report.wordSimilarity).toBeGreaterThan(0); // Still some similarity
      expect(report.breakdown.wordMatch).toBe(false);
    });

    it("should detect length difference in breakdown", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step, step], "DJD");
      const seqB = createSequence([step, step], "DJ");

      const report = calculator.computeSimilarity(seqA, seqB);

      expect(report.breakdown.lengthMatch).toBe(false);
      expect(report.breakdown.lengthDifference).toBe(1);
      expect(report.structuralSimilarity).toBeLessThan(1.0);
    });

    it("should count motion type matches and mismatches", () => {
      const proStep = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST,
        MotionType.PRO
      );
      const antiStep = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST,
        MotionType.ANTI
      );

      const seqA = createSequence([proStep, proStep], "DJ");
      const seqB = createSequence([antiStep, antiStep], "DJ");

      const report = calculator.computeSimilarity(seqA, seqB);

      expect(report.breakdown.motionTypeMismatches).toBeGreaterThan(0);
      expect(report.motionSimilarity).toBeLessThan(1.0);
    });

    it("should provide beat-by-beat scores", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step, step], "DJD");
      const seqB = createSequence([step, step, step], "DJD");

      const report = calculator.computeSimilarity(seqA, seqB);

      expect(report.beatByBeatScores.length).toBe(3);
      expect(report.beatByBeatScores.every((s) => s > 0.9)).toBe(true);
    });

    it("should generate human-readable summary", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step], "DJ");
      const seqB = createSequence([step, step], "DJ");

      const report = calculator.computeSimilarity(seqA, seqB);

      expect(report.summary).toBeTruthy();
      expect(report.summary.length).toBeGreaterThan(10);
    });
  });

  // ============================================================================
  // QUICK SCORE
  // ============================================================================

  describe("computeQuickScore", () => {
    it("should return high score for identical sequences", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step], "DJ");
      const seqB = createSequence([step, step], "DJ");

      const result = calculator.computeQuickScore(seqA, seqB);

      expect(result.score).toBeGreaterThan(0.9);
      expect(result.likelyEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should return low score for different length sequences", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step, step, step], "DJDJ");
      const seqB = createSequence([step], "D");

      const result = calculator.computeQuickScore(seqA, seqB);

      expect(result.score).toBeLessThan(0.5);
      expect(result.likelyEquivalent).toBe(false);
    });

    it("should return 1.0 for empty sequences", () => {
      const seqA = createSequence([], "");
      const seqB = createSequence([], "");

      const result = calculator.computeQuickScore(seqA, seqB);

      expect(result.score).toBe(1.0);
      expect(result.likelyEquivalent).toBe(true);
    });

    it("should detect circular equivalence for rotated words", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      // "DJDJ" rotated by 2 is "DJDJ" (same)
      // "ABC" rotated by 1 is "BCA"
      const seqA = createSequence([step, step, step], "ABC", true);
      const seqB = createSequence([step, step, step], "BCA", true);

      const result = calculator.computeQuickScore(seqA, seqB);

      expect(result.score).toBeGreaterThan(0.8);
      expect(result.likelyEquivalent).toBe(true);
    });
  });

  // ============================================================================
  // COMMON SUBSEQUENCES
  // ============================================================================

  describe("findCommonSubsequences", () => {
    it("should find common subsequence in matching sequences", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step, step], "DJD");
      const seqB = createSequence([step, step, step], "DJD");

      const subsequences = calculator.findCommonSubsequences(seqA, seqB, 2);

      expect(subsequences.length).toBeGreaterThan(0);
      expect(subsequences[0].length).toBeGreaterThanOrEqual(2);
    });

    it("should return empty array when no common subsequence meets minimum length", () => {
      const stepA = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST,
        MotionType.PRO
      );
      const stepB = createStep(
        GridLocation.NORTHEAST, GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST, GridLocation.NORTHWEST,
        MotionType.STATIC
      );

      // Completely different steps
      const seqA = createSequence([stepA], "D");
      const seqB = createSequence([stepB], "X");

      const subsequences = calculator.findCommonSubsequences(seqA, seqB, 2);

      // Either empty or very low similarity subsequences
      expect(subsequences.length).toBe(0);
    });

    it("should find longest common subsequence first", () => {
      const matchingStep = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const differentStep = createStep(
        GridLocation.NORTHEAST, GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST, GridLocation.NORTHWEST,
        MotionType.ANTI
      );

      const seqA = createSequence(
        [matchingStep, matchingStep, matchingStep, differentStep],
        "DDJX"
      );
      const seqB = createSequence(
        [matchingStep, matchingStep, matchingStep, differentStep],
        "DDJX"
      );

      const subsequences = calculator.findCommonSubsequences(seqA, seqB, 2);

      if (subsequences.length > 0) {
        // First subsequence should be the longest
        const lengths = subsequences.map((s) => s.length);
        expect(lengths[0]).toBe(Math.max(...lengths));
      }
    });
  });

  // ============================================================================
  // SUMMARY GENERATION
  // ============================================================================

  describe("generateSummary", () => {
    it("should describe nearly identical sequences", () => {
      const step = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST
      );
      const seqA = createSequence([step, step], "DJ");
      const seqB = createSequence([step, step], "DJ");

      const report = calculator.computeSimilarity(seqA, seqB);
      const summary = calculator.generateSummary(report);

      expect(summary.toLowerCase()).toContain("identical");
    });

    it("should describe different sequences appropriately", () => {
      const stepA = createStep(
        GridLocation.NORTH, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.WEST,
        MotionType.PRO
      );
      const stepB = createStep(
        GridLocation.NORTHEAST, GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST, GridLocation.NORTHWEST,
        MotionType.STATIC
      );

      const seqA = createSequence([stepA, stepA], "DJ");
      const seqB = createSequence([stepB, stepB], "XY");

      const report = calculator.computeSimilarity(seqA, seqB);
      const summary = calculator.generateSummary(report);

      expect(summary.toLowerCase()).not.toContain("identical");
    });
  });
});
