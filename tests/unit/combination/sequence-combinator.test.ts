/**
 * Layer 1 core — the seam-graph closed-walk search.
 *
 * The engine's whole claim rests on two properties this suite pins:
 *   1. Every result is a CLOSED loop with position continuity at every seam,
 *      including the wrap from the last step back to the first.
 *   2. When two cards live in disjoint position worlds and no bridge material
 *      is allowed, the search EXHAUSTS and says so — `impossible` is a proof,
 *      not a timeout. AAAA (alpha) + GGGG (beta) is that case.
 *
 * Ambient bridging is Task 9; every call here runs with `allowAmbient: false`,
 * which is also what makes the impossibility case a clean statement.
 *
 * The GG/HH calls raise `maxResults` above the default: the classifier is still
 * a Task-8 stub that slices shortest-first, and the shapes under test here
 * (a 2-block concatenation AND a 4-block interleave) only coexist in a wider
 * slice. Nothing about the search itself is relaxed.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type {
  CombinationSearchReport,
  WalkBlock,
} from "$lib/shared/combination/domain/types";
import { findCombinations } from "$lib/shared/combination/services/sequence-combinator";

import { AAAA_CCW, GGGG_CW, HHHH_CCW, HHHH_CW } from "./fixtures";
import { loadPictographDatasetForTests } from "./pictograph-dataset";

/** Rotation-faithful twins re-derive their letters from the dataframe. */
beforeAll(async () => {
  await loadPictographDatasetForTests();
}, 60_000);

const GH_OPTIONS = {
  allowAmbient: false,
  maxResultLength: 8,
  maxResults: 200,
} as const;

let ghReport: CombinationSearchReport | null = null;

/** One search shared by the shape/continuity assertions below. */
async function gh(): Promise<CombinationSearchReport> {
  ghReport ??= await findCombinations(GGGG_CW, HHHH_CCW, GH_OPTIONS);
  return ghReport;
}

