import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadString,
} from "firebase/storage";
import {
  getFirestoreInstance,
  getStorageInstance,
} from "$lib/shared/auth/firebase";
import { stripUndefined } from "$lib/shared/firestore/firestore-helpers";
import {
  ARTIFACT_PUBLICATION_SCHEMA_VERSION,
  publicationRequestId,
  type ArtifactPublicationRequest,
  type ArtifactPublicationStatus,
  type PublicArtifactEnvelope,
  type PublicArtifactRevisionRecord,
} from "$lib/shared/artifact-revisions/domain/public-artifact";
import {
  ARTIFACT_PUBLICATION_REQUESTS_COLLECTION,
  getArtifactPublicationRequestPath,
  getPublicArtifactPath,
  getPublicArtifactRevisionPath,
  publicArtifactPosterStoragePath,
} from "$lib/shared/artifact-revisions/data/artifact-publication-paths";
import { currentTunnelRevisionRef } from "../domain/tunnel-revision";
import {
  createTunnelPublicRevision,
  type TunnelPublicPayload,
} from "../domain/tunnel-public-revision";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";

/**
 * Owner-side tunnel publication, publish-first: "Share publicly" makes the
 * tunnel live in Explore immediately — ledger entry, immutable public
 * revision, and guest envelope land in one batch, whose shape firestore.rules
 * verifies field by field. Moderation is a retroactive takedown
 * (artifact-publication-review.ts), and content it removed can never be
 * republished as-is. Saving a tunnel never touches any of this.
 */

export interface PublicationOwner {
  readonly uid: string;
  readonly displayName: string;
}

export type PublishTunnelResult =
  | { readonly status: "published"; readonly revisionId: string }
  | { readonly status: "already-live"; readonly revisionId: string }
  /** This exact content was taken down by moderation — edit to republish. */
  | { readonly status: "removed"; readonly revisionId: string };

export interface TunnelPublicationStatus {
  /** The lifecycle of the artifact's CURRENT content, plus whether an older
   *  revision is still live publicly. */
  readonly state: ArtifactPublicationStatus | "unpublished";
  /** Live public revision id, when an envelope exists. */
  readonly liveRevisionId?: string;
  /** True when the live envelope shows an older revision than the tunnel's
   *  current content — "publish update" territory. */
  readonly liveIsStale?: boolean;
  /** Public revision id of the tunnel's current content. */
  readonly currentPublicRevisionId?: string;
}

async function uploadPublicPoster(
  owner: PublicationOwner,
  artifactId: string,
  publicRevisionId: string,
  posterDataUrl: string
): Promise<string> {
  const storage = await getStorageInstance();
  const path = publicArtifactPosterStoragePath(
    owner.uid,
    artifactId,
    publicRevisionId
  );
  const target = storageRef(storage, path);
  await uploadString(target, posterDataUrl, "data_url", {
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
  });
  return getDownloadURL(target);
}

/**
 * Publish the tunnel's current content — live immediately. Idempotent per
 * content: the ledger id is `{artifactId}_{publicRevisionId}`, so publishing
 * identical content converges on the existing entry (and relists it when it
 * was previously withdrawn).
 */
