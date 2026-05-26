import { describe, expect, it } from "vitest";
import { encodeSequence, decodeSequence, encodeSequenceWithCompression, decodeSequenceWithCompression, parseSequenceRouteId, generateSequenceRoutePath } from "$lib/shared/navigation/services/sequence-encoder";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

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

describe("SequenceEncoder", () => {

  describe("encode/decode round-trip", () => {
    it("preserves all motion fields through uncompressed round-trip", () => {
      const step = makeStep(
        1,
        {
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.NORTH,
          endLocation: GridLocation.EAST,
          startOrientation: Orientation.IN,
          endOrientation: Orientation.OUT,
          turns: 2,
          propType: PropType.STAFF,
        },
        {
          motionType: MotionType.ANTI,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
          startLocation: GridLocation.SOUTH,
          endLocation: GridLocation.WEST,
          startOrientation: Orientation.CLOCK,
          endOrientation: Orientation.COUNTER,
          turns: 1,
          propType: PropType.FAN,
        }
      );

      const seq = buildTestSequence([
        makeStartPosition(
          {
            motionType: MotionType.STATIC,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.IN,
            turns: 0,
            propType: PropType.STAFF,
          },
          {
            motionType: MotionType.STATIC,
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.SOUTH,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.IN,
            turns: 0,
            propType: PropType.FAN,
          }
        ),
        step,
      ]);

      const encoded = encodeSequence(seq);
      const decoded = decodeSequence(encoded);

      expect(decoded.steps).toHaveLength(1);

      const blueMotion = decoded.steps[0].motions.blue!;
      expect(blueMotion.motionType).toBe(MotionType.PRO);
      expect(blueMotion.rotationDirection).toBe(RotationDirection.CLOCKWISE);
      expect(blueMotion.startLocation).toBe(GridLocation.NORTH);
      expect(blueMotion.endLocation).toBe(GridLocation.EAST);
      expect(blueMotion.startOrientation).toBe(Orientation.IN);
      expect(blueMotion.endOrientation).toBe(Orientation.OUT);
      expect(blueMotion.turns).toBe(2);
      expect(blueMotion.propType).toBe(PropType.STAFF);

      const redMotion = decoded.steps[0].motions.red!;
      expect(redMotion.motionType).toBe(MotionType.ANTI);
      expect(redMotion.rotationDirection).toBe(
        RotationDirection.COUNTER_CLOCKWISE
      );
      expect(redMotion.startLocation).toBe(GridLocation.SOUTH);
      expect(redMotion.endLocation).toBe(GridLocation.WEST);
      expect(redMotion.startOrientation).toBe(Orientation.CLOCK);
      expect(redMotion.endOrientation).toBe(Orientation.COUNTER);
      expect(redMotion.turns).toBe(1);
      expect(redMotion.propType).toBe(PropType.FAN);
    });

    it("preserves all motion fields through compressed round-trip", () => {
      const step = makeStep(
        1,
        {
          motionType: MotionType.DASH,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.NORTHEAST,
          endLocation: GridLocation.SOUTHWEST,
          startOrientation: Orientation.CLOCK,
          endOrientation: Orientation.COUNTER,
          turns: 3,
          propType: PropType.CLUB,
        },
        {
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
          startLocation: GridLocation.SOUTHEAST,
          endLocation: GridLocation.SOUTHEAST,
          startOrientation: Orientation.OUT,
          endOrientation: Orientation.OUT,
          turns: 0,
          propType: PropType.CLUB,
        }
      );

      const seq = buildTestSequence([
        makeStartPosition(
          {
            motionType: MotionType.STATIC,
            startLocation: GridLocation.NORTHEAST,
            endLocation: GridLocation.NORTHEAST,
            turns: 0,
            propType: PropType.CLUB,
          },
          {
            motionType: MotionType.STATIC,
            startLocation: GridLocation.SOUTHEAST,
            endLocation: GridLocation.SOUTHEAST,
            turns: 0,
            propType: PropType.CLUB,
          }
        ),
        step,
      ]);

      const { encoded } = encodeSequenceWithCompression(seq);
      const decoded = decodeSequenceWithCompression(encoded);

      const blueMotion = decoded.steps[0].motions.blue!;
      expect(blueMotion.motionType).toBe(MotionType.DASH);
      expect(blueMotion.startLocation).toBe(GridLocation.NORTHEAST);
      expect(blueMotion.endLocation).toBe(GridLocation.SOUTHWEST);
      expect(blueMotion.turns).toBe(3);
      expect(blueMotion.propType).toBe(PropType.CLUB);

      const redMotion = decoded.steps[0].motions.red!;
      expect(redMotion.motionType).toBe(MotionType.STATIC);
      expect(redMotion.startLocation).toBe(GridLocation.SOUTHEAST);
      expect(redMotion.endLocation).toBe(GridLocation.SOUTHEAST);
      expect(redMotion.turns).toBe(0);
    });

    it("preserves multi-step sequences", () => {
      const steps = [
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
            turns: 1,
            propType: PropType.STAFF,
          },
          {
            motionType: MotionType.PRO,
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.WEST,
            rotationDirection: RotationDirection.CLOCKWISE,
            turns: 1,
            propType: PropType.STAFF,
          }
        ),
        makeStep(
          2,
          {
            motionType: MotionType.ANTI,
            startLocation: GridLocation.EAST,
            endLocation: GridLocation.SOUTH,
            rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
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
      ];

      const seq = buildTestSequence(steps);
      const { encoded } = encodeSequenceWithCompression(seq);
      const decoded = decodeSequenceWithCompression(encoded);

      expect(decoded.steps).toHaveLength(3);

      expect(decoded.steps[0].motions.blue!.motionType).toBe(MotionType.PRO);
      expect(decoded.steps[1].motions.blue!.motionType).toBe(MotionType.ANTI);
      expect(decoded.steps[2].motions.blue!.motionType).toBe(MotionType.STATIC);

      expect(decoded.steps[0].motions.blue!.startLocation).toBe(
        GridLocation.NORTH
      );
      expect(decoded.steps[0].motions.blue!.endLocation).toBe(
        GridLocation.EAST
      );
      expect(decoded.steps[1].motions.blue!.startLocation).toBe(
        GridLocation.EAST
      );
      expect(decoded.steps[1].motions.blue!.endLocation).toBe(
        GridLocation.SOUTH
      );
    });

    it("preserves float turns value", () => {
      const step = makeStep(
        1,
        {
          motionType: MotionType.FLOAT,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.NORTH,
          endLocation: GridLocation.EAST,
          turns: "fl" as unknown as number,
          propType: PropType.STAFF,
        },
        {
          motionType: MotionType.STATIC,
          startLocation: GridLocation.SOUTH,
          endLocation: GridLocation.SOUTH,
          turns: 0,
          propType: PropType.STAFF,
        }
      );

      const seq = buildTestSequence([
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
        step,
      ]);

      const encoded = encodeSequence(seq);
      const decoded = decodeSequence(encoded);

      expect(decoded.steps[0].motions.blue!.turns).toBe("fl");
      expect(decoded.steps[0].motions.blue!.motionType).toBe(MotionType.FLOAT);
    });

    it("preserves all 8 grid locations", () => {
      const locations = [
        GridLocation.NORTH,
        GridLocation.EAST,
        GridLocation.SOUTH,
        GridLocation.WEST,
        GridLocation.NORTHEAST,
        GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST,
        GridLocation.NORTHWEST,
      ];

      for (const loc of locations) {
        const step = makeStep(
          1,
          {
            startLocation: loc,
            endLocation: GridLocation.NORTH,
            turns: 0,
            motionType: MotionType.STATIC,
            propType: PropType.STAFF,
          },
          {
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.SOUTH,
            turns: 0,
            motionType: MotionType.STATIC,
            propType: PropType.STAFF,
          }
        );

        const seq = buildTestSequence([
          makeStartPosition(
            {
              startLocation: loc,
              endLocation: loc,
              turns: 0,
              propType: PropType.STAFF,
            },
            {
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              propType: PropType.STAFF,
            }
          ),
          step,
        ]);

        const encoded = encodeSequence(seq);
        const decoded = decodeSequence(encoded);

        expect(decoded.steps[0].motions.blue!.startLocation).toBe(loc);
      }
    });

    it("preserves all orientation values", () => {
      const orientations = [
        Orientation.IN,
        Orientation.OUT,
        Orientation.CLOCK,
        Orientation.COUNTER,
      ];

      for (const orient of orientations) {
        const step = makeStep(
          1,
          {
            startOrientation: orient,
            endOrientation: orient,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            turns: 0,
            motionType: MotionType.STATIC,
            propType: PropType.STAFF,
          },
          {
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.SOUTH,
            turns: 0,
            motionType: MotionType.STATIC,
            propType: PropType.STAFF,
          }
        );

        const seq = buildTestSequence([
          makeStartPosition(
            {
              startLocation: GridLocation.NORTH,
              endLocation: GridLocation.NORTH,
              turns: 0,
              propType: PropType.STAFF,
            },
            {
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              propType: PropType.STAFF,
            }
          ),
          step,
        ]);

        const encoded = encodeSequence(seq);
        const decoded = decodeSequence(encoded);

        expect(decoded.steps[0].motions.blue!.startOrientation).toBe(orient);
        expect(decoded.steps[0].motions.blue!.endOrientation).toBe(orient);
      }
    });

    it("preserves all prop types through round-trip", () => {
      const propTypes = [
        PropType.STAFF,
        PropType.CLUB,
        PropType.FAN,
        PropType.TRIAD,
        PropType.BUUGENG,
        PropType.HAND,
        PropType.POI,
      ];

      for (const propType of propTypes) {
        const step = makeStep(
          1,
          {
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            turns: 0,
            motionType: MotionType.STATIC,
            propType,
          },
          {
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.SOUTH,
            turns: 0,
            motionType: MotionType.STATIC,
            propType,
          }
        );

        const seq = buildTestSequence([
          makeStartPosition(
            {
              startLocation: GridLocation.NORTH,
              endLocation: GridLocation.NORTH,
              turns: 0,
              propType,
            },
            {
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              propType,
            }
          ),
          step,
        ]);

        const encoded = encodeSequence(seq);
        const decoded = decodeSequence(encoded);

        expect(decoded.steps[0].motions.blue!.propType).toBe(propType);
        expect(decoded.steps[0].motions.red!.propType).toBe(propType);
      }
    });
  });

  describe("parseSequenceRouteId", () => {
    it("detects compressed encoded sequences (z: prefix)", () => {
      const result = parseSequenceRouteId("z:CoCkBEjA2oBh");
      expect(result.encoded).toBe("z:CoCkBEjA2oBh");
      expect(result.legacyId).toBeNull();
    });

    it("detects URL-encoded z: prefix", () => {
      const result = parseSequenceRouteId("z%3ACoCkBEjA2oBh");
      expect(result.encoded).toBe("z:CoCkBEjA2oBh");
      expect(result.legacyId).toBeNull();
    });

    it("detects uncompressed pipe-delimited sequences", () => {
      const result = parseSequenceRouteId(
        "nosoiic0sS:sonoiic0sS|noeaioc1pS:soweioc1pS"
      );
      expect(result.encoded).not.toBeNull();
      expect(result.legacyId).toBeNull();
    });

    it("identifies legacy Firebase IDs", () => {
      const result = parseSequenceRouteId(
        "seq_1769720340144_pm6d0gz72"
      );
      expect(result.encoded).toBeNull();
      expect(result.legacyId).toBe("seq_1769720340144_pm6d0gz72");
    });

    it("identifies plain words as legacy IDs", () => {
      const result = parseSequenceRouteId("CAKE");
      expect(result.encoded).toBeNull();
      expect(result.legacyId).toBe("CAKE");
    });

    it("returns both null for empty input", () => {
      const result = parseSequenceRouteId("");
      expect(result.encoded).toBeNull();
      expect(result.legacyId).toBeNull();
    });
  });

  describe("generateSequenceRoutePath", () => {
    it("generates a path starting with /sequence/", () => {
      const seq = buildTestSequence([
        makeStartPosition(
          {
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            turns: 0,
            propType: PropType.STAFF,
          },
          {
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
            turns: 1,
            propType: PropType.STAFF,
          },
          {
            motionType: MotionType.PRO,
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.WEST,
            rotationDirection: RotationDirection.CLOCKWISE,
            turns: 1,
            propType: PropType.STAFF,
          }
        ),
      ]);

      const path = generateSequenceRoutePath(seq);

      expect(path).toMatch(/^\/sequence\//);
    });

    it("produces a path that round-trips through decodeSequenceWithCompression", () => {
      const seq = buildTestSequence([
        makeStartPosition(
          {
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            turns: 0,
            propType: PropType.STAFF,
          },
          {
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
            turns: 1,
            propType: PropType.STAFF,
          },
          {
            motionType: MotionType.PRO,
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.WEST,
            rotationDirection: RotationDirection.CLOCKWISE,
            turns: 1,
            propType: PropType.STAFF,
          }
        ),
      ]);

      const path = generateSequenceRoutePath(seq);

      // The path is URL-encoded; extract and decode it
      const id = path.replace("/sequence/", "");
      const decodedId = decodeURIComponent(id);

      // generateSequenceRoutePath uses compressForURL which produces d1: or raw: prefixes.
      // parseSequenceRouteId currently only recognizes z: and pipe-delimited formats,
      // so we verify the round-trip via decodeSequenceWithCompression directly.
      const decoded = decodeSequenceWithCompression(decodedId);
      expect(decoded.steps).toHaveLength(1);
      expect(decoded.steps[0].motions.blue!.motionType).toBe(MotionType.PRO);
      expect(decoded.steps[0].motions.blue!.startLocation).toBe(
        GridLocation.NORTH
      );
      expect(decoded.steps[0].motions.blue!.endLocation).toBe(
        GridLocation.EAST
      );
    });
  });

  describe("edge cases", () => {
    it("throws on empty input", () => {
      expect(() => decodeSequence("")).toThrow();
    });

    it("handles start position with no actual steps", () => {
      const seq = buildTestSequence([
        makeStartPosition(
          {
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            turns: 0,
            propType: PropType.STAFF,
          },
          {
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.SOUTH,
            turns: 0,
            propType: PropType.STAFF,
          }
        ),
      ]);

      const encoded = encodeSequence(seq);
      const decoded = decodeSequence(encoded);

      expect(decoded.steps).toHaveLength(0);
      expect(decoded.startPosition).toBeDefined();
    });

    it("compressed and uncompressed decode to identical motion data", () => {
      const seq = buildTestSequence([
        makeStartPosition(
          {
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            turns: 0,
            propType: PropType.STAFF,
          },
          {
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
            turns: 2,
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
            propType: PropType.FAN,
          }
        ),
      ]);

      const uncompressed = decodeSequence(encodeSequence(seq));
      const { encoded: compressedStr } = encodeSequenceWithCompression(seq);
      const compressed = decodeSequenceWithCompression(compressedStr);

      const uBlue = uncompressed.steps[0].motions.blue!;
      const cBlue = compressed.steps[0].motions.blue!;

      expect(cBlue.motionType).toBe(uBlue.motionType);
      expect(cBlue.rotationDirection).toBe(uBlue.rotationDirection);
      expect(cBlue.startLocation).toBe(uBlue.startLocation);
      expect(cBlue.endLocation).toBe(uBlue.endLocation);
      expect(cBlue.startOrientation).toBe(uBlue.startOrientation);
      expect(cBlue.endOrientation).toBe(uBlue.endOrientation);
      expect(cBlue.turns).toBe(uBlue.turns);
      expect(cBlue.propType).toBe(uBlue.propType);
    });
  });
});
