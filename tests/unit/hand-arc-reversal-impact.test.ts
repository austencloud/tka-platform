/**
 * Hand-Arc Reversal Impact — corpus superset guarantee + display-diff report
 * ==========================================================================
 *
 * Two jobs:
 *
 * 1. GUARANTEE (hard assert): the hand-arc-aware detector never suppresses a
 *    dot the legacy rotation-only detector emitted. The findings doc
 *    (2026-06-30-reversal-derivation-reconciliation-findings.md) established
 *    the legacy detector has zero false positives — this work only ADDS the
 *    hand reversals it missed. new ⊇ old, cell for cell, over the whole
 *    published corpus.
 *
 * 2. REPORT (diagnostic): how many sequences/steps GAIN dots — the
 *    display-level magnitude of enabling hand-arc awareness. Reversal flags
 *    are no longer identity-bearing (content-hash V2 live since 2026-06-30,
 *    CONTENT_HASH_VERSION === HASH_VERSION_V2), so this is a pure display
 *    diff: more dots on cards/UI, no identity forks.
 *
 * The legacy reference below is a frozen copy of the pre-2026-07-05
 * production algorithm (rotation-only, loop-wrap, blank-transparent) — kept
 * here verbatim so the comparison is against the real shipped behavior, not a
 * reimagining of it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveSteps } from "../../src/lib/shared/foundation/services/step-deriver";
import { processReversals } from "../../src/lib/shared/create/services/reversal-detector";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "../../src/lib/shared/foundation/domain/models/step-data";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

// ---------------------------------------------------------------------------
// Frozen legacy reference (pre-hand-arc production processReversals)
// ---------------------------------------------------------------------------

function legacyGetPropRotDir(step: StepData, color: "blue" | "red"): string | null {
  if (!step || step.isBlank) return null;
  const motionData = step.motions?.[color] as
    | { rotationDirection?: string; motionType?: string }
    | undefined;
  if (!motionData) return null;
  if (motionData.rotationDirection) return motionData.rotationDirection;
  if (motionData.motionType === "static" || motionData.motionType === "dash") {
    return "noRotation";
  }
  return "cw"; // legacy bad-data default (warn elided in the frozen copy)
}

function legacyLastValid(steps: StepData[], color: "blue" | "red"): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const dir = legacyGetPropRotDir(steps[i]!, color);
    if (dir && dir !== "noRotation") return dir;
  }
  return null;
}

function legacyIsReversal(last: string | null, current: string | null): boolean {
  if (!last || !current || last === "noRotation" || current === "noRotation") {
    return false;
  }
  return last !== current;
}

function legacyProcessReversals(sequence: SequenceData): Array<{ blue: boolean; red: boolean }> {
  const isLoop = !!sequence.loopType;
  const steps = sequence.steps;
  const out: Array<{ blue: boolean; red: boolean }> = [];

  for (let i = 0; i < steps.length; i++) {
    const currentStep = steps[i]!;
    if (currentStep.isBlank) {
      out.push({ blue: false, red: false });
      continue;
    }
    const previousSteps = isLoop
      ? [...steps, ...steps.slice(0, i)]
      : steps.slice(0, i);

    out.push({
      blue: legacyIsReversal(
        legacyLastValid(previousSteps, "blue"),
        legacyGetPropRotDir(currentStep, "blue")
      ),
      red: legacyIsReversal(
        legacyLastValid(previousSteps, "red"),
        legacyGetPropRotDir(currentStep, "red")
      ),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Corpus loading (same harness shape as reversal-derivation-parity.test.ts)
// ---------------------------------------------------------------------------

interface RawDoc {
  word?: string;
  loopType?: string | null;
  isCircular?: boolean;
  blueSoloProp?: { steps: unknown[] };
  redSoloProp?: { steps: unknown[] };
  stepPairings?: Array<{ letter: string | null }>;
}

function loadCorpus(): RawDoc[] {
  const file = path.resolve(
    projectRoot,
    "static/data/snapshots/public-sequences.json"
  );
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    documents: RawDoc[];
  };
  return parsed.documents.filter(
    (d) =>
      d.blueSoloProp?.steps?.length &&
      d.redSoloProp?.steps?.length &&
      d.stepPairings?.length
  );
}

describe("hand-arc reversal impact (public corpus)", () => {
  it("never suppresses a legacy dot, and reports the dots gained", () => {
    const corpus = loadCorpus();
    expect(corpus.length).toBeGreaterThan(0);

    let analyzed = 0;
    let stepTotal = 0;
    let cellsOld = 0;
    let cellsNew = 0;
    let gainedBlue = 0;
    let gainedRed = 0;
    let suppressed = 0;
    let seqGained = 0;
    let loopGained = 0;
    const examples: string[] = [];

    for (const doc of corpus) {
      let derived;
      try {
        derived = deriveSteps(
          doc.blueSoloProp as never,
          doc.redSoloProp as never,
          doc.stepPairings as never
        );
      } catch {
        continue; // malformed doc — outside the question
      }

      const sequence = {
        id: "impact",
        name: doc.word ?? "",
        word: doc.word ?? "",
        steps: derived,
        loopType: doc.loopType ?? undefined,
        thumbnails: [],
        isFavorite: false,
        isCircular: !!doc.isCircular,
        level: 2,
        difficultyLevel: "intermediate",
        tags: [],
        metadata: {},
      } as unknown as SequenceData;

      analyzed++;
      const oldFlags = legacyProcessReversals(sequence);
      const processed = processReversals(sequence);

      let thisGained = false;
      for (let i = 0; i < processed.steps.length; i++) {
        stepTotal++;
        const oldStep = oldFlags[i]!;
        const newStep = processed.steps[i] as {
          blueReversal?: boolean;
          redReversal?: boolean;
        };

        for (const color of ["blue", "red"] as const) {
          const oldDot = oldStep[color];
          const newDot =
            color === "blue" ? !!newStep.blueReversal : !!newStep.redReversal;
          if (oldDot) cellsOld++;
          if (newDot) cellsNew++;
          if (oldDot && !newDot) suppressed++;
          if (!oldDot && newDot) {
            thisGained = true;
            if (color === "blue") gainedBlue++;
            else gainedRed++;
          }
        }
      }

      if (thisGained) {
        seqGained++;
        if (doc.loopType) loopGained++;
        if (examples.length < 8) {
          examples.push(
            `${(doc.word ?? "?").slice(0, 18).padEnd(18)} loop=${String(doc.loopType ?? "—")}`
          );
        }
      }
    }

    /* eslint-disable no-console */
    console.log("\n===== HAND-ARC REVERSAL IMPACT =====");
    console.log(`sequences analyzed:                 ${analyzed}`);
    console.log(`steps analyzed:                     ${stepTotal}`);
    console.log(`reversal cells (legacy detector):   ${cellsOld}`);
    console.log(`reversal cells (hand-arc detector): ${cellsNew}`);
    console.log(
      `cells GAINED (hand reversals found): ${gainedBlue + gainedRed}  (blue=${gainedBlue}, red=${gainedRed})`
    );
    console.log(
      `sequences gaining ≥1 dot:           ${seqGained} / ${analyzed}  (loop=${loopGained}, non-loop=${seqGained - loopGained})`
    );
    console.log(`cells SUPPRESSED (must be 0):       ${suppressed}`);
    console.log("examples gaining dots:");
    for (const e of examples) console.log("  " + e);
    console.log("====================================\n");
    /* eslint-enable no-console */

    // The hard guarantee: hand-arc awareness only ADDS dots.
    expect(suppressed).toBe(0);
    expect(analyzed).toBeGreaterThan(0);
  });
});
