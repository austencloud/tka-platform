/**
 * Repair every shortcode's payload-derived labels (parity-repair spec,
 * "Shortcode correction → Repair path").
 *
 * The payload is the authority: the `encoded` blob (falling back to embedded
 * `sequenceData.steps`) is decoded, each beat's letter is matched against the
 * pictograph dataframes (the same match `motion-query-handler` performs, done
 * directly over `parseCsvEdges` because the app's CSV loader is browser-only),
 * and the result runs through the shared STRICT word API
 * (`deriveWordStatusFromSteps` → { word, complete, missingStepIndexes,
 * stepCount }). Labels are updated only when derivation is COMPLETE — a
 * partial word would misrepresent the payload, so those records are reported
 * for manual review, never guessed.
 *
 * Every stale mutable label is repaired — not only the auto-name class the
 * first version of this script targeted. `payloadWord`, `payloadStepCount`,
 * and `payloadSchemaVersion: 2` are stamped alongside the `sequenceName` /
 * `sequence` compatibility aliases (readers prefer payloadWord). Scan counts,
 * encoded payloads, ownership, deck attribution, and timestamps are never
 * touched. Historical payload versions (no payloadSchemaVersion) are counted
 * separately from schema-2 records whose labels drifted.
 *
 * Requires the Admin SDK in BOTH modes: the scan reads every full document
 * (the old client-SDK `select()` projection path breaks under the compat
 * client — "db.collection(...).select is not a function"), and writes are
 * admin-only by rules regardless.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-shortcode-words.ts             # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-shortcode-words.ts --apply     # write
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-shortcode-words.ts --apply --limit 5
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import { decodeSequenceFromQR } from "../../src/lib/shared/navigation/services/sequence-encoder";
import { deriveWordStatusFromSteps } from "../../src/lib/shared/foundation/services/word-deriver";
import type { Step } from "@tka/tka-types";
import {
  parseCsvEdges,
  type CsvEdge,
} from "../../src/lib/features/choreo-card/services/pictograph-letter-lookup";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

type AnyRec = Record<string, unknown>;

const REPO_ROOT = "E:/tka-platform";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : Infinity;
})();

// Both dataframes, parsed once. deriveGridMode is browser-coupled, so match
// diamond first and fall back to box — a beat only lives in one, and the two
// alphabets don't collide on the same motion signature.
const csvPath = (name: string) =>
  join(REPO_ROOT, "static", "data", "pictographs", name);
const DIAMOND_EDGES = parseCsvEdges(
  readFileSync(csvPath("DiamondPictographDataframe.csv"), "utf8")
);
const BOX_EDGES = parseCsvEdges(
  readFileSync(csvPath("BoxPictographDataframe.csv"), "utf8")
);

const lc = (v: unknown): string => String(v ?? "").toLowerCase();

interface Motion {
  motionType?: string;
  startLocation?: string;
  endLocation?: string;
  rotationDirection?: string;
  prefloatMotionType?: string;
  prefloatRotationDirection?: string;
}

/** The letter-lookup motion type, mirroring motion-query-handler.getSearchMotionType:
 *  a float resolves through its prefloat type, or to a shift when it travels. */
function searchType(m: Motion): string {
  if (m.prefloatMotionType) return lc(m.prefloatMotionType);
  if (lc(m.motionType) === "float" && lc(m.startLocation) !== lc(m.endLocation)) {
    return "pro";
  }
  return lc(m.motionType);
}

/** Match a beat's two motions against one dataframe. Replicates the criteria in
 *  motion-query-handler.findLetterByMotionConfiguration: motionType + start/end
 *  location + rotation (rotation ignored for static/dash/unresolved-float), with
 *  the float→pro/anti alternative expansion. */
function matchIn(edges: CsvEdge[], blue: Motion, red: Motion): string | null {
  const blueFloat = lc(blue.motionType) === "float" && !blue.prefloatMotionType;
  const redFloat = lc(red.motionType) === "float" && !red.prefloatMotionType;
  const blueTypes =
    blueFloat && searchType(blue) === "pro" ? ["pro", "anti"] : [searchType(blue)];
  const redTypes =
    redFloat && searchType(red) === "pro" ? ["pro", "anti"] : [searchType(red)];
  const blueRot = lc(blue.prefloatRotationDirection || blue.rotationDirection);
  const redRot = lc(red.prefloatRotationDirection || red.rotationDirection);

  for (const bt of blueTypes) {
    for (const rt of redTypes) {
      const bIgnore = bt === "static" || bt === "dash" || blueFloat;
      const rIgnore = rt === "static" || rt === "dash" || redFloat;
      for (const e of edges) {
        if (
          lc(e.blueMotionType) === bt &&
          lc(e.blueStartLocation) === lc(blue.startLocation) &&
          lc(e.blueEndLocation) === lc(blue.endLocation) &&
          (bIgnore || lc(e.blueRotationDirection) === blueRot) &&
          lc(e.redMotionType) === rt &&
          lc(e.redStartLocation) === lc(red.startLocation) &&
          lc(e.redEndLocation) === lc(red.endLocation) &&
          (rIgnore || lc(e.redRotationDirection) === redRot)
        ) {
          return e.letter || null;
        }
      }
    }
  }
  return null;
}

