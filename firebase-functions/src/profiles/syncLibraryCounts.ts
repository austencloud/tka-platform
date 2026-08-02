import * as admin from "firebase-admin";
import { createHash } from "node:crypto";
import {
  onDocumentCreated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";

type CountKind = "sequences" | "collections";
type IncrementFactory = (delta: number) => unknown;

const LIBRARY_COUNT_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

interface CountEvent {
  userId: string;
  kind: CountKind;
  delta: 1 | -1;
  eventId: string;
  eventTime: Date;
  counted: boolean;
}

function timestampMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  return Number.NaN;
}

/**
 * Applies one Firestore delivery at most once. Events at or before the latest
 * aggregation cutoff are already represented by that aggregate and are only
 * ledgered, never incremented again.
 */
export async function _applyLibraryCountEvent(
  event: CountEvent,
  db: FirebaseFirestore.Firestore = admin.firestore(),
  increment: IncrementFactory = (delta) =>
    admin.firestore.FieldValue.increment(delta)
): Promise<boolean> {
  if (!event.counted) return false;

  const profileRef = db.doc(`users/${event.userId}`);
  const stateRef = db.doc(`users/${event.userId}/system/libraryCounts`);
  const ledgerId = createHash("sha256")
    .update(`${event.kind}:${event.delta}:${event.eventId}`)
    .digest("base64url");
  const ledgerRef = db.doc(
    `users/${event.userId}/libraryCountEvents/${ledgerId}`
  );

  return db.runTransaction(async (transaction) => {
    const [profile, state, ledger] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(stateRef),
      transaction.get(ledgerRef),
    ]);

    // Reading the parent in this transaction makes account deletion race-safe:
    // neither the counter nor its ledger can recreate a deleted profile.
    if (!profile.exists) return false;

    const stateData = state.data() ?? {};
    const needsReconciliation = stateData.ready !== true;
    if (ledger.exists) return needsReconciliation;
    const cutoffMillis = timestampMillis(stateData.cutoff);
    const applyDelta =
      stateData.ready === true && event.eventTime.getTime() > cutoffMillis;

    if (applyDelta) {
      transaction.update(profileRef, {
        [event.kind === "sequences" ? "sequenceCount" : "collectionCount"]:
          increment(event.delta),
      });
    }
    const processedAt = admin.firestore.Timestamp.now();
    transaction.create(ledgerRef, {
      kind: event.kind,
      delta: event.delta,
      eventTime: event.eventTime.toISOString(),
      applied: applyDelta,
      processedAt,
      expiresAt: admin.firestore.Timestamp.fromMillis(
        processedAt.toMillis() + LIBRARY_COUNT_EVENT_RETENTION_MS
      ),
    });
    return needsReconciliation;
  });
}

/**
 * Establishes an exact baseline when a profile appears after guest library
 * documents. Aggregate queries avoid loading document payloads. Their shared
 * transaction read time is the cutoff used to classify delayed event delivery.
 */
export async function _reconcileLibraryCountsOnProfileCreate(
  userId: string,
  db: FirebaseFirestore.Firestore = admin.firestore()
): Promise<void> {
  const profileRef = db.doc(`users/${userId}`);
  const stateRef = db.doc(`users/${userId}/system/libraryCounts`);
  const sequences = db.collection(`users/${userId}/sequences`);
  const collections = db.collection(`users/${userId}/collections`);

  await db.runTransaction(async (transaction) => {
    const [profile, state] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(stateRef),
    ]);
    if (!profile.exists || state.data()?.ready === true) return;

    const [sequenceCount, collectionCount, typedSystemCount, nullSystemCount] =
      await Promise.all([
        transaction.get(sequences.count()),
        transaction.get(collections.count()),
        transaction.get(
          collections
            .where("systemType", "in", ["favorites", "founding"])
            .count()
        ),
        transaction.get(collections.where("systemType", "==", null).count()),
      ]);

    const totalCollections = collectionCount.data().count;
    const excludedCollections =
      typedSystemCount.data().count + nullSystemCount.data().count;
    const cutoff = sequenceCount.readTime;

    transaction.update(profileRef, {
      sequenceCount: sequenceCount.data().count,
      collectionCount: Math.max(0, totalCollections - excludedCollections),
    });
    transaction.set(
      stateRef,
      { ready: true, cutoff, reconciledAt: cutoff },
      { merge: true }
    );
  });
}

export async function _handleLibraryCountEvent(
  event: CountEvent,
  db: FirebaseFirestore.Firestore = admin.firestore()
): Promise<void> {
  const needsReconciliation = await _applyLibraryCountEvent(event, db);
  if (needsReconciliation) {
    await _reconcileLibraryCountsOnProfileCreate(event.userId, db);
  }
}

const sequencePath = "users/{userId}/sequences/{sequenceId}";
const collectionPath = "users/{userId}/collections/{collectionId}";
const profilePath = "users/{userId}";

export const syncLibraryCountsOnProfileCreate = onDocumentCreated(
  { document: profilePath, retry: true },
  (event) => _reconcileLibraryCountsOnProfileCreate(event.params.userId)
);

export const syncSequenceCountOnCreate = onDocumentCreated(
  { document: sequencePath, retry: true },
  (event) =>
    _handleLibraryCountEvent({
      userId: event.params.userId,
      kind: "sequences",
      delta: 1,
      eventId: event.id,
      eventTime: new Date(event.time),
      counted: true,
    })
);
export const syncSequenceCountOnDelete = onDocumentDeleted(
  { document: sequencePath, retry: true },
  (event) =>
    _handleLibraryCountEvent({
      userId: event.params.userId,
      kind: "sequences",
      delta: -1,
      eventId: event.id,
      eventTime: new Date(event.time),
      counted: true,
    })
);
export const syncCollectionCountOnCreate = onDocumentCreated(
  { document: collectionPath, retry: true },
  (event) =>
    _handleLibraryCountEvent({
      userId: event.params.userId,
      kind: "collections",
      delta: 1,
      eventId: event.id,
      eventTime: new Date(event.time),
      counted: !Object.prototype.hasOwnProperty.call(
        event.data?.data() ?? {},
        "systemType"
      ),
    })
);
export const syncCollectionCountOnDelete = onDocumentDeleted(
  { document: collectionPath, retry: true },
  (event) =>
    _handleLibraryCountEvent({
      userId: event.params.userId,
      kind: "collections",
      delta: -1,
      eventId: event.id,
      eventTime: new Date(event.time),
      counted: !Object.prototype.hasOwnProperty.call(
        event.data?.data() ?? {},
        "systemType"
      ),
    })
);
