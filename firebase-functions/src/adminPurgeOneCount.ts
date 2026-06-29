import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

/** Sequences with this many motion steps or fewer are "one-count" junk. */
const ONE_COUNT_MAX = 1;

/**
 * Mirror of firestore.rules isAdmin(): the caller's user doc must have
 * role === "admin" or isAdmin === true. The Admin SDK bypasses rules, so this
 * gate is enforced in code.
 */
async function assertAdmin(
  context: functions.https.CallableContext
): Promise<string> {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  const snap = await db.doc(`users/${uid}`).get();
  const data = snap.data() ?? {};
  const isAdmin = data.role === "admin" || data.isAdmin === true;
  if (!isAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }
  return uid;
}

/** Persisted step count: stepPairings is the source of truth; steps is never persisted. */
function stepCount(data: FirebaseFirestore.DocumentData): number {
  if (Array.isArray(data.stepPairings)) return data.stepPairings.length;
  if (typeof data.sequenceLength === "number") return data.sequenceLength;
  return 0;
}

async function decrementSequenceCount(ownerId: string, by: number): Promise<void> {
  if (!ownerId || by <= 0) return;
  const userRef = db.doc(`users/${ownerId}`);
  await db.runTransaction(async (tx) => {
    const u = await tx.get(userRef);
    const current = (u.data()?.sequenceCount as number) ?? 0;
    tx.set(userRef, { sequenceCount: Math.max(0, current - by) }, { merge: true });
  });
}

interface PurgeResult {
  scanned: number;
  candidates: number;
  deleted: number;
  publicRemoved: number;
  sample: Array<{ id: string; ownerId: string; word: string }>;
}

/**
 * Purge all one-count sequences across every user.
 * Defaults to a dry run; pass { dryRun: false } to actually delete.
 */
export const purgeOneCountSequences = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (data, context): Promise<PurgeResult> => {
    await assertAdmin(context);
    const dryRun = data?.dryRun !== false; // anything but explicit false = dry run

    const snap = await db.collectionGroup("sequences").get();
    const result: PurgeResult = {
      scanned: snap.size,
      candidates: 0,
      deleted: 0,
      publicRemoved: 0,
      sample: [],
    };

    const candidates: Array<{
      ref: FirebaseFirestore.DocumentReference;
      id: string;
      ownerId: string;
      word: string;
    }> = [];

    for (const doc of snap.docs) {
      // Only operate on real user libraries: users/{uid}/sequences/{id}.
      // collectionGroup matches every "sequences" subcollection (e.g. deck
      // catalogs), so guard on the grandparent collection being "users".
      const userDoc = doc.ref.parent.parent;
      if (!userDoc || userDoc.parent.id !== "users") continue;
      const d = doc.data();
      if (stepCount(d) <= ONE_COUNT_MAX) {
        const ownerId = userDoc.id;
        const word = (d.word as string) || (d.name as string) || "";
        candidates.push({ ref: doc.ref, id: doc.id, ownerId, word });
      }
    }

    result.candidates = candidates.length;
    result.sample = candidates
      .slice(0, 25)
      .map((c) => ({ id: c.id, ownerId: c.ownerId, word: c.word }));

    if (dryRun) {
      functions.logger.info(
        `[purgeOneCount] DRY RUN scanned=${result.scanned} candidates=${result.candidates}`
      );
      return result;
    }

    const ownerDecrements = new Map<string, number>();
    let batch = db.batch();
    let ops = 0;

    for (const c of candidates) {
      batch.delete(c.ref);
      ops++;
      result.deleted++;

      const publicRef = db.doc(`publicSequences/${c.id}`);
      const publicSnap = await publicRef.get();
      if (publicSnap.exists) {
        batch.delete(publicRef);
        ops++;
        result.publicRemoved++;
      }

      ownerDecrements.set(c.ownerId, (ownerDecrements.get(c.ownerId) ?? 0) + 1);

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    for (const [ownerId, count] of ownerDecrements) {
      await decrementSequenceCount(ownerId, count);
    }

    functions.logger.info(
      `[purgeOneCount] EXECUTED scanned=${result.scanned} deleted=${result.deleted} publicRemoved=${result.publicRemoved}`
    );
    return result;
  });

/** Admin-only single delete of any user's sequence (for the gallery right-click). */
export const adminDeleteSequence = functions.https.onCall(
  async (data, context): Promise<{ deleted: boolean; publicRemoved: boolean }> => {
    await assertAdmin(context);
    const ownerId = data?.ownerId;
    const sequenceId = data?.sequenceId;
    if (
      typeof ownerId !== "string" ||
      typeof sequenceId !== "string" ||
      !ownerId ||
      !sequenceId
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ownerId and sequenceId are required."
      );
    }

    // Remove the public mirror first so a failure can't leave it orphaned in
    // the community gallery (the user doc is the fallback source of truth).
    let publicRemoved = false;
    const publicRef = db.doc(`publicSequences/${sequenceId}`);
    const publicSnap = await publicRef.get();
    if (publicSnap.exists) {
      await publicRef.delete();
      publicRemoved = true;
    }

    const userSeqRef = db.doc(`users/${ownerId}/sequences/${sequenceId}`);
    const userSnap = await userSeqRef.get();
    const deleted = userSnap.exists;
    if (deleted) {
      await userSeqRef.delete();
      await decrementSequenceCount(ownerId, 1);
    }

    return { deleted, publicRemoved };
  }
);
