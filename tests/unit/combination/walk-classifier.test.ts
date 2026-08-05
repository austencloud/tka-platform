/**
 * Layer 2 — verdicts, content dedup and ranking.
 *
 * The search hands over closed walks; this layer decides what they MEAN and
 * which of them a human should see first. Three claims carry the suite:
 *
 *   1. The verdict is read off the block shape against each card's REPEAT UNIT,
 *      so "two G steps" (GGGG's unit is one step) and "two FALG steps" (unit
 *      four) are labelled differently even though both are two-step blocks.
 *   2. Dedup is on CONTENT, not on source identity. Two walks over different
 *      variants of a symmetric card build the same sequence, and only one of
 *      them should reach the user.
 *   3. The presentation order is NOT the search's shortest-first order. That
 *      was a measured problem at Task 6: the shortest walks of GGGG + HHHH are
 *      two-step "one G, one H" loops, and a default page of 24 filled up with
 *      them.
 *
 * Every expected string here is DISPLAY-layer output (`simplifyRepeatedWord`),
 * so "GGGG" reads as "G" — the data layer's full expansion still lives on
 * `sequence.word`.
 */

import { beforeAll, describe, expect, it } from "vitest";

import {
  COMBINATOR_DEFAULTS,
  type CombinationResult,
  type WalkBlock,
  type WalkSource,
} from "$lib/shared/combination/domain/types";
import { findCombinations } from "$lib/shared/combination/services/sequence-combinator";
import {
  classifyAndRank,
  rankResults,
  type RawWalk,
} from "$lib/shared/combination/services/walk-classifier";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

import { FALG, GGGG_CW, GHGH, HHHH_CCW } from "./fixtures";
import { loadPictographDatasetForTests } from "./pictograph-dataset";

/** Letter re-derivation and the twin sources both read the real dataframe. */
beforeAll(async () => {
  await loadPictographDatasetForTests();
}, 60_000);

const NO_AMBIENT = { allowAmbient: false } as const;

/** `cardA:1+cardB:2` — the block shape, for readable failure messages. */
function shapeOf(result: CombinationResult): string {
  return result.blocks.map((b) => `${b.kind}:${b.steps.length}`).join("+");
}

function cardBlocks(result: CombinationResult): readonly WalkBlock[] {
  return result.blocks.filter((b) => b.kind !== "ambient");
}

describe("walk classifier — verdicts", () => {
  it("labels a two-run walk SEQUENTIAL and a whole-unit interleave FUSED", async () => {
    // GGGG and HHHH each simplify to a one-letter word, so their repeat unit is
    // ONE step: every single-step block is already a whole unit, and the only
    // thing separating these two verdicts is how many runs the walk has.
    const report = await findCombinations(GGGG_CW, HHHH_CCW, NO_AMBIENT);
    expect(report.results.length).toBeGreaterThan(0);

    const sequential = report.results.find((r) => r.verdict === "SEQUENTIAL");
    expect(sequential, "expected a SEQUENTIAL result").toBeDefined();
    expect(cardBlocks(sequential!)).toHaveLength(2);

    const fused = report.results.find((r) => r.verdict === "FUSED");
    expect(fused, "expected a FUSED result").toBeDefined();
    const fusedBlocks = cardBlocks(fused!);
    expect(fusedBlocks.length).toBeGreaterThan(2);
    // Strictly alternating cards. The whole-unit half of the FUSED rule is
    // vacuous for this pair (unit 1 divides everything) — the sub-unit cut it
    // guards against is tested on FALG and GHGH below, where the unit is > 1.
    fusedBlocks.forEach((block, i) => {
      if (i > 0)
        expect(block.kind, shapeOf(fused!)).not.toBe(fusedBlocks[i - 1]!.kind);
    });

    // Every result carries one of the four verdicts — no stub label survives.
    for (const result of report.results) {
      expect(
        ["SEQUENTIAL", "FUSED", "BRAIDED", "HYBRID"],
        result.canonicalHash
      ).toContain(result.verdict);
    }
  }, 60_000);

  it("labels a cut inside FALG's repeat unit BRAIDED", async () => {
    // FALG's word does not repeat, so its unit is its four letters — a one- or
    // two-step FALG block is a cut INSIDE the unit, which is exactly what
    // BRAIDED names. GGGG's unit is one step, so the G side can never trigger
    // it; the label here is about card A alone.
    const report = await findCombinations(FALG, GGGG_CW, {
      ...NO_AMBIENT,
      maxResultLength: 8,
      maxResults: 40,
    });

    const braided = report.results.filter((r) => r.verdict === "BRAIDED");
    expect(braided.length, "expected a BRAIDED result").toBeGreaterThan(0);

    for (const result of braided) {
      const subUnit = result.blocks.filter(
        (b) => b.kind === "cardA" && b.steps.length < 4
      );
      expect(subUnit.length, shapeOf(result)).toBeGreaterThan(0);
    }

    // And the converse: nothing whose card blocks are all whole units got
    // called BRAIDED.
    for (const result of report.results) {
      if (result.verdict !== "BRAIDED") continue;
      expect(
        cardBlocks(result).some(
          (b) => b.steps.length < (b.kind === "cardA" ? 4 : 1)
        ),
        shapeOf(result)
      ).toBe(true);
    }
  }, 60_000);
});