function letterForBeat(step: AnyRec): string | null {
  if (typeof step.letter === "string" && step.letter) return step.letter;
  const motions = step.motions as { blue?: Motion; red?: Motion } | undefined;
  const blue = motions?.blue;
  const red = motions?.red;
  if (!blue || !red) return null;
  return matchIn(DIAMOND_EDGES, blue, red) ?? matchIn(BOX_EDGES, blue, red);
}

/**
 * Derive the payload word for a shortcode doc through the shared strict API.
 *
 * Payload priority per the spec: decode `encoded` first (the immutable
 * authority), fall back to embedded `sequenceData.steps`. Beat letters are
 * filled by the dataframe match where the payload lacks them, then the
 * letter-filled steps run through `deriveWordStatusFromSteps` so completeness,
 * missing indexes, and the content-beat count come from the SAME strict code
 * the runtime uses — never a local reimplementation.
 */
async function derivePayloadWord(data: AnyRec): Promise<{
  word: string;
  complete: boolean;
  missingStepIndexes: readonly number[];
  stepCount: number;
} | null> {
  let steps: AnyRec[] | null = null;

  if (typeof data.encoded === "string" && data.encoded) {
    const decoded = (await decodeSequenceFromQR(data.encoded)) as SequenceData;
    const decodedSteps = (decoded.steps ?? []) as unknown as AnyRec[];
    if (decodedSteps.length > 0) steps = decodedSteps;
  }
  if (!steps) {
    const embedded = data.sequenceData as
      | { steps?: unknown; beats?: unknown }
      | undefined;
    const embeddedSteps = embedded?.steps ?? embedded?.beats;
    if (Array.isArray(embeddedSteps) && embeddedSteps.length > 0) {
      steps = embeddedSteps as AnyRec[];
    }
  }
  if (!steps || steps.length === 0) return null;

  const lettered = steps.map((step, index) => ({
    ...(step as object),
    stepNumber:
      typeof step.stepNumber === "number" ? step.stepNumber : index + 1,
    letter: letterForBeat(step),
  }));
  const status = deriveWordStatusFromSteps(lettered as unknown as Step[]);
  return {
    word: status.word,
    complete: status.complete,
    missingStepIndexes: status.missingStepIndexes,
    stepCount: status.stepCount,
  };
}

/** Matches the mint path's SHORTCODE_PAYLOAD_SCHEMA_VERSION in
 *  short-code-manager.ts: 2 = strict payload-derived labels. */
const PAYLOAD_SCHEMA_VERSION = 2;

