/**
 * reconcile-sequence-public-projections — the phase-3 corpus repair of the
 * sequence/public parity design
 * (docs/superpowers/specs/active/2026-07-25-sequence-public-parity-repair-design.md).
 *
 * For every publicSequences document: load its owner source, normalize it
 * through the SAME modules the runtime writer uses (trySequenceNormalization →
 * buildPublicSequenceProjection), classify the drift, and — under --apply —
 * repair each safe record in ONE Admin transaction: full schema-2 projection,
 * hash claim, stale-claim release, and owner parity stamps together.
 *
 *   npx tsx scripts/migrations/reconcile-sequence-public-projections.ts                  # dry-run
 *   npx tsx scripts/migrations/reconcile-sequence-public-projections.ts --sequence <id>  # one doc
 *   npx tsx scripts/migrations/reconcile-sequence-public-projections.ts --limit 50
 *   npx tsx scripts/migrations/reconcile-sequence-public-projections.ts --after <docId>
 *   TKA_ADMIN=1 npx tsx scripts/migrations/reconcile-sequence-public-projections.ts --apply
 *
 * Rules of the run (spec, "Corpus repair migration"):
 *   - dry-run by default; --apply requires TKA_ADMIN=1
 *   - a timestamped JSON manifest records every classification and proposed
 *     change (scripts/migrations/backups/)
 *   - idempotent: a second apply produces zero writes (the builder holds
 *     revision/updatedAt still when the digest is unchanged, and IN_SYNC
 *     records are never written)
 *   - never deletes a duplicate public sequence; DUPLICATE_HASH_CONFLICT is
 *     reported for explicit review, all group members excluded from apply
 *   - a record whose owner/public docs changed between scan and apply is
 *     skipped and reported (SOURCE_CHANGED_DURING_RUN)
 *
 * publishedAt policy (spec section 4): the legacy syncer re-stamped
 * publishedAt on every resync, so on LEGACY documents the stored value is the
 * last-sync time, not the publication time — reconstruct from the owner's
 * birthday/createdAt. Schema-2 documents were written by the preserving
 * builder; their stored publishedAt is trusted.
 *
 * Owner writes are the PARITY fields only (word, sequenceLength, contentHash,
 * contentHashVersion, projection stamps). Source fields outside normalization
 * are preserved by not touching them; this migration repairs the public
 * projection and the parity contract, not owner-document composition.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { initFirestore } from "../lib/firestore-provider.js";
import {
  trySequenceNormalization,
  type NormalizedSequenceWrite,
} from "../../src/lib/shared/library/services/sequence-persistence-normalizer";
import {
  buildPublicSequenceProjection,
  PUBLIC_PROJECTION_SCHEMA_VERSION,
  PROJECTION_DIGEST_EXCLUDED_KEYS,
  type ProjectionSourceSequence,
  type PublicProjectionContext,
  type PublicProjectionLoopData,
  type PublicSequenceProjectionWrite,
  type ExistingPublicOwnedFields,
} from "../../src/lib/shared/library/services/public-sequence-projection";
import {
  publicSequenceClaimId,
  readExistingPublicOwnedFields,
  PUBLIC_SEQUENCE_HASH_COLLECTION,
} from "../../src/lib/shared/library/services/public-sequence-persister";
import { sha256Hex } from "../../src/lib/shared/foundation/utils/canonical-digest";
import { encodeSequence } from "../../src/lib/shared/navigation/services/sequence-encoder";
import { calculateDifficultyLevel } from "../../src/lib/shared/browse/services/sequence-difficulty-calculator";
import { loopDetector } from "../../src/lib/features/create/generate/circular/services/loop-detector";
import { periodToNumber } from "../../src/lib/shared/foundation/domain/models/generation/circular-models";
import { isSeamlesslyLoopable } from "../../src/lib/shared/foundation/services/sequence-loopability-checker";
import { resolveLoopDisplay } from "../../src/lib/features/loop-labeler/services/loop-display-resolver";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

// crypto.subtle guard for older Node runtimes (same shim as rehash-content-v2).
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;

// Minimal typed facade over the Admin SDK surface this script touches — the
// provider returns `any`, and chained AnyRec indexing is not callable under
// tsc. Field names match firebase-admin (`exists` is a PROPERTY, unlike the
// client SDK's method).
interface AdminDocSnap {
  readonly id: string;
  readonly exists: boolean;
  data(): AnyRec | undefined;
}
interface AdminDocRef {
  get(): Promise<AdminDocSnap>;
}
interface AdminCollectionRef {
  doc(id: string): AdminDocRef;
  get(): Promise<{ docs: AdminDocSnap[] }>;
}
interface AdminTransaction {
  getAll(...refs: AdminDocRef[]): Promise<AdminDocSnap[]>;
  set(ref: AdminDocRef, data: unknown): void;
  update(ref: AdminDocRef, data: unknown): void;
  delete(ref: AdminDocRef): void;
}
interface AdminDb {
  collection(path: string): AdminCollectionRef;
  runTransaction<T>(fn: (t: AdminTransaction) => Promise<T>): Promise<T>;
}

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : undefined;
})();
const AFTER = (() => {
  const i = argv.indexOf("--after");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : undefined;
})();
const ONLY_SEQUENCE = (() => {
  const i = argv.indexOf("--sequence");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : undefined;
})();

if (APPLY && process.env.TKA_ADMIN !== "1") {
  console.error("--apply requires TKA_ADMIN=1 (Admin SDK, explicit opt-in).");
  process.exit(1);
}

// Classification model

type Classification =
  | "IN_SYNC"
  | "SAFE_REPROJECT"
  | "EXPECTED_LOOP_REPRESENTATION"
  | "ORPHAN_PUBLIC"
  | "PRIVATE_SOURCE_WITH_PUBLIC_MIRROR"
  | "DUPLICATE_HASH_CONFLICT"
  | "INCOMPLETE_CANONICAL_DATA"
  | "SOURCE_CHANGED_DURING_RUN";

interface Precondition {
  readonly ownerUpdatedAtMillis: number | null;
  readonly ownerVersion: number | null;
  readonly publicUpdatedAtMillis: number | null;
}

interface ScanRecord {
  readonly id: string;
  readonly ownerId: string | null;
  classification: Classification;
  readonly detail?: string;
  readonly storedWord?: string;
  readonly expectedWord?: string;
  readonly storedSchemaVersion?: number;
  readonly expectedClaimId?: string;
  readonly staleClaimId?: string;
  readonly changedKeys?: readonly string[];
  readonly precondition?: Precondition;
  /** Everything the apply transaction writes, computed at scan time. */
  plan?: {
    readonly projection: PublicSequenceProjectionWrite;
    readonly exactWord: string;
    readonly sequenceLength: number;
    readonly contentHash: string;
    readonly contentHashVersion: number;
  };
  applied?: "written" | "skipped-changed" | "skipped-claim-conflict" | "failed";
  applyError?: string;
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  const v = value as { toMillis?: () => number } | null | undefined;
  if (v && typeof v.toMillis === "function") return v.toMillis();
  return null;
}

