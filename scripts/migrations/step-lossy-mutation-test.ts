/**
 * Lossy-Bridge Mutation Test — the NEGATIVE CONTROL for the data-parity net.
 *
 * The round-trip parity script proves the LOSSLESS bridge (Step + MotionView)
 * preserves everything. This script proves the net would CATCH the opposite:
 * it round-trips every corpus step through the deliberately LOSSY generic
 * bridge (stepDataToStep -> stepToStepData, which nulls handPath, skewSteps,
 * skewDir, and pathShape) and asserts the fingerprints DO drift.
 *
 * PASS here means "the net has teeth": if any adoption slice accidentally
 * routes data through a lossy path, the guard flags it. FAIL means the lossy
 * bridge slipped through undetected — the net is blind and adoption edits
 * are flying without instruments (the exact state the 2026-07-01 self-audit
 * caught). Requires the corpus to contain the synthetic risk fixtures
 * (data-parity-guard.ts --capture injects them).
 *
 *   npx tsx scripts/migrations/step-lossy-mutation-test.ts
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
  stepDataToStep,
  stepToStepData,
} from "../../src/lib/shared/foundation/domain/adapters/step-bridge";
import {
  viewFieldsDigest,
  riskFieldCoverage,
  formatCoverage,
} from "./lib/view-fields-digest.js";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;
const stepSig = new StepSignatureGenerator(new MotionSignatureGenerator());
const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(__dirname, "fixtures", "data-parity-baseline.json");

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

function lossyRoundTrip(seq: SequenceData): SequenceData {
  const steps = (seq.steps ?? []).map((sd) =>
    stepToStepData(stepDataToStep(sd))
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

  // Per-record: which risk fields it carries, and which fingerprints drifted
  // under the lossy bridge. A carried field whose record shows ZERO drift is
  // an undetected corruption — the net is blind there.
  const blind: string[] = [];
  const caught: string[] = [];
  const driftByField = new Map<string, number>();
  let atRiskRecords = 0;

  for (const { raw } of records) {
    let hydrated: SequenceData;
    try {
      hydrated = hydrate(raw) as SequenceData;
    } catch {
      continue;
    }
    if (!hydrated.steps || hydrated.steps.length === 0) continue;
    const cov = riskFieldCoverage(hydrated.steps);
    const carriesDroppable = cov.handPath + cov.skew + cov.pathShape > 0;
    if (!carriesDroppable) continue; // lossy bridge only drops these; others pass through
    atRiskRecords++;

    const before = await fingerprintHydrated(hydrated);
    const after = await fingerprintHydrated(lossyRoundTrip(hydrated));
    const drifted = FIELDS.filter((f) => before[f] !== after[f]);
    for (const f of drifted)
      driftByField.set(f, (driftByField.get(f) ?? 0) + 1);

    const label = `${raw.word ?? raw.id} [${formatCoverage(cov)}]`;
    if (drifted.length === 0) blind.push(label);
    else caught.push(`${label} -> flagged by: ${drifted.join(", ")}`);
  }

  console.log(
    `\n─── lossy-bridge mutation test: ${atRiskRecords} at-risk records ───`
  );
  if (atRiskRecords === 0) {
    console.log(
      `❌ NET TOOTHLESS — corpus carries no droppable risk fields at all.`
    );
    console.log(
      `   Re-capture with data-parity-guard.ts --capture (injects synthetic fixtures).`
    );
    process.exit(1);
  }
  for (const c of caught) console.log(`   ✓ ${c}`);
  console.log(`\n   drift by fingerprint:`);
  for (const [f, n] of driftByField) console.log(`     ${f}: ${n}`);
  if (blind.length > 0) {
    console.log(
      `\n❌ NET BLIND — ${blind.length} at-risk records survived the lossy bridge undetected:`
    );
    for (const b of blind) console.log(`   ✗ ${b}`);
    process.exit(1);
  }
  console.log(
    `\n✅ NET HAS TEETH — every at-risk record was flagged when run through the lossy bridge.`
  );
  process.exit(0);
}

main();
export {};
