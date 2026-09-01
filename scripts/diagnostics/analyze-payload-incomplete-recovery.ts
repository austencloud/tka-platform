/**
 * Read-only feasibility analysis for the 62 PAYLOAD_INCOMPLETE quarantines
 * (parity-repair spec follow-up, 2026-07-27).
 *
 * Hypothesis under test: these are blob-only mints whose wire slot carries the
 * legacy `noRotation` poison, i.e. the runtime already treats their floats as
 * prefloat-less. The app has CANONICAL semantics for prefloat-less floats on
 * mint/store-time steps — the alternatives lookup (`floatAlternatives: true`,
 * the qCE8jd class). If a reconstructed embedded copy (the blob's own motion
 * data, no letters stamped, no prefloat invented) derives a complete word that
 * matches the mint label, the record can rejoin LABELS_CURRENT through the
 * same channel every source mint uses.
 *
 * Two measurements, no writes:
 *
 * 1. WITNESSES — records carrying BOTH an embedded copy whose floats have
 *    real prefloat testimony AND a legacy blob that dropped it (tgllYT
 *    class). Per float beat: does the alternatives lookup on the DECODE
 *    reproduce the mint-time letter? This is the same witness set that
 *    disproved handpath-based recovery; the alternatives semantics must beat
 *    it before any repair is built.
 *
 * 2. THE 62 — per code: decode the blob, run BOTH the strict (current,
 *    incomplete) and the alternatives derivation, then simulate the
 *    backfill-shortcode-words classification as if the embedded copy existed.
 *    Report which codes would land in a sanctioned write class vs stay
 *    quarantined.
 *
 *   TKA_ADMIN=1 npx tsx scripts/diagnostics/analyze-payload-incomplete-recovery.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import {
  contentStepsOf,
  deriveFromSteps,
  letterForBeat,
  PAYLOAD_SCHEMA_VERSION,
  type AnyRec,
} from "../migrations/lib/shortcode-derivation";
import { decodeSequenceFromQR } from "../../src/lib/shared/navigation/services/sequence-encoder";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

const BASELINE_PATH = join(
  "scripts",
  "diagnostics",
  "parity-audit-baseline.json"
);

interface Motionish {
  motionType?: string;
  prefloatMotionType?: string;
  prefloatRotationDirection?: string;
}

const motionsOf = (step: AnyRec) =>
  (step.motions ?? {}) as { left?: Motionish; right?: Motionish };

const isFloat = (m?: Motionish) =>
  String(m?.motionType ?? "").toLowerCase() === "float";
const hasPrefloat = (m?: Motionish) => Boolean(m?.prefloatMotionType);

async function decodeSteps(encoded: unknown): Promise<AnyRec[] | null> {
  if (typeof encoded !== "string" || !encoded) return null;
  try {
    const decoded = (await decodeSequenceFromQR(encoded)) as SequenceData;
    const steps = (decoded.steps ?? []) as unknown as AnyRec[];
    return steps.length > 0 ? steps : null;
  } catch {
    return null;
  }
}

/** Mirror of backfill-shortcode-words' write-gate decision tree, applied to a
 *  hypothetical record whose embedded channel derives `derived`. Returns the
 *  class the real backfill would assign. */
function simulateBackfillClass(
  data: AnyRec,
  derived: { word: string; complete: boolean; stepCount: number }
): string {
  const storedLabel = String(
    data.payloadWord ?? data.sequenceName ?? data.sequence ?? ""
  );
  if (!derived.complete || derived.word.length === 0)
    return "STILL_INCOMPLETE";
  const isLegacyVersion = data.payloadSchemaVersion !== PAYLOAD_SCHEMA_VERSION;
  const labelsCurrent =
    data.payloadWord === derived.word &&
    data.sequenceName === derived.word &&
    data.sequence === derived.word &&
    data.payloadStepCount === derived.stepCount &&
    !isLegacyVersion;
  if (labelsCurrent) return "LABELS_CURRENT";

  const WORD_SHAPE = /^[A-ZΑ-Ωα-ω-]+$/u;
  const wordChanged = storedLabel !== derived.word;
  const labelIsWordShaped =
    storedLabel.length > 0 && WORD_SHAPE.test(storedLabel);
  if (wordChanged && labelIsWordShaped) {
    const storedTokens = storedLabel.match(/[A-ZΑ-Ωα-ω]-?/gu) ?? [];
    const storedMinusFirstToken = storedTokens.slice(1).join("");
    if (
      storedMinusFirstToken === derived.word &&
      storedTokens.length === derived.stepCount + 1
    ) {
      return "TRUNCATED_PAYLOAD_AT_MINT";
    }
    const payloadOutgrowsLabel = derived.stepCount > storedTokens.length;
    if (!derived.word.startsWith(storedLabel) && !payloadOutgrowsLabel) {
      // In the real backfill a corroborated derivation escapes this class,
      // but a restored embed + incomplete blob can never corroborate — the
      // conservative reading is the honest one here.
      return "LABEL_CONTRADICTS_PAYLOAD";
    }
  }
  return isLegacyVersion ? "LEGACY_PAYLOAD_VERSION" : "STALE_MUTABLE_LABELS";
}

