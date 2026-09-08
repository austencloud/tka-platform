/**
 * Step Round-Trip Parity — proves the lossless Step + MotionView bridge.
 *
 * For every step in the frozen corpus, runs StepData -> StepWithView -> StepData
 * and asserts the motion-derived non-render fingerprints (V2 identity hash,
 * left/right path + solo dedup hashes, step signatures) are byte-identical to the
 * original. If 0 drift, the canonical `Step` + `MotionView` representation is
 * proven lossless over real data — the keystone that makes StepData->Step
 * adoption safe on the sinks the pixel net cannot see.
 *
 * Fingerprints are computed DIRECTLY on the (already-hydrated) sequences with the
 * rebuilt steps swapped in — no re-hydrate — so any drift is the round-trip's
 * fault, not a re-derivation artifact. Reuses the data-parity-guard snapshot as
 * its corpus (offline, deterministic).
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/data-parity-guard.ts --capture --limit 80  # once
 *   npx tsx scripts/migrations/step-roundtrip-parity.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hydrate,
  ensureComposition,
} from "../../src/lib/shared/foundation/services/sequence-hydrator";
import { computeHash } from "../../src/lib/shared/library/services/sequence-content-hasher";
import { StepSignatureGenerator } from "../../src/lib/shared/comparison/services/step-signature-generator";
import { MotionSignatureGenerator } from "../../src/lib/shared/comparison/services/motion-signature-generator";
import {
  stepDataToStepWithView,
  stepWithViewToStepData,
} from "../../src/lib/shared/foundation/domain/adapters/step-view-bridge";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import {
  viewFieldsDigest,
  riskFieldCoverage,
  formatCoverage,
} from "./lib/view-fields-digest.js";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;
const stepSig = new StepSignatureGenerator(new MotionSignatureGenerator());
const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(__dirname, "fixtures", "data-parity-baseline.json");

// Fingerprint an ALREADY-HYDRATED sequence WITHOUT re-hydrating — isolates the
// effect of swapping in round-tripped steps.
async function fingerprintHydrated(
  seq: SequenceData
): Promise<Record<string, string>> {
  const composed = ensureComposition(seq) as AnyRec;
  return {
    identityHash: await computeHash(seq),
    leftPathHash: String(composed["leftPathHash"] ?? ""),
    rightPathHash: String(composed["rightPathHash"] ?? ""),
    leftSoloHash: String(composed["leftSoloHash"] ?? ""),
    rightSoloHash: String(composed["rightSoloHash"] ?? ""),
    stepSignatures: JSON.stringify(stepSig.generateSignatures(seq.steps ?? [])),
    viewFieldsDigest: viewFieldsDigest(seq.steps ?? []),
  };
}

function roundTrip(seq: SequenceData): SequenceData {
  const steps = (seq.steps ?? []).map((sd) =>
    stepWithViewToStepData(stepDataToStepWithView(sd))
  );
  return { ...seq, steps } as SequenceData;
}

async function main(): Promise<void> {
  if (!existsSync(SNAPSHOT)) {
    console.error(
      `No corpus snapshot at ${SNAPSHOT}. Run data-parity-guard.ts --capture first.`
    );
    process.exit(1);
  }
  const { records } = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as {
    records: Array<{ raw: SequenceData }>;
  };
  const FIELDS = [
    "identityHash",
    "leftPathHash",
    "rightPathHash",
    "leftSoloHash",
    "rightSoloHash",
    "stepSignatures",
    "viewFieldsDigest",
  ];
  const drift: Array<{
    word: string;
    field: string;
    before: string;
    after: string;
  }> = [];
  let seqs = 0;
  let steps = 0;
  let errors = 0;

  for (const { raw } of records) {
    let hydrated: SequenceData;
    try {
      hydrated = hydrate(raw) as SequenceData;
    } catch {
      continue;
    }
    if (!hydrated.steps || hydrated.steps.length === 0) continue;
    seqs++;
    steps += hydrated.steps.length;
    let rebuilt: SequenceData;
    try {
      rebuilt = roundTrip(hydrated);
    } catch (e) {
      errors++;
      drift.push({
        word: raw.word ?? "?",
        field: "ROUNDTRIP_THREW",
        before: "",
        after: (e instanceof Error ? e.message : String(e)).slice(0, 40),
      });
      continue;
    }
    const before = await fingerprintHydrated(hydrated);
    const after = await fingerprintHydrated(rebuilt);
    for (const f of FIELDS) {
      if (before[f] !== after[f]) {
        drift.push({
          word: raw.word ?? "?",
          field: f,
          before: String(before[f]).slice(0, 24),
          after: String(after[f]).slice(0, 24),
        });
      }
    }
  }

  const byField = new Map<string, number>();
  for (const d of drift) byField.set(d.field, (byField.get(d.field) ?? 0) + 1);
  // Non-vacuousness proof: show the corpus actually CARRIES the risk fields.
  // 0 in any column means "lossless" was never tested on that field.
  const allSteps = records.flatMap(({ raw }) => {
    try {
      return (hydrate(raw) as SequenceData).steps ?? [];
    } catch {
      return [];
    }
  });
  console.log(
    `risk-field coverage: ${formatCoverage(riskFieldCoverage(allSteps))}`
  );
  console.log(
    `\n─── round-trip parity: ${seqs} sequences, ${steps} steps, ${FIELDS.length} fingerprints each ───`
  );
  if (drift.length === 0) {
    console.log(
      `✅ LOSSLESS — 0 fingerprints drifted. Step + MotionView round-trips byte-identical on every non-render sink.`
    );
  } else {
    console.log(
      `❌ LOSSY — ${drift.length} fingerprints drifted (${errors} round-trip throws) across ${new Set(drift.map((d) => d.word)).size} sequences:`
    );
    for (const [field, n] of byField) console.log(`   ${field}: ${n}`);
    console.log(`\nfirst 15:`);
    for (const d of drift.slice(0, 15))
      console.log(`   ${d.word} · ${d.field}: ${d.before} -> ${d.after}`);
  }
  process.exit(drift.length === 0 ? 0 : 1);
}

main();
export {};
