/**
 * Retain immutable sequence subjects and audit legacy media associations.
 *
 * Dry-run is the default. The apply path creates missing sequence revision
 * documents only; it never guesses a revision for an existing video.
 *
 *   npx tsx scripts/migrations/retain-media-subject-revisions.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/retain-media-subject-revisions.ts --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initFirestore } from "../lib/firestore-provider.js";
import { buildSequenceRevisionRecord } from "../../src/lib/shared/library/services/sequence-revision";
import type { PublicSequenceProjectionWrite } from "../../src/lib/shared/library/services/public-sequence-projection";
import { auditMediaAssociationRevision } from "../../src/lib/shared/video-collaboration/domain/media-revision-audit";
import type { MediaAssociation } from "../../src/lib/shared/video-collaboration/domain/collaborative-video";
import {
  CollectedTunnelSchema,
  type CollectedTunnel,
} from "../../src/lib/features/tunnel-collection/domain/tunnel-collection-types";
import {
  createTunnelRevision,
  prepareTunnelRevision,
} from "../../src/lib/features/tunnel-collection/domain/tunnel-revision";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRecord = Record<string, unknown>;
interface AdminSnapshot {
  readonly id: string;
  readonly exists: boolean;
  readonly ref: AdminDocRef;
  data(): AnyRecord | undefined;
}
interface AdminDocRef {
  readonly path: string;
  get(): Promise<AdminSnapshot>;
  set(data: unknown): Promise<void>;
  collection(path: string): AdminCollection;
}
interface AdminCollection {
  doc(id: string): AdminDocRef;
  get(): Promise<{ docs: AdminSnapshot[] }>;
}
interface AdminDb {
  collection(path: string): AdminCollection;
  collectionGroup(path: string): Pick<AdminCollection, "get">;
  runTransaction<T>(
    update: (transaction: {
      get(ref: AdminDocRef): Promise<AdminSnapshot>;
      set(ref: AdminDocRef, data: unknown): void;
      update(ref: AdminDocRef, data: unknown): void;
    }) => Promise<T>
  ): Promise<T>;
}

const apply = process.argv.includes("--apply");
if (apply && process.env.TKA_ADMIN !== "1") {
  throw new Error("--apply requires TKA_ADMIN=1");
}

const { db: rawDb, isAdmin } = await initFirestore();
if (!isAdmin) {
  throw new Error(
    "A complete corpus audit requires TKA_ADMIN=1; contributor credentials can only see an authorized subset."
  );
}
const db = rawDb as AdminDb;
const publicSnapshot = await db.collection("publicSequences").get();
const sequenceResults: AnyRecord[] = [];
const revisionBySequence = new Map<string, string>();
let writes = 0;

for (const snapshot of publicSnapshot.docs) {
  const data = { id: snapshot.id, ...(snapshot.data() ?? {}) };
  if (
    data["publicProjectionSchemaVersion"] !== 2 ||
    typeof data["ownerId"] !== "string" ||
    typeof data["contentHash"] !== "string" ||
    !/^[a-f0-9]{64}$/.test(data["contentHash"] as string) ||
    typeof data["contentHashVersion"] !== "number"
  ) {
    sequenceResults.push({
      sequenceId: snapshot.id,
      status: "BLOCKED_INVALID_PUBLIC_PROJECTION",
    });
    continue;
  }

  const revision = await buildSequenceRevisionRecord(
    data as unknown as PublicSequenceProjectionWrite,
    data["publishedAt"] ?? new Date()
  );
  revisionBySequence.set(snapshot.id, revision.revisionId);
  const ref = db.collection("sequenceRevisions").doc(revision.revisionId);
  const existing = await ref.get();
  if (existing.exists) {
    const existingData = existing.data() ?? {};
    const exact =
      existingData["sequenceId"] === snapshot.id &&
      existingData["contentDigest"] === revision.contentDigest;
    sequenceResults.push({
      sequenceId: snapshot.id,
      revisionId: revision.revisionId,
      status: exact ? "ALREADY_RETAINED" : "BLOCKED_REVISION_CONFLICT",
    });
    continue;
  }

  sequenceResults.push({
    sequenceId: snapshot.id,
    revisionId: revision.revisionId,
    status: apply ? "CREATED" : "WOULD_CREATE",
  });
  if (apply) {
    await ref.set(revision);
    writes += 1;
  }
}

const tunnelSnapshot = await db.collectionGroup("tunnel-collection").get();
const tunnelResults: AnyRecord[] = [];
for (const snapshot of tunnelSnapshot.docs) {
  const parsed = CollectedTunnelSchema.safeParse({
    id: snapshot.id,
    ...(snapshot.data() ?? {}),
  });
  if (!parsed.success) {
    tunnelResults.push({
      path: snapshot.ref.path,
      status: "BLOCKED_INVALID_TUNNEL",
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    continue;
  }

  const tunnel = parsed.data as CollectedTunnel;
  const prepared = await prepareTunnelRevision(
    tunnel,
    tunnel.currentRevisionId ? tunnel : undefined
  );
  const revision = await createTunnelRevision(
    prepared,
    prepared.currentRevisionCreatedAt ?? prepared.createdAt
  );
  const ref = snapshot.ref.collection("revisions").doc(revision.revisionId);
  const existing = await ref.get();
  const parentStamped =
    tunnel.currentRevisionId === revision.revisionId &&
    tunnel.currentContentDigest === revision.contentDigest;
  if (existing.exists && parentStamped) {
    const existingData = existing.data() ?? {};
    const exact =
      existingData["artifactId"] === tunnel.id &&
      existingData["contentDigest"] === revision.contentDigest;
    tunnelResults.push({
      path: snapshot.ref.path,
      revisionId: revision.revisionId,
      status: exact ? "ALREADY_RETAINED" : "BLOCKED_REVISION_CONFLICT",
    });
    continue;
  }

  tunnelResults.push({
    path: snapshot.ref.path,
    revisionId: revision.revisionId,
    status: apply ? "CREATED" : "WOULD_CREATE",
  });
  if (apply) {
    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(snapshot.ref);
      if (!currentSnapshot.exists) {
        throw new Error(
          `Tunnel disappeared during migration: ${snapshot.ref.path}`
        );
      }
      const currentParsed = CollectedTunnelSchema.safeParse({
        id: currentSnapshot.id,
        ...(currentSnapshot.data() ?? {}),
      });
      if (!currentParsed.success) {
        throw new Error(
          `Tunnel changed to an invalid shape: ${snapshot.ref.path}`
        );
      }
      const current = currentParsed.data as CollectedTunnel;
      const currentPrepared = await prepareTunnelRevision(
        current,
        current.currentRevisionId ? current : undefined
      );
      const currentRevision = await createTunnelRevision(
        currentPrepared,
        currentPrepared.currentRevisionCreatedAt ?? currentPrepared.createdAt
      );
      const currentRef = snapshot.ref
        .collection("revisions")
        .doc(currentRevision.revisionId);
      const currentRevisionSnapshot = await transaction.get(currentRef);
      transaction.update(snapshot.ref, {
        currentRevisionId: currentRevision.revisionId,
        currentContentDigest: currentRevision.contentDigest,
        currentRevisionCreatedAt: currentRevision.createdAt,
        revisionDigestAlgorithm: currentRevision.digestAlgorithm,
        revisionDigestVersion: currentRevision.digestVersion,
      });
      if (!currentRevisionSnapshot.exists) {
        transaction.set(currentRef, currentRevision);
      }
    });
    writes += 1;
  }
}

const videoSnapshot = await db.collection("videos").get();
const mediaResults: AnyRecord[] = [];
for (const snapshot of videoSnapshot.docs) {
  const data = snapshot.data() ?? {};
  const associations = Array.isArray(data["associations"])
    ? (data["associations"] as unknown[])
    : [];
  const normalized = [...associations];
  if (
    typeof data["sequenceId"] === "string" &&
    !associations.some(
      (value) =>
        value &&
        typeof value === "object" &&
        (value as AnyRecord)["subjectType"] === "sequence" &&
        (value as AnyRecord)["subjectId"] === data["sequenceId"]
    )
  ) {
    normalized.push({
      subjectType: "sequence",
      subjectId: data["sequenceId"],
      relationship: "performance",
    });
  }

  for (const value of normalized) {
    if (!value || typeof value !== "object") continue;
    const association = value as AnyRecord;
    const subjectType = association["subjectType"];
    const subjectId = association["subjectId"];
    if (
      (subjectType !== "sequence" && subjectType !== "tunnel") ||
      typeof subjectId !== "string"
    ) {
      continue;
    }
    const audit = auditMediaAssociationRevision({
      subjectType,
      subjectId,
      relationship: subjectType === "sequence" ? "performance" : "realization",
      ...(association["revision"] ? { revision: association["revision"] } : {}),
    } as MediaAssociation);
    if (audit.status === "pinned") {
      mediaResults.push({
        videoId: snapshot.id,
        subjectType,
        subjectId,
        status: "PINNED",
        revisionId: audit.revisionId,
      });
      continue;
    }

    mediaResults.push({
      videoId: snapshot.id,
      subjectType,
      subjectId,
      currentRevisionId:
        subjectType === "sequence"
          ? (revisionBySequence.get(subjectId) ?? null)
          : null,
      status: "AMBIGUOUS_LEGACY_ASSOCIATION",
      reason:
        "The video predates immutable subject references; current state is not proof of historical state.",
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: apply ? "apply" : "dry-run",
  writes,
  sequences: sequenceResults,
  tunnels: tunnelResults,
  media: mediaResults,
  summary: {
    publicSequences: publicSnapshot.docs.length,
    savedTunnels: tunnelSnapshot.docs.length,
    retainedOrCreatable: sequenceResults.filter((row) =>
      ["ALREADY_RETAINED", "WOULD_CREATE", "CREATED"].includes(
        String(row["status"])
      )
    ).length,
    ambiguousMediaAssociations: mediaResults.filter(
      (row) => row["status"] === "AMBIGUOUS_LEGACY_ASSOCIATION"
    ).length,
    blockedTunnels: tunnelResults.filter((row) =>
      String(row["status"]).startsWith("BLOCKED_")
    ).length,
  },
};

const outputDir = join(process.cwd(), "scripts", "migrations", "backups");
mkdirSync(outputDir, { recursive: true });
const outputPath = join(
  outputDir,
  `media-subject-revisions-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report.summary, writes, outputPath }, null, 2));
