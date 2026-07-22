import { describe, expect, it } from "vitest";

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { decodeSequenceFromQR } from "../sequence-encoder";

describe("legacy QR payload compatibility", () => {
  it.each([
    {
      code: "s8g62i",
      payload:
        "s~q1:9O5/166CQPYL*25*4NKYPGQG:RDJMKRIPXMFQ56W257R5YNI*O4AYS/*COVM1VC9S3:T9J*4HQ13H0",
      stepCount: 4,
      firstMotionType: MotionType.STATIC,
      firstTurns: 0.5,
    },
    {
      code: "rSgNf0",
      payload:
        "s~r1:sr:c2039feb:q1:9O5/166CQPYL*2512NXY9:Z9K56LPHVVPOP6PQI0J11NKO.CQILLI9XZ9HKD+ICP6A+J9B A5KD3:FP0G/B8336",
      stepCount: 8,
      firstMotionType: MotionType.PRO,
      firstTurns: 1,
    },
  ])(
    "decodes the embedded payload from shortcode $code",
    async ({ payload, stepCount, firstMotionType, firstTurns }) => {
      const sequence = await decodeSequenceFromQR(payload);

      expect(sequence.steps).toHaveLength(stepCount);
      expect(sequence.startPosition?.motions.blue?.propType).toBe(
        PropType.STAFF
      );
      expect(sequence.startPosition?.motions.red?.propType).toBe(
        PropType.STAFF
      );
      expect(sequence.steps[0]?.motions.blue.motionType).toBe(firstMotionType);
      expect(sequence.steps[0]?.motions.blue.turns).toBe(firstTurns);
    }
  );
});
