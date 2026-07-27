/**
 * Integration test: smooth constraint must prevent prop rotation reversals.
 *
 * When propContinuity = "maximize", the beam search should never produce
 * a sequence where the rotation direction changes (cw→ccw or ccw→cw)
 * between consecutive non-noRotation steps.
 *
 * The old StepGenerationOrchestrator hard-filtered by rotation direction.
 * The new SequenceBuilder uses soft constraints + enrichment. This test
 * verifies the new path actually prevents reversals.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SequenceBuilder } from "../../src/generation/builder/SequenceBuilder.js";
import type { IVariationProvider } from "../../src/generation/data/IVariationProvider.js";
import type { PictographData, MotionData } from "../../src/generation/constraints/types.js";
import { setLetterTransitionGraph } from "../../src/core/transition-graph/LetterTransitionGraph.js";
import type { ITransitionGraph } from "../../src/core/transition-graph/ITransitionGraph.js";
import type { PositionGroup, LetterPositionInfo } from "../../src/core/types/sequence-engine-types.js";

// Mock data — must have BOTH cw and ccw variations for each letter so the
// constraint has a real choice to make.

function makeMotion(overrides: Partial<MotionData> = {}): MotionData {
  return {
    color: "blue",
    startLocation: "n",
    endLocation: "s",
    motionType: "pro",
    rotationDirection: "cw",
    startOrientation: "in",
    endOrientation: "in",
    ...overrides,
  };
}

function makePictograph(overrides: Partial<PictographData> & { letter: string }): PictographData {
  return {
    startPosition: "alpha1",
    endPosition: "alpha1",
    timing: "together",
    direction: "together",
    blueMotion: makeMotion({ color: "blue" }),
    redMotion: makeMotion({ color: "red" }),
    ...overrides,
  };
}

// Positions: alpha1, beta3
// Letters:
//   α - Type 6 start position (static at each position)
//   A - alpha1→beta3 (pro, has cw AND ccw variations)
//   B - beta3→alpha1 (pro, has cw AND ccw variations)
//   C - alpha1→alpha1 (static blue, pro red — has cw AND ccw for red)
//   D - beta3→beta3 (static blue, pro red — has cw AND ccw for red)
const MOCK_PICTOGRAPHS: PictographData[] = [
  // Start positions
  makePictograph({
    letter: "α",
    startPosition: "alpha1",
    endPosition: "alpha1",
    blueMotion: makeMotion({ motionType: "static", rotationDirection: "noRotation", startLocation: "s", endLocation: "s" }),
    redMotion: makeMotion({ motionType: "static", rotationDirection: "noRotation", startLocation: "n", endLocation: "n" }),
  }),
  makePictograph({
    letter: "α",
    startPosition: "beta3",
    endPosition: "beta3",
    blueMotion: makeMotion({ motionType: "static", rotationDirection: "noRotation", startLocation: "e", endLocation: "e" }),
    redMotion: makeMotion({ motionType: "static", rotationDirection: "noRotation", startLocation: "n", endLocation: "n" }),
  }),

  // A: alpha1→beta3, CW variant
  makePictograph({
    letter: "A",
    startPosition: "alpha1",
    endPosition: "beta3",
    blueMotion: makeMotion({ motionType: "pro", rotationDirection: "cw", startLocation: "s", endLocation: "e" }),
    redMotion: makeMotion({ motionType: "pro", rotationDirection: "cw", startLocation: "n", endLocation: "e" }),
  }),
  // A: alpha1→beta3, CCW variant
  makePictograph({
    letter: "A",
    startPosition: "alpha1",
    endPosition: "beta3",
    blueMotion: makeMotion({ motionType: "pro", rotationDirection: "ccw", startLocation: "s", endLocation: "e" }),
    redMotion: makeMotion({ motionType: "pro", rotationDirection: "ccw", startLocation: "n", endLocation: "e" }),
  }),

  // B: beta3→alpha1, CW variant
  makePictograph({
    letter: "B",
    startPosition: "beta3",
    endPosition: "alpha1",
    blueMotion: makeMotion({ motionType: "pro", rotationDirection: "cw", startLocation: "e", endLocation: "s" }),
    redMotion: makeMotion({ motionType: "pro", rotationDirection: "cw", startLocation: "e", endLocation: "n" }),
  }),
  // B: beta3→alpha1, CCW variant
  makePictograph({
    letter: "B",
    startPosition: "beta3",
    endPosition: "alpha1",
    blueMotion: makeMotion({ motionType: "pro", rotationDirection: "ccw", startLocation: "e", endLocation: "s" }),
    redMotion: makeMotion({ motionType: "pro", rotationDirection: "ccw", startLocation: "e", endLocation: "n" }),
  }),

  // C: alpha1→alpha1 — static blue (noRotation), pro red with cw/ccw variants
  makePictograph({
    letter: "C",
    startPosition: "alpha1",
    endPosition: "alpha1",
    blueMotion: makeMotion({ motionType: "static", rotationDirection: "noRotation", startLocation: "s", endLocation: "s" }),
    redMotion: makeMotion({ motionType: "pro", rotationDirection: "cw", startLocation: "n", endLocation: "n" }),
  }),
  makePictograph({
    letter: "C",
    startPosition: "alpha1",
    endPosition: "alpha1",
    blueMotion: makeMotion({ motionType: "static", rotationDirection: "noRotation", startLocation: "s", endLocation: "s" }),
    redMotion: makeMotion({ motionType: "pro", rotationDirection: "ccw", startLocation: "n", endLocation: "n" }),
  }),

  // D: beta3→beta3 — static blue (noRotation), pro red with cw/ccw variants
  makePictograph({
    letter: "D",
    startPosition: "beta3",
    endPosition: "beta3",
    blueMotion: makeMotion({ motionType: "static", rotationDirection: "noRotation", startLocation: "e", endLocation: "e" }),
    redMotion: makeMotion({ motionType: "pro", rotationDirection: "cw", startLocation: "n", endLocation: "n" }),
  }),
  makePictograph({
    letter: "D",
    startPosition: "beta3",
    endPosition: "beta3",
    blueMotion: makeMotion({ motionType: "static", rotationDirection: "noRotation", startLocation: "e", endLocation: "e" }),
    redMotion: makeMotion({ motionType: "pro", rotationDirection: "ccw", startLocation: "n", endLocation: "n" }),
  }),
];

// Mock variation provider

class MockVariationProvider implements IVariationProvider {
  getVariations(letter: string, startPosition: string, _gridMode: string): PictographData[] {
    return MOCK_PICTOGRAPHS.filter(
      (p) => p.letter === letter && p.startPosition === startPosition,
    );
  }

  getAllVariations(_gridMode: string): PictographData[] {
    return MOCK_PICTOGRAPHS;
  }
}

// Mock transition graph

const mockTransitionGraph: ITransitionGraph = {
  findBridgeLetters: () => [],
  findAllBridgeOptions: () => [],
  getPositionGroup: (pos: string): PositionGroup => {
    if (pos.startsWith("alpha")) return "alpha" as PositionGroup;
    if (pos.startsWith("beta")) return "beta" as PositionGroup;
    return "gamma" as PositionGroup;
  },
  getLetterPositionInfo: (letter: string): LetterPositionInfo | null => {
    const info: Record<string, LetterPositionInfo> = {
      A: { letter: "A", startGroups: ["alpha" as PositionGroup], endGroups: ["beta" as PositionGroup] },
      B: { letter: "B", startGroups: ["beta" as PositionGroup], endGroups: ["alpha" as PositionGroup] },
      C: { letter: "C", startGroups: ["alpha" as PositionGroup], endGroups: ["alpha" as PositionGroup] },
      D: { letter: "D", startGroups: ["beta" as PositionGroup], endGroups: ["beta" as PositionGroup] },
    };
    return info[letter] ?? null;
  },
};

// Reversal detection helper

function findReversals(steps: { blueMotion: MotionData; redMotion: MotionData }[]): string[] {
  const issues: string[] = [];

  for (const color of ["blue", "red"] as const) {
    let lastDir: string | null = null;
    for (let i = 0; i < steps.length; i++) {
      const motion = color === "blue" ? steps[i]!.motions.blue : steps[i]!.motions.red;
      const dir = motion.rotationDirection;
      if (!dir || dir === "noRotation" || dir === "no_rot") continue;

      if (lastDir && lastDir !== dir) {
        issues.push(`${color} reversal at step ${i}: ${lastDir}→${dir}`);
      }
      lastDir = dir;
    }
  }

  return issues;
}

// Tests

describe("Smooth constraint prevents prop reversals", () => {
  beforeEach(() => {
    setLetterTransitionGraph(mockTransitionGraph);
  });

  it("length-based generation with smooth props has zero reversals (50 runs)", () => {
    const provider = new MockVariationProvider();
    const allReversals: string[] = [];

    for (let run = 0; run < 200; run++) {
      const builder = new SequenceBuilder(provider);
      const result = builder.build({
        length: 8,
        gridMode: "diamond",
        level: 2,
        maxTurnIntensity: 1,
        constraintOptions: { propContinuity: "maximize" },
      });

      const reversals = findReversals(result.sequence);
      if (reversals.length > 0) {
        // Dump the blue directions and turns for debugging
        const blueData = result.sequence.map((s, i) => ({
          step: i,
          letter: s.letter,
          blueType: s.blueMotion.motionType,
          blueDir: s.blueMotion.rotationDirection,
          blueTurns: s.blueMotion.turns,
        }));
        allReversals.push(`Run ${run}: ${reversals.join(", ")} | DATA: ${JSON.stringify(blueData)}`);
      }
    }

    expect(allReversals).toEqual([]);
  });

  it("word-based generation with smooth props has zero reversals (50 runs)", () => {
    const provider = new MockVariationProvider();
    const allReversals: string[] = [];

    for (let run = 0; run < 50; run++) {
      const builder = new SequenceBuilder(provider);
      const result = builder.build({
        word: "ABAB",
        gridMode: "diamond",
        level: 2,
        maxTurnIntensity: 1,
        constraintOptions: { propContinuity: "maximize" },
      });

      const reversals = findReversals(result.sequence);
      if (reversals.length > 0) {
        allReversals.push(`Run ${run}: ${reversals.join(", ")}`);
      }
    }

    expect(allReversals).toEqual([]);
  });
});
