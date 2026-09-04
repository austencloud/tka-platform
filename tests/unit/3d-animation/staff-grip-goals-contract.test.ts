/**
 * The staff-grip lab's goal list is the swept corpus, provably.
 *
 * The lab pins the 19 core TnD sequences and shows each one's result from
 * `docs/diagnostics/prop-continuity-findings.json`. That claim only holds while
 * three things stay in step:
 *
 *   1. the roster in `lab-goals.ts`,
 *   2. `TND_MOTIONS` ids 1-19 in `scripts/seed-tnd-deck.ts`, which the sweep
 *      builds its corpus from, and
 *   3. the baked `static/data/hero/tnd-base-words.json` the browser hydrates.
 *
 * If any of them drifts, the lab would show one sequence's findings while
 * playing another's choreography. These assertions fail first instead.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { selectStaticSequence } from "$lib/shared/foundation/services/static-sequence-catalog";
import { continuityReport } from "$lib/shared/3d/diagnostics/prop-continuity-findings";

import {
  LAB_GOALS,
  LAB_GOAL_FAMILIES,
} from "../../../src/routes/test/staff-grip/lab-goals";
import { coreTnDCorpus } from "../../tools/prop-continuity-corpus";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

const catalogPayload = JSON.parse(
  readFileSync(
    path.join(projectRoot, "static/data/hero/tnd-base-words.json"),
    "utf8",
  ),
) as unknown;

/** Every field that changes what the stage actually plays. */
function playbackShape(sequence: {
  readonly steps: readonly unknown[];
  readonly startPosition?: unknown;
}): unknown {
  const motion = (raw: unknown) => {
    const m = raw as Record<string, unknown>;
    return {
      motionType: m.motionType,
      rotationDirection: m.rotationDirection,
      startLocation: m.startLocation,
      endLocation: m.endLocation,
      startOrientation: m.startOrientation,
      endOrientation: m.endOrientation,
      turns: m.turns,
      hand: m.hand,
    };
  };

  const framed = (raw: unknown, withGridMode: boolean) => {
    const s = raw as Record<string, unknown>;
    const motions = s.motions as Record<string, unknown>;
    return {
      letter: s.letter ?? null,
      startPosition: s.startPosition ?? null,
      endPosition: s.endPosition ?? null,
      // Only compared on steps. The seeder leaves it off the start position
      // record itself while the baked document carries it; both agree on the
      // grid mode inside that record's own motions, which is what renders.
      gridMode: withGridMode ? s.gridMode : null,
      left: motion(motions.left),
      right: motion(motions.right),
    };
  };

  return {
    steps: sequence.steps.map((step) => framed(step, true)),
    startPosition: sequence.startPosition
      ? framed(sequence.startPosition, false)
      : null,
  };
}

describe("staff-grip lab goals", () => {
  const corpus = coreTnDCorpus();

  it("is the seeder's first nineteen, in order", () => {
    expect(LAB_GOALS.map((goal) => goal.id)).toEqual(
      corpus.map((entry) => entry.id),
    );
    expect(LAB_GOALS.map((goal) => goal.word)).toEqual(
      corpus.map((entry) => entry.word),
    );
    expect(LAB_GOALS.map((goal) => goal.order)).toEqual(
      Array.from({ length: 19 }, (_, index) => index + 1),
    );
  });

  it("groups all nineteen with no goal in two families and none stranded", () => {
    const grouped = LAB_GOAL_FAMILIES.flatMap((family) => family.goals);
    expect(grouped).toHaveLength(LAB_GOALS.length);
    expect(new Set(grouped.map((goal) => goal.id)).size).toBe(LAB_GOALS.length);
    for (const family of LAB_GOAL_FAMILIES) {
      expect(family.goals.length).toBeGreaterThan(0);
      for (const goal of family.goals) {
        expect(goal.familyId).toBe(family.id);
      }
    }
  });

  it("shows a word the product would show, never the expanded form", () => {
    // A repeating word always displays in its smallest form: AAAA reads as A.
    expect(LAB_GOALS.map((goal) => goal.label)).toEqual([
      "A",
      "B",
      "C",
      "G",
      "H",
      "I",
      "S",
      "T",
      "U",
      "V",
      "JD",
      "KE",
      "LF",
      "DJ",
      "EK",
      "FL",
      "MP",
      "NQ",
      "OR",
    ]);
  });

  it("hydrates from the baked catalog to the choreography the sweep walked", () => {
    for (const entry of corpus) {
      const hydrated = selectStaticSequence(catalogPayload, entry.id);
      expect(hydrated, `${entry.id} is missing from the baked catalog`).not.toBe(
        null,
      );
      expect(playbackShape(hydrated!), entry.id).toEqual(
        playbackShape(entry.sequence),
      );
    }
  });

  it("has a committed continuity result for every goal", () => {
    for (const goal of LAB_GOALS) {
      const report = continuityReport(goal.id);
      expect(report, `${goal.id} was never swept`).toBeDefined();
      expect(report!.word).toBe(goal.word);
      expect(report!.group).toBe("core-tnd");
      expect(report!.motionStepCount).toBe(
        corpus.find((entry) => entry.id === goal.id)!.sequence.steps.length,
      );
    }
  });
});
