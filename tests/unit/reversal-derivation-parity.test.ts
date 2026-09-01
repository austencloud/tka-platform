/**
 * Reversal-Derivation Parity Diagnostic
 * =====================================
 *
 * Question this answers: if the app RE-DERIVES per-step reversal flags from
 * motion content (which `hydrate()` already does on every load via
 * `processReversals`), do the derived flags equal the flags PERSISTED in each
 * sequence's `stepPairings`?
 *
 * Why it matters: both `hashSequenceContent` (render-cache key) and
 * `computeHash` (SHA-256 variation identity) include `blueReversal`/
 * `redReversal`. If re-derivation changes a flag, that sequence's content
 * identity changes — forks, dedup, and deck membership all key off it. So the
 * "make reversals derived, keep contentHash byte-stable" path is only viable if
 * derived == stored for the whole published corpus.
 *
 * Corpus: the committed public snapshot (`static/data/snapshots/public-sequences.json`),
 * 460 published sequences in compositional form (blueSoloProp / redSoloProp /
 * stepPairings). Read-only; this test mutates nothing.
 *
 * This is a DIAGNOSTIC, not a gate: it prints a categorized report and only
 * asserts the corpus loaded. It must not fail CI while the divergence it
 * measures is an open design question.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveSteps } from "../../src/lib/shared/foundation/services/step-deriver";
import { processReversals } from "../../src/lib/shared/create/services/reversal-detector";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import { normalizeLegacySequence } from "@tka/tka-types";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

interface RawDoc {
  word?: string;
  loopType?: string | null;
  isCircular?: boolean;
  isForked?: boolean;
  leftSoloProp?: { steps: unknown[] };
  rightSoloProp?: { steps: unknown[] };
  stepPairings?: Array<{
    letter: string | null;
    leftReversal?: boolean;
    rightReversal?: boolean;
  }>;
}

function loadCorpus(): RawDoc[] {
  const file = path.resolve(
    projectRoot,
    "static/data/snapshots/public-sequences.json"
  );
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    documents: RawDoc[];
  };
  return parsed.documents
    .map(normalizeLegacySequence)
    .filter(
      (d) =>
        d.leftSoloProp?.steps?.length &&
        d.rightSoloProp?.steps?.length &&
        d.stepPairings?.length
    );
}

describe("reversal-derivation parity (diagnostic over the public corpus)", () => {
  it("reports whether real processReversals reproduces stored stepPairings flags", () => {
    const corpus = loadCorpus();
    expect(corpus.length).toBeGreaterThan(0);

    let seqMatch = 0;
    let seqDiffer = 0;
    let stepTotal = 0;
    let stepDiffer = 0;
    let loopDiffer = 0;
    let nonLoopDiffer = 0;
    let seqWithStoredFlags = 0;
    let seqWithStoredFlagsDiffer = 0;
    const examples: string[] = [];

    for (const doc of corpus) {
      const pairings = doc.stepPairings!;
      const isLoop = !!doc.loopType;
      const hasStoredFlag = pairings.some(
        (p) => p.leftReversal || p.rightReversal
      );
      if (hasStoredFlag) seqWithStoredFlags++;

      let derived;
      try {
        // deriveSteps composes the per-step StepData exactly as hydrate() does.
        derived = deriveSteps(
          doc.leftSoloProp as never,
          doc.rightSoloProp as never,
          pairings as never
        );
      } catch {
        // length mismatch / malformed doc — skip, not part of the question.
        continue;
      }

      const seq = {
        id: "diag",
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

      const processed = processReversals(seq);

      let thisDiffers = false;
      for (let i = 0; i < pairings.length; i++) {
        const storedB = !!pairings[i].leftReversal;
        const storedR = !!pairings[i].rightReversal;
        const step = processed.steps[i] as {
          leftReversal?: boolean;
          rightReversal?: boolean;
        };
        const derB = !!step?.leftReversal;
        const derR = !!step?.rightReversal;
        stepTotal++;
        if (derB !== storedB || derR !== storedR) {
          stepDiffer++;
          thisDiffers = true;
        }
      }

      if (thisDiffers) {
        seqDiffer++;
        if (isLoop) loopDiffer++;
        else nonLoopDiffer++;
        if (hasStoredFlag) seqWithStoredFlagsDiffer++;
        if (examples.length < 8) {
          examples.push(
            `${(doc.word ?? "?").slice(0, 18).padEnd(18)} loop=${String(
              doc.loopType ?? "—"
            ).padEnd(16)} forked=${doc.isForked ? "Y" : "N"} storedFlags=${
              hasStoredFlag ? "Y" : "N"
            }`
          );
        }
      } else {
        seqMatch++;
      }
    }

    const analyzed = seqMatch + seqDiffer;
    /* eslint-disable no-console */
    console.log("\n===== REVERSAL DERIVATION PARITY =====");
    console.log(`corpus sequences (compositional): ${corpus.length}`);
    console.log(`analyzed (deriveSteps succeeded):  ${analyzed}`);
    console.log(
      `MATCH  real processReversals == stored: ${seqMatch} sequences`
    );
    console.log(
      `DIFFER real processReversals != stored: ${seqDiffer} sequences  (loop=${loopDiffer}, non-loop=${nonLoopDiffer})`
    );
    console.log(
      `step-level: ${stepDiffer}/${stepTotal} steps differ (${(
        (100 * stepDiffer) /
        Math.max(1, stepTotal)
      ).toFixed(1)}%)`
    );
    console.log(
      `sequences carrying any stored reversal flag: ${seqWithStoredFlags}  (of those, differ from re-derivation: ${seqWithStoredFlagsDiffer})`
    );
    console.log("examples that differ:");
    for (const e of examples) console.log("  " + e);
    console.log("======================================\n");
    /* eslint-enable no-console */

    expect(analyzed).toBeGreaterThan(0);
  });
});
