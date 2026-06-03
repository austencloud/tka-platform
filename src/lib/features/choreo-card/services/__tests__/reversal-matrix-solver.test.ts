import { describe, it, expect } from "vitest";
import { solveHandFlips } from "../reversal-seed-service";
import { processReversals } from "$lib/shared/create/services/reversal-detector";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

/**
 * Proves the live reversal apply is WYSIWYG and idempotent.
 *
 * `solveHandFlips` decides which beats to flip so that the reversals the real
 * `processReversals` detector re-derives from the *resulting* spin land exactly
 * on the caller's matrix. These tests run the actual detector on the solved
 * result — no reimplementation — so they verify the two properties the user
 * reported missing:
 *   1. WYSIWYG  — detected dots equal the matrix cell-for-cell.
 *   2. Idempotent — applying the same matrix a second time flips nothing.
 */

type Motion = { rotationDirection?: string; motionType?: string } | undefined;

/** Flip cw↔ccw / pro↔anti on the beats the solver selected (mirrors flipMotion). */
function applyFlips(motions: Motion[], flips: boolean[]): Motion[] {
  return motions.map((m, i) => {
    if (!m || !flips[i]) return m;
    const next = { ...m };
    if (next.rotationDirection === "cw") next.rotationDirection = "ccw";
    else if (next.rotationDirection === "ccw") next.rotationDirection = "cw";
    if (next.motionType === "pro") next.motionType = "anti";
    else if (next.motionType === "anti") next.motionType = "pro";
    return next;
  });
}

function pro(dir: "cw" | "ccw"): Motion {
  return { rotationDirection: dir, motionType: "pro" };
}

function makeSeq(blue: Motion[], red: Motion[], isCircular: boolean): SequenceData {
  const steps: StepData[] = blue.map((b, i) => ({
    id: `beat-${i + 1}`,
    stepNumber: i + 1,
    duration: 1.0,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    letter: null,
    startPosition: null,
    endPosition: null,
    motions: {
      [MotionColor.BLUE]: b as never,
      [MotionColor.RED]: red[i] as never,
    },
  }));
  return {
    id: "seq",
    name: "Test",
    word: "",
    steps,
    thumbnails: [],
    isFavorite: false,
    isCircular,
    loopType: isCircular ? "rotated" : undefined,
    level: 2,
    difficultyLevel: "intermediate",
    tags: [],
    metadata: {},
  } as unknown as SequenceData;
}

function detected(seq: SequenceData): { blue: boolean[]; red: boolean[] } {
  const processed = processReversals(seq);
  return {
    blue: processed.steps.map((s) => s.blueReversal),
    red: processed.steps.map((s) => s.redReversal),
  };
}

describe("reversal matrix solver", () => {
  it("WYSIWYG: detected reversals equal the matrix on a clean loop", () => {
    // 4-beat loop, every beat spinning, both hands start cw.
    const blueBase = [pro("cw"), pro("cw"), pro("cw"), pro("cw")];
    const redBase = [pro("cw"), pro("cw"), pro("cw"), pro("cw")];
    const blueWant = [false, true, false, true]; // 2 reversals → even → clean
    const redWant = [true, false, true, false]; // first-beat reversal honoured via wrap

    const blueFlips = solveHandFlips(blueBase, blueWant);
    const redFlips = solveHandFlips(redBase, redWant);

    const seq = makeSeq(
      applyFlips(blueBase, blueFlips),
      applyFlips(redBase, redFlips),
      true,
    );

    const got = detected(seq);
    expect(got.blue).toEqual(blueWant);
    expect(got.red).toEqual(redWant);
  });

  it("idempotent: re-solving the result flips nothing", () => {
    const base = [pro("cw"), pro("cw"), pro("cw"), pro("cw")];
    const want = [false, true, false, true];

    const result = applyFlips(base, solveHandFlips(base, want));
    const second = solveHandFlips(result, want);

    expect(second).toEqual([false, false, false, false]);
  });

  it("static/dash cells are inert (a non-spinning beat can't reverse)", () => {
    // beat 2 is non-spinning; its matrix cell must produce no reversal.
    const base = [pro("cw"), undefined, pro("cw"), pro("cw")];
    const want = [false, true, true, false];

    const seq = makeSeq(applyFlips(base, solveHandFlips(base, want)), base, false);
    const got = detected(seq);

    expect(got.blue[1]).toBe(false); // inert cell — no dot on the static beat
    expect(got.blue[2]).toBe(true); // honoured on the next spinning beat
    expect(got.blue[0]).toBe(false); // first beat has no predecessor
  });
});
