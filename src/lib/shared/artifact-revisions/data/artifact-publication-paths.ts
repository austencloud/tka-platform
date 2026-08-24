/**
 * Firestore + Storage paths for the visual-artifact publication boundary.
 * Keep every consumer on these helpers — path drift between rules, services,
 * and tests is how projection bugs are born (see shared/library/data/
 * firestore-paths.ts for the sequence-side precedent).
 */

export const PUBLIC_ARTIFACTS_COLLECTION = "publicArtifacts";
export const ARTIFACT_PUBLICATION_REQUESTS_COLLECTION =
  "artifactPublicationRequests";

export function getPublicArtifactPath(artifactId: string): string {
  return `${PUBLIC_ARTIFACTS_COLLECTION}/${artifactId}`;
}

export function getPublicArtifactRevisionsPath(artifactId: string): string {
  return `${getPublicArtifactPath(artifactId)}/revisions`;
}

export function getPublicArtifactRevisionPath(
  artifactId: string,
  revisionId: string
): string {
  return `${getPublicArtifactRevisionsPath(artifactId)}/${revisionId}`;
}

export function getArtifactPublicationRequestPath(requestId: string): string {
  return `${ARTIFACT_PUBLICATION_REQUESTS_COLLECTION}/${requestId}`;
}

/** Storage object for the world-readable discovery poster (webp, ≤200KB). */
export function publicArtifactPosterStoragePath(
  ownerId: string,
  artifactId: string,
  publicRevisionId: string
): string {
  return `public-artifacts/${ownerId}/${artifactId}/${publicRevisionId}.webp`;
}
