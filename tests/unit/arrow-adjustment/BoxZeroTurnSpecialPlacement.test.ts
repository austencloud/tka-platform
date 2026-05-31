/**
 * Box Zero-Turn Special Placement — Regression Test
 *
 * Verifies that the box/special/from_layer1 placement JSON files contain
 * (0, 0) entries for the quarter-opp TnD family letters D, E, F, J, K, L.
 *
 * Root cause: TnD deck cards at the 1:1 ratio (zero turns) rendered in box
 * mode for the quarter-opp family had no special placement entry, causing the
 * pipeline to fall through to default placement. Default placement produces
 * small adjustments (~65px) that leave arrows visually "hugging" the props on
 * a 300px-wide card canvas. The fix adds (0, 0) entries to the affected JSON
 * files with values derived from the existing non-zero-turn entries.
 *
 * Pipeline trace for a box zero-turn K step:
 *   - generateOrientationKey → "in_in" (both start orientations radial)
 *   - resolveEffectiveOriKey → mapToLegacyBucket → "from_layer1"
 *   - generateTurnsTuple → "(0, 0)" (both turns = 0)
 *   - SpecialPlacer.getSpecialAdjustment → loads box/special/from_layer1/K_placements.json
 *   - SpecialPlacementLookup.lookupAdjustment → looks up "(0, 0)" key
 *   - BEFORE fix: no entry → returns null → falls to default (~65px adjustment)
 *   - AFTER fix: entry present → returns explicit adjustment (100px range)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { SpecialPlacementLookup } from "$lib/shared/pictograph/arrow/positioning/placement/services/special-placement-lookup";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { applyBoxMode } from "$lib/features/choreo-card/services/deck-variation";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { generateOrientationKey, resolveEffectiveOriKey, mapToLegacyBucket } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/special-placement-ori-key-generator";
import { turnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/turns-tuple-generator";

const STATIC_ROOT = resolve(process.cwd(), "static");

/**
 * Read a box special placement JSON file directly from the static directory.
 * This is how SpecialPlacementDataProvider loads data at runtime.
 */