export async function publishTunnel(
  tunnel: CollectedTunnel,
  owner: PublicationOwner
): Promise<PublishTunnelResult> {
  const sourceRevision = currentTunnelRevisionRef(tunnel);
  if (!sourceRevision) {
    throw new Error("Tunnel has no current revision — save it before sharing");
  }

  const publicRevision = await createTunnelPublicRevision(tunnel);
  const requestId = publicationRequestId(tunnel.id, publicRevision.revisionId);
  const firestore = await getFirestoreInstance();
  const requestRef = doc(
    firestore,
    getArtifactPublicationRequestPath(requestId)
  );
  const envelopeRef = doc(firestore, getPublicArtifactPath(tunnel.id));
  const [existing, envelopeSnap] = await Promise.all([
    getDoc(requestRef),
    getDoc(envelopeRef),
  ]);

  const existingStatus = existing.exists()
    ? ((existing.data() as { status?: string }).status ?? "")
    : null;

  if (existingStatus === "removed") {
    // Moderation takedown is terminal for this exact content. A changed
    // tunnel produces a new revision id and therefore a fresh ledger entry.
    return { status: "removed", revisionId: publicRevision.revisionId };
  }

  const liveRevisionId = envelopeSnap.exists()
    ? ((envelopeSnap.data() as { currentRevisionId?: string })
        .currentRevisionId ?? undefined)
    : undefined;
  if (
    existingStatus === "published" &&
    liveRevisionId === publicRevision.revisionId
  ) {
    return { status: "already-live", revisionId: publicRevision.revisionId };
  }

  const existingPosterUrl = existing.exists()
    ? ((existing.data() as { posterUrl?: string }).posterUrl ?? undefined)
    : undefined;
  const posterUrl =
    existingPosterUrl ??
    (await uploadPublicPoster(
      owner,
      tunnel.id,
      publicRevision.revisionId,
      publicRevision.payload.poster
    ));

  const batch = writeBatch(firestore);

  if (existingStatus === "withdrawn") {
    // Relist: only status/requestedAt are mutable on the ledger entry.
    batch.update(requestRef, {
      status: "published",
      requestedAt: serverTimestamp(),
    });
  } else if (existingStatus === "published") {
    // A superseded ledger entry the owner is reverting to — already
    // `published`, so only the envelope needs to advance back to it.
  } else {
    const request: ArtifactPublicationRequest<TunnelPublicPayload> = {
      requestId,
      artifactId: tunnel.id,
      artifactType: "tunnel",
      ownerId: owner.uid,
      ownerDisplayName: owner.displayName,
      title: tunnel.name,
      revisionId: publicRevision.revisionId,
      contentDigest: publicRevision.contentDigest,
      digestAlgorithm: publicRevision.digestAlgorithm,
      digestVersion: publicRevision.digestVersion,
      payload: publicRevision.payload,
      posterUrl,
      sourceRevision,
      status: "published",
      requestedAt: serverTimestamp(),
      schemaVersion: ARTIFACT_PUBLICATION_SCHEMA_VERSION,
    };
    batch.set(requestRef, stripUndefined({ ...request }));

    const revisionRecord: PublicArtifactRevisionRecord<TunnelPublicPayload> = {
      artifactId: tunnel.id,
      revisionId: publicRevision.revisionId,
      contentDigest: publicRevision.contentDigest,
      digestAlgorithm: publicRevision.digestAlgorithm,
      digestVersion: publicRevision.digestVersion,
      artifactType: "tunnel",
      ownerId: owner.uid,
      payload: publicRevision.payload,
      createdAt: serverTimestamp(),
      schemaVersion: ARTIFACT_PUBLICATION_SCHEMA_VERSION,
    };
    batch.set(
      doc(
        firestore,
        getPublicArtifactRevisionPath(tunnel.id, publicRevision.revisionId)
      ),
      stripUndefined({ ...revisionRecord })
    );
  }

  const envelope: PublicArtifactEnvelope = {
    artifactId: tunnel.id,
    artifactType: "tunnel",
    ownerId: owner.uid,
    ownerDisplayName: owner.displayName,
    title: tunnel.name,
    ...(posterUrl !== undefined && { posterUrl }),
    currentRevisionId: publicRevision.revisionId,
    currentContentDigest: publicRevision.contentDigest,
    // First publish stamps publishedAt; later revisions preserve it (the
    // rules enforce equality on update).
    publishedAt: envelopeSnap.exists()
      ? (envelopeSnap.data() as { publishedAt?: unknown }).publishedAt
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
    schemaVersion: ARTIFACT_PUBLICATION_SCHEMA_VERSION,
  };
  batch.set(envelopeRef, stripUndefined({ ...envelope }));

  await batch.commit();
  return { status: "published", revisionId: publicRevision.revisionId };
}

async function loadOwnerRequests(
  firestore: Firestore,
  artifactId: string,
  ownerId: string
) {
  const snapshot = await getDocs(
    query(
      collection(firestore, ARTIFACT_PUBLICATION_REQUESTS_COLLECTION),
      where("artifactId", "==", artifactId),
      where("ownerId", "==", ownerId)
    )
  );
  return snapshot.docs;
}

/**
 * Withdraw the artifact from public view: delete the envelope (delisting the
 * guest projection and, through the rules cascade, guest revision reads) and
 * mark the live ledger entries withdrawn in the same batch.
 */
export async function withdrawTunnelPublication(
  artifactId: string,
  owner: PublicationOwner
): Promise<void> {
  const firestore = await getFirestoreInstance();
  const envelopeRef = doc(firestore, getPublicArtifactPath(artifactId));
  const envelope = await getDoc(envelopeRef);
  const requests = await loadOwnerRequests(firestore, artifactId, owner.uid);

  const batch = writeBatch(firestore);
  if (envelope.exists()) {
    batch.delete(envelopeRef);
  }
  for (const request of requests) {
    const status = (request.data() as { status?: string }).status;
    if (status === "published") {
      batch.update(request.ref, { status: "withdrawn" });
    }
  }
  await batch.commit();
}

/** Owner-facing lifecycle summary for one tunnel's publication controls. */
export async function getTunnelPublicationStatus(
  tunnel: CollectedTunnel,
  owner: PublicationOwner
): Promise<TunnelPublicationStatus> {
  const firestore = await getFirestoreInstance();
  const publicRevision = await createTunnelPublicRevision(tunnel);
  const envelopeRef = doc(firestore, getPublicArtifactPath(tunnel.id));
  const [envelope, requests] = await Promise.all([
    getDoc(envelopeRef),
    loadOwnerRequests(firestore, tunnel.id, owner.uid),
  ]);

  const liveRevisionId = envelope.exists()
    ? ((envelope.data() as { currentRevisionId?: string }).currentRevisionId ??
      undefined)
    : undefined;
  const current = requests.find(
    (request) =>
      (request.data() as { revisionId?: string }).revisionId ===
      publicRevision.revisionId
  );
  const currentStatus = current
    ? ((current.data() as { status?: string }).status as
        | ArtifactPublicationStatus
        | undefined)
    : undefined;

  return {
    // `state` describes the tunnel's CURRENT content. A live envelope showing
    // an older revision surfaces via liveRevisionId + liveIsStale instead.
    state: currentStatus ?? "unpublished",
    ...(liveRevisionId !== undefined && { liveRevisionId }),
    ...(liveRevisionId !== undefined && {
      liveIsStale: liveRevisionId !== publicRevision.revisionId,
    }),
    currentPublicRevisionId: publicRevision.revisionId,
  };
}
