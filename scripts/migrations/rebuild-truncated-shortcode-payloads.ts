/**
 * Rebuild defective shortcode PAYLOADS (parity-repair spec, "Shortcode
 * correction" follow-up). The label repair (backfill-shortcode-words.ts)
 * quarantined two payload-defect classes it must never relabel:
 *
 *   - TRUNCATED_PAYLOAD_AT_MINT (53): the mint consumed the first 0-based
 *     content beat as a start position, so the stored payload physically lost
 *     beat 1 while the label kept the full word. Scans still play the full
 *     sequence today because the resolver prefers Firestore lookups — the
 *     truncated payload only surfaces if the source doc is ever deleted.
 *   - PAYLOAD_MISSING (8N3I): no embedded steps and an undecodable blob; its
 *     source was deleted, so every resolution strategy fails. Its content
 *     hash's claim winner (2AI7) carries a complete embedded payload.
 *
 * This script restores the payload from the best surviving source — the owner
 * doc, else the public projection (both hydrated through the SAME
 * trySequenceNormalization seam the runtime and the corpus reconcile use),
 * else the hash-claim twin's embedded payload. A rebuild is written ONLY when
 * the source derivation is COMPLETE and its word equals the stored label
 * (TRUNCATED) or expands it seed→expansion (the missing-payload zombie).
 *
 * Writes: `sequenceData` (mint-shaped embed) and — when a fresh encode
 * round-trips losslessly — `encoded`. Labels, schema stamps, encoderHash,
 * claims, scan counts, and deck attribution are NEVER touched here; rerunning
 * backfill-shortcode-words.ts --apply afterwards stamps the labels through
 * the already-reviewed policy.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/rebuild-truncated-shortcode-payloads.ts            # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/rebuild-truncated-shortcode-payloads.ts --apply
 *   ... --manifest scripts/migrations/backups/shortcode-labels-apply-<stamp>.json
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import {
  deriveFromSteps,
  derivePayloadWord,
  PAYLOAD_SCHEMA_VERSION,
  type AnyRec,
  type PayloadDerivation,
} from "./lib/shortcode-derivation";
import { trySequenceNormalization } from "../../src/lib/shared/library/services/sequence-persistence-normalizer";
import {
  encodeSequence,
  encodeSequenceForQR,
  decodeSequenceFromQR,
} from "../../src/lib/shared/navigation/services/sequence-encoder";
import { sha256Hex } from "../../src/lib/shared/foundation/utils/canonical-digest";
import { registerLoopDetector } from "../../src/lib/shared/create/get-loop-detector";
import { loopDetector } from "../../src/lib/features/create/generate/circular/services/loop-detector";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

// The compositional encoder needs the LOOP detector the app registers at
// bootstrap; without it every re-encode falls back to the legacy wire format.
registerLoopDetector(loopDetector);

// crypto.subtle guard for older Node runtimes (same shim as the reconcile
// migration — the encoder hashes through webcrypto).
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const MANIFEST = (() => {
  const i = argv.indexOf("--manifest");
  if (i >= 0 && argv[i + 1]) return argv[i + 1]!;
  const dir = join("scripts", "migrations", "backups");
  const candidates = readdirSync(dir)
    .filter((f) => f.startsWith("shortcode-labels-apply-") && f.endsWith(".json"))
    .sort();
  const latest = candidates[candidates.length - 1];
  if (!latest) throw new Error(`no shortcode-labels-apply-*.json in ${dir}`);
  return join(dir, latest);
})();

interface AdminDocSnap {
  exists: boolean;
  id: string;
  ref: { path: string };
  updateTime?: unknown;
  data(): AnyRec | undefined;
}
interface AdminDocRef {
  path: string;
  get(): Promise<AdminDocSnap>;
  update(data: AnyRec, precondition?: { lastUpdateTime: unknown }): Promise<unknown>;
}
interface AdminDb {
  doc(path: string): AdminDocRef;
  collection(path: string): { listDocuments(): Promise<Array<{ id: string }>> };
  getAll(...refs: AdminDocRef[]): Promise<AdminDocSnap[]>;
}

type RebuildStatus =
  | "REBUILT"                    // sequenceData + encoded both restored
  | "REBUILT_BLOB_KEPT"          // sequenceData restored; encode failed round-trip, old blob left
  | "SKIPPED_ALREADY_CURRENT"    // payloadSchemaVersion already 2 (a prior run fixed it)
  | "SKIPPED_GONE"               // shortcode doc no longer exists
  | "SOURCE_NOT_FOUND"           // owner, public, catalog, and twin all unavailable
  | "AMBIGUOUS_SOURCES"          // multiple catalog copies with DIFFERENT content, none hash-matched
  | "SOURCE_WORD_MISMATCH"       // source derivation disagrees with stored label — never write
  | "SOURCE_INCOMPLETE";         // source steps failed strict derivation

interface RebuildRecord {
  code: string;
  cls: string;
  status: RebuildStatus;
  storedLabel?: string;
  source?: "owner" | "public" | "catalog" | "twin";
  sourcePath?: string;
  sourceWord?: string;
  sourceStepCount?: number;
  previousStepCount?: number | null;
  detail?: string;
}

function storedLabelOf(data: AnyRec): string {
  const name = data.sequenceName;
  const seq = data.sequence;
  const pick = (v: unknown) => (typeof v === "string" ? v : "");
  return pick(name) || pick(seq);
}

/** Mint-shaped embed, mirroring allocateCode in short-code-manager.ts. */
function buildEmbed(hydrated: SequenceData): AnyRec {
  const seqData: AnyRec = { steps: hydrated.steps };
  if (hydrated.word != null) seqData.word = hydrated.word;
  if (hydrated.startPosition != null) seqData.startPosition = hydrated.startPosition;
  if (hydrated.gridMode != null) seqData.gridMode = hydrated.gridMode;
  if (hydrated.isCircular != null) seqData.isCircular = hydrated.isCircular;
  if (hydrated.loopType != null) seqData.loopType = hydrated.loopType;
  return JSON.parse(JSON.stringify(seqData)) as AnyRec;
}

