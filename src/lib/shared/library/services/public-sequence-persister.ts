/**
 * public-sequence-persister — atomic persistence for the public-sequence
 * aggregate: public projection, hash claim, and owner projection stamps.
 *
 * Parity-repair spec sections 6 (transaction) and 8 (hash claim). The previous
 * writer read the prior document and ran a `where("contentHash","==")` preflight
 * OUTSIDE the write, so two clients could interleave between read and write:
 * both observe "no duplicate", both `setDoc`. `runTransaction` closes that —
 * Firestore's serializable transactions force the losing writer to re-run its
 * callback against the winner's committed state. Same proven pattern as
 * `ShortCodeManager`'s `shortcodeHashes` allocation (short-code-manager.ts:658).
 *
 * ## Claim semantics vs shortcodes
 *
 * `publicSequenceHashes/{contentHashVersion}_{contentHash}` — one claim per
 * distinct movement identity. A shortcode loser can ADOPT the winner's code
 * (same immutable payload); a sequence publisher cannot adopt another owner's
 * sequence id, so a claim held by a different sequence is a typed
 * `PublicDuplicateError` and the transaction commits nothing. The claim id
 * embeds the hash version so a future hash-basis rollout cannot confuse values
 * computed under different bases.
 *
 * ## Transaction discipline
 *
 * The callback may run more than once under contention. Everything is derived
 * from `tx.get` reads inside the callback — no outer captures leak between
 * runs. All reads precede all writes (Firestore requirement). The digest await
 * (`buildPublicSequenceProjection`) sits between the last read and the first
 * write, which is legal; it only widens the contention window by milliseconds.
 *
 * Client transactions FAIL OFFLINE by design — publication is an online act.
 * Private saves keep their offline-capable batched path; the Dexie-first save
 * plus `library-sync-retry.ts` queue a public intent for retry when offline.
 *
 * ## What stays outside (spec section 10)
 *
 * Artifact fan-out (`publicHandPaths`, `publicSoloProps`), Browse-cache
 * injection, moderation, and context preparation (tags, encoder hash, loop
 * detection) all remain the caller's job — they are either unbounded writes or
 * reads that must not extend the transaction.
 */

import {
  doc,
  runTransaction,
  serverTimestamp,
  deleteField,
  type Firestore,
} from "firebase/firestore";

import {
  buildPublicSequenceProjection,
  type ExistingPublicOwnedFields,
  type ProjectionSourceSequence,
  type PublicProjectionContext,
  type PublicProjectionPriorState,
  type PublicProjectionTimestamp,
} from "$lib/shared/library/services/public-sequence-projection";
import { computeStoredProjectionDigest } from "$lib/shared/library/services/public-sequence-projection";
import { PUBLIC_PROJECTION_SCHEMA_VERSION } from "$lib/shared/foundation/domain/models/public-sequence-wire-schema";
import type { NormalizedSequenceWrite } from "$lib/shared/library/services/sequence-persistence-normalizer";
import {
  getPublicSequencePath,
  getUserSequencePath,
} from "$lib/shared/library/data/firestore-paths";

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export const PUBLIC_SEQUENCE_HASH_COLLECTION = "publicSequenceHashes";

export interface PublicSequenceHashClaim {
  readonly sequenceId: string;
  readonly ownerId: string;
  readonly contentHash: string;
  readonly contentHashVersion: number;
  readonly createdAt: unknown;
}

/** `{contentHashVersion}_{contentHash}` — version first so bases never mix. */
export function publicSequenceClaimId(
  contentHashVersion: number,
  contentHash: string
): string {
  return `${contentHashVersion}_${contentHash}`;
}

/**
 * Another owner's public sequence already claims this exact movement identity.
 * Typed so the retry layer can classify it as a user-action state, never a
 * background retry (spec section 6).
 */
export class PublicDuplicateError extends Error {
  readonly code = "PUBLIC_DUPLICATE" as const;
  constructor(
    readonly claimedBySequenceId: string,
    readonly claimedByOwnerId: string,
    readonly claimedWord: string | undefined
  ) {
    super(
      `This exact sequence already exists in the gallery` +
        (claimedWord ? ` (published as "${claimedWord}")` : "")
    );
    this.name = "PublicDuplicateError";
  }
}

// ---------------------------------------------------------------------------
// Prior-state extraction
// ---------------------------------------------------------------------------

