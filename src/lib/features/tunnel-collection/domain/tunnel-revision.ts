import { canonicalDigest } from "$lib/shared/foundation/utils/canonical-digest";
import {
  ARTIFACT_REVISION_DIGEST_ALGORITHM,
  ARTIFACT_REVISION_DIGEST_VERSION,
  createArtifactRevisionRef,
  type ArtifactRevisionRef,
} from "$lib/shared/artifact-revisions/domain/artifact-revision";
import type { CollectedTunnel } from "./tunnel-collection-types";

/** The exact tunnel state that a realization can truthfully depict. */
export interface TunnelRevisionPayload {
  readonly steps: CollectedTunnel["steps"];
  readonly snapshot: CollectedTunnel["snapshot"];
  readonly poster: string;
  readonly source?: CollectedTunnel["source"];
  readonly sourceWord?: string;
  readonly sourceSequenceId?: string;
  readonly composition?: CollectedTunnel["composition"];
}

export interface TunnelRevisionRecord extends ArtifactRevisionRef {
  readonly artifactType: "tunnel";
  readonly payload: TunnelRevisionPayload;
  readonly createdAt: number;
}

export function tunnelRevisionPayload(
  tunnel: Pick<
    CollectedTunnel,
    | "steps"
    | "snapshot"
    | "poster"
    | "source"
    | "sourceWord"
    | "sourceSequenceId"
    | "composition"
  >
): TunnelRevisionPayload {
  return {
    steps: tunnel.steps,
    snapshot: tunnel.snapshot,
    poster: tunnel.poster,
    ...(tunnel.source !== undefined && { source: tunnel.source }),
    ...(tunnel.sourceWord !== undefined && { sourceWord: tunnel.sourceWord }),
    ...(tunnel.sourceSequenceId !== undefined && {
      sourceSequenceId: tunnel.sourceSequenceId,
    }),
    ...(tunnel.composition !== undefined && {
      composition: tunnel.composition,
    }),
  };
}

export async function createTunnelRevision(
  tunnel: CollectedTunnel,
  createdAt: number
): Promise<TunnelRevisionRecord> {
  const payload = tunnelRevisionPayload(tunnel);
  const contentDigest = await canonicalDigest(payload);
  return {
    ...createArtifactRevisionRef(tunnel.id, contentDigest),
    artifactType: "tunnel",
    payload,
    createdAt,
  };
}

export async function prepareTunnelRevision(
  tunnel: CollectedTunnel,
  previous?: CollectedTunnel
): Promise<CollectedTunnel> {
  const payload = tunnelRevisionPayload(tunnel);
  const contentDigest = await canonicalDigest(payload);
  if (
    previous?.currentContentDigest === contentDigest &&
    previous.currentRevisionId
  ) {
    return {
      ...tunnel,
      currentRevisionId: previous.currentRevisionId,
      currentContentDigest: previous.currentContentDigest,
      currentRevisionCreatedAt:
        previous.currentRevisionCreatedAt ?? previous.createdAt,
      revisionDigestAlgorithm: ARTIFACT_REVISION_DIGEST_ALGORITHM,
      revisionDigestVersion: ARTIFACT_REVISION_DIGEST_VERSION,
    };
  }

  const ref = createArtifactRevisionRef(tunnel.id, contentDigest);
  return {
    ...tunnel,
    currentRevisionId: ref.revisionId,
    currentContentDigest: ref.contentDigest,
    currentRevisionCreatedAt: previous ? Date.now() : tunnel.createdAt,
    revisionDigestAlgorithm: ref.digestAlgorithm,
    revisionDigestVersion: ref.digestVersion,
  };
}

export function currentTunnelRevisionRef(
  tunnel: CollectedTunnel
): ArtifactRevisionRef | null {
  if (!tunnel.currentRevisionId || !tunnel.currentContentDigest) return null;
  return {
    artifactId: tunnel.id,
    revisionId: tunnel.currentRevisionId,
    contentDigest: tunnel.currentContentDigest,
    digestAlgorithm:
      tunnel.revisionDigestAlgorithm ?? ARTIFACT_REVISION_DIGEST_ALGORITHM,
    digestVersion:
      tunnel.revisionDigestVersion ?? ARTIFACT_REVISION_DIGEST_VERSION,
  };
}
