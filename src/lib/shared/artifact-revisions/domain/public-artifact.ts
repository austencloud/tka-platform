import {
  ARTIFACT_REVISION_DIGEST_ALGORITHM,
  ARTIFACT_REVISION_DIGEST_VERSION,
  artifactRevisionId,
  isArtifactRevisionRef,
  type ArtifactRevisionRef,
} from "./artifact-revision";

/**
 * Shared publication domain for visual artifacts (tunnels first; mandalas and
 * scenes follow the same envelope). Publish-first model: sharing goes live
 * immediately, moderation is a retroactive takedown, never a gate. Four
 * resources, four authorities:
 *
 * 1. The private mutable work stays in the owner's collection — untouched here.
 * 2. `publicArtifacts/{artifactId}/revisions/{revisionId}` — immutable,
 *    content-addressed over the SANITIZED public payload (each artifact type
 *    owns its sanitizer). Created by the owner's publish batch, never edited.
 * 3. `artifactPublicationRequests/{artifactId}_{revisionId}` — the append-only
 *    publication ledger: who published what, when, and whether it was later
 *    withdrawn or taken down. Never deleted by clients.
 * 4. `publicArtifacts/{artifactId}` — the guest-readable envelope. It exists
 *    only while the artifact is live: publishing creates it, owner withdrawal
 *    or moderator takedown deletes it. Guest revision reads require the
 *    envelope, so delisting cascades without destroying history.
 */
export const ARTIFACT_PUBLICATION_SCHEMA_VERSION = 1;

export const PUBLIC_ARTIFACT_TYPES = ["tunnel", "mandala", "scene"] as const;
export type PublicArtifactType = (typeof PUBLIC_ARTIFACT_TYPES)[number];

export function isPublicArtifactType(
  value: unknown
): value is PublicArtifactType {
  return PUBLIC_ARTIFACT_TYPES.includes(value as PublicArtifactType);
}

/** The live-only guest projection. Owner-published, owner/admin-deleted. */
export interface PublicArtifactEnvelope {
  readonly artifactId: string;
  readonly artifactType: PublicArtifactType;
  readonly ownerId: string;
  readonly ownerDisplayName: string;
  readonly title: string;
  /** Storage-hosted discovery poster; the digest-covered inline poster lives
   *  in the revision payload and is only fetched on detail views. */
  readonly posterUrl?: string;
  readonly currentRevisionId: string;
  readonly currentContentDigest: string;
  /** Server timestamps — objects on read, sentinels on write. */
  readonly publishedAt: unknown;
  readonly updatedAt: unknown;
  readonly schemaVersion: number;
}

/** One immutable published payload under the envelope. Never edited. Carries
 *  ownerId so a delisted artifact's history stays owner-resolvable without
 *  traversing the (now absent) envelope. */
export interface PublicArtifactRevisionRecord<P = unknown>
  extends ArtifactRevisionRef {
  readonly artifactType: PublicArtifactType;
  readonly ownerId: string;
  readonly payload: P;
  readonly createdAt: unknown;
  readonly schemaVersion: number;
}

/**
 * - `published` — the owner made this revision public; the envelope shows it
 *   (or a newer revision has since superseded it).
 * - `withdrawn` — the owner delisted it; they may republish it any time.
 * - `removed` — moderation takedown. Terminal for this exact content: only
 *   changed content (a new revision id) can go public again.
 */
export type ArtifactPublicationStatus = "published" | "withdrawn" | "removed";

/**
 * The publication ledger entry, one document per (artifact, public revision)
 * pair so republishing identical content is idempotent and every revision
 * that was ever public keeps its audit record.
 */