/** Re-encode and prove the round-trip is lossless (complete derivation, same
 *  word, same beat count) before replacing a blob. A failed encode or a lossy
 *  round-trip keeps the old blob — the rebuilt sequenceData still wins at
 *  resolve time for the zombie (its old blob throws), and for truncated
 *  records the doc-backed strategies come first anyway. */
async function tryReencode(
  hydrated: SequenceData,
  expectedWord: string,
  expectedCount: number
): Promise<string | null> {
  try {
    const blob = await encodeSequenceForQR(hydrated);
    const decoded = (await decodeSequenceFromQR(blob)) as SequenceData;
    const check = deriveFromSteps(
      (decoded.steps ?? []) as unknown as AnyRec[],
      "encoded"
    );
    if (check.complete && check.word === expectedWord && check.stepCount === expectedCount) {
      return blob;
    }
    return null;
  } catch {
    return null;
  }
}

async function hydrateData(data: AnyRec, id: string): Promise<SequenceData | null> {
  const normalization = await trySequenceNormalization({
    ...(data as object),
    id,
  } as SequenceData);
  if (!normalization.ok) return null;
  return normalization.value.hydrated;
}

async function hydrateDoc(
  db: AdminDb,
  path: string,
  id: string
): Promise<SequenceData | null> {
  const snap = await db.doc(path).get();
  if (!snap.exists) return null;
  return hydrateData(snap.data() ?? {}, id);
}

/**
 * Deck mints carry only a catalog-style sequenceId (no ownerId/deckId), so the
 * source lives at catalogs/{catalogId}/sequences/{sequenceId} for an unknown
 * catalog. There is no collection-group index on `word`, so probe by document
 * id instead: list catalog refs once (listDocuments reads no documents), then
 * getAll() the candidate paths in chunks. Reversal-deck variants can seed the
 * SAME doc id with DIFFERENT content, so multiple hits are disambiguated by
 * content hash — identical copies pick the first, a copy whose
 * sha256Hex(encodeSequence(hydrated)) matches the record's encoderHash wins
 * outright, and unresolvable differences quarantine the record.
 */
const GET_ALL_CHUNK = 300;
let catalogIdsCache: string[] | null = null;