describe("walk classifier — content dedup", () => {
  it("gives every surfaced result a distinct canonical hash", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, NO_AMBIENT);
    const hashes = report.results.map((r) => r.canonicalHash);
    expect(new Set(hashes).size).toBe(hashes.length);
    // The hash is CONTENT, not the search's source-identity signature: it has
    // to survive two walks over different variants of the same material.
    for (const hash of hashes) expect(hash.length).toBeGreaterThan(0);
  }, 60_000);

  it("collapses two walks over different sources that build the same sequence", async () => {
    // GGGG and HHHH are 4-fold symmetric, so a variant of card B can contain
    // literally the same steps as the identity — and the search cannot see
    // that, because its dedup key is `sourceId#stepIndex`. Same steps, two
    // source labels: the search reports two walks, the classifier must report
    // one result.
    const steps = [
      ...GGGG_CW.steps.slice(0, 2), // beta1 -> beta3 -> beta5
      ...HHHH_CCW.steps.slice(2, 4), // beta5 -> beta7 -> beta1
    ];

    const walkVia = (bSourceId: string, signature: string): RawWalk => ({
      blocks: [
        {
          sourceId: "A",
          kind: "cardA",
          startStepIndex: 0,
          steps: steps.slice(0, 2),
          rotationFaithful: false,
        },
        {
          sourceId: bSourceId,
          kind: "cardB",
          startStepIndex: 2,
          steps: steps.slice(2),
          rotationFaithful: false,
        },
      ],
      totalSteps: 4,
      signature,
    });

    const sources: WalkSource[] = [
      {
        kind: "cardA",
        id: "A",
        variant: {
          rotation: 0,
          mirrored: false,
          colorSwapped: false,
          rotationFaithful: false,
        },
        sequence: GGGG_CW,
      },
      {
        kind: "cardB",
        id: "B id",
        variant: {
          rotation: 0,
          mirrored: false,
          colorSwapped: false,
          rotationFaithful: false,
        },
        sequence: HHHH_CCW,
      },
      {
        kind: "cardB",
        id: "B mirror",
        variant: {
          rotation: 0,
          mirrored: true,
          colorSwapped: false,
          rotationFaithful: false,
        },
        sequence: HHHH_CCW,
      },
    ];

    const both = await classifyAndRank(
      [walkVia("B id", "w1"), walkVia("B mirror", "w2")],
      GGGG_CW,
      HHHH_CCW,
      sources,
      COMBINATOR_DEFAULTS
    );
    const alone = await classifyAndRank(
      [walkVia("B id", "w1")],
      GGGG_CW,
      HHHH_CCW,
      sources,
      COMBINATOR_DEFAULTS
    );

    expect(both).toHaveLength(1);
    // The survivor is the FIRST walk — the search emits shortest-first, so
    // "first" is the representative worth keeping.
    expect(both[0]!.blocks[1]!.sourceId).toBe("B id");
    expect(both[0]!.canonicalHash).toBe(alone[0]!.canonicalHash);
  }, 60_000);
});