export interface ArtifactPublicationRequest<P = unknown> {
  readonly requestId: string;
  readonly artifactId: string;
  readonly artifactType: PublicArtifactType;
  readonly ownerId: string;
  readonly ownerDisplayName: string;
  readonly title: string;
  /** Public revision identity — content-addressed over `payload`. */
  readonly revisionId: string;
  readonly contentDigest: string;
  readonly digestAlgorithm: typeof ARTIFACT_REVISION_DIGEST_ALGORITHM;
  readonly digestVersion: typeof ARTIFACT_REVISION_DIGEST_VERSION;
  /** The sanitized public payload, exactly as published. */
  readonly payload: P;
  readonly posterUrl?: string;
  /** Provenance: the exact PRIVATE revision this public payload was built
   *  from. Ledger-only — never copied into the guest projection. */
  readonly sourceRevision: ArtifactRevisionRef;
  readonly status: ArtifactPublicationStatus;
  readonly requestedAt: unknown;
  readonly reviewedAt?: unknown;
  readonly reviewedBy?: string;
  readonly reviewNote?: string;
  readonly schemaVersion: number;
}

export function publicationRequestId(
  artifactId: string,
  publicRevisionId: string
): string {
  if (!artifactId.trim() || !publicRevisionId.trim()) {
    throw new Error(
      "Publication request ids require an artifact id and a revision id"
    );
  }
  return `${artifactId}_${publicRevisionId}`;
}

/** Owner-side status moves: withdraw live content, republish withdrawn
 *  content. `removed` is terminal — takedowns cannot be self-reversed. */
const OWNER_TRANSITIONS: Readonly<
  Record<ArtifactPublicationStatus, readonly ArtifactPublicationStatus[]>
> = {
  published: ["withdrawn"],
  withdrawn: ["published"],
  removed: [],
};

/** Moderator-side status moves: take down published content. */
const REVIEWER_TRANSITIONS: Readonly<
  Record<ArtifactPublicationStatus, readonly ArtifactPublicationStatus[]>
> = {
  published: ["removed"],
  withdrawn: [],
  removed: [],
};

export function canOwnerTransition(
  from: ArtifactPublicationStatus,
  to: ArtifactPublicationStatus
): boolean {
  return OWNER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canReviewerTransition(
  from: ArtifactPublicationStatus,
  to: ArtifactPublicationStatus
): boolean {
  return REVIEWER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isPublicArtifactEnvelope(
  value: unknown
): value is PublicArtifactEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PublicArtifactEnvelope>;
  return (
    typeof candidate.artifactId === "string" &&
    candidate.artifactId.length > 0 &&
    isPublicArtifactType(candidate.artifactType) &&
    typeof candidate.ownerId === "string" &&
    candidate.ownerId.length > 0 &&
    typeof candidate.ownerDisplayName === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.currentContentDigest === "string" &&
    /^[a-f0-9]{64}$/.test(candidate.currentContentDigest) &&
    candidate.currentRevisionId ===
      artifactRevisionId(candidate.currentContentDigest) &&
    typeof candidate.schemaVersion === "number"
  );
}

export function isArtifactPublicationRequest(
  value: unknown
): value is ArtifactPublicationRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ArtifactPublicationRequest>;
  return (
    typeof candidate.requestId === "string" &&
    typeof candidate.artifactId === "string" &&
    candidate.artifactId.length > 0 &&
    isPublicArtifactType(candidate.artifactType) &&
    typeof candidate.ownerId === "string" &&
    candidate.ownerId.length > 0 &&
    typeof candidate.contentDigest === "string" &&
    /^[a-f0-9]{64}$/.test(candidate.contentDigest) &&
    candidate.revisionId === artifactRevisionId(candidate.contentDigest) &&
    candidate.requestId ===
      publicationRequestId(candidate.artifactId, candidate.revisionId) &&
    candidate.digestAlgorithm === ARTIFACT_REVISION_DIGEST_ALGORITHM &&
    candidate.digestVersion === ARTIFACT_REVISION_DIGEST_VERSION &&
    typeof candidate.status === "string" &&
    ["published", "withdrawn", "removed"].includes(candidate.status) &&
    isArtifactRevisionRef(candidate.sourceRevision) &&
    typeof candidate.schemaVersion === "number"
  );
}