// Context preparation (Admin-SDK replica of the runtime preparer)

const profileCache = new Map<
  string,
  { displayName: string; avatarUrl?: string }
>();
const tagNameCache = new Map<string, Map<string, string>>();

async function readOwnerProfile(db: AdminDb, ownerId: string) {
  const cached = profileCache.get(ownerId);
  if (cached) return cached;
  const snap = await db.collection("users").doc(ownerId).get();
  const data = snap.data() ?? {};
  const profile = {
    displayName:
      typeof data["displayName"] === "string" && data["displayName"].length > 0
        ? (data["displayName"] as string)
        : "Unknown",
    ...(typeof data["photoURL"] === "string" && {
      avatarUrl: data["photoURL"] as string,
    }),
  };
  profileCache.set(ownerId, profile);
  return profile;
}

async function resolveTagNames(
  db: AdminDb,
  ownerId: string,
  ownerData: AnyRec
): Promise<string[]> {
  const sequenceTags = ownerData["sequenceTags"] as
    | Array<{ tagId: string }>
    | undefined;
  const tagIds = sequenceTags?.length
    ? sequenceTags.map((t) => t.tagId)
    : [...((ownerData["tagIds"] as string[] | undefined) ?? [])];
  if (tagIds.length === 0) return [];

  let nameById = tagNameCache.get(ownerId);
  if (!nameById) {
    const snap = await db.collection(`users/${ownerId}/tags`).get();
    nameById = new Map<string, string>();
    for (const d of snap.docs) {
      const name = (d.data() ?? {})["name"];
      if (typeof name === "string" && name.length > 0) nameById.set(d.id, name);
    }
    tagNameCache.set(ownerId, nameById);
  }

  const names: string[] = [];
  const seen = new Set<string>();
  for (const id of tagIds) {
    const name = nameById.get(id);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** Admin-read replica of the syncer's curated loop-labels lookup. */
async function fetchCuratedLoopType(
  db: AdminDb,
  word: string
): Promise<string | null> {
  if (!word) return null;
  try {
    const snap = await db.collection("loop-labels").doc(word).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    if (data["isFreeform"]) return null;
    const designations = data["designations"] as
      | Array<{ loopType: string; components?: string[] }>
      | undefined;
    const first = designations?.[0];
    if (!first) return null;
    if (first.components && first.components.length > 0) {
      return first.components.join("+");
    }
    return first.loopType || null;
  } catch {
    return null;
  }
}

/** Same layered strategy as PublicIndexSyncer.detectLoopInfo. */
async function detectLoop(
  db: AdminDb,
  hydrated: SequenceData
): Promise<PublicProjectionLoopData> {
  const detected = (
    loopType: string | null,
    isCircular: boolean
  ): PublicProjectionLoopData => {
    let period: number | undefined;
    let components: string[] | undefined;
    if (isCircular) {
      try {
        const detection = loopDetector.detectLOOPType(hydrated);
        const display = resolveLoopDisplay(hydrated);
        period = detection.period
          ? periodToNumber(detection.period)
          : undefined;
        components =
          display.components.size > 0 ? [...display.components] : undefined;
        loopType = loopType ?? detection.loopType;
      } catch {
        /* keep what we have */
      }
    }
    return {
      isCircular,
      loopType,
      ...(period !== undefined && { period }),
      ...(components !== undefined && {
        components: components as SequenceData["components"],
      }),
      ...(hydrated.componentDomains && {
        componentDomains: hydrated.componentDomains,
      }),
      ...(hydrated.loopSpec && { loopSpec: hydrated.loopSpec }),
    };
  };

  if (hydrated.loopType) return detected(hydrated.loopType, true);
  const curated = await fetchCuratedLoopType(db, hydrated.word ?? "");
  if (curated) return detected(curated, true);
  if (!isSeamlesslyLoopable(hydrated))
    return { isCircular: false, loopType: null };
  return detected(null, true);
}

// ---------------------------------------------------------------------------
// Scan + classify
// ---------------------------------------------------------------------------

interface PublicDocSnapshot {
  readonly id: string;
  readonly data: AnyRec;
}

async function classify(
  db: AdminDb,
  publicDoc: PublicDocSnapshot
): Promise<ScanRecord> {
  const { id, data } = publicDoc;
  const ownerId =
    typeof data["ownerId"] === "string" && data["ownerId"].length > 0
      ? (data["ownerId"] as string)
      : typeof data["sourceRef"] === "string"
        ? (/^users\/([^/]+)\/sequences\//.exec(
            data["sourceRef"] as string
          )?.[1] ?? null)
        : null;

  if (!ownerId) {
    return {
      id,
      ownerId: null,
      classification: "ORPHAN_PUBLIC",
      detail: "no ownerId and no parseable sourceRef",
      storedWord: data["word"] as string | undefined,
    };
  }

  const ownerSnap = await db
    .collection(`users/${ownerId}/sequences`)
    .doc(id)
    .get();
  if (!ownerSnap.exists) {
    return {
      id,
      ownerId,
      classification: "ORPHAN_PUBLIC",
      detail: `owner document users/${ownerId}/sequences/${id} does not exist`,
      storedWord: data["word"] as string | undefined,
    };
  }
  const ownerData = ownerSnap.data() ?? {};

  if (ownerData["isDeleted"] === true || ownerData["visibility"] !== "public") {
    return {
      id,
      ownerId,
      classification: "PRIVATE_SOURCE_WITH_PUBLIC_MIRROR",
      detail: `owner visibility=${JSON.stringify(ownerData["visibility"])} isDeleted=${ownerData["isDeleted"] === true}`,
      storedWord: data["word"] as string | undefined,
      precondition: {
        ownerUpdatedAtMillis: timestampMillis(ownerData["updatedAt"]),
        ownerVersion:
          typeof ownerData["_version"] === "number"
            ? (ownerData["_version"] as number)
            : null,
        publicUpdatedAtMillis: timestampMillis(data["updatedAt"]),
      },
    };
  }

  const normalization = await trySequenceNormalization({
    ...(ownerData as object),
    id,
  } as SequenceData);
  if (!normalization.ok) {
    return {
      id,
      ownerId,
      classification: "INCOMPLETE_CANONICAL_DATA",
      detail: `${normalization.code}: ${normalization.error.message.slice(0, 200)}`,
      storedWord: data["word"] as string | undefined,
    };
  }
  const normalized =
    normalization.value as unknown as NormalizedSequenceWrite<ProjectionSourceSequence>;
  const hydrated = normalization.value.hydrated;

  // --- context (Admin replica of the runtime preparer) ---------------------
  const profile = await readOwnerProfile(db, ownerId);
  const tagNames = await resolveTagNames(db, ownerId, ownerData);
  const loop = await detectLoop(db, hydrated);
  const encoderHash = await sha256Hex(encodeSequence(hydrated));
  const level = calculateDifficultyLevel([...(hydrated.steps ?? [])]);

  const storedSchemaVersion =
    typeof data["publicProjectionSchemaVersion"] === "number"
      ? (data["publicProjectionSchemaVersion"] as number)
      : undefined;
  const isSchemaTwo = storedSchemaVersion === PUBLIC_PROJECTION_SCHEMA_VERSION;

  // publishedAt: trust schema-2 (preserving builder); reconstruct legacy from
  // the owner's birthday/createdAt (the old syncer destroyed the original).
  const prior: ExistingPublicOwnedFields = {
    ...readExistingPublicOwnedFields(data),
  };
  const reconstructedPublishedAt = !isSchemaTwo
    ? (ownerData["birthday"] ?? ownerData["createdAt"] ?? data["publishedAt"])
    : undefined;

  const context: PublicProjectionContext = {
    ownerId,
    ownerDisplayName: profile.displayName,
    ...(profile.avatarUrl !== undefined && {
      ownerAvatarUrl: profile.avatarUrl,
    }),
    tagNames,
    encoderHash,
    loop,
    ...(typeof ownerData["difficultyLevel"] === "string" && {
      difficultyLevel: ownerData["difficultyLevel"] as string,
    }),
    level,
    now: new Date(),
  };

  const revision =
    typeof data["publicProjectionRevision"] === "number"
      ? (data["publicProjectionRevision"] as number) + 1
      : 1;
  const projection = await buildPublicSequenceProjection(
    normalized,
    context,
    revision,
    {
      kind: "existing",
      fields: {
        ...prior,
        ...(reconstructedPublishedAt != null && {
          publishedAt:
            reconstructedPublishedAt as ExistingPublicOwnedFields["publishedAt"],
        }),
      },
    }
  );

  const expectedClaimId = publicSequenceClaimId(
    normalized.contentHashVersion,
    normalized.contentHash
  );
  const storedHash = data["contentHash"];
  const storedVersion = data["contentHashVersion"];
  const storedClaimId =
    typeof storedHash === "string" && typeof storedVersion === "number"
      ? publicSequenceClaimId(storedVersion, storedHash)
      : undefined;

  const precondition: Precondition = {
    ownerUpdatedAtMillis: timestampMillis(ownerData["updatedAt"]),
    ownerVersion:
      typeof ownerData["_version"] === "number"
        ? (ownerData["_version"] as number)
        : null,
    publicUpdatedAtMillis: timestampMillis(data["updatedAt"]),
  };

  const storedWord = (data["word"] as string | undefined) ?? "";
  const loopRepresentation =
    storedWord.length > 0 &&
    storedWord !== normalized.exactWord &&
    normalized.exactWord.startsWith(storedWord);

  // Manifest diff: which DIGEST-COVERED keys change. The digest's exclusion
  // list is reused verbatim — leftSoloProp/rightSoloProp/stepPairings mint fresh
  // UUIDs on every normalization pass, so diffing them would report every
  // record as changed forever and IN_SYNC would be unreachable (their content
  // identity is covered by the four tier hashes + contentHash). JSON compare
  // is advisory (key-order differences can over-report); the digest decides
  // IN_SYNC.
  const diffExcluded = new Set<string>(PROJECTION_DIGEST_EXCLUDED_KEYS);
  const changedKeys: string[] = [];
  for (const [key, value] of Object.entries(projection)) {
    if (diffExcluded.has(key)) continue;
    if (JSON.stringify(data[key] ?? null) !== JSON.stringify(value ?? null)) {
      changedKeys.push(key);
    }
  }

  const claimOk = false; // filled by the duplicate pass, which owns claim state
  void claimOk;

  const base: ScanRecord = {
    id,
    ownerId,
    classification: loopRepresentation
      ? "EXPECTED_LOOP_REPRESENTATION"
      : "SAFE_REPROJECT",
    storedWord,
    expectedWord: normalized.exactWord,
    ...(storedSchemaVersion !== undefined && { storedSchemaVersion }),
    expectedClaimId,
    ...(storedClaimId !== undefined &&
      storedClaimId !== expectedClaimId && { staleClaimId: storedClaimId }),
    changedKeys,
    precondition,
    plan: {
      projection,
      exactWord: normalized.exactWord,
      sequenceLength: normalized.sequenceLength,
      contentHash: normalized.contentHash,
      contentHashVersion: normalized.contentHashVersion,
    },
  };

  // IN_SYNC requires: schema-2 stored doc whose digest matches, matching owner
  // parity stamps, and no key drift. Claim existence is checked in the
  // duplicate pass (it needs the full claim map).
  // The digest is the authoritative content comparator (it covers every
  // stable projected key); changedKeys stays advisory because JSON compare
  // can over-report on key order, and blocking IN_SYNC on it would stop the
  // corpus from ever converging.
  if (
    isSchemaTwo &&
    data["publicProjectionDigest"] === projection.publicProjectionDigest &&
    ownerData["publicProjectionDigest"] === projection.publicProjectionDigest &&
    ownerData["word"] === normalized.exactWord &&
    ownerData["contentHash"] === normalized.contentHash &&
    ownerData["sequenceLength"] === normalized.sequenceLength
  ) {
    base.classification = "IN_SYNC";
  }
  return base;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

async function applyRecord(db: AdminDb, record: ScanRecord): Promise<void> {
  const plan = record.plan!;
  const ownerId = record.ownerId!;
  const publicRef = db.collection("publicSequences").doc(record.id);
  const ownerRef = db.collection(`users/${ownerId}/sequences`).doc(record.id);
  const claimRef = db
    .collection(PUBLIC_SEQUENCE_HASH_COLLECTION)
    .doc(record.expectedClaimId!);
  const staleClaimRef = record.staleClaimId
    ? db.collection(PUBLIC_SEQUENCE_HASH_COLLECTION).doc(record.staleClaimId)
    : null;

  await db.runTransaction(async (t) => {
    const refs = [
      ownerRef,
      publicRef,
      claimRef,
      ...(staleClaimRef ? [staleClaimRef] : []),
    ];
    const [ownerSnap, publicSnap, claimSnap, staleSnap] = await t.getAll(
      ...refs
    );

    if (!ownerSnap?.exists || !publicSnap?.exists) {
      record.applied = "skipped-changed";
      return;
    }
    const ownerNow = ownerSnap.data() ?? {};
    const publicNow = publicSnap.data() ?? {};

    // Scan precondition: the documents this plan was computed from are the
    // documents still stored. Any drift → skip, rerun picks it up.
    const pre = record.precondition!;
    const changed =
      timestampMillis(ownerNow["updatedAt"]) !== pre.ownerUpdatedAtMillis ||
      (typeof ownerNow["_version"] === "number"
        ? (ownerNow["_version"] as number)
        : null) !== pre.ownerVersion ||
      timestampMillis(publicNow["updatedAt"]) !== pre.publicUpdatedAtMillis ||
      ownerNow["visibility"] !== "public" ||
      ownerNow["isDeleted"] === true;
    if (changed) {
      record.applied = "skipped-changed";
      return;
    }

    // Claim: absent → create; present for THIS sequence → keep; present for
    // another sequence → a conflict surfaced after the scan. Never steal.
    const claimData = claimSnap?.exists ? (claimSnap.data() ?? {}) : null;
    if (claimData && claimData["sequenceId"] !== record.id) {
      record.applied = "skipped-claim-conflict";
      return;
    }

    const staleOwned =
      staleSnap !== undefined &&
      staleSnap.exists &&
      (staleSnap.data() ?? {})["sequenceId"] === record.id;

    // --- writes ------------------------------------------------------------
    t.set(publicRef, plan.projection);
    if (!claimData) {
      t.set(claimRef, {
        sequenceId: record.id,
        ownerId,
        contentHash: plan.contentHash,
        contentHashVersion: plan.contentHashVersion,
        createdAt: new Date(),
      });
    }
    if (staleClaimRef && staleOwned) {
      t.delete(staleClaimRef);
    }
    t.update(ownerRef, {
      word: plan.exactWord,
      sequenceLength: plan.sequenceLength,
      contentHash: plan.contentHash,
      contentHashVersion: plan.contentHashVersion,
      publicProjectionRevision: plan.projection.publicProjectionRevision,
      publicProjectionSchemaVersion:
        plan.projection.publicProjectionSchemaVersion,
      publicProjectionDigest: plan.projection.publicProjectionDigest,
    });
    record.applied = "written";
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { db: rawDb, sdk } = (await initFirestore()) as {
    db: unknown;
    sdk: string;
  };
  if (sdk !== "admin") {
    console.error(
      "This migration reads every user's owner documents — it requires the Admin SDK. Set TKA_ADMIN=1 (serviceAccountKey.json in repo root)."
    );
    process.exit(1);
  }
  const db = rawDb as AdminDb;
  console.log(
    `reconcile-sequence-public-projections — ${APPLY ? "APPLY" : "DRY-RUN"} — via ${sdk}`
  );

  // Full public corpus (small: hundreds of docs), plus the claim map.
  const publicSnap = await db.collection("publicSequences").get();
  let docs: PublicDocSnapshot[] = publicSnap.docs.map((d) => ({
    id: d.id,
    data: d.data() ?? {},
  }));
  docs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (ONLY_SEQUENCE) docs = docs.filter((d) => d.id === ONLY_SEQUENCE);
  if (AFTER) docs = docs.filter((d) => d.id > AFTER);
  if (LIMIT !== undefined) docs = docs.slice(0, LIMIT);

  const claimSnap = await db.collection(PUBLIC_SEQUENCE_HASH_COLLECTION).get();
  const claims = new Map<string, AnyRec>();
  for (const d of claimSnap.docs) {
    claims.set(d.id, d.data() ?? {});
  }

  console.log(
    `scanning ${docs.length} public documents (claims on file: ${claims.size})`
  );

  // Bounded-concurrency scan.
  const records: ScanRecord[] = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    const chunk = docs.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((d) => classify(db, d)));
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        records.push(outcome.value);
      } else {
        records.push({
          id: chunk[index]!.id,
          ownerId: null,
          classification: "INCOMPLETE_CANONICAL_DATA",
          detail: `classifier threw: ${String(outcome.reason).slice(0, 300)}`,
        });
      }
    });
    if ((i / CONCURRENCY) % 10 === 0 && i > 0) {
      console.log(`  …${i}/${docs.length}`);
    }
  }

  // Duplicate pass: two rules.
  // (a) Two SCANNED documents normalizing to the same claim id — neither is
  //     safe to write; a human picks the survivor.
  // (b) An EXISTING claim held by a different, still-present document.
  const byClaim = new Map<string, ScanRecord[]>();
  for (const r of records) {
    if (!r.expectedClaimId || !r.plan) continue;
    const list = byClaim.get(r.expectedClaimId) ?? [];
    list.push(r);
    byClaim.set(r.expectedClaimId, list);
  }
  const scannedIds = new Set(records.map((r) => r.id));
  for (const [claimId, group] of byClaim) {
    const holder = claims.get(claimId);
    const foreignHolder =
      holder &&
      typeof holder["sequenceId"] === "string" &&
      !group.some((r) => r.id === holder["sequenceId"]) &&
      scannedIds.has(holder["sequenceId"] as string);
    if (group.length > 1 || foreignHolder) {
      const competing = [
        ...group.map((r) => r.id),
        ...(foreignHolder ? [holder!["sequenceId"] as string] : []),
      ];
      for (const r of group) {
        if (r.classification === "IN_SYNC") continue;
        r.classification = "DUPLICATE_HASH_CONFLICT";
        (r as { detail?: string }).detail =
          `claim ${claimId} contested by: ${competing.join(", ")}`;
        r.plan = undefined;
      }
    }
  }

  // An otherwise-in-sync schema-2 document published before the claim
  // collection existed still needs its claim minted — that IS a repair, or the
  // phase-4 strict rules would strand it.
  for (const r of records) {
    if (
      r.classification === "IN_SYNC" &&
      r.expectedClaimId &&
      !claims.has(r.expectedClaimId)
    ) {
      r.classification = "SAFE_REPROJECT";
      (r as { detail?: string }).detail =
        "in sync, but its hash claim is missing";
    }
  }

  // Apply.
  if (APPLY) {
    const applicable = records.filter(
      (r) =>
        (r.classification === "SAFE_REPROJECT" ||
          r.classification === "EXPECTED_LOOP_REPRESENTATION") &&
        r.plan
    );
    console.log(`\napplying ${applicable.length} repairs…`);
    for (let i = 0; i < applicable.length; i += CONCURRENCY) {
      const chunk = applicable.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        chunk.map(async (r) => {
          try {
            await applyRecord(db, r);
            if (r.applied === "skipped-changed") {
              r.classification = "SOURCE_CHANGED_DURING_RUN";
            }
          } catch (e) {
            r.applied = "failed";
            r.applyError = String(e).slice(0, 300);
          }
        })
      );
    }
  }

  // Manifest — deterministic order by (ownerId, id).
  records.sort((a, b) =>
    (a.ownerId ?? "") < (b.ownerId ?? "")
      ? -1
      : (a.ownerId ?? "") > (b.ownerId ?? "")
        ? 1
        : a.id < b.id
          ? -1
          : 1
  );
  const counts: Record<string, number> = {};
  for (const r of records) {
    counts[r.classification] = (counts[r.classification] ?? 0) + 1;
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? "apply" : "dry-run",
    scanned: docs.length,
    claimsOnFile: claims.size,
    counts,
    records: records.map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      classification: r.classification,
      ...(r.detail && { detail: r.detail }),
      ...(r.storedWord !== undefined && { storedWord: r.storedWord }),
      ...(r.expectedWord !== undefined && { expectedWord: r.expectedWord }),
      ...(r.storedSchemaVersion !== undefined && {
        storedSchemaVersion: r.storedSchemaVersion,
      }),
      ...(r.expectedClaimId && { expectedClaimId: r.expectedClaimId }),
      ...(r.staleClaimId && { staleClaimId: r.staleClaimId }),
      ...(r.changedKeys?.length ? { changedKeys: r.changedKeys } : {}),
      ...(r.precondition && { precondition: r.precondition }),
      ...(r.applied && { applied: r.applied }),
      ...(r.applyError && { applyError: r.applyError }),
    })),
  };
  const outDir = join("scripts", "migrations", "backups");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(
    outDir,
    `reconcile-projections-${APPLY ? "apply" : "dryrun"}-${stamp}.json`
  );
  writeFileSync(outPath, JSON.stringify(manifest, null, 2));

  console.log(`\n════ ${APPLY ? "APPLY" : "DRY-RUN"} SUMMARY ════`);
  for (const [cls, count] of Object.entries(counts).sort()) {
    console.log(`  ${count.toString().padStart(5)}  ${cls}`);
  }
  if (APPLY) {
    const applied = records.filter((r) => r.applied === "written").length;
    const failed = records.filter((r) => r.applied === "failed").length;
    console.log(`  written=${applied} failed=${failed}`);
  }
  console.log(`\nmanifest: ${outPath}`);
  if (!APPLY) {
    console.log(
      "Review the manifest (duplicates + incomplete first), then re-run with TKA_ADMIN=1 --apply."
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