describe("walk classifier — unlabelable results", () => {
  it("drops a walk whose spliced material has no dataframe letter", async () => {
    // A PRO that never moves is not a dataframe row at all, so `buildResult`
    // flags the sequence `metadata.incompleteWord`. Such a result cannot be
    // labelled, saved or turned into a shortcode — surfacing it would only
    // offer the user something that breaks downstream.
    const stuck = (color: MotionColor) =>
      createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.NORTH,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        turns: 0,
        color,
        arrowLocation: GridLocation.NORTH,
      });
    const unresolvable = createStepData({
      id: "unresolvable",
      stepNumber: 1,
      letter: null,
      startPosition: GGGG_CW.steps[0]!.startPosition,
      endPosition: GGGG_CW.steps[0]!.startPosition,
      motions: {
        [MotionColor.BLUE]: stuck(MotionColor.BLUE),
        [MotionColor.RED]: stuck(MotionColor.RED),
      },
    });

    const walk = (blocks: WalkBlock[], signature: string): RawWalk => ({
      blocks,
      totalSteps: blocks.reduce((n, b) => n + b.steps.length, 0),
      signature,
    });

    const good = walk(
      [
        {
          sourceId: "A",
          kind: "cardA",
          startStepIndex: 0,
          steps: GGGG_CW.steps.slice(0, 2),
          rotationFaithful: false,
        },
        {
          sourceId: "B id",
          kind: "cardB",
          startStepIndex: 2,
          steps: HHHH_CCW.steps.slice(2, 4),
          rotationFaithful: false,
        },
      ],
      "good"
    );
    const broken = walk(
      [
        {
          sourceId: "A",
          kind: "cardA",
          startStepIndex: 0,
          steps: [GGGG_CW.steps[0]!, unresolvable],
          rotationFaithful: false,
        },
        {
          sourceId: "B id",
          kind: "cardB",
          startStepIndex: 1,
          steps: HHHH_CCW.steps.slice(1, 4),
          rotationFaithful: false,
        },
      ],
      "broken"
    );

    const results = await classifyAndRank(
      [broken, good],
      GGGG_CW,
      HHHH_CCW,
      [],
      COMBINATOR_DEFAULTS
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.sequence.metadata.incompleteWord).toBeUndefined();
    expect(results[0]!.sequence.word.length).toBe(
      results[0]!.sequence.steps.length
    );
  }, 60_000);
});

describe("walk classifier — ranking", () => {
  it("does not let trivial two-step walks head the default page", async () => {
    // THE measured Task-6 problem. The search finds the two-step loops first
    // (they are the shortest closed walks there are) and there are dozens of
    // them; ranked by shape instead, a real interleave leads.
    const report = await findCombinations(GGGG_CW, HHHH_CCW, NO_AMBIENT);
    expect(report.results.length).toBe(COMBINATOR_DEFAULTS.maxResults);

    const first = report.results[0]!;
    expect(first.sequence.steps.length).toBeGreaterThan(2);
    expect(first.verdict).toBe("FUSED");
    expect(first.sequence.period).toBe(1);

    // Two-steppers are still present — they are real combinations — just not
    // at the top.
    const shortest = report.results.findIndex(
      (r) => r.sequence.steps.length === 2
    );
    expect(shortest).toBeGreaterThan(0);
  }, 60_000);

  it("orders verdicts FUSED, SEQUENTIAL, HYBRID, BRAIDED", async () => {
    const order = ["FUSED", "SEQUENTIAL", "HYBRID", "BRAIDED"];

    // Measured on a real report: GGGG + HHHH produces the first three.
    const gh = await findCombinations(GGGG_CW, HHHH_CCW, NO_AMBIENT);
    const ghRanks = gh.results.map((r) => order.indexOf(r.verdict));
    expect(ghRanks).toEqual([...ghRanks].sort((a, b) => a - b));
    expect(new Set(ghRanks).size).toBeGreaterThan(1);

    // GHGH's unit is two steps ("GHGH" simplifies to "GH"), so one-step GHGH
    // blocks are sub-unit — this pair is where BRAIDED shows up, and it sorts
    // last there too.
    const gg = await findCombinations(GHGH, GGGG_CW, {
      ...NO_AMBIENT,
      maxResultLength: 8,
      maxResults: 40,
    });
    const ggRanks = gg.results.map((r) => order.indexOf(r.verdict));
    expect(ggRanks).toEqual([...ggRanks].sort((a, b) => a - b));
    expect(gg.results.some((r) => r.verdict === "BRAIDED")).toBe(true);

    // FUSED above BRAIDED directly, on real results from those two reports —
    // no pair produces both verdicts at these lengths, so the comparator is
    // exercised on the mixed list instead of a synthetic one.
    const fused = gh.results.find((r) => r.verdict === "FUSED")!;
    const braided = gg.results.find((r) => r.verdict === "BRAIDED")!;
    expect(rankResults([braided, fused], 8).map((r) => r.verdict)).toEqual([
      "FUSED",
      "BRAIDED",
    ]);
  }, 60_000);

  it("puts period-1 loops above period-2 within the same verdict", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, NO_AMBIENT);
    const fusedPeriods = report.results
      .filter((r) => r.verdict === "FUSED")
      .map((r) => r.sequence.period);

    // Both periods really are present — otherwise the ordering claim is vacuous.
    expect(fusedPeriods).toContain(1);
    expect(fusedPeriods).toContain(2);
    expect(fusedPeriods).toEqual(
      [...fusedPeriods].sort((a, b) => (a ?? Infinity) - (b ?? Infinity))
    );
  }, 60_000);
});