async function main(): Promise<void> {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
    quarantined: Record<string, string>;
  };
  const quarantinedCodes = Object.keys(baseline.quarantined);

  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    sdk: string;
    isAdmin: boolean;
  };
  if (!isAdmin) throw new Error("run with TKA_ADMIN=1");
  console.log(`via ${sdk} — read-only analysis`);

  const snap = await (db.collection as (p: string) => AnyRec)("shortcodes")[
    "get"
  ]();
  const docs = (snap.docs as Array<{ id: string; data: () => AnyRec }>).map(
    (d) => ({ id: d.id, data: d.data() })
  );
  console.log(`shortcodes scanned: ${docs.length}`);

  // ── 1. Witness validation ─────────────────────────────────────────────────
  const witness = {
    records: 0,
    misalignedSkipped: 0,
    beats: 0,
    altMatchesMint: 0,
    altNull: 0,
    altWrongLetter: 0,
    mismatchExamples: [] as AnyRec[],
    wordRecords: 0,
    wordMatches: 0,
    wordMismatchExamples: [] as AnyRec[],
  };

  for (const { id, data } of docs) {
    const embedded = data.sequenceData as
      | { steps?: unknown; beats?: unknown }
      | undefined;
    const rawEmb = (embedded?.steps ?? embedded?.beats) as
      | AnyRec[]
      | undefined;
    if (!Array.isArray(rawEmb) || rawEmb.length === 0) continue;
    const embC = contentStepsOf(rawEmb);
    // Era-2 embeds only: at least one float carrying real prefloat testimony.
    const hasPfFloat = embC.some((s) => {
      const m = motionsOf(s);
      return (
        (isFloat(m.left) && hasPrefloat(m.left)) ||
        (isFloat(m.right) && hasPrefloat(m.right))
      );
    });
    if (!hasPfFloat) continue;
    const decSteps = await decodeSteps(data.encoded);
    if (!decSteps) continue;
    const decC = contentStepsOf(decSteps);
    if (decC.length !== embC.length) {
      witness.misalignedSkipped++;
      continue;
    }
    witness.records++;

    let usedBeats = 0;
    for (let i = 0; i < embC.length; i++) {
      const em = motionsOf(embC[i]!);
      const dm = motionsOf(decC[i]!);
      const decPrefloatless =
        (isFloat(dm.left) && !hasPrefloat(dm.left)) ||
        (isFloat(dm.right) && !hasPrefloat(dm.right));
      const embHasTestimony =
        (isFloat(em.left) && hasPrefloat(em.left)) ||
        (isFloat(em.right) && hasPrefloat(em.right));
      if (!decPrefloatless || !embHasTestimony) continue;

      // Mint truth: the embedded step's stored letter, else its strict lookup.
      const mintLetter =
        (typeof embC[i]!.letter === "string" && (embC[i]!.letter as string)) ||
        letterForBeat(embC[i]!);
      if (!mintLetter) continue;
      const altLetter = letterForBeat(decC[i]!, { floatAlternatives: true });
      usedBeats++;
      witness.beats++;
      if (!altLetter) witness.altNull++;
      else if (altLetter === mintLetter) witness.altMatchesMint++;
      else {
        witness.altWrongLetter++;
        if (witness.mismatchExamples.length < 15) {
          witness.mismatchExamples.push({
            code: id,
            beat: i,
            mintLetter,
            altLetter,
          });
        }
      }
    }

    // Whole-word check where both channels complete.
    if (usedBeats > 0) {
      const embWord = deriveFromSteps(rawEmb, "embedded");
      const altWord = deriveFromSteps(decSteps, "embedded"); // alternatives ON
      if (embWord.complete && altWord.complete) {
        witness.wordRecords++;
        if (embWord.word === altWord.word) witness.wordMatches++;
        else if (witness.wordMismatchExamples.length < 15) {
          witness.wordMismatchExamples.push({
            code: id,
            mintWord: embWord.word,
            altWord: altWord.word,
          });
        }
      }
    }
  }

  // ── 2. The 62 quarantined codes ───────────────────────────────────────────
  const byId = new Map(docs.map((d) => [d.id, d.data]));
  const rows: AnyRec[] = [];
  const classCounts: Record<string, number> = {};

  for (const code of quarantinedCodes) {
    const data = byId.get(code);
    if (!data) {
      rows.push({ code, outcome: "DOC_MISSING" });
      classCounts["DOC_MISSING"] = (classCounts["DOC_MISSING"] ?? 0) + 1;
      continue;
    }
    const decSteps = await decodeSteps(data.encoded);
    if (!decSteps) {
      rows.push({ code, outcome: "DECODE_FAILED" });
      classCounts["DECODE_FAILED"] = (classCounts["DECODE_FAILED"] ?? 0) + 1;
      continue;
    }
    const strict = deriveFromSteps(decSteps, "encoded");
    const alt = deriveFromSteps(decSteps, "embedded"); // alternatives ON

    // Census of why each strict-missing beat is missing.
    const decC = contentStepsOf(decSteps);
    let floatGaps = 0;
    let otherGaps = 0;
    for (const i of strict.missingStepIndexes) {
      const m = motionsOf(decC[i] ?? {});
      if (
        (isFloat(m.left) && !hasPrefloat(m.left)) ||
        (isFloat(m.right) && !hasPrefloat(m.right))
      )
        floatGaps++;
      else otherGaps++;
    }

    const storedLabel = String(
      data.payloadWord ?? data.sequenceName ?? data.sequence ?? ""
    );
    const simulated = simulateBackfillClass(data, alt);
    classCounts[simulated] = (classCounts[simulated] ?? 0) + 1;
    rows.push({
      code,
      storedLabel,
      strictWord: strict.word,
      strictMissing: strict.missingStepIndexes,
      floatGaps,
      otherGaps,
      altWord: alt.word,
      altComplete: alt.complete,
      altMissing: alt.missingStepIndexes,
      altMatchesLabel: alt.complete && alt.word === storedLabel,
      simulatedClass: simulated,
    });
  }

  // ── report ────────────────────────────────────────────────────────────────
  console.log("\n════ WITNESS VALIDATION (alternatives vs mint testimony) ════");
  console.log(
    `records: ${witness.records} (skipped ${witness.misalignedSkipped} misaligned)`
  );
  console.log(
    `float beats: ${witness.beats} — alt==mint ${witness.altMatchesMint}, ` +
      `alt null ${witness.altNull}, alt WRONG ${witness.altWrongLetter}`
  );
  for (const ex of witness.mismatchExamples) {
    console.log(`  ✗ ${JSON.stringify(ex)}`);
  }
  console.log(
    `whole words (both complete): ${witness.wordRecords} — match ${witness.wordMatches}`
  );
  for (const ex of witness.wordMismatchExamples) {
    console.log(`  ✗ ${JSON.stringify(ex)}`);
  }

  console.log("\n════ THE 62 — simulated post-restore classification ════");
  for (const [cls, n] of Object.entries(classCounts).sort()) {
    console.log(`  ${String(n).padStart(4)}  ${cls}`);
  }
  for (const r of rows) {
    const flag =
      r.simulatedClass === "STILL_INCOMPLETE" ||
      r.simulatedClass === "LABEL_CONTRADICTS_PAYLOAD"
        ? "⚠️ "
        : r.altMatchesLabel
          ? "✅"
          : "· ";
    console.log(
      `  ${flag} ${r.code} [${r.simulatedClass}] "${r.storedLabel}" → alt "${r.altWord}"` +
        (r.otherGaps ? ` — ${r.otherGaps} NON-float gap(s)` : "")
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(
    "scripts",
    "migrations",
    "backups",
    `payload-incomplete-analysis-${stamp}.json`
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), witness, classCounts, rows },
      null,
      2
    )
  );
  console.log(`\nmanifest: ${outPath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