describe("sequence combinator — walk search", () => {
  it("finds a sequential (2-block) combination of GGGG + HHHH", async () => {
    const report = await gh();
    expect(report.gridModeMismatch).toBe(false);
    expect(report.impossible).toBe(false);
    expect(report.results.length).toBeGreaterThan(0);

    const sequential = report.results.find((r) => r.blocks.length === 2);
    expect(sequential, "expected a two-block concatenation").toBeDefined();
    expect(sequential!.sequence.steps.length).toBe(
      sequential!.blocks[0]!.steps.length + sequential!.blocks[1]!.steps.length
    );
  });

  it("finds an interleaved (4+ block) combination carrying both letters", async () => {
    const report = await gh();
    const fused = report.results.find((r) => r.blocks.length >= 4);
    expect(fused, "expected a four-block interleave").toBeDefined();

    const letters = fused!.sequence.steps.map((s) => s.letter ?? "").join("");
    expect(letters).toMatch(/G/);
    expect(letters).toMatch(/H/);
  });

  it("every result is a closed loop with position continuity", async () => {
    const report = await gh();
    expect(report.results.length).toBeGreaterThan(0);

    for (const result of report.results) {
      const steps = result.sequence.steps;
      expect(steps.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i]!.startPosition, result.canonicalHash).toBe(
          steps[i - 1]!.endPosition
        );
      }
      expect(steps[0]!.startPosition, result.canonicalHash).toBe(
        steps.at(-1)!.endPosition
      );
      expect(steps.map((s) => s.stepNumber)).toEqual(
        steps.map((_, i) => i + 1)
      );
    }
  });

  it("every result draws material from BOTH cards", async () => {
    const report = await gh();
    for (const result of report.results) {
      expect(result.cardAShare, result.canonicalHash).toBeGreaterThan(0);
      expect(result.cardBShare, result.canonicalHash).toBeGreaterThan(0);
      expect(result.cardAShare + result.cardBShare).toBeCloseTo(1, 10);
    }
  });

  it("proves AAAA + GGGG impossible without ambient (alpha vs beta world)", async () => {
    // No spatial/colour/twin transform moves a position family, so the two
    // cards share no seam and no closed alternating walk can exist. The
    // search must EXHAUST to say so.
    const report = await findCombinations(AAAA_CCW, GGGG_CW, {
      allowAmbient: false,
      maxResultLength: 8,
    });
    expect(report.results).toHaveLength(0);
    expect(report.searchComplete).toBe(true);
    expect(report.impossible).toBe(true);
    expect(report.gridModeMismatch).toBe(false);

    // The proof is CHEAP, and that matters: the two cards' seams are disjoint,
    // so the only walkable material is card A and its twin. Measured at 2,001
    // < nodes <= 2,200 (default budget 200,000, ~1% consumed). A regression
    // that made this expensive would turn a proof into a timeout.
    const tightBudget = await findCombinations(AAAA_CCW, GGGG_CW, {
      allowAmbient: false,
      maxResultLength: 8,
      searchBudget: 2_500,
    });
    expect(tightBudget.searchComplete).toBe(true);
    expect(tightBudget.impossible).toBe(true);
  }, 60_000);

  it("dedups rotations of the same closed walk", async () => {
    // Both cards are 4-fold symmetric — GGGG's rotation-faithful twin IS
    // HHHH_CW — so the SAME cyclic walk is reachable from several card-A start
    // indices, each entering at a different phase and therefore splitting the
    // blocks differently. Without rotation-canonical dedup every such walk
    // would be reported once per phase.
    //
    // maxResultLength 4 keeps this EXHAUSTIVE, so the assertion is over the
    // whole space rather than over whatever the budget happened to reach.
    const report = await findCombinations(GGGG_CW, HHHH_CW, {
      allowAmbient: false,
      maxResultLength: 4,
      maxResults: 100_000,
    });
    expect(report.searchComplete).toBe(true);
    expect(report.results.length).toBeGreaterThan(0);

    const hashes = report.results.map((r) => r.canonicalHash);
    expect(new Set(hashes).size).toBe(hashes.length);

    // Re-derive the rotation classes independently of the engine's own key:
    // per step, (source, step identity), canonicalized by rotation. Two results
    // landing in the same class would mean the same loop reported twice.
    const rotationClass = (blocks: readonly WalkBlock[]): string => {
      const keys = blocks.flatMap((b) =>
        b.steps.map((s) => `${b.sourceId}#${s.id}`)
      );
      let best = keys.join(">");
      for (let k = 1; k < keys.length; k++) {
        const rotated = [...keys.slice(k), ...keys.slice(0, k)].join(">");
        if (rotated < best) best = rotated;
      }
      return best;
    };
    const classes = report.results.map((r) => rotationClass(r.blocks));
    expect(new Set(classes).size).toBe(classes.length);
  }, 120_000);

  it("is deterministic — same inputs, same results in the same order", async () => {
    const options = {
      allowAmbient: false,
      maxResultLength: 6,
      maxResults: 40,
    };
    const first = await findCombinations(GGGG_CW, HHHH_CCW, options);
    const second = await findCombinations(GGGG_CW, HHHH_CCW, options);

    expect(second.results.map((r) => r.canonicalHash)).toEqual(
      first.results.map((r) => r.canonicalHash)
    );
    expect(second.results.map((r) => r.sequence.word)).toEqual(
      first.results.map((r) => r.sequence.word)
    );
    expect(second.searchComplete).toBe(first.searchComplete);
  }, 60_000);

  it("reports a grid-mode mismatch instead of searching", async () => {
    const boxish = { ...HHHH_CCW, gridMode: "box" as never };
    const report = await findCombinations(GGGG_CW, boxish, {
      allowAmbient: false,
    });
    expect(report.gridModeMismatch).toBe(true);
    expect(report.results).toHaveLength(0);
    expect(report.impossible).toBe(true);
    expect(report.searchComplete).toBe(true);
  });
});
