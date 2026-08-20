import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";

type VideoDocument = Readonly<Record<string, unknown>>;

function publicSequenceId(data: VideoDocument | undefined): string | null {
  if (data?.visibility !== "public") return null;
  const sequenceId = data.sequenceId;
  return typeof sequenceId === "string" && sequenceId.length > 0
    ? sequenceId
    : null;
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
    new Set([publicSequenceId(before), publicSequenceId(after)].filter(Boolean))
  ) as string[];
}

/**
 * Rebuild the public performance metadata from authoritative public video
 * documents. Aggregate/query reads run in the same transaction snapshot, so
 * duplicate event delivery and overlapping writes converge without counters
 * drifting. A missing public projection is intentionally a no-op; its create
 * trigger will reconcile when the sequence is published later.
 */
export async function _reconcilePublicPerformanceMetadata(
  sequenceId: string,
  db: FirebaseFirestore.Firestore = admin.firestore()
): Promise<boolean> {
  const publicSequenceRef = db.doc(`publicSequences/${sequenceId}`);
  const publicVideos = db
    .collection("videos")
    .where("sequenceId", "==", sequenceId)
    .where("visibility", "==", "public");

  return db.runTransaction(async (transaction) => {
    const publicSequence = await transaction.get(publicSequenceRef);
    if (!publicSequence.exists) return false;

    const [countSnapshot, latestSnapshot] = await Promise.all([
      transaction.get(publicVideos.count()),
      transaction.get(publicVideos.orderBy("createdAt", "desc").limit(1)),
    ]);
    const latestCreatedAt = latestSnapshot.docs[0]?.data().createdAt;

    transaction.update(publicSequenceRef, {
      publicPerformanceCount: countSnapshot.data().count,
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
