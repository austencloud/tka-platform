/**
 * Compositional Encoding Tests
 *
 * Tests the recipe encoding format (r:{tag}:{hash}:{compressed seed})
 * used for LOOP sequences to produce smaller QR codes.
 *
 * Silent bug risk: if the recipe encoding produces a wrong sequence,
 * the pictographs render incorrectly with no visible error. The QR
 * code works but shows wrong movements. Hash verification is the safety net.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SequenceEncoder } from "$lib/shared/navigation/services/implementations/SequenceEncoder";
import { CompositionalDecoder } from "$lib/shared/qr/services/implementations/CompositionalDecoder";
import {
  RECIPE_PREFIX,
  LOOP_TYPE_TAGS,
  TAG_TO_LOOP_TYPE,
} from "$lib/shared/qr/services/contracts/ICompositionalEncoder";
import { computeRecipeHash } from "$lib/shared/qr/services/implementations/compositional-utils";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

// ============================================================================
// HELPERS (same pattern as SequenceEncoder.test.ts)
// ============================================================================

function makeStep(
  stepNumber: number,
  blue: Partial<Parameters<typeof createMotionData>[0]>,
  red: Partial<Parameters<typeof createMotionData>[0]>
): StepData {
  return {
    id: `step-${stepNumber}`,
    stepNumber,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    letter: null,
    startPosition: null,
    endPosition: null,
    motions: {
      blue: createMotionData({ ...blue, color: MotionColor.BLUE }),
      red: createMotionData({ ...red, color: MotionColor.RED }),
    },
  };
}

function makeStartPosition(
  blue: Partial<Parameters<typeof createMotionData>[0]>,
  red: Partial<Parameters<typeof createMotionData>[0]>
): StepData {
  return makeStep(0, blue, red);
}

function buildTestSequence(steps: StepData[]): SequenceData {
  const startPos = steps.find((s) => s.stepNumber === 0);
  const actualSteps = steps.filter((s) => s.stepNumber > 0);

  return createSequenceData({
    word: "TEST",
    name: "Test Sequence",
    steps: actualSteps,
    ...(startPos && {
      startPosition: {
        id: startPos.id,
        letter: startPos.letter,
        gridPosition: startPos.startPosition,
        startPosition: startPos.startPosition,
        endPosition: startPos.endPosition,
        motions: startPos.motions,
      },
    }),
  });
}

function buildSimple3StepSequence(): SequenceData {
  return buildTestSequence([
    makeStartPosition(
      {
        motionType: MotionType.STATIC,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.NORTH,
        turns: 0,
        propType: PropType.STAFF,
      },
      {
        motionType: MotionType.STATIC,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.SOUTH,
        turns: 0,
        propType: PropType.STAFF,
      }
    ),
    makeStep(
      1,
      {
        motionType: MotionType.PRO,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        rotationDirection: RotationDirection.CLOCKWISE,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.OUT,
        turns: 1,
        propType: PropType.STAFF,
      },
      {
        motionType: MotionType.ANTI,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.WEST,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        startOrientation: Orientation.CLOCK,
        endOrientation: Orientation.COUNTER,
        turns: 1,
        propType: PropType.STAFF,
      }
    ),
    makeStep(
      2,
      {
        motionType: MotionType.PRO,
        startLocation: GridLocation.EAST,
        endLocation: GridLocation.SOUTH,
        rotationDirection: RotationDirection.CLOCKWISE,
        turns: 1,
        propType: PropType.STAFF,
      },
      {
        motionType: MotionType.ANTI,
        startLocation: GridLocation.WEST,
        endLocation: GridLocation.NORTH,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        turns: 1,
        propType: PropType.STAFF,
      }
    ),
    makeStep(
      3,
      {
        motionType: MotionType.STATIC,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.SOUTH,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        propType: PropType.STAFF,
      },
      {
        motionType: MotionType.STATIC,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.NORTH,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        propType: PropType.STAFF,
      }
    ),
  ]);
}

// ============================================================================
// TESTS
// ============================================================================

describe("CompositionalEncoding", () => {
  let encoder: SequenceEncoder;

  beforeEach(() => {
    encoder = new SequenceEncoder();
  });

  // ==========================================================================
  // CONSTANTS AND FORMAT
  // ==========================================================================

  describe("LOOP_TYPE_TAGS", () => {
    it("maps all single-transform LOOP types to compact tags", () => {
      expect(LOOP_TYPE_TAGS["rotated"]).toBe("sr");
      expect(LOOP_TYPE_TAGS["mirrored"]).toBe("sm");
      expect(LOOP_TYPE_TAGS["flipped"]).toBe("sf");
      expect(LOOP_TYPE_TAGS["swapped"]).toBe("ss");
      expect(LOOP_TYPE_TAGS["inverted"]).toBe("si");
      expect(LOOP_TYPE_TAGS["strict_rewound"]).toBe("rw");
    });

    it("does not include compound LOOP types", () => {
      expect(LOOP_TYPE_TAGS["swapped_inverted"]).toBeUndefined();
      expect(LOOP_TYPE_TAGS["rotated_inverted"]).toBeUndefined();
      expect(LOOP_TYPE_TAGS["mirrored_swapped"]).toBeUndefined();
    });

    it("has reverse lookup for every tag", () => {
      for (const [loopType, tag] of Object.entries(LOOP_TYPE_TAGS)) {
        expect(TAG_TO_LOOP_TYPE[tag]).toBe(loopType);
      }
    });
  });

  describe("RECIPE_PREFIX", () => {
    it("is 'r:'", () => {
      expect(RECIPE_PREFIX).toBe("r:");
    });
  });

  // ==========================================================================
  // FLAT ENCODING REGRESSION
  // ==========================================================================

  describe("encodeForQR/decodeFromQR: flat encoding still works", () => {
    it("non-LOOP sequences use flat encoding (s~z: format)", async () => {
      const seq = buildSimple3StepSequence();
      const encoded = await encoder.encodeForQR(seq);

      // Should start with s~ prefix
      expect(encoded.startsWith("s~")).toBe(true);

      // Should NOT use recipe encoding (non-LOOP)
      expect(encoded.startsWith("s~r:")).toBe(false);

      // Should use z: compression
      expect(encoded.startsWith("s~z:")).toBe(true);
    });

    it("round-trips non-LOOP sequences through encodeForQR/decodeFromQR", async () => {
      const seq = buildSimple3StepSequence();
      const encoded = await encoder.encodeForQR(seq);
      const decoded = await encoder.decodeFromQR(encoded);

      // Step count preserved
      expect(decoded.steps).toHaveLength(3);

      // Motion data preserved
      expect(decoded.steps[0].motions.blue!.motionType).toBe(MotionType.PRO);
      expect(decoded.steps[0].motions.red!.motionType).toBe(MotionType.ANTI);
      expect(decoded.steps[0].motions.blue!.startLocation).toBe(
        GridLocation.NORTH
      );
      expect(decoded.steps[0].motions.blue!.endLocation).toBe(
        GridLocation.EAST
      );
    });
  });

  // ==========================================================================
  // COMPOSITIONAL DECODER UNIT TESTS
  // ==========================================================================

  describe("CompositionalDecoder", () => {
    it("isRecipeEncoded correctly identifies recipe strings", () => {
      const decoder = new CompositionalDecoder(
        { encode: (s) => encoder.encode(s) },
        { decode: (s) => encoder.decode(s) },
        {
          decompressString: (s) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (encoder as any).decompressString(s),
        }
      );

      expect(decoder.isRecipeEncoded("r:sr:abc12345:data")).toBe(true);
      expect(decoder.isRecipeEncoded("z:compressed")).toBe(false);
      expect(decoder.isRecipeEncoded("raw|data")).toBe(false);
    });

    it("rejects unknown LOOP type tags", async () => {
      const decoder = new CompositionalDecoder(
        { encode: (s) => encoder.encode(s) },
        { decode: (s) => encoder.decode(s) },
        {
          decompressString: () => null,
        }
      );

      await expect(
        decoder.decode("r:xx:abc12345:data")
      ).rejects.toThrow('Unknown LOOP type tag: "xx"');
    });

    it("rejects malformed recipe strings", async () => {
      const decoder = new CompositionalDecoder(
        { encode: (s) => encoder.encode(s) },
        { decode: (s) => encoder.decode(s) },
        { decompressString: () => null }
      );

      await expect(decoder.decode("r:sr")).rejects.toThrow(
        "Invalid recipe format"
      );
    });

    it("rejects strings without recipe prefix", async () => {
      const decoder = new CompositionalDecoder(
        { encode: (s) => encoder.encode(s) },
        { decode: (s) => encoder.decode(s) },
        { decompressString: () => null }
      );

      await expect(decoder.decode("z:compressed")).rejects.toThrow(
        "Not a recipe-encoded string"
      );
    });

    it("rejects decompression failures", async () => {
      const decoder = new CompositionalDecoder(
        { encode: (s) => encoder.encode(s) },
        { decode: (s) => encoder.decode(s) },
        { decompressString: () => null }
      );

      await expect(
        decoder.decode("r:sr:abc12345:corruptdata")
      ).rejects.toThrow("Failed to decompress seed data");
    });
  });

  // ==========================================================================
  // HASH VERIFICATION
  // ==========================================================================

  describe("computeRecipeHash", () => {
    it("produces an 8-character hex string", async () => {
      const hash = await computeRecipeHash("test data");
      expect(hash).toHaveLength(8);
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it("produces different hashes for different inputs", async () => {
      const hash1 = await computeRecipeHash("sequence A");
      const hash2 = await computeRecipeHash("sequence B");
      expect(hash1).not.toBe(hash2);
    });

    it("produces consistent hashes for the same input", async () => {
      const hash1 = await computeRecipeHash("deterministic");
      const hash2 = await computeRecipeHash("deterministic");
      expect(hash1).toBe(hash2);
    });
  });

  // ==========================================================================
  // INLINE ENCODING DETECTION
  // ==========================================================================

  describe("isInlineEncoded", () => {
    it("detects s~ prefix", () => {
      expect(encoder.isInlineEncoded("s~z:compressed")).toBe(true);
      expect(encoder.isInlineEncoded("s~r:sr:abc:data")).toBe(true);
    });

    it("rejects non-inline codes", () => {
      expect(encoder.isInlineEncoded("abc123")).toBe(false);
      expect(encoder.isInlineEncoded("r:sr:abc:data")).toBe(false);
    });
  });
});
