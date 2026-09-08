/**
 * Move one library sequence to another user without changing its sequence id
 * or public URL.
 *
 * Usage:
 *   pnpm sequence:transfer -- <sequenceId> <uid|username|displayName>
 *   pnpm sequence:transfer -- <sequenceId> <target> --dry-run
 *   pnpm sequence:transfer -- <sequenceId> <target> --from <sourceUid>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { initFirestore } from "./lib/firestore-provider.js";
import {
  computeStoredProjectionDigest,
  PUBLIC_PROJECTION_SCHEMA_VERSION,
} from "../src/lib/shared/library/services/public-sequence-projection";
import {
  PUBLIC_SEQUENCE_HASH_COLLECTION,
  publicSequenceClaimId,
} from "../src/lib/shared/library/services/public-sequence-persister";
import {
  getPublicSequencePath,
  getUserSequencePath,
} from "../src/lib/shared/library/data/firestore-paths";

const DEFAULT_SOURCE_OWNER_ID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
type AnyRecord = Record<string, unknown>;

interface AdminDocumentSnapshot {
  readonly id: string;
  readonly exists: boolean;
  data(): AnyRecord | undefined;
}

interface AdminDocumentReference {
  readonly id: string;
  readonly path: string;
  get(): Promise<AdminDocumentSnapshot>;
}

interface AdminQuerySnapshot {
  readonly docs: AdminDocumentSnapshot[];
  readonly empty: boolean;
}

interface AdminQuery {
  where(field: string, operator: string, value: unknown): AdminQuery;
  limit(count: number): AdminQuery;
  get(): Promise<AdminQuerySnapshot>;
}

interface AdminCollectionReference extends AdminQuery {
  doc(id: string): AdminDocumentReference;
}

interface AdminTransaction {
  getAll(
    ...references: AdminDocumentReference[]
  ): Promise<AdminDocumentSnapshot[]>;
  get(query: AdminQuery): Promise<AdminQuerySnapshot>;
  set(reference: AdminDocumentReference, data: AnyRecord): void;
  update(reference: AdminDocumentReference, data: AnyRecord): void;
  delete(reference: AdminDocumentReference): void;
}

interface AdminFirestore {
  doc(path: string): AdminDocumentReference;
  collection(path: string): AdminCollectionReference;
  runTransaction<T>(
    operation: (transaction: AdminTransaction) => Promise<T>
  ): Promise<T>;
}

export interface SequenceTransferOptions {
  readonly sequenceId: string;
  readonly targetSelector: string;
  readonly sourceOwnerId: string;
  readonly dryRun: boolean;
}

export interface TransferTargetProfile {
  readonly ownerId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
}

interface TransferInspection {
  readonly sourceOwnerId: string;
  readonly target: TransferTargetProfile;
  readonly sequenceId: string;
  readonly word: string;
  readonly visibility: string;
  readonly public: boolean;
  readonly shortcodeIds: string[];
  readonly sourceData: AnyRecord;
  readonly publicData?: AnyRecord;
  readonly claimData?: AnyRecord;
  readonly shortcodes: Array<{
    readonly id: string;
    readonly data: AnyRecord;
  }>;
  readonly sourceCount: number;
  readonly targetCount: number;
}

export function parseSequenceTransferArgs(
  argv: readonly string[]
): SequenceTransferOptions | { readonly help: true } {
  const positional: string[] = [];
  let sourceOwnerId = DEFAULT_SOURCE_OWNER_ID;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--from") {
      sourceOwnerId = argv[++index] ?? "";
      if (!sourceOwnerId) throw new Error("--from requires a source user id");
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--help" || argument === "-h") {
      return { help: true };
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }

  if (positional.length !== 2) {
    throw new Error("A sequence id and target user are required");
  }
  const [sequenceId, targetSelector] = positional as [string, string];
  if (
    sequenceId.includes("/") ||
    sourceOwnerId.includes("/") ||
    targetSelector.includes("/")
  ) {
    throw new Error("Sequence and user selectors cannot contain '/'");
  }

  return { sequenceId, targetSelector, sourceOwnerId, dryRun };
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function buildMovedOwnerRecord(
  sourceData: AnyRecord,
  targetOwnerId: string,
  now: Date,
  publicStamps?: {
    readonly revision: number;
    readonly schema: number;
    readonly digest: string;
  }
): AnyRecord {
  const moved: AnyRecord = {
    ...sourceData,
    ownerId: targetOwnerId,
    updatedAt: now,
    isFavorite: false,
    ...(publicStamps && {
      publicProjectionRevision: publicStamps.revision,
      publicProjectionSchemaVersion: publicStamps.schema,
      publicProjectionDigest: publicStamps.digest,
    }),
  };

  // Collections and private tag ids belong to a user's library, not to the
  // movement. Carrying them across would point the new owner at documents they
  // cannot read and make the sequence appear inside someone else's folders.
  delete moved["collectionIds"];
  delete moved["tagIds"];
  delete moved["sequenceTags"];
  return moved;
}

export async function buildTransferredPublicProjection(
  stored: AnyRecord,
  sequenceId: string,
  target: TransferTargetProfile,
  now: Date
): Promise<AnyRecord> {
  const next: AnyRecord = {
    ...stored,
    ownerId: target.ownerId,
    ownerDisplayName: target.displayName,
    sourceRef: getUserSequencePath(target.ownerId, sequenceId),
    updatedAt: now,
    publicProjectionRevision:
      (typeof stored["publicProjectionRevision"] === "number"
        ? stored["publicProjectionRevision"]
        : 0) + 1,
  };
  if (target.avatarUrl) {
    next["ownerAvatarUrl"] = target.avatarUrl;
  } else {
    delete next["ownerAvatarUrl"];
  }
  next["publicProjectionDigest"] = await computeStoredProjectionDigest(next);
  return next;
}

function profileFromSnapshot(
  snapshot: AdminDocumentSnapshot
): TransferTargetProfile {
  const data = snapshot.data() ?? {};
  const avatarUrl =
    nonEmptyString(data["photoURL"]) ?? nonEmptyString(data["avatar"]);
  return {
    ownerId: snapshot.id,
    displayName:
      nonEmptyString(data["displayName"]) ??
      nonEmptyString(data["username"]) ??
      "Unknown",
    ...(avatarUrl && { avatarUrl }),
  };
}

function readContentIdentity(data: AnyRecord): {
  readonly contentHashVersion: number;
  readonly contentHash: string;
} {
  const contentHashVersion = data["contentHashVersion"];
  const contentHash = data["contentHash"];
  if (
    typeof contentHashVersion !== "number" ||
    !Number.isInteger(contentHashVersion) ||
    contentHashVersion < 1 ||
    typeof contentHash !== "string" ||
    contentHash.length === 0
  ) {
    throw new Error("Source sequence has no valid content-hash identity");
  }
  return { contentHashVersion, contentHash };
}

export async function assertTransferablePublicAggregate(
  sourceData: AnyRecord,
  publicData: AnyRecord,
  claimData: AnyRecord,
  sourceOwnerId: string,
  sequenceId: string,
  sourcePath: string
): Promise<void> {
  const identity = readContentIdentity(sourceData);
  if (
    sourceData["visibility"] !== "public" ||
    publicData["ownerId"] !== sourceOwnerId ||
    publicData["sourceRef"] !== sourcePath ||
    publicData["contentHash"] !== identity.contentHash ||
    publicData["contentHashVersion"] !== identity.contentHashVersion
  ) {
    throw new Error("Public projection does not match the source owner record");
  }
  if (
    publicData["publicProjectionSchemaVersion"] !==
      PUBLIC_PROJECTION_SCHEMA_VERSION ||
    sourceData["publicProjectionSchemaVersion"] !==
      PUBLIC_PROJECTION_SCHEMA_VERSION ||
    sourceData["publicProjectionRevision"] !==
      publicData["publicProjectionRevision"] ||
    sourceData["publicProjectionDigest"] !==
      publicData["publicProjectionDigest"] ||
    (await computeStoredProjectionDigest(publicData)) !==
      publicData["publicProjectionDigest"]
  ) {
    throw new Error(
      "Public projection stamps are stale; reconcile parity before transfer"
    );
  }
  if (
    claimData["sequenceId"] !== sequenceId ||
    claimData["ownerId"] !== sourceOwnerId ||
    claimData["contentHashVersion"] !== identity.contentHashVersion ||
    claimData["contentHash"] !== identity.contentHash
  ) {
    throw new Error("Public hash claim does not match the source owner");
  }
}

async function resolveTargetProfile(
  db: AdminFirestore,
  selector: string
): Promise<TransferTargetProfile> {
  const direct = await db.doc(`users/${selector}`).get();
  if (direct.exists) return profileFromSnapshot(direct);

  const candidates = new Map<string, AdminDocumentSnapshot>();
  const usernameMatches = await db
    .collection("users")
    .where("usernameLowercase", "==", selector.toLowerCase())
    .limit(2)
    .get();
  for (const match of usernameMatches.docs) candidates.set(match.id, match);

  const displayMatches = await db
    .collection("users")
    .where("displayName", "==", selector)
    .limit(2)
    .get();
  for (const match of displayMatches.docs) candidates.set(match.id, match);

  if (candidates.size === 0) {
    throw new Error(`No user matches ${JSON.stringify(selector)}`);
  }
  if (candidates.size > 1) {
    throw new Error(
      `${JSON.stringify(selector)} matches multiple users; use the target uid`
    );
  }
  return profileFromSnapshot([...candidates.values()][0]!);
}

async function inspectTransfer(
  db: AdminFirestore,
  options: SequenceTransferOptions
): Promise<TransferInspection> {
  const target = await resolveTargetProfile(db, options.targetSelector);
  if (target.ownerId === options.sourceOwnerId) {
    throw new Error("Source and target users are the same");
  }

  const sourcePath = getUserSequencePath(
    options.sourceOwnerId,
    options.sequenceId
  );
  const targetPath = getUserSequencePath(target.ownerId, options.sequenceId);
  const publicPath = getPublicSequencePath(options.sequenceId);
  const [sourceSnap, targetSnap, publicSnap, sourceSequences, targetSequences] =
    await Promise.all([
      db.doc(sourcePath).get(),
      db.doc(targetPath).get(),
      db.doc(publicPath).get(),
      db.collection(`users/${options.sourceOwnerId}/sequences`).get(),
      db.collection(`users/${target.ownerId}/sequences`).get(),
    ]);
  if (!sourceSnap.exists) throw new Error(`${sourcePath} does not exist`);
  if (targetSnap.exists) throw new Error(`${targetPath} already exists`);

  const sourceData = sourceSnap.data() ?? {};
  const visibility = nonEmptyString(sourceData["visibility"]) ?? "private";
  if (sourceData["isDeleted"] === true) {
    throw new Error("Deleted sequences cannot be transferred");
  }
  if (sourceData["ownerId"] !== options.sourceOwnerId) {
    throw new Error("Source ownerId does not match the source library path");
  }
  if ((visibility === "public") !== publicSnap.exists) {
    throw new Error(
      "Owner visibility and public projection disagree; repair parity before transfer"
    );
  }

  let claimData: AnyRecord | undefined;
  if (publicSnap.exists) {
    const publicData = publicSnap.data() ?? {};
    const identity = readContentIdentity(sourceData);
    const claimId = publicSequenceClaimId(
      identity.contentHashVersion,
      identity.contentHash
    );
    const claimSnap = await db
      .doc(`${PUBLIC_SEQUENCE_HASH_COLLECTION}/${claimId}`)
      .get();
    if (!claimSnap.exists) {
      throw new Error("Public hash claim does not match the source owner");
    }
    claimData = claimSnap.data() ?? {};
    await assertTransferablePublicAggregate(
      sourceData,
      publicData,
      claimData,
      options.sourceOwnerId,
      options.sequenceId,
      sourcePath
    );
  }

  const shortcodeSnap = await db
    .collection("shortcodes")
    .where("sequenceId", "==", options.sequenceId)
    .get();
  if (
    shortcodeSnap.docs.some(
      (document) => document.data()?.["ownerId"] !== options.sourceOwnerId
    )
  ) {
    throw new Error(
      "A shortcode is owned by a different user; repair it first"
    );
  }

  return {
    sourceOwnerId: options.sourceOwnerId,
    target,
    sequenceId: options.sequenceId,
    word:
      nonEmptyString(sourceData["word"] ?? sourceData["name"]) ??
      options.sequenceId,
    visibility,
    public: publicSnap.exists,
    shortcodeIds: shortcodeSnap.docs.map((document) => document.id),
    sourceData,
    ...(publicSnap.exists && { publicData: publicSnap.data() ?? {} }),
    ...(claimData && { claimData }),
    shortcodes: shortcodeSnap.docs.map((document) => ({
      id: document.id,
      data: document.data() ?? {},
    })),
    sourceCount: sourceSequences.docs.length,
    targetCount: targetSequences.docs.length,
  };
}

function writeBackup(inspection: TransferInspection): string {
  const backupDirectory = join(homedir(), ".tka", "backups");
  mkdirSync(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    backupDirectory,
    `sequence-transfer-${inspection.sequenceId}-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceOwnerId: inspection.sourceOwnerId,
        targetOwnerId: inspection.target.ownerId,
        sequenceId: inspection.sequenceId,
        sourceData: inspection.sourceData,
        publicData: inspection.publicData ?? null,
        claimData: inspection.claimData ?? null,
        shortcodes: inspection.shortcodes,
      },
      null,
      2
    )
  );
  return backupPath;
}

async function applyTransfer(
  db: AdminFirestore,
  inspection: TransferInspection
): Promise<{ sourceCount: number; targetCount: number; revision?: number }> {
  const sourceOwnerRef = db.doc(
    getUserSequencePath(inspection.sourceOwnerId, inspection.sequenceId)
  );
  const targetOwnerRef = db.doc(
    getUserSequencePath(inspection.target.ownerId, inspection.sequenceId)
  );
  const sourceProfileRef = db.doc(`users/${inspection.sourceOwnerId}`);
  const targetProfileRef = db.doc(`users/${inspection.target.ownerId}`);
  const publicRef = db.doc(getPublicSequencePath(inspection.sequenceId));
  const identity = readContentIdentity(inspection.sourceData);
  const claimRef = inspection.public
    ? db.doc(
        `${PUBLIC_SEQUENCE_HASH_COLLECTION}/${publicSequenceClaimId(
          identity.contentHashVersion,
          identity.contentHash
        )}`
      )
    : undefined;
  const sourceSequences = db.collection(
    `users/${inspection.sourceOwnerId}/sequences`
  );
  const targetSequences = db.collection(
    `users/${inspection.target.ownerId}/sequences`
  );
  const shortcodeQuery = db
    .collection("shortcodes")
    .where("sequenceId", "==", inspection.sequenceId);

  return db.runTransaction(async (transaction) => {
    const references = [
      sourceOwnerRef,
      targetOwnerRef,
      sourceProfileRef,
      targetProfileRef,
      ...(inspection.public && claimRef ? [publicRef, claimRef] : []),
    ];
    const snapshots = await transaction.getAll(...references);
    const [
      sourceNow,
      targetNow,
      sourceProfileNow,
      targetProfileNow,
      publicNow,
      claimNow,
    ] = snapshots;
    const sourceSequencesNow = await transaction.get(sourceSequences);
    const targetSequencesNow = await transaction.get(targetSequences);
    const shortcodesNow = await transaction.get(shortcodeQuery);

    if (!sourceNow?.exists || targetNow?.exists) {
      throw new Error(
        "Owner records changed after the dry run; retry transfer"
      );
    }
    if (!sourceProfileNow?.exists || !targetProfileNow?.exists) {
      throw new Error("Source or target profile disappeared; retry transfer");
    }
    const sourceData = sourceNow.data() ?? {};
    if (
      sourceData["ownerId"] !== inspection.sourceOwnerId ||
      sourceData["contentHash"] !== inspection.sourceData["contentHash"] ||
      sourceData["contentHashVersion"] !==
        inspection.sourceData["contentHashVersion"] ||
      sourceData["visibility"] !== inspection.visibility ||
      sourceData["isDeleted"] === true
    ) {
      throw new Error(
        "Source sequence changed after inspection; retry transfer"
      );
    }
    if (
      shortcodesNow.docs.some(
        (document) => document.data()?.["ownerId"] !== inspection.sourceOwnerId
      )
    ) {
      throw new Error(
        "Shortcode ownership changed after inspection; retry transfer"
      );
    }

    const now = new Date();
    let nextPublic: AnyRecord | undefined;
    if (inspection.public) {
      if (!claimRef)
        throw new Error("Public transfer is missing its hash claim");
      const publicData = publicNow?.data() ?? {};
      const claimData = claimNow?.data() ?? {};
      if (
        !publicNow?.exists ||
        !claimNow?.exists ||
        Object.keys(publicData).length === 0 ||
        Object.keys(claimData).length === 0
      ) {
        throw new Error(
          "Public aggregate changed after inspection; retry transfer"
        );
      }
      await assertTransferablePublicAggregate(
        sourceData,
        publicData,
        claimData,
        inspection.sourceOwnerId,
        inspection.sequenceId,
        sourceOwnerRef.path
      );
      nextPublic = await buildTransferredPublicProjection(
        publicData,
        inspection.sequenceId,
        profileFromSnapshot(targetProfileNow),
        now
      );
    }

    const publicStamps = nextPublic
      ? {
          revision: nextPublic["publicProjectionRevision"] as number,
          schema: nextPublic["publicProjectionSchemaVersion"] as number,
          digest: nextPublic["publicProjectionDigest"] as string,
        }
      : undefined;
    const movedOwner = buildMovedOwnerRecord(
      sourceData,
      inspection.target.ownerId,
      now,
      publicStamps
    );
    const sourceCount = sourceSequencesNow.docs.filter(
      (document) => document.id !== inspection.sequenceId
    ).length;
    const targetCount = targetSequencesNow.docs.length + 1;

    transaction.set(targetOwnerRef, movedOwner);
    transaction.delete(sourceOwnerRef);
    if (nextPublic && claimRef) {
      transaction.set(publicRef, nextPublic);
      transaction.update(claimRef, { ownerId: inspection.target.ownerId });
    }
    for (const shortcode of shortcodesNow.docs) {
      transaction.update(db.doc(`shortcodes/${shortcode.id}`), {
        ownerId: inspection.target.ownerId,
      });
    }
    transaction.update(sourceProfileRef, { sequenceCount: sourceCount });
    transaction.update(targetProfileRef, { sequenceCount: targetCount });

    return {
      sourceCount,
      targetCount,
      ...(nextPublic && {
        revision: nextPublic["publicProjectionRevision"] as number,
      }),
    };
  });
}

const USAGE = [
  "Usage: pnpm sequence:transfer -- <sequenceId> <uid|username|displayName> [--dry-run] [--from <uid>]",
  "",
  "The source defaults to Austen's import library. Transfer applies immediately unless --dry-run is present.",
].join("\n");

async function main(): Promise<void> {
  let options: ReturnType<typeof parseSequenceTransferArgs>;
  try {
    options = parseSequenceTransferArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  if ("help" in options) {
    console.log(USAGE);
    return;
  }

  process.env["TKA_ADMIN"] = "1";
  const { db: rawDb, sdk } = (await initFirestore()) as {
    db: unknown;
    sdk: string;
  };
  if (sdk !== "admin") throw new Error("Sequence transfer requires Admin SDK");
  const db = rawDb as AdminFirestore;
  const inspection = await inspectTransfer(db, options);

  console.log(
    `${options.dryRun ? "WOULD_TRANSFER" : "TRANSFER"}  ${inspection.word}  ${inspection.sourceOwnerId} -> ${inspection.target.displayName} (${inspection.target.ownerId})`
  );
  console.log(
    `sequence=${inspection.sequenceId} visibility=${inspection.visibility} shortcodes=${inspection.shortcodeIds.join(",") || "none"}`
  );
  console.log(
    `counts: source ${inspection.sourceCount} -> ${inspection.sourceCount - 1}; target ${inspection.targetCount} -> ${inspection.targetCount + 1}`
  );

  if (options.dryRun) return;
  const backupPath = writeBackup(inspection);
  console.log(`backup: ${backupPath}`);
  const result = await applyTransfer(db, inspection);
  console.log(
    `TRANSFERRED  sourceCount=${result.sourceCount} targetCount=${result.targetCount}` +
      (result.revision ? ` publicRevision=${result.revision}` : "")
  );
  console.log(
    `Live: https://tkaflowarts.com/sequence/${encodeURIComponent(inspection.sequenceId)}`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
