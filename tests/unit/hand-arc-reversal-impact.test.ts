/**
 * Reversal Dot Display — corpus byte-identical guarantee vs legacy
 * ================================================================
 *
 * DISPLAY POLICY (Austen, 2026-07-05): pictograph reversal DOTS are for
 * prop-direction reversals ONLY. The consolidated detector's dot output must
 * be BYTE-IDENTICAL to the legacy rotation-only production detector over the
 * whole published corpus: zero dots gained, zero dots suppressed.
 *
 * The legacy reference below is a frozen copy of the pre-consolidation
 * production algorithm (rotation-only, loop-wrap, blank-transparent) — kept
 * here verbatim so the comparison is against the real shipped behavior, not a
 * reimagining of it.
 *
 * The engine's `handReversal` channel (hand retraces, prop continues) is a
 * separate NON-DISPLAY signal retained for future consumers; its corpus
 * footprint is reported informationally at the end (it feeds nothing today).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveSteps } from "../../src/lib/shared/foundation/services/step-deriver";
import { processReversals } from "../../src/lib/shared/create/services/reversal-detector";
import { deriveReversals } from "@tka/sequence-engine";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "../../src/lib/shared/foundation/domain/models/step-data";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

// ---------------------------------------------------------------------------
// Frozen legacy reference (pre-consolidation production processReversals)
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

describe("reversal dot display — corpus parity with the legacy detector", () => {
  it("dot output is byte-identical to legacy: 0 gained, 0 suppressed", () => {
    const corpus = loadCorpus();
    expect(corpus.length).toBeGreaterThan(0);

    let analyzed = 0;
    let stepTotal = 0;
    let cellsLegacy = 0;
    let cellsNew = 0;
    let gained = 0;
    let suppressed = 0;
    let handSignalCells = 0; // non-display channel footprint (informational)

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
        id: "parity",
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
      const legacyFlags = legacyProcessReversals(sequence);
      const processed = processReversals(sequence);
      const signals = deriveReversals(sequence.steps, {
        loop: !!sequence.loopType,
      });

      for (let i = 0; i < processed.steps.length; i++) {
        stepTotal++;
        const legacyStep = legacyFlags[i]!;
        const newStep = processed.steps[i] as {
          blueReversal?: boolean;
          redReversal?: boolean;
        };

        for (const color of ["blue", "red"] as const) {
          const legacyDot = legacyStep[color];
          const newDot =
            color === "blue" ? !!newStep.blueReversal : !!newStep.redReversal;
          if (legacyDot) cellsLegacy++;
          if (newDot) cellsNew++;
          if (legacyDot && !newDot) suppressed++;
          if (!legacyDot && newDot) gained++;
          if (signals[i]?.[color].handReversal) handSignalCells++;
        }
      }
    }

    /* eslint-disable no-console */
    console.log("\n===== REVERSAL DOT DISPLAY PARITY (vs legacy) =====");
    console.log(`sequences analyzed:                ${analyzed}`);
    console.log(`steps analyzed:                    ${stepTotal}`);
    console.log(`dot cells (legacy detector):       ${cellsLegacy}`);
    console.log(`dot cells (consolidated detector): ${cellsNew}`);
    console.log(`cells GAINED (must be 0):          ${gained}`);
    console.log(`cells SUPPRESSED (must be 0):      ${suppressed}`);
    console.log(
      `handReversal signal cells (non-display channel, informational): ${handSignalCells}`
    );
    console.log("===================================================\n");
    /* eslint-enable no-console */

    // The display policy, hard-asserted: dots = prop-direction reversals
    // only, byte-identical to legacy.
    expect(gained).toBe(0);
    expect(suppressed).toBe(0);
    expect(cellsNew).toBe(cellsLegacy);
    expect(analyzed).toBeGreaterThan(0);
  });
});