type LabelClass =
  | "LABELS_CURRENT"
  | "STALE_MUTABLE_LABELS"
  | "LEGACY_PAYLOAD_VERSION"
  | "PAYLOAD_INCOMPLETE"
  | "PAYLOAD_MISSING"
  | "DERIVATION_FAILED";

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    sdk: string;
    isAdmin: boolean;
  };
  if (!isAdmin) {
    throw new Error(
      "This repair reads every full shortcode document and writes label fields — run with TKA_ADMIN=1. (The client compat SDK also lacks select(), which broke the old dry-run path.)"
    );
  }
  console.log(
    `via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"}` +
      (LIMIT !== Infinity ? ` — limit ${LIMIT}` : "")
  );

  const snap = await (db.collection as (p: string) => AnyRec)("shortcodes")[
    "get"
  ]();
  let docs = (snap.docs as Array<{ id: string; data: () => AnyRec }>).map(
    (d) => ({ id: d.id, data: d.data() })
  );
  docs.sort((a, b) => (a.id < b.id ? -1 : 1));
  if (LIMIT !== Infinity) docs = docs.slice(0, LIMIT);
  console.log(`shortcodes scanned: ${docs.length}`);

  const results: Array<{
    code: string;
    cls: LabelClass;
    storedLabel?: string;
    derivedWord?: string;
    detail?: string;
  }> = [];
  let batch = (db.batch as () => AnyRec)();
  let batchCount = 0;
  const commitBatch = async () => {
    if (batchCount === 0) return;
    await (batch.commit as () => Promise<unknown>)();
    batch = (db.batch as () => AnyRec)();
    batchCount = 0;
  };

  for (const { id: code, data } of docs) {
    const storedLabel = String(
      data.payloadWord ?? data.sequenceName ?? data.sequence ?? ""
    );
    const isLegacyVersion = data.payloadSchemaVersion !== PAYLOAD_SCHEMA_VERSION;

    let derived: Awaited<ReturnType<typeof derivePayloadWord>>;
    try {
      derived = await derivePayloadWord(data);
    } catch (e) {
      results.push({
        code,
        cls: "DERIVATION_FAILED",
        storedLabel,
        detail: String(e instanceof Error ? e.message : e).slice(0, 200),
      });
      continue;
    }

    if (!derived) {
      results.push({ code, cls: "PAYLOAD_MISSING", storedLabel });
      continue;
    }
    if (!derived.complete || derived.word.length === 0) {
      // Quarantine: never invent or truncate a word. Reported for manual
      // review with the exact unresolved beat indexes.
      results.push({
        code,
        cls: "PAYLOAD_INCOMPLETE",
        storedLabel,
        derivedWord: derived.word,
        detail: `missing beat indexes: ${derived.missingStepIndexes.join(", ")} (of ${derived.stepCount})`,
      });
      continue;
    }

    const labelsCurrent =
      data.payloadWord === derived.word &&
      data.sequenceName === derived.word &&
      data.sequence === derived.word &&
      data.payloadStepCount === derived.stepCount &&
      !isLegacyVersion;
    if (labelsCurrent) {
      results.push({ code, cls: "LABELS_CURRENT" });
      continue;
    }

    // Historical payload versions (no schema stamp yet) are counted
    // separately from schema-2 records whose mutable labels drifted — the
    // same write, two different stories about how the record got here.
    const cls: LabelClass = isLegacyVersion
      ? "LEGACY_PAYLOAD_VERSION"
      : "STALE_MUTABLE_LABELS";
    results.push({ code, cls, storedLabel, derivedWord: derived.word });

    if (APPLY) {
      const ref = (db.collection as (p: string) => AnyRec)("shortcodes")[
        "doc"
      ](code) as AnyRec;
      // Label fields ONLY — scan counts, encoded payloads, ownership,
      // deck/print attribution, and timestamps are never touched.
      (batch.update as (r: AnyRec, u: AnyRec) => void)(ref, {
        payloadWord: derived.word,
        payloadStepCount: derived.stepCount,
        payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
        sequenceName: derived.word,
        sequence: derived.word,
      });
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }
  }
  if (APPLY) await commitBatch();

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.cls] = (counts[r.cls] ?? 0) + 1;
  console.log(`\n════ ${APPLY ? "APPLY" : "DRY-RUN"} SUMMARY ════`);
  for (const [cls, count] of Object.entries(counts).sort()) {
    console.log(`  ${count.toString().padStart(5)}  ${cls}`);
  }
  // Console lists problems in full and a sample of repairs; the manifest has
  // every record. 20k+ deck codes would otherwise flood the terminal.
  const PRINT_CAP_PER_CLASS = 40;
  const printed: Record<string, number> = {};
  for (const r of results) {
    if (r.cls === "LABELS_CURRENT") continue;
    const isProblem =
      r.cls === "PAYLOAD_INCOMPLETE" ||
      r.cls === "PAYLOAD_MISSING" ||
      r.cls === "DERIVATION_FAILED";
    printed[r.cls] = (printed[r.cls] ?? 0) + 1;
    if (!isProblem && printed[r.cls]! > PRINT_CAP_PER_CLASS) continue;
    const arrow =
      r.derivedWord !== undefined
        ? ` "${r.storedLabel}" → "${r.derivedWord}"`
        : ` "${r.storedLabel ?? ""}"`;
    console.log(
      `  ${isProblem ? "⚠️ " : APPLY ? "✅" : "· "} ${r.code}${arrow}${r.detail ? ` — ${r.detail}` : ""}`
    );
  }
  for (const [cls, n] of Object.entries(printed)) {
    if (n > PRINT_CAP_PER_CLASS && cls !== "PAYLOAD_INCOMPLETE" && cls !== "PAYLOAD_MISSING" && cls !== "DERIVATION_FAILED") {
      console.log(`  … ${n - PRINT_CAP_PER_CLASS} more ${cls} (see manifest)`);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(
    "scripts",
    "migrations",
    "backups",
    `shortcode-labels-${APPLY ? "apply" : "dryrun"}-${stamp}.json`
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: APPLY ? "apply" : "dry-run",
        counts,
        results,
      },
      null,
      2
    )
  );
  console.log(`\nmanifest: ${outPath}`);
  if (!APPLY) console.log("Re-run with TKA_ADMIN=1 … --apply to write.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
