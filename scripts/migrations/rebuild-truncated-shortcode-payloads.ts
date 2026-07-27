/**
 * Rebuild defective shortcode PAYLOADS (parity-repair spec, "Shortcode
 * correction" follow-up). The label repair (backfill-shortcode-words.ts)
 * quarantines every payload-defect class it must never relabel:
 *
 *   - TRUNCATED_PAYLOAD_AT_MINT: the mint consumed the first 0-based content
 *     beat as a start position, so the stored payload physically lost beat 1
 *     while the label kept the full word.
 *   - PAYLOAD_MISSING (8N3I): no embedded steps and an undecodable blob; its
 *     content hash's claim winner (2AI7) carries a complete embedded payload.
 *   - PAYLOAD_INCOMPLETE: payload beats exist but some letters are
 *     underivable (no stored letter, no dataframe match — mixed-mode beats).
 *     The live source carries stored per-beat letters; it must be the SAME
 *     sequence (equal beat count, letter agreement at every derivable
 *     position) before its lettered steps replace the payload.
 *   - PAYLOAD_SOURCES_CONFLICT: encoded and embedded derive different words
 *     (the legacy blob channel's same-family letter bias). The live source
 *     arbitrates and must side with ONE of the two witnesses; with no
 *     surviving source, the record's own embedded payload is accepted when
 *     the stored label corroborates it (two witnesses against the biased
 *     blob).
 *   - LABEL_CONTRADICTS_PAYLOAD: a single payload witness contradicts the
 *     label. The live source must side with the label (payload was
 *     biased/lossy → restore it) or with the payload (label was wrong → the
 *     rebuild makes the payload corroborated and the backfill relabels).
 *
 * This script restores the payload from the best surviving source — the owner
 * doc, else the public projection (both hydrated through the SAME
 * trySequenceNormalization seam the runtime and the corpus reconcile use),
 * else a label-gated catalog copy, else the hash-claim twin's embedded
 * payload. Every accepted rebuild must additionally pass a CONVERGENCE
 * SIMULATION: the post-write document is re-derived through the shared
 * derivation and must yield a complete, un-conflicted word equal to the
 * source's — a half-repair that would merely move a record between
 * quarantine classes is never written.
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
  contentLetters,
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
  | "REBUILT_BLOB_DROPPED"       // sequenceData restored; defective blob DELETED (unencodable, would re-create the conflict)
  | "SKIPPED_ALREADY_CURRENT"    // payloadSchemaVersion already 2 (a prior run fixed it)
  | "SKIPPED_GONE"               // shortcode doc no longer exists
  | "SOURCE_NOT_FOUND"           // owner, public, catalog, and twin all unavailable
  | "AMBIGUOUS_SOURCES"          // multiple catalog copies with DIFFERENT content, none hash-matched
  | "SOURCE_WORD_MISMATCH"       // source word supports no witness (label or payload) — never write
  | "SOURCE_INCONSISTENT"        // beat count / positional letters prove a different sequence
  | "NO_CONVERGENCE"             // post-write simulation would still not derive cleanly
  | "SOURCE_INCOMPLETE";         // source steps failed strict derivation

/** The two classes whose defect is a physically SHORTER payload — their gates
 *  require the source to have MORE beats. Every other class repairs a
 *  same-length payload (letter gaps or letter bias), so equality is required. */
const SHORT_PAYLOAD_CLASSES = new Set(["TRUNCATED_PAYLOAD_AT_MINT", "PAYLOAD_MISSING"]);
const REPAIR_CLASSES = new Set([
  ...SHORT_PAYLOAD_CLASSES,
  "PAYLOAD_INCOMPLETE",
  "PAYLOAD_SOURCES_CONFLICT",
  "LABEL_CONTRADICTS_PAYLOAD",
]);