async function findCatalogSources(
  db: AdminDb,
  sequenceId: string
): Promise<Array<{ path: string; hydrated: SequenceData; hash: string }>> {
  if (!catalogIdsCache) {
    catalogIdsCache = (await db.collection("catalogs").listDocuments()).map(
      (ref) => ref.id
    );
    console.log(`  (catalog probe space: ${catalogIdsCache.length} catalogs)`);
  }
  const refs = catalogIdsCache.map((catalogId) =>
    db.doc(`catalogs/${catalogId}/sequences/${sequenceId}`)
  );
  const hits: Array<{ path: string; hydrated: SequenceData; hash: string }> = [];
  for (let i = 0; i < refs.length; i += GET_ALL_CHUNK) {
    const snaps = await db.getAll(...refs.slice(i, i + GET_ALL_CHUNK));
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const hydrated = await hydrateData(snap.data() ?? {}, sequenceId);
      if (!hydrated) continue;
      hits.push({
        path: snap.ref.path,
        hydrated,
        hash: await sha256Hex(encodeSequence(hydrated)),
      });
    }
  }
  return hits;
}

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AdminDb;
    sdk: string;
    isAdmin: boolean;
  };
  if (!isAdmin) {
    throw new Error("Payload rebuilds write shortcode docs — run with TKA_ADMIN=1.");
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    results: Array<{ code: string; cls: string; storedLabel?: string }>;
  };
  const targets = manifest.results.filter(
    (r) => r.cls === "TRUNCATED_PAYLOAD_AT_MINT" || r.cls === "PAYLOAD_MISSING"
  );
  console.log(
    `via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"} — ${targets.length} targets from ${MANIFEST}`
  );

  const results: RebuildRecord[] = [];

  for (const target of targets) {
    const { code, cls } = target;
    const ref = db.doc(`shortcodes/${code}`);
    const snap = await ref.get();
    if (!snap.exists) {
      results.push({ code, cls, status: "SKIPPED_GONE" });
      continue;
    }
    const data = snap.data() ?? {};
    const storedLabel = storedLabelOf(data);
    if (data.payloadSchemaVersion === PAYLOAD_SCHEMA_VERSION) {
      results.push({ code, cls, status: "SKIPPED_ALREADY_CURRENT", storedLabel });
      continue;
    }

    // The current payload's best derivation — the rebuild must strictly beat it.
    const current = await derivePayloadWord(data);
    const currentCount =
      current && !("conflict" in current) ? current.stepCount : null;

    const sequenceId = typeof data.sequenceId === "string" ? data.sequenceId : "";
    const ownerId = typeof data.ownerId === "string" ? data.ownerId : "";

    // --- source resolution: owner doc → public projection → catalogs → twin -
    let source: RebuildRecord["source"] | undefined;
    let sourcePath: string | undefined;
    let hydrated: SequenceData | null = null;
    let twinEmbed: AnyRec | null = null;

    if (ownerId && sequenceId) {
      hydrated = await hydrateDoc(
        db,
        `users/${ownerId}/sequences/${sequenceId}`,
        sequenceId
      );
      if (hydrated) source = "owner";
    }
    if (!hydrated && sequenceId) {
      hydrated = await hydrateDoc(db, `publicSequences/${sequenceId}`, sequenceId);
      if (hydrated) source = "public";
    }
    if (!hydrated && sequenceId) {
      const hits = await findCatalogSources(db, sequenceId);
      // Reversal/length deck variants seed the SAME doc id (an 8-beat deck and
      // a 16-beat deck both hold alpha1_JDΔW), so gate every copy on the
      // stored label FIRST — only the copy whose complete derivation
      // reproduces the full-word label can be this record's source. Survivors
      // that still differ in content hash are disambiguated by the record's
      // encoderHash, else quarantined.
      const gated: typeof hits = [];
      for (const hit of hits) {
        const d = deriveFromSteps(
          (hit.hydrated.steps ?? []) as unknown as AnyRec[],
          "embedded"
        );
        if (
          d.complete &&
          d.word === storedLabel &&
          (currentCount === null || d.stepCount > currentCount)
        ) {
          gated.push(hit);
        }
      }
      if (gated.length > 0) {
        const distinctHashes = new Set(gated.map((h) => h.hash));
        const recordHash =
          typeof data.encoderHash === "string" ? data.encoderHash : "";
        const hashMatched = gated.find((h) => h.hash === recordHash);
        const chosen =
          distinctHashes.size === 1 ? gated[0]! : (hashMatched ?? null);
        if (!chosen) {
          results.push({
            code,
            cls,
            status: "AMBIGUOUS_SOURCES",
            storedLabel,
            detail: `${gated.length} label-matching catalog copies with ${distinctHashes.size} distinct content hashes, none matching record.encoderHash: ${gated.map((h) => h.path).join(" | ")}`,
          });
          continue;
        }
        hydrated = chosen.hydrated;
        source = "catalog";
        sourcePath = chosen.path;
      }
    }
    if (!hydrated && typeof data.encoderHash === "string" && data.encoderHash) {
      const claim = await db.doc(`shortcodeHashes/${data.encoderHash}`).get();
      const twinCode = claim.exists ? (claim.data()?.code as string | undefined) : undefined;
      if (twinCode && twinCode !== code) {
        const twinSnap = await db.doc(`shortcodes/${twinCode}`).get();
        const twinData = twinSnap.exists ? twinSnap.data() ?? {} : {};
        const embedded = twinData.sequenceData as AnyRec | undefined;
        if (embedded && Array.isArray(embedded.steps) && embedded.steps.length > 0) {
          twinEmbed = JSON.parse(JSON.stringify(embedded)) as AnyRec;
          source = "twin";
        }
      }
    }

    if (!hydrated && !twinEmbed) {
      results.push({ code, cls, status: "SOURCE_NOT_FOUND", storedLabel });
      continue;
    }

    // --- gate: the source must derive COMPLETE and match the stored label ---
    const sourceSteps = hydrated
      ? ((hydrated.steps ?? []) as unknown as AnyRec[])
      : (twinEmbed!.steps as AnyRec[]);
    const derived: PayloadDerivation = deriveFromSteps(sourceSteps, "embedded");
    if (!derived.complete || derived.word.length === 0) {
      results.push({
        code,
        cls,
        status: "SOURCE_INCOMPLETE",
        storedLabel,
        source,
        sourcePath,
        detail: `missing beat indexes: ${derived.missingStepIndexes.join(", ")}`,
      });
      continue;
    }
    // TRUNCATED records kept their full-word label at mint, so the restored
    // payload must reproduce it exactly. The zombie's label is a seed of its
    // twin's expanded word, so seed→expansion is accepted there — the same
    // single-witness allowance the label repair applies.
    const wordOk =
      derived.word === storedLabel ||
      (cls === "PAYLOAD_MISSING" && derived.word.startsWith(storedLabel));
    if (!wordOk) {
      results.push({
        code,
        cls,
        status: "SOURCE_WORD_MISMATCH",
        storedLabel,
        source,
        sourcePath,
        sourceWord: derived.word,
        detail: "source derivation does not reproduce the stored label — left for review",
      });
      continue;
    }
    if (currentCount !== null && derived.stepCount <= currentCount) {
      results.push({
        code,
        cls,
        status: "SOURCE_WORD_MISMATCH",
        storedLabel,
        source,
        sourcePath,
        sourceWord: derived.word,
        previousStepCount: currentCount,
        sourceStepCount: derived.stepCount,
        detail: "source has no more beats than the stored payload — nothing to restore",
      });
      continue;
    }

    // --- build the write -----------------------------------------------------
    const embed = hydrated ? buildEmbed(hydrated) : twinEmbed!;
    let blob: string | null = null;
    if (hydrated) {
      blob = await tryReencode(hydrated, derived.word, derived.stepCount);
    } else if (twinEmbed) {
      const twinAsSequence = {
        id: code,
        word: derived.word,
        ...(twinEmbed as object),
      } as unknown as SequenceData;
      blob = await tryReencode(twinAsSequence, derived.word, derived.stepCount);
    }

    const status: RebuildStatus = blob ? "REBUILT" : "REBUILT_BLOB_KEPT";
    results.push({
      code,
      cls,
      status,
      storedLabel,
      source,
      sourcePath,
      sourceWord: derived.word,
      sourceStepCount: derived.stepCount,
      previousStepCount: currentCount,
    });
    console.log(
      `  ${code}  ${status}  via ${source}  ${JSON.stringify(storedLabel)}  ` +
        `${currentCount ?? "∅"}→${derived.stepCount} beats${blob ? "" : "  (blob kept)"}`
    );

    if (APPLY) {
      const update: AnyRec = { sequenceData: embed };
      if (blob) update.encoded = blob;
      await ref.update(update, { lastUpdateTime: snap.updateTime });
    }
  }

  const counts = new Map<string, number>();
  for (const r of results) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  console.log(`\n════ ${APPLY ? "APPLY" : "DRY-RUN"} SUMMARY ════`);
  for (const [status, n] of [...counts.entries()].sort()) {
    console.log(`  ${String(n).padStart(5)}  ${status}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(
    "scripts",
    "migrations",
    "backups",
    `rebuild-payloads-${APPLY ? "apply" : "dryrun"}-${stamp}.json`
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), mode: APPLY ? "apply" : "dry-run", manifest: MANIFEST, counts: Object.fromEntries(counts), results },
      null,
      2
    )
  );
  console.log(`manifest: ${outPath}`);
  if (!APPLY) console.log("Re-run with TKA_ADMIN=1 … --apply to write.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
