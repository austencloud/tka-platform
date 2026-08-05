/**
 * The splice builder — where a graph walk becomes something performable.
 *
 * The payoff this suite exists to prove: a spliced walk over TWO DIFFERENT
 * cards has a valid orientation chain end to end. The search only guarantees
 * positions; `buildResult` re-derives orientations from the walk's own start
 * hold, and `validateSequence` (the create module's orientation-continuity
 * validator) is the independent check that it worked.
 *
 * `validateSequence` is imported from `features/` deliberately and ONLY here —
 * `shared/` source may never import from `features/`, but a test may reach for
 * the app's own validator rather than re-deriving the rule it enforces.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { WalkBlock } from "$lib/shared/combination/domain/types";
import { findCombinations } from "$lib/shared/combination/services/sequence-combinator";
import { buildResult } from "$lib/shared/combination/services/splice-builder";
import { validateSequence } from "$lib/features/create/spell/services/orientation-continuity-validator";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

import { GGGG_CW, HHHH_CCW } from "./fixtures";
import { loadPictographDatasetForTests } from "./pictograph-dataset";

/** Letter re-derivation and the twin sources both read the real dataframe. */
beforeAll(async () => {
  await loadPictographDatasetForTests();
}, 60_000);

const COLORS = [MotionColor.BLUE, MotionColor.RED] as const;

/**
 * The hand-assembled 2-block walk: all of GGGG, then all of HHHH_CCW.
 *
 * Both loops run beta1 -> beta3 -> beta5 -> beta7 -> beta1, so joining them at
 * beta1 is a legal closed walk — the same SEQUENTIAL shape the search finds,
 * built here by hand so the builder is tested without the search in the frame.
 */
function gThenH(): WalkBlock[] {
  return [
    {
      sourceId: "A",
      kind: "cardA",
      startStepIndex: 0,
      steps: GGGG_CW.steps,
      rotationFaithful: false,
    },
    {
      sourceId: "B id",
      kind: "cardB",
      startStepIndex: 0,
      steps: HHHH_CCW.steps,
      rotationFaithful: false,
    },
  ];
}

