import { describe, expect, it } from "vitest";
import { makeSpinRatio } from "@vtg/domain";
import {
  handIndexAt,
  propIndexAt,
} from "$lib/shared/notation/qft/qft-model";
import {
  theoryKnobs,
  theorySoloKnobs,
  type TheoryFlower,
} from "$lib/shared/shape-matrix/domain/theory-flower";

/** Austen's report: 5:1 antispin, prop starting in, both hands the same. */
const FIVE_ONE_ANTI_IN: TheoryFlower = {
  ratio: makeSpinRatio(5, 1),
  style: "anti",
  ori: "in",
  petals: 6,
};

const eighths = (value: number) => ((value % 8) + 8) % 8;

const samples = [0, 0.25, 0.5, 1, 1.75, 2, 3.5, 5];

describe("a Theory pairing's right hand", () => {
  /* Same Direction is one motion played twice, the second hand a fixed number
     of steps into it. Anything the right hand shows that the left never shows
     at any moment is a different motion wearing the same name. */
  for (const [mode, offset] of [
    ["TS", 0],
    ["SS", 4],
    ["QS", 2],
  ] as const) {
    it(`plays the left hand's own motion ${offset} steps ahead in ${mode}`, () => {
      const left = theorySoloKnobs(FIVE_ONE_ANTI_IN);
      const right = theoryKnobs(FIVE_ONE_ANTI_IN, "right", mode);

      for (const u of samples) {
        expect(eighths(handIndexAt(right, u))).toBeCloseTo(
          eighths(handIndexAt(left, u + offset)),
          10
        );
        expect(eighths(propIndexAt(right, u))).toBeCloseTo(
          eighths(propIndexAt(left, u + offset)),
          10
        );
      }
    });
  }

  /* Quarter Time is where the old arithmetic showed: it carried the prop two
     eighths when the motion had already turned it ten, leaving the right-hand
     mandala a half turn out of true against a left it was meant to match. */
  it("does not leave the Quarter Time prop a half turn out of true", () => {
    const right = theoryKnobs(FIVE_ONE_ANTI_IN, "right", "QS");
    const stale = { ...theorySoloKnobs(FIVE_ONE_ANTI_IN), handPhase: 8 + 2 };
    expect(eighths(propIndexAt(right, 0))).not.toBeCloseTo(
      eighths(propIndexAt(stale, 0)),
      10
    );
    expect(
      eighths(propIndexAt(right, 0) - propIndexAt(stale, 0))
    ).toBeCloseTo(4, 10);
  });

  /* Opposite Direction is the same motion mirrored about the axis between the
     hands, so every bearing reflects — which swaps clock for counter and
     leaves in and out alone. */
  for (const ori of ["in", "out", "clock", "counter"] as const) {
    it(`mirrors a ${ori} start in Opposite Direction`, () => {
      const flower: TheoryFlower = { ...FIVE_ONE_ANTI_IN, ori };
      const left = theorySoloKnobs(flower);
      const right = theoryKnobs(flower, "right", "QO");
      const axis = 8 + 2 / 2;

      for (const u of samples) {
        expect(eighths(handIndexAt(right, u))).toBeCloseTo(
          eighths(2 * axis - handIndexAt(left, u)),
          10
        );
        expect(eighths(propIndexAt(right, u))).toBeCloseTo(
          eighths(2 * axis - propIndexAt(left, u)),
          10
        );
      }
    });
  }

  /* A hand that never travels has no clock to run ahead of, so its timing is
     the plain bearing offset it always was. */
  it("keeps a stationary hand's timing a plain bearing offset", () => {
    const stationary: TheoryFlower = {
      ratio: makeSpinRatio(1, 0),
      style: "pro",
      ori: "out",
      petals: 1,
    };
    const right = theoryKnobs(stationary, "right", "QS");
    expect(right.phase).toBe(theorySoloKnobs(stationary).phase);
    expect(right.handPhase).toBe(8 + 2);
  });
});
