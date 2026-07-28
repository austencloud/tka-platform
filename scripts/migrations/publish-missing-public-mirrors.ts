/**
 * publish-missing-public-mirrors — surgical companion to
 * reconcile-sequence-public-projections. That reconciler walks EXISTING
 * publicSequences documents; it cannot see an owner document whose publish
 * was denied before the mirror was ever created (the 2026-07-27..28 window
 * where prod served a pre-phase-4 client against the phase-4 strict rules).
 *
 * This script takes explicit owner/sequence targets, verifies the owner
 * document is public, undeleted, and has NO mirror, then performs the full
 * publish-transaction shape through the SAME modules the runtime writer uses:
 * schema-2 projection + hash claim + owner parity stamps, one Admin
 * transaction per sequence. A claim already held by another sequence is a
 * legitimate PUBLIC_DUPLICATE and is reported, never stolen.
 *
 *   npx tsx scripts/migrations/publish-missing-public-mirrors.ts \
 *     --target <ownerId>:<sequenceId> [--target ...]              # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/publish-missing-public-mirrors.ts \
 *     --target <ownerId>:<sequenceId> --apply
 *
 * Context preparation (profile, tags, loop, encoder hash, level) is the same
 * Admin-SDK replica the reconciler carries; copied rather than imported
 * because the reconciler executes its main() on import.
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
  type ProjectionSourceSequence,
  type PublicProjectionContext,
  type PublicProjectionLoopData,
} from "../../src/lib/shared/library/services/public-sequence-projection";
import {
  publicSequenceClaimId,
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

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;

// Minimal typed facade over the Admin SDK surface this script touches (same
// shape as the reconciler's: `exists` is a PROPERTY in firebase-admin).
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

const APPLY = process.argv.includes("--apply");
const targets: Array<{ ownerId: string; sequenceId: string }> = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--target") {
    const raw = process.argv[++i] ?? "";
    const [ownerId, sequenceId] = raw.split(":");
    if (!ownerId || !sequenceId) {
      console.error(`Bad --target "${raw}" — expected <ownerId>:<sequenceId>`);
      process.exit(1);
    }
    targets.push({ ownerId, sequenceId });
  }
}
if (targets.length === 0) {
  console.error("No --target given. Usage: --target <ownerId>:<sequenceId>");
  process.exit(1);
}
if (APPLY && process.env["TKA_ADMIN"] !== "1") {
  console.error("--apply requires TKA_ADMIN=1");
  process.exit(1);
}

// --- context preparation (Admin replica, same as the reconciler) -----------

async function readOwnerProfile(db: AdminDb, ownerId: string) {
  const snap = await db.collection("users").doc(ownerId).get();
  const data = snap.data() ?? {};
  return {
    displayName:
      typeof data["displayName"] === "string" && data["displayName"].length > 0
        ? (data["displayName"] as string)
        : "Unknown",
    ...(typeof data["photoURL"] === "string" && {
      avatarUrl: data["photoURL"] as string,
    }),
  };
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
  const snap = await db.collection(`users/${ownerId}/tags`).get();
  const nameById = new Map<string, string>();
  for (const d of snap.docs) {
    const name = (d.data() ?? {})["name"];
    if (typeof name === "string" && name.length > 0) nameById.set(d.id, name);
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
        period = detection.period ? periodToNumber(detection.period) : undefined;
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
  if (!isSeamlesslyLoopable(hydrated)) return { isCircular: false, loopType: null };
  return detected(null, true);
}

// --- run -------------------------------------------------------------------

interface Report {
  ownerId: string;
  sequenceId: string;
  outcome: string;
  detail?: string;
  word?: string;
  claimId?: string;
}

const { db: rawDb, sdk } = (await initFirestore()) as {
  db: unknown;
  sdk: string;
};
if (sdk !== "admin") {
  console.error(
    "This script writes publicSequences directly — it requires the Admin SDK. Set TKA_ADMIN=1 (serviceAccountKey.json in repo root)."
  );
  process.exit(1);
}
const db = rawDb as AdminDb;
const reports: Report[] = [];

for (const { ownerId, sequenceId } of targets) {
  const ownerRef = db.collection(`users/${ownerId}/sequences`).doc(sequenceId);
  const publicRef = db.collection("publicSequences").doc(sequenceId);

  const [ownerSnap, publicSnap] = await Promise.all([
    ownerRef.get(),
    publicRef.get(),
  ]);
  if (!ownerSnap.exists) {
    reports.push({ ownerId, sequenceId, outcome: "OWNER_MISSING" });
    continue;
  }
  if (publicSnap.exists) {
    reports.push({
      ownerId,
      sequenceId,
      outcome: "MIRROR_ALREADY_EXISTS",
      detail: "use reconcile-sequence-public-projections instead",
    });
    continue;
  }
  const ownerData = ownerSnap.data() ?? {};
  if (ownerData["isDeleted"] === true || ownerData["visibility"] !== "public") {
    reports.push({
      ownerId,
      sequenceId,
      outcome: "NOT_PUBLICLY_ELIGIBLE",
      detail: `visibility=${JSON.stringify(ownerData["visibility"])} isDeleted=${ownerData["isDeleted"] === true}`,
    });
    continue;
  }

  const normalization = await trySequenceNormalization({
    ...(ownerData as object),
    id: sequenceId,
  } as SequenceData);
  if (!normalization.ok) {
    reports.push({
      ownerId,
      sequenceId,
      outcome: "INCOMPLETE_CANONICAL_DATA",
      detail: `${normalization.code}: ${normalization.error.message.slice(0, 200)}`,
    });
    continue;
  }
  const normalized =
    normalization.value as unknown as NormalizedSequenceWrite<ProjectionSourceSequence>;
  const hydrated = normalization.value.hydrated;

  const profile = await readOwnerProfile(db, ownerId);
  const tagNames = await resolveTagNames(db, ownerId, ownerData);
  const loop = await detectLoop(db, hydrated);
  const encoderHash = await sha256Hex(encodeSequence(hydrated));
  const level = calculateDifficultyLevel([...(hydrated.steps ?? [])]);

  const context: PublicProjectionContext = {
    ownerId,
    ownerDisplayName: profile.displayName,
    ...(profile.avatarUrl !== undefined && { ownerAvatarUrl: profile.avatarUrl }),
    tagNames,
    encoderHash,
    loop,
    ...(typeof ownerData["difficultyLevel"] === "string" && {
      difficultyLevel: ownerData["difficultyLevel"] as string,
    }),
    level,
    now: new Date(),
  };

  const projection = await buildPublicSequenceProjection(normalized, context, 1, {
    kind: "first-publication",
  });
  const claimId = publicSequenceClaimId(
    normalized.contentHashVersion,
    normalized.contentHash
  );
  const claimRef = db.collection(PUBLIC_SEQUENCE_HASH_COLLECTION).doc(claimId);
  const claimSnap = await claimRef.get();
  if (claimSnap.exists && (claimSnap.data() ?? {})["sequenceId"] !== sequenceId) {
    reports.push({
      ownerId,
      sequenceId,
      outcome: "PUBLIC_DUPLICATE",
      detail: `claim ${claimId} held by sequence ${(claimSnap.data() ?? {})["sequenceId"]}`,
      claimId,
    });
    continue;
  }

  if (!APPLY) {
    reports.push({
      ownerId,
      sequenceId,
      outcome: "WOULD_PUBLISH",
      word: normalized.exactWord,
      claimId,
    });
    continue;
  }

  await db.runTransaction(async (t) => {
    const [ownerNow, publicNow, claimNow] = await t.getAll(
      ownerRef,
      publicRef,
      claimRef
    );
    if (!ownerNow?.exists || publicNow?.exists) {
      reports.push({ ownerId, sequenceId, outcome: "SKIPPED_CHANGED" });
      return;
    }
    const claimData = claimNow?.exists ? (claimNow.data() ?? {}) : null;
    if (claimData && claimData["sequenceId"] !== sequenceId) {
      reports.push({ ownerId, sequenceId, outcome: "SKIPPED_CLAIM_CONFLICT" });
      return;
    }
    t.set(publicRef, projection);
    if (!claimData) {
      t.set(claimRef, {
        sequenceId,
        ownerId,
        contentHash: normalized.contentHash,
        contentHashVersion: normalized.contentHashVersion,
        createdAt: new Date(),
      });
    }
    t.update(ownerRef, {
      word: normalized.exactWord,
      sequenceLength: normalized.sequenceLength,
      contentHash: normalized.contentHash,
      contentHashVersion: normalized.contentHashVersion,
      publicProjectionRevision: projection.publicProjectionRevision,
      publicProjectionSchemaVersion: projection.publicProjectionSchemaVersion,
      publicProjectionDigest: projection.publicProjectionDigest,
    });
    reports.push({
      ownerId,
      sequenceId,
      outcome: "PUBLISHED",
      word: normalized.exactWord,
      claimId,
    });
  });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = join("scripts", "migrations", "backups");
mkdirSync(backupDir, { recursive: true });
const manifestPath = join(
  backupDir,
  `publish-missing-mirrors-${APPLY ? "apply" : "dryrun"}-${stamp}.json`
);
writeFileSync(manifestPath, JSON.stringify(reports, null, 2));

for (const r of reports) {
  console.log(
    `${r.outcome}  ${r.ownerId}:${r.sequenceId}` +
      (r.word ? `  word=${r.word}` : "") +
      (r.detail ? `  (${r.detail})` : "")
  );
}
console.log(`\nManifest: ${manifestPath}`);
