import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";

type VideoDocument = Readonly<Record<string, unknown>>;

function publicSequenceIds(data: VideoDocument | undefined): string[] {
  if (data?.visibility !== "public") return [];
  const ids = new Set<string>();
  if (typeof data.sequenceId === "string" && data.sequenceId.length > 0) {
    ids.add(data.sequenceId);
  }
  if (Array.isArray(data.associations)) {
    for (const value of data.associations) {
      if (!value || typeof value !== "object") continue;
      const association = value as Record<string, unknown>;
      if (
        association.subjectType === "sequence" &&
        association.relationship === "performance" &&
        typeof association.subjectId === "string" &&
        association.subjectId.length > 0
      ) {
        ids.add(association.subjectId);
      }
    }
  }
  return [...ids];
}

/**
 * Every sequence whose public-video projection may have changed. Keeping this
 * pure makes the visibility boundary directly testable: restricted videos
 * never nominate a public sequence for reconciliation.
 */
export function _affectedPublicSequenceIds(
  before: VideoDocument | undefined,
  after: VideoDocument | undefined
): string[] {
  return Array.from(
    new Set([...publicSequenceIds(before), ...publicSequenceIds(after)])
  );
}

/**
 * Rebuild the public performance metadata from authoritative public video
 * documents. Legacy and typed-association queries run in the same transaction
 * snapshot and are de-duplicated by video id, so
 * duplicate event delivery and overlapping writes converge without counters
 * drifting. A missing public projection is intentionally a no-op; its create
 * trigger will reconcile when the sequence is published later.
 */
export async function _reconcilePublicPerformanceMetadata(
  sequenceId: string,
  db: FirebaseFirestore.Firestore = admin.firestore()
): Promise<boolean> {
  const publicSequenceRef = db.doc(`publicSequences/${sequenceId}`);
  const videos = db.collection("videos");
  const legacyPublicVideos = videos
    .where("sequenceId", "==", sequenceId)
    .where("visibility", "==", "public");
  const associatedPublicVideos = videos
    .where("associationKeys", "array-contains", `sequence:${sequenceId}`)
    .where("visibility", "==", "public");

  return db.runTransaction(async (transaction) => {
    const publicSequence = await transaction.get(publicSequenceRef);
    if (!publicSequence.exists) return false;

    const [legacySnapshot, associatedSnapshot] = await Promise.all([
      transaction.get(legacyPublicVideos),
      transaction.get(associatedPublicVideos),
    ]);
    const videosById = new Map<
      string,
      FirebaseFirestore.QueryDocumentSnapshot
    >();
    for (const video of [...legacySnapshot.docs, ...associatedSnapshot.docs]) {
      videosById.set(video.id, video);
    }
    const publicVideos = [...videosById.values()];
    const latest = publicVideos.sort((left, right) => {
      const leftMillis = left.data().createdAt?.toMillis?.() ?? 0;
      const rightMillis = right.data().createdAt?.toMillis?.() ?? 0;
      return rightMillis - leftMillis;
    })[0];
    const latestCreatedAt = latest?.data().createdAt;

    transaction.update(publicSequenceRef, {
      publicPerformanceCount: publicVideos.length,
      latestPublicPerformanceAt:
        latestCreatedAt ?? admin.firestore.FieldValue.delete(),
    });
    return true;
  });
}

export const syncPublicPerformanceMetadataOnVideoWrite = onDocumentWritten(
  { document: "videos/{videoId}", retry: true },
  async (event) => {
    const before = event.data?.before.exists
      ? event.data.before.data()
      : undefined;
    const after = event.data?.after.exists
      ? event.data.after.data()
      : undefined;
    const sequenceIds = _affectedPublicSequenceIds(before, after);

    await Promise.all(
      sequenceIds.map((sequenceId) =>
        _reconcilePublicPerformanceMetadata(sequenceId)
      )
    );
  }
);

/** Handles performances uploaded before their sequence was made public. */
export const syncPublicPerformanceMetadataOnSequencePublish = onDocumentCreated(
  { document: "publicSequences/{sequenceId}", retry: true },
  (event) => _reconcilePublicPerformanceMetadata(event.params.sequenceId)
);