interface RebuildRecord {
  code: string;
  cls: string;
  status: RebuildStatus;
  storedLabel?: string;
  source?: "owner" | "public" | "catalog" | "twin" | "embedded";
  sourcePath?: string;
  sourceWord?: string;
  sourceStepCount?: number;
  previousStepCount?: number | null;
  /** The blob this repair replaced or deleted, retained for recoverability. */
  previousEncoded?: string;
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

/** Re-encode and verify before replacing a blob. Two proof tiers:
 *
 *  "word"    — the round-trip is fully lossless: the decoded blob derives a
 *              COMPLETE word equal to the source's, same beat count.
 *  "motions" — the wire format dropped letters the dataframes cannot
 *              re-derive (the same beats that make records INCOMPLETE), but
 *              the decode still has the right beat count and ZERO letter
 *              disagreements with the source at every derivable position.
 *              Offline playback renders from motions, so this blob plays the
 *              right sequence even where its letters are unverifiable — and
 *              the simulation gate still requires the record as a whole to
 *              derive cleanly (the lettered embed carries the word).
 *
 *  A failed encode or an unprovable round-trip returns null and keeps the old
 *  blob — the caller's convergence simulation decides whether that is
 *  acceptable for the record's class. */
async function tryReencode(
  hydrated: SequenceData,
  expectedWord: string,
  expectedCount: number,
  sourceLetters: readonly (string | null)[]
): Promise<{ blob: string; verified: "word" | "motions" } | null> {
  try {
    const blob = await encodeSequenceForQR(hydrated);
    const decoded = (await decodeSequenceFromQR(blob)) as SequenceData;
    const steps = (decoded.steps ?? []) as unknown as AnyRec[];
    const check = deriveFromSteps(steps, "encoded");
    if (check.complete && check.word === expectedWord && check.stepCount === expectedCount) {
      return { blob, verified: "word" };
    }
    if (check.stepCount === expectedCount) {
      const blobLetters = contentLetters(steps);
      if (blobLetters.length === sourceLetters.length) {
        const clash = blobLetters.some(
          (letter, i) =>
            letter !== null && sourceLetters[i] !== null && letter !== sourceLetters[i]
        );
        if (!clash) return { blob, verified: "motions" };
      }
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
  const { db, sdk, isAdmin, FieldValue } = (await initFirestore()) as AnyRec & {
    db: AdminDb;
    sdk: string;
    isAdmin: boolean;
    FieldValue: { delete(): unknown };
  };
  if (!isAdmin) {
    throw new Error("Payload rebuilds write shortcode docs — run with TKA_ADMIN=1.");
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    results: Array<{ code: string; cls: string; storedLabel?: string }>;
  };
  const targets = manifest.results.filter((r) => REPAIR_CLASSES.has(r.cls));
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

    // The current payload's own testimony. For CONFLICT records both halves
    // matter (the source must side with one of them); everywhere else the
    // best single derivation is the baseline the rebuild must beat or match.
    const current = await derivePayloadWord(data);
    const currentBest = current && !("conflict" in current) ? current : null;
    const currentConflict =
      current && "conflict" in current ? current.conflict : null;
    const currentCount =
      currentBest?.stepCount ?? currentConflict?.embedded.stepCount ?? null;

    // Positional letters of the current payload (embedded preferred — it is
    // the mint-time witness with stored letters; blob letters are
    // matcher-derived). Proves an INCOMPLETE payload is the SAME sequence as
    // its source at every derivable beat, not just the same word length.
    let payloadLetters: (string | null)[] | null = null;
    {
      const embeddedRaw = (data.sequenceData as AnyRec | undefined)?.steps;
      if (Array.isArray(embeddedRaw) && embeddedRaw.length > 0) {
        payloadLetters = contentLetters(embeddedRaw as AnyRec[]);
      } else if (typeof data.encoded === "string" && data.encoded) {
        try {
          const decoded = (await decodeSequenceFromQR(data.encoded)) as SequenceData;
          const steps = (decoded.steps ?? []) as unknown as AnyRec[];
          if (steps.length > 0) payloadLetters = contentLetters(steps);
        } catch {
          // undecodable blob — no positional witness
        }
      }
    }

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
      // a 16-beat deck both hold alpha1_JDΔW), so gate every copy on a witness
      // FIRST — only a copy whose complete derivation reproduces the stored
      // label (or, for the quarantine classes, the payload's own derived word)
      // can be this record's source. Survivors that still differ in content
      // hash are disambiguated by the record's encoderHash, else quarantined.
      const gated: typeof hits = [];
      for (const hit of hits) {
        const d = deriveFromSteps(
          (hit.hydrated.steps ?? []) as unknown as AnyRec[],
          "embedded"
        );
        const witnessOk =
          d.word === storedLabel ||
          (currentBest !== null && d.word === currentBest.word);
        const countOk = SHORT_PAYLOAD_CLASSES.has(cls)
          ? currentCount === null || d.stepCount > currentCount
          : d.stepCount === currentCount;
        if (d.complete && witnessOk && countOk) {
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
          // For the short-payload classes an unresolvable catalog ambiguity
          // is terminal — there is no other witness. Quarantine-class records
          // still hold their own mint-time embedded/twin witnesses, so an
          // ambiguous catalog just means "no catalog source" and the chain
          // falls through to those.
          if (SHORT_PAYLOAD_CLASSES.has(cls)) {
            results.push({
              code,
              cls,
              status: "AMBIGUOUS_SOURCES",
              storedLabel,
              detail: `${gated.length} label-matching catalog copies with ${distinctHashes.size} distinct content hashes, none matching record.encoderHash: ${gated.map((h) => h.path).join(" | ")}`,
            });
            continue;
          }
        } else {
          hydrated = chosen.hydrated;
          source = "catalog";
          sourcePath = chosen.path;
        }
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

    // A CONFLICT record with no surviving doc source can still be repaired
    // from its own embedded payload when the stored label corroborates it —
    // two mint-time witnesses (embed + label) against the legacy blob
    // channel's known letter bias.
    if (
      !hydrated &&
      !twinEmbed &&
      cls === "PAYLOAD_SOURCES_CONFLICT" &&
      currentConflict &&
      currentConflict.embedded.word === storedLabel
    ) {
      const embedded = data.sequenceData as AnyRec | undefined;
      if (embedded && Array.isArray(embedded.steps) && embedded.steps.length > 0) {
        twinEmbed = JSON.parse(JSON.stringify(embedded)) as AnyRec;
        source = "embedded";
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
    // --- class-specific evidence gates ---------------------------------------
    const reject = (status: RebuildStatus, detail: string): void => {
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
        detail,
      });
    };

    if (SHORT_PAYLOAD_CLASSES.has(cls)) {
      // TRUNCATED records kept their full-word label at mint, so the restored
      // payload must reproduce it exactly. The zombie's label is a seed of its
      // twin's expanded word, so seed→expansion is accepted there — the same
      // single-witness allowance the label repair applies.
      const wordOk =
        derived.word === storedLabel ||
        (cls === "PAYLOAD_MISSING" && derived.word.startsWith(storedLabel));
      if (!wordOk) {
        reject(
          "SOURCE_WORD_MISMATCH",
          "source derivation does not reproduce the stored label — left for review"
        );
        continue;
      }
      if (currentCount !== null && derived.stepCount <= currentCount) {
        reject(
          "SOURCE_WORD_MISMATCH",
          "source has no more beats than the stored payload — nothing to restore"
        );
        continue;
      }
    } else if (cls === "PAYLOAD_INCOMPLETE") {
      // Same-sequence proof: equal beat count AND letter agreement at every
      // position the payload could derive. The label may then be confirmed OR
      // corrected — the payload identity is what the source must match.
      if (currentCount === null || derived.stepCount !== currentCount) {
        reject(
          "SOURCE_INCONSISTENT",
          `source has ${derived.stepCount} beats, payload has ${currentCount ?? "?"}`
        );
        continue;
      }
      const sourceLetters = contentLetters(sourceSteps);
      if (payloadLetters === null || payloadLetters.length !== sourceLetters.length) {
        reject(
          "SOURCE_INCONSISTENT",
          `no positional payload witness (payload ${payloadLetters?.length ?? "∅"} vs source ${sourceLetters.length} beats)`
        );
        continue;
      }
      const clashes: number[] = [];
      for (let i = 0; i < sourceLetters.length; i++) {
        if (payloadLetters[i] !== null && payloadLetters[i] !== sourceLetters[i]) {
          clashes.push(i);
        }
      }
      if (clashes.length > 0) {
        reject(
          "SOURCE_INCONSISTENT",
          `letters disagree at derivable beats ${clashes.join(", ")}`
        );
        continue;
      }
    } else if (cls === "PAYLOAD_SOURCES_CONFLICT") {
      // The source arbitrates between the two payload witnesses; a word that
      // sides with NEITHER means this source is not this record's sequence.
      if (currentCount === null || derived.stepCount !== currentCount) {
        reject(
          "SOURCE_INCONSISTENT",
          `source has ${derived.stepCount} beats, payload has ${currentCount ?? "?"}`
        );
        continue;
      }
      const witnessWords = currentConflict
        ? [currentConflict.encoded.word, currentConflict.embedded.word]
        : currentBest
          ? [currentBest.word]
          : [];
      if (!witnessWords.includes(derived.word)) {
        reject(
          "SOURCE_WORD_MISMATCH",
          `source word sides with neither payload witness (${witnessWords.map((w) => JSON.stringify(w)).join(" / ")})`
        );
        continue;
      }
    } else if (cls === "LABEL_CONTRADICTS_PAYLOAD") {
      // The source must side with the label (payload was lossy/biased) or
      // with the payload derivation (label was wrong — the rebuild makes the
      // payload corroborated and the backfill's reviewed policy relabels).
      const sidesWithLabel = derived.word === storedLabel;
      const sidesWithPayload =
        currentBest !== null && derived.word === currentBest.word;
      if (!sidesWithLabel && !sidesWithPayload) {
        reject(
          "SOURCE_WORD_MISMATCH",
          "source sides with neither the label nor the payload derivation"
        );
        continue;
      }
      if (currentCount !== null && derived.stepCount < currentCount) {
        reject(
          "SOURCE_INCONSISTENT",
          `source has ${derived.stepCount} beats, payload has ${currentCount}`
        );
        continue;
      }
    }

    // --- build the write -----------------------------------------------------
    const embed = hydrated ? buildEmbed(hydrated) : twinEmbed!;
    // The embed's word METADATA must state the verified derivation, never the
    // source doc's mutable `word` field — an owner doc can carry a stale word
    // next to correct steps (AK0E: word "UΛZ-Δ-…", letters "VΛY-Σ-…"), and
    // the resolver's embedded-fallback strategy surfaces this field.
    embed.word = derived.word;
    const sourceLetters = contentLetters(sourceSteps);
    let blob: string | null = null;
    let blobVerified: "word" | "motions" | null = null;
    if (hydrated) {
      const reencoded = await tryReencode(
        hydrated,
        derived.word,
        derived.stepCount,
        sourceLetters
      );
      if (reencoded) ({ blob, verified: blobVerified } = reencoded);
    } else if (twinEmbed) {
      const twinAsSequence = {
        id: code,
        word: derived.word,
        ...(twinEmbed as object),
      } as unknown as SequenceData;
      const reencoded = await tryReencode(
        twinAsSequence,
        derived.word,
        derived.stepCount,
        sourceLetters
      );
      if (reencoded) ({ blob, verified: blobVerified } = reencoded);
    }

    // Convergence proof: simulate the post-write document through the SAME
    // shared derivation the label backfill runs next, and require a complete,
    // un-conflicted word equal to the source's. This is what stops a
    // half-repair — e.g. a biased blob surviving a failed re-encode next to a
    // same-count corrected embed — from merely moving the record from one
    // quarantine class to another.
    const simulated = await derivePayloadWord({
      ...data,
      sequenceData: embed,
      ...(blob ? { encoded: blob } : {}),
    });
    const simConverges = (
      sim: Awaited<ReturnType<typeof derivePayloadWord>>
    ): boolean =>
      sim !== null &&
      !("conflict" in sim) &&
      sim.complete &&
      sim.word === derived.word;

    // When the ONLY thing standing between a quarantine-class record and
    // convergence is a defective old blob that cannot be re-encoded, the
    // honest state is embed + NO blob: Firestore-backed resolution serves the
    // corrected payload, and the skinny R2 fallback omits the code instead of
    // playing the WRONG sequence offline. The deleted blob is retained in the
    // manifest. Never done for the short-payload classes — their old blobs
    // are lossy, not contradicted.
    let dropBlob = false;
    if (!simConverges(simulated) && blob === null && !SHORT_PAYLOAD_CLASSES.has(cls)) {
      const withoutBlob: AnyRec = { ...data, sequenceData: embed };
      delete withoutBlob.encoded;
      dropBlob = simConverges(await derivePayloadWord(withoutBlob));
    }
    if (!simConverges(simulated) && !dropBlob) {
      reject(
        "NO_CONVERGENCE",
        blob
          ? "post-write simulation does not derive the source word cleanly"
          : "re-encode failed and the surviving old blob would keep the payload in conflict"
      );
      continue;
    }

    const status: RebuildStatus = blob
      ? "REBUILT"
      : dropBlob
        ? "REBUILT_BLOB_DROPPED"
        : "REBUILT_BLOB_KEPT";
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
      ...(typeof data.encoded === "string" && (blob || dropBlob)
        ? { previousEncoded: data.encoded }
        : {}),
      ...(blobVerified === "motions"
        ? { detail: "blob motion-verified (letters underivable at some beats)" }
        : {}),
    });
    console.log(
      `  ${code}  ${status}  via ${source}  ${JSON.stringify(storedLabel)}  ` +
        `${currentCount ?? "∅"}→${derived.stepCount} beats${blob ? (blobVerified === "motions" ? "  (motion-verified blob)" : "") : dropBlob ? "  (defective blob dropped)" : "  (blob kept)"}`
    );

    if (APPLY) {
      const update: AnyRec = { sequenceData: embed };
      if (blob) update.encoded = blob;
      else if (dropBlob) update.encoded = FieldValue.delete();
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