/**
 * Extract the public-owned fields of an existing `publicSequences/{id}`
 * document for the projection builder's prior state.
 *
 * Type-guarded rather than cast: a legacy document can carry anything, and a
 * malformed counter must read as "absent" (builder seeds it) rather than
 * poison the projection. Timestamps pass through as wire values — the builder
 * never inspects them, it only decides which field gets which value, and
 * writing a read Firestore `Timestamp` back is value-identical.
 */
export function readExistingPublicOwnedFields(
  data: Record<string, unknown>
): ExistingPublicOwnedFields {
  const finiteNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  const forkCount = finiteNumber(data["forkCount"]);
  const viewCount = finiteNumber(data["viewCount"]);
  const starCount = finiteNumber(data["starCount"]);
  const publicProjectionRevision = finiteNumber(data["publicProjectionRevision"]);
  const publicProjectionDigest =
    typeof data["publicProjectionDigest"] === "string"
      ? data["publicProjectionDigest"]
      : undefined;

  return {
    ...(data["publishedAt"] != null && {
      publishedAt: data["publishedAt"] as PublicProjectionTimestamp,
    }),
    ...(data["updatedAt"] != null && {
      updatedAt: data["updatedAt"] as PublicProjectionTimestamp,
    }),
    ...(forkCount !== undefined && { forkCount }),
    ...(viewCount !== undefined && { viewCount }),
    ...(starCount !== undefined && { starCount }),
    ...(publicProjectionRevision !== undefined && { publicProjectionRevision }),
    ...(publicProjectionDigest !== undefined && { publicProjectionDigest }),
  };
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export interface PublishPublicSequenceResult {
  readonly revision: number;
  readonly digest: string;
  readonly firstPublication: boolean;
}

/**
 * Atomically publish (or republish) a sequence's public projection.
 *
 * One transaction, per spec section 6:
 *   reads  — public doc, hash claim, owner doc, stale claim (when the hash moved)
 *   writes — public projection (full set), claim create (when new identity),
 *            stale-claim delete (only when PROVEN owned by this sequence),
 *            owner projection stamps (revision/schema/digest + the normalized
 *            word/length/hash pair, so owner and mirror cannot disagree)
 *
 * Duplicate → throws {@link PublicDuplicateError}, commits nothing.
 * Owner doc absent → stamps are skipped, not invented; the publish itself
 * still lands (migration tooling projects sequences whose owner docs it is
 * separately repairing).
 *
 * @throws {PublicDuplicateError} when another sequence owns this content hash.
 */
export async function publishPublicSequence(
  firestore: Firestore,
  normalized: NormalizedSequenceWrite<ProjectionSourceSequence>,
  context: Omit<PublicProjectionContext, "now">,
  userId: string
): Promise<PublishPublicSequenceResult> {
  const sequenceId = normalized.ownerData.id;
  const publicRef = doc(firestore, getPublicSequencePath(sequenceId));
  const ownerRef = doc(firestore, getUserSequencePath(userId, sequenceId));
  const claimId = publicSequenceClaimId(
    normalized.contentHashVersion,
    normalized.contentHash
  );
  const claimRef = doc(firestore, PUBLIC_SEQUENCE_HASH_COLLECTION, claimId);

  return runTransaction(firestore, async (tx) => {
    // Everything below derives from this run's reads — nothing survives a
    // contention re-run (short-code-manager.ts:658 discipline).
    const publicSnap = await tx.get(publicRef);
    const claimSnap = await tx.get(claimRef);
    const ownerSnap = await tx.get(ownerRef);

    if (claimSnap.exists()) {
      const claim = claimSnap.data() as PublicSequenceHashClaim;
      if (claim.sequenceId !== sequenceId) {
        // A publisher cannot adopt another owner's sequence id, so unlike the
        // shortcode race there is no adoption path. Read the winner's word for
        // the user-facing message (still a read — no writes have happened).
        const winnerSnap = await tx.get(
          doc(firestore, getPublicSequencePath(claim.sequenceId))
        );
        const winnerWord = winnerSnap.exists()
          ? (winnerSnap.data() as { word?: string }).word
          : undefined;
        throw new PublicDuplicateError(
          claim.sequenceId,
          claim.ownerId,
          winnerWord
        );
      }
    }

    const publicData = publicSnap.exists()
      ? (publicSnap.data() as Record<string, unknown>)
      : undefined;
    const prior: PublicProjectionPriorState = publicData
      ? { kind: "existing", fields: readExistingPublicOwnedFields(publicData) }
      : { kind: "first-publication" };

    // Stale-claim cleanup: when the stored document carries a DIFFERENT hash
    // than the one being published, its old claim is released — but only after
    // this transaction PROVES the old claim belongs to this sequence (spec
    // section 6, step 10). Read before any write.
    let staleClaimRef: ReturnType<typeof doc> | null = null;
    const oldHash = publicData?.["contentHash"];
    const oldVersion = publicData?.["contentHashVersion"];
    if (
      typeof oldHash === "string" &&
      typeof oldVersion === "number" &&
      publicSequenceClaimId(oldVersion, oldHash) !== claimId
    ) {
      const candidateRef = doc(
        firestore,
        PUBLIC_SEQUENCE_HASH_COLLECTION,
        publicSequenceClaimId(oldVersion, oldHash)
      );
      const staleSnap = await tx.get(candidateRef);
      if (
        staleSnap.exists() &&
        (staleSnap.data() as PublicSequenceHashClaim).sequenceId === sequenceId
      ) {
        staleClaimRef = candidateRef;
      }
    }

    const revision =
      prior.kind === "existing"
        ? (prior.fields.publicProjectionRevision ?? 0) + 1
        : 1;

    const projection = await buildPublicSequenceProjection(
      normalized,
      { ...context, now: serverTimestamp() },
      revision,
      prior
    );

    // --- writes (no reads past this point) ---------------------------------
    tx.set(publicRef, projection as unknown as Record<string, unknown>);

    if (!claimSnap.exists()) {
      const claim: PublicSequenceHashClaim = {
        sequenceId,
        ownerId: userId,
        contentHash: normalized.contentHash,
        contentHashVersion: normalized.contentHashVersion,
        createdAt: serverTimestamp(),
      };
      tx.set(claimRef, claim as unknown as Record<string, unknown>);
    }

    if (staleClaimRef) {
      tx.delete(staleClaimRef);
    }

    if (ownerSnap.exists()) {
      tx.update(ownerRef, {
        publicProjectionRevision: projection.publicProjectionRevision,
        publicProjectionSchemaVersion: projection.publicProjectionSchemaVersion,
        publicProjectionDigest: projection.publicProjectionDigest,
        word: normalized.exactWord,
        sequenceLength: normalized.sequenceLength,
        contentHash: normalized.contentHash,
        contentHashVersion: normalized.contentHashVersion,
      });
    }

    return {
      revision: projection.publicProjectionRevision,
      digest: projection.publicProjectionDigest,
      firstPublication: prior.kind === "first-publication",
    };
  });
}

// ---------------------------------------------------------------------------
// Unpublish
// ---------------------------------------------------------------------------

export type UnpublishPublicSequenceResult =
  | { readonly status: "unpublished" }
  /** No public document existed — nothing to remove, treated as success. */
  | { readonly status: "absent" };

/**
 * Atomically remove a sequence's public presence: public document, its owned
 * hash claim (proven by `claim.sequenceId`), and the owner document's
 * projection stamps. Owner id comes from the stored public document, so
 * callers that only know the sequence id (recycle bin, batch delete) need no
 * signature change.
 *
 * Owner VISIBILITY is not touched here — the owner document's `visibility`
 * field is the caller's domain (a private re-save has already written it; a
 * delete flow is about to remove the whole document).
 */
export async function unpublishPublicSequence(
  firestore: Firestore,
  sequenceId: string
): Promise<UnpublishPublicSequenceResult> {
  const publicRef = doc(firestore, getPublicSequencePath(sequenceId));

  return runTransaction(firestore, async (tx) => {
    const publicSnap = await tx.get(publicRef);
    if (!publicSnap.exists()) {
      return { status: "absent" as const };
    }
    const data = publicSnap.data() as Record<string, unknown>;

    // Locate this sequence's claim from the stored hash pair. Legacy documents
    // (no contentHash) predate claims — nothing to release.
    let claimRef: ReturnType<typeof doc> | null = null;
    const hash = data["contentHash"];
    const version = data["contentHashVersion"];
    if (typeof hash === "string" && typeof version === "number") {
      const candidateRef = doc(
        firestore,
        PUBLIC_SEQUENCE_HASH_COLLECTION,
        publicSequenceClaimId(version, hash)
      );
      const claimSnap = await tx.get(candidateRef);
      if (
        claimSnap.exists() &&
        (claimSnap.data() as PublicSequenceHashClaim).sequenceId === sequenceId
      ) {
        claimRef = candidateRef;
      }
    }

    // Owner stamps: cleared when the owner document still exists. It may not
    // (delete flows remove the owner first) — that is fine, not an error.
    let ownerRef: ReturnType<typeof doc> | null = null;
    const ownerId = data["ownerId"];
    if (typeof ownerId === "string" && ownerId.length > 0) {
      const candidateRef = doc(
        firestore,
        getUserSequencePath(ownerId, sequenceId)
      );
      const ownerSnap = await tx.get(candidateRef);
      if (ownerSnap.exists()) {
        ownerRef = candidateRef;
      }
    }

    // --- writes -------------------------------------------------------------
    tx.delete(publicRef);
    if (claimRef) tx.delete(claimRef);
    if (ownerRef) {
      tx.update(ownerRef, {
        publicProjectionRevision: deleteField(),
        publicProjectionSchemaVersion: deleteField(),
        publicProjectionDigest: deleteField(),
      });
    }

    return { status: "unpublished" as const };
  });
}

// ---------------------------------------------------------------------------
// Thumbnails (narrow patch)
// ---------------------------------------------------------------------------

export type UpdatePublicThumbnailsResult =
  | { readonly status: "updated" }
  | { readonly status: "absent" };

/**
 * Patch a completed background thumbnail without replaying a full sequence
 * snapshot that may already be stale (spec section 6). For a schema-2 document
 * the projection digest and revision are restamped from the PATCHED stored
 * document (`computeStoredProjectionDigest`), and the owner document's stamp
 * copies move with them so owner/mirror parity holds. Legacy documents get the
 * plain patch — they have no stamps to maintain.
 *
 * Also self-heals a missing claim: a schema-2 document published before the
 * claim collection existed gains its claim here, so the phase 4 strict rules
 * cannot strand it.
 */
export async function updatePublicThumbnails(
  firestore: Firestore,
  sequenceId: string,
  thumbnails: readonly string[],
  thumbnailLimit = 3
): Promise<UpdatePublicThumbnailsResult> {
  const publicRef = doc(firestore, getPublicSequencePath(sequenceId));
  const publicThumbnails = thumbnails.slice(0, thumbnailLimit);

  return runTransaction(firestore, async (tx) => {
    const publicSnap = await tx.get(publicRef);
    if (!publicSnap.exists()) {
      return { status: "absent" as const };
    }
    const data = publicSnap.data() as Record<string, unknown>;
    const isSchemaTwo =
      data["publicProjectionSchemaVersion"] === PUBLIC_PROJECTION_SCHEMA_VERSION;

    if (!isSchemaTwo) {
      tx.update(publicRef, {
        thumbnails: publicThumbnails,
        updatedAt: serverTimestamp(),
      });
      return { status: "updated" as const };
    }

    // Claim self-heal read (before writes).
    let missingClaimRef: ReturnType<typeof doc> | null = null;
    const hash = data["contentHash"];
    const version = data["contentHashVersion"];
    if (typeof hash === "string" && typeof version === "number") {
      const candidateRef = doc(
        firestore,
        PUBLIC_SEQUENCE_HASH_COLLECTION,
        publicSequenceClaimId(version, hash)
      );
      const claimSnap = await tx.get(candidateRef);
      if (!claimSnap.exists()) {
        missingClaimRef = candidateRef;
      }
    }

    // Owner stamp parity read (before writes).
    let ownerRef: ReturnType<typeof doc> | null = null;
    const ownerId = data["ownerId"];
    if (typeof ownerId === "string" && ownerId.length > 0) {
      const candidateRef = doc(
        firestore,
        getUserSequencePath(ownerId, sequenceId)
      );
      const ownerSnap = await tx.get(candidateRef);
      if (ownerSnap.exists()) {
        ownerRef = candidateRef;
      }
    }

    const patched = { ...data, thumbnails: publicThumbnails };
    const digest = await computeStoredProjectionDigest(patched);
    const revision =
      digest === data["publicProjectionDigest"]
        ? ((data["publicProjectionRevision"] as number | undefined) ?? 1)
        : ((data["publicProjectionRevision"] as number | undefined) ?? 0) + 1;

    // --- writes -------------------------------------------------------------
    tx.update(publicRef, {
      thumbnails: publicThumbnails,
      updatedAt: serverTimestamp(),
      publicProjectionDigest: digest,
      publicProjectionRevision: revision,
    });
    if (missingClaimRef && typeof hash === "string" && typeof version === "number") {
      const claim: PublicSequenceHashClaim = {
        sequenceId,
        ownerId: String(data["ownerId"] ?? ""),
        contentHash: hash,
        contentHashVersion: version,
        createdAt: serverTimestamp(),
      };
      tx.set(missingClaimRef, claim as unknown as Record<string, unknown>);
    }
    if (ownerRef) {
      tx.update(ownerRef, {
        publicProjectionDigest: digest,
        publicProjectionRevision: revision,
      });
    }

    return { status: "updated" as const };
  });
}