describe("walk classifier — derivation", () => {
  it("names the ingredients in display words", async () => {
    const report = await findCombinations(FALG, GGGG_CW, {
      ...NO_AMBIENT,
      maxResultLength: 8,
      maxResults: 40,
    });
    expect(report.results.length).toBeGreaterThan(0);

    // DISPLAY layer: GGGG simplifies to G, FALG does not repeat so it stays
    // whole. Pinned exactly — `simplifyRepeatedWord` on both operands is the
    // whole contract, and a raw "GGGG" here would be the defect
    // `simplified-word-display.md` exists to catch.
    for (const result of report.results) {
      expect(result.derivation, result.canonicalHash).toMatch(
        /^= FALG \+ G(?: · rotation-faithful seams)?$/
      );
    }
    expect(report.results.some((r) => r.derivation === "= FALG + G")).toBe(
      true
    );

    // The marker is not decoration: it appears exactly when a block came from a
    // rotation-faithful twin source.
    for (const result of report.results) {
      expect(
        result.derivation.includes("rotation-faithful"),
        result.canonicalHash
      ).toBe(result.rotationFaithfulBlocks > 0);
    }
  }, 60_000);

  it("names both single-letter cards", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, NO_AMBIENT);
    for (const result of report.results) {
      expect(result.derivation, result.canonicalHash).toMatch(
        /^= G \+ H(?: · rotation-faithful seams)?$/
      );
    }
    // No ambient layer yet (Task 9), so nothing extends the sentence.
    for (const result of report.results) {
      expect(result.usedAmbient).toBe(false);
      expect(result.ambientWords).toEqual([]);
    }
  }, 60_000);
});

describe("walk classifier — wholeUnitsOnly", () => {
  it("is a no-op for GGGG + HHHH, whose unit is a single step", async () => {
    // Both cards simplify to one letter, so every block is already a whole
    // number of units and the flag can remove nothing. The claim worth pinning
    // is that it removes nothing — a filter that quietly dropped whole-unit
    // walks would show up here as a shorter list.
    const unrestricted = await findCombinations(GGGG_CW, HHHH_CCW, NO_AMBIENT);
    const restricted = await findCombinations(GGGG_CW, HHHH_CCW, {
      ...NO_AMBIENT,
      wholeUnitsOnly: true,
    });

    expect(restricted.results.length).toBeGreaterThan(0);
    expect(restricted.results.map((r) => r.canonicalHash)).toEqual(
      unrestricted.results.map((r) => r.canonicalHash)
    );
  }, 60_000);

  it("actually removes sub-unit blocks when a card's unit is bigger than one", async () => {
    // GHGH's unit is two steps, so this is where the flag has teeth.
    const options = {
      ...NO_AMBIENT,
      maxResultLength: 8,
      maxResults: 40,
    };
    const unrestricted = await findCombinations(GHGH, GGGG_CW, options);
    const restricted = await findCombinations(GHGH, GGGG_CW, {
      ...options,
      wholeUnitsOnly: true,
    });

    expect(restricted.results.length).toBeGreaterThan(0);
    expect(
      unrestricted.results.some((r) =>
        r.blocks.some((b) => b.kind === "cardA" && b.steps.length % 2 !== 0)
      ),
      "the unrestricted search must contain what the flag removes"
    ).toBe(true);

    for (const result of restricted.results) {
      for (const block of result.blocks) {
        if (block.kind === "cardA") {
          expect(block.steps.length % 2, shapeOf(result)).toBe(0);
        }
      }
      // A sub-unit cut is what BRAIDED means, so the flag rules it out.
      expect(result.verdict, shapeOf(result)).not.toBe("BRAIDED");
    }
  }, 60_000);
});

describe("walk classifier — determinism", () => {
  it("labels, dedups and ranks identically across runs", async () => {
    const options = {
      ...NO_AMBIENT,
      maxResultLength: 6,
      maxResults: 24,
    };
    const [first, second] = [
      await findCombinations(GGGG_CW, HHHH_CCW, options),
      await findCombinations(GGGG_CW, HHHH_CCW, options),
    ];

    const fingerprint = (report: { results: readonly CombinationResult[] }) =>
      report.results.map((r) => ({
        hash: r.canonicalHash,
        verdict: r.verdict,
        derivation: r.derivation,
        word: r.sequence.word,
        period: r.sequence.period,
        shape: shapeOf(r),
      }));

    expect(fingerprint(second)).toEqual(fingerprint(first));
  }, 60_000);
});