function readBoxSpecialPlacement(oriKey: string, letter: string): Record<string, unknown> | null {
  const filePath = resolve(
    STATIC_ROOT,
    "data/arrow_placement/box/special",
    oriKey,
    `${letter}_placements.json`
  );
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Build a minimal diamond-mode motion for the K step 1 from the KE sequence,
 * exactly as it appears in the gallery metadata (anti, S→E, in→out).
 */
function makeKE_step1_diamond(): PictographData {
  const blueMotion = createMotionData({
    motionType: "anti" as const,
    rotationDirection: "cw" as const,
    startLocation: "s" as const,
    endLocation: "e" as const,
    turns: 0,
    startOrientation: "in" as const,
    endOrientation: "out" as const,
  });
  const redMotion = createMotionData({
    motionType: "anti" as const,
    rotationDirection: "ccw" as const,
    startLocation: "n" as const,
    endLocation: "e" as const,
    turns: 0,
    startOrientation: "in" as const,
    endOrientation: "out" as const,
  });
  return {
    id: "ke-step1",
    letter: "K" as any,
    motions: { blue: blueMotion, red: redMotion },
  };
}

/**
 * Apply a 1-step CW box rotation (what applyBoxMode does for alpha/gamma families).
 */
function toBoxStep(diamondPictograph: PictographData): PictographData {
  // Wrap in a minimal sequence to use applyBoxMode
  const seq = createSequenceData({
    id: "test",
    word: "KE",
    steps: [
      {
        id: "s1",
        stepNumber: 1,
        duration: 1,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
        startPosition: null,
        endPosition: null,
        motions: diamondPictograph.motions,
        letter: diamondPictograph.letter,
      } as any,
    ],
  });
  const boxSeq = applyBoxMode(seq, "box");
  const boxStep = boxSeq.steps[0]!;
  return {
    ...diamondPictograph,
    motions: boxStep.motions,
    gridMode: boxStep.gridMode,
  } as any;
}

// ─── Manifest check ─────────────────────────────────────────────────────────

describe("Box special placement manifest", () => {
  it("lists D and F under from_layer1", () => {
    const manifestPath = resolve(
      STATIC_ROOT,
      "data/arrow_placement/box/special/placement_manifest.json"
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, string[]>;
    expect(manifest.from_layer1).toContain("D");
    expect(manifest.from_layer1).toContain("F");
  });
});

// ─── JSON file presence ──────────────────────────────────────────────────────

describe("Box special placement files have (0, 0) entries", () => {
  const QUARTER_OPP_LETTERS = ["D", "E", "F", "J", "K", "L"] as const;

  for (const letter of QUARTER_OPP_LETTERS) {
    it(`box/special/from_layer1/${letter}_placements.json contains "(0, 0)"`, () => {
      const data = readBoxSpecialPlacement("from_layer1", letter);
      expect(data).not.toBeNull();

      // The JSON is structured as { [letter]: { [turnsTuple]: { [key]: [x, y] } } }
      const letterData = data![letter] as Record<string, unknown> | undefined;
      expect(letterData).toBeDefined();

      const zeroZeroEntry = letterData!["(0, 0)"];
      expect(zeroZeroEntry).toBeDefined();
      expect(typeof zeroZeroEntry).toBe("object");
    });
  }
});

// ─── Lookup pipeline ─────────────────────────────────────────────────────────

describe("SpecialPlacementLookup returns non-null for box K zero turns", () => {
  it("finds a placement for (0, 0) turns with a blue anti motion", () => {
    const lookup = new SpecialPlacementLookup();

    // Load the real K placement data
    const kData = readBoxSpecialPlacement("from_layer1", "K");
    expect(kData).not.toBeNull();

    // Blue anti CW motion (from the KE sequence step 1, box-rotated)
    const blueMotion = createMotionData({
      motionType: "anti" as const,
      rotationDirection: "cw" as const,
      startLocation: "sw" as const,  // S rotated 1-step CW = SW
      endLocation: "se" as const,    // E rotated 1-step CW = SE
      turns: 0,
      startOrientation: "in" as const,
      endOrientation: "out" as const,
    });
    const redMotion = createMotionData({
      motionType: "anti" as const,
      rotationDirection: "ccw" as const,
      startLocation: "ne" as const,  // N rotated 1-step CW = NE
      endLocation: "se" as const,    // E rotated 1-step CW = SE
      turns: 0,
      startOrientation: "in" as const,
      endOrientation: "out" as const,
    });

    const pictograph: PictographData = {
      id: "ke-box-step1",
      letter: "K" as any,
      motions: { blue: blueMotion, red: redMotion },
    };

    const result = lookup.lookupAdjustment(
      kData!,
      "(0, 0)",
      blueMotion,
      pictograph,
      "blue"
    );

    expect(result).not.toBeNull();
    // The adjustment should be substantial — not the near-zero default values
    const magnitude = Math.sqrt(result!.x ** 2 + result!.y ** 2);
    expect(magnitude).toBeGreaterThan(50);
  });
});

// ─── Orientation key derivation ──────────────────────────────────────────────

describe("Box K zero-turn step maps to from_layer1 and (0, 0) turns tuple", () => {
  it("generates the correct oriKey after box rotation", () => {
    const diamondStep = makeKE_step1_diamond();
    const boxStep = toBoxStep(diamondStep);

    // Both start orientations are radial (in/out) → from_layer1
    const rawOriKey = generateOrientationKey(boxStep.motions.blue!, boxStep);
    // rawOriKey = "in_in" (both start orientations are "in")
    expect(rawOriKey).toBe("in_in");

    const oriKey = resolveEffectiveOriKey(rawOriKey, boxStep);
    // Both props are staff → mapToLegacyBucket → from_layer1
    expect(oriKey).toBe("from_layer1");
  });

  it("generates (0, 0) turns tuple for zero-turn box K", () => {
    const diamondStep = makeKE_step1_diamond();
    const boxStep = toBoxStep(diamondStep);

    const pictograph = {
      ...boxStep,
      motions: {
        blue: { ...boxStep.motions.blue!, turns: 0 },
        red: { ...boxStep.motions.red!, turns: 0 },
      },
    } as PictographData;

    const turnsTuple = turnsTupleGenerator.generateTurnsTuple(pictograph);
    expect(turnsTuple).toBe("(0, 0)");
  });
});