describe("splice builder", () => {
  it("splices two cards into one closed, orientation-valid sequence", async () => {
    const result = await buildResult(gThenH(), GGGG_CW);

    expect(result.steps.length).toBe(8);
    expect(result.steps.map((s) => s.stepNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(result.isCircular).toBe(true);
    expect(result.word.length).toBe(8);
    expect(result.startPosition).toBeDefined();
    expect(result.startPosition!.gridPosition).toBe(
      GGGG_CW.steps[0]!.startPosition
    );
    expect(result.gridMode).toBe(GGGG_CW.gridMode);

    // Positional closure: every seam meets, including the wrap.
    for (let i = 1; i < result.steps.length; i++) {
      expect(result.steps[i]!.startPosition).toBe(
        result.steps[i - 1]!.endPosition
      );
    }
    expect(result.steps.at(-1)!.endPosition).toBe(
      result.steps[0]!.startPosition
    );

    // THE PAYOFF. Step 1 is checked against the rebuilt start hold, every other
    // step against its predecessor — across the G/H seam included.
    expect(validateSequence(result)).toEqual([]);
  });

  it("is deterministic — the same blocks build the same sequence", async () => {
    const [first, second] = await Promise.all([
      buildResult(gThenH(), GGGG_CW),
      buildResult(gThenH(), GGGG_CW),
    ]);
    // Deep equality including every id: a `crypto.randomUUID()` anywhere in the
    // builder would fail here, and would silently break the search's own
    // determinism guarantee one layer up.
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("keeps the source letters through the splice", async () => {
    // Letters are orientation-INDEPENDENT (dataframe rows carry no orientation),
    // so re-deriving them after the orientation pass is normalization, not
    // correction — it must return exactly what the blocks brought in.
    const result = await buildResult(gThenH(), GGGG_CW);
    expect(result.steps.map((s) => s.letter)).toEqual([
      "G",
      "G",
      "G",
      "G",
      "H",
      "H",
      "H",
      "H",
    ]);
    expect(result.word).toBe("GGGGHHHH");
    expect(result.name).toBe("GGGGHHHH");
  });

  it("really re-derives letters rather than carrying them", async () => {
    // `deriveSequenceLetters` KEEPS the existing letter when a lookup fails, so
    // the assertion above would stay green against a dead dataframe handler.
    // Blanking the blocks' letters first makes the derivation load-bearing.
    const blanked = gThenH().map((block) => ({
      ...block,
      steps: block.steps.map((step) => ({ ...step, letter: null })),
    }));
    const result = await buildResult(blanked, GGGG_CW);
    expect(result.word).toBe("GGGGHHHH");
  });

  it("recomputes reversal flags over the new step order", async () => {
    const result = await buildResult(gThenH(), GGGG_CW);

    for (const step of result.steps) {
      expect(typeof step.blueReversal).toBe("boolean");
      expect(typeof step.redReversal).toBe("boolean");
    }

    // Step 1 can never carry a dot: a dot marks a prop-direction FLIP against
    // what came before, and `processReversals` reads the loop wrap only for
    // sequences carrying a `loopType`. A combination carries none (its LOOP
    // classification is not this layer's claim), so step 1 has no predecessor
    // to flip against.
    expect(result.steps[0]!.blueReversal).toBe(false);
    expect(result.steps[0]!.redReversal).toBe(false);

    // The G->H seam: GGGG is pro CW throughout, HHHH_CCW is anti CCW
    // throughout, so the prop reverses direction exactly once, on step 5 — the
    // first H. Both hands move identically in these two cards, so both dot.
    const dotted = result.steps
      .filter((s) => s.blueReversal || s.redReversal)
      .map((s) => s.stepNumber);
    expect(dotted).toEqual([5]);
    expect(result.steps[4]!.blueReversal).toBe(true);
    expect(result.steps[4]!.redReversal).toBe(true);
  });

  it("closes its orientation chain in one pass for GGGG + HHHH", async () => {
    // OBSERVED, not required. Positional closure is guaranteed; orientation
    // closure is a property of the material, and a walk that does NOT return to
    // its start orientation is simply a period > 1 loop.
    //
    // This splice happens to close in one pass, and the arithmetic says why:
    // pro at 0 turns preserves orientation, so the four G steps are the
    // identity; anti at 0 turns flips it, and four flips are also the identity.
    // in -> in -> in -> in -> in -> out -> in -> out -> in.
    //
    // Pinning the observation guards the claim in both directions — if the
    // orientation pass ever stopped running, or started forcing closure, the
    // chain below would no longer read as computed values.
    const result = await buildResult(gThenH(), GGGG_CW);
    const hold = result.startPosition!;

    for (const color of COLORS) {
      expect(hold.motions[color]!.endOrientation).toBe(
        GGGG_CW.steps[0]!.motions[color].startOrientation
      );
      expect(result.steps.at(-1)!.motions[color].endOrientation).toBe(
        hold.motions[color]!.endOrientation
      );
    }

    expect(result.steps.map((s) => s.motions.blue.startOrientation)).toEqual([
      "in",
      "in",
      "in",
      "in",
      "in",
      "out",
      "in",
      "out",
    ]);
  });

  it("every searched combination of GGGG + HHHH is orientation-valid", async () => {
    // The end-to-end claim: the real builder now runs inside the pipeline, so
    // the search's results are not merely position-continuous walks — they are
    // performable sequences.
    const report = await findCombinations(GGGG_CW, HHHH_CCW, {
      allowAmbient: false,
      maxResultLength: 6,
      maxResults: 40,
    });
    expect(report.results.length).toBeGreaterThan(0);

    for (const result of report.results) {
      const seq = result.sequence;
      expect(seq.startPosition, result.canonicalHash).toBeDefined();
      expect(
        validateSequence(seq).map((e) => e.message),
        result.canonicalHash
      ).toEqual([]);

      // Positional closure survives the post-processing pass.
      for (let i = 1; i < seq.steps.length; i++) {
        expect(seq.steps[i]!.startPosition, result.canonicalHash).toBe(
          seq.steps[i - 1]!.endPosition
        );
      }
      expect(seq.steps.at(-1)!.endPosition, result.canonicalHash).toBe(
        seq.steps[0]!.startPosition
      );
      expect(seq.startPosition!.gridPosition, result.canonicalHash).toBe(
        seq.steps[0]!.startPosition
      );
    }
  }, 60_000);
});
