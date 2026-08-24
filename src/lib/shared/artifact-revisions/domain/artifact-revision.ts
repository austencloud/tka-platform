/**
 * Stable identity for one immutable artifact payload.
 *
 * `artifactId` names the conceptual work. `revisionId` names one exact payload
 * of that work, and is content-addressed so retrying the same save is
 * idempotent. Media stores this whole reference; it must never point only at a
 * mutable working document.
 */
export interface ArtifactRevisionRef {
  readonly artifactId: string;
  readonly revisionId: string;
  readonly contentDigest: string;
  readonly digestAlgorithm: typeof ARTIFACT_REVISION_DIGEST_ALGORITHM;
  readonly digestVersion: typeof ARTIFACT_REVISION_DIGEST_VERSION;
}

export const ARTIFACT_REVISION_DIGEST_ALGORITHM = "SHA-256" as const;
export const ARTIFACT_REVISION_DIGEST_VERSION = 1 as const;

/** A Firestore-safe, collision-resistant id derived from the full digest. */
export function artifactRevisionId(contentDigest: string): string {
  if (!/^[a-f0-9]{64}$/.test(contentDigest)) {
    throw new Error(
      "Artifact revision digests must be 64 lowercase hex characters"
    );
  }
  return `v${ARTIFACT_REVISION_DIGEST_VERSION}_${contentDigest}`;
}

export function createArtifactRevisionRef(
  artifactId: string,
  contentDigest: string
): ArtifactRevisionRef {
  if (!artifactId.trim()) {
    throw new Error("Artifact revision references require an artifact id");
  }
  return {
    artifactId,
    revisionId: artifactRevisionId(contentDigest),
    contentDigest,
    digestAlgorithm: ARTIFACT_REVISION_DIGEST_ALGORITHM,
    digestVersion: ARTIFACT_REVISION_DIGEST_VERSION,
  };
}

export function isArtifactRevisionRef(
  value: unknown
): value is ArtifactRevisionRef {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ArtifactRevisionRef>;
  return (
    typeof candidate.artifactId === "string" &&
    candidate.artifactId.length > 0 &&
    typeof candidate.contentDigest === "string" &&
    /^[a-f0-9]{64}$/.test(candidate.contentDigest) &&
    candidate.revisionId === artifactRevisionId(candidate.contentDigest) &&
    candidate.digestAlgorithm === ARTIFACT_REVISION_DIGEST_ALGORITHM &&
    candidate.digestVersion === ARTIFACT_REVISION_DIGEST_VERSION
  );
}
