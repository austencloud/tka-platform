import {
  getArtifactPublicationSummary,
  publishArtifact,
  withdrawArtifactPublication,
  type ArtifactPublicationSummary,
  type PublicationOwner,
  type PublishArtifactResult,
} from "$lib/shared/artifact-revisions/services/artifact-publication-service";
import { currentTunnelRevisionRef } from "../domain/tunnel-revision";
import {
  createTunnelPublicRevision,
  type TunnelPublicPayload,
} from "../domain/tunnel-public-revision";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";

/**
 * The tunnel adapter for the shared publication boundary. Everything about the
 * four-resource publish batch, idempotency, and withdrawal lives in
 * `shared/artifact-revisions/services/artifact-publication-service.ts`; this
 * file supplies only what is tunnel-specific — the private revision that
 * provides provenance, the sanitized public payload, and the poster, which for
 * a tunnel is already stored inline on the saved work.
 */

export type {
  PublicationOwner,
  PublishArtifactResult as PublishTunnelResult,
};
export type TunnelPublicationStatus = ArtifactPublicationSummary;

export async function publishTunnel(
  tunnel: CollectedTunnel,
  owner: PublicationOwner
): Promise<PublishArtifactResult> {
  const sourceRevision = currentTunnelRevisionRef(tunnel);
  if (!sourceRevision) {
    throw new Error("Tunnel has no current revision — save it before sharing");
  }
  const publicRevision = await createTunnelPublicRevision(tunnel);
  return publishArtifact<TunnelPublicPayload>(
    {
      artifactId: tunnel.id,
      artifactType: "tunnel",
      title: tunnel.name,
      sourceRevision,
      publicRevision,
      posterDataUrl: () => publicRevision.payload.poster,
    },
    owner
  );
}

export function withdrawTunnelPublication(
  artifactId: string,
  owner: PublicationOwner
): Promise<void> {
  return withdrawArtifactPublication(artifactId, owner);
}

/** Owner-facing lifecycle summary for one tunnel's publication controls. */
export async function getTunnelPublicationStatus(
  tunnel: CollectedTunnel,
  owner: PublicationOwner
): Promise<TunnelPublicationStatus> {
  const publicRevision = await createTunnelPublicRevision(tunnel);
  return getArtifactPublicationSummary(
    tunnel.id,
    publicRevision.revisionId,
    owner
  );
}
