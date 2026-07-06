/**
 * Follow-count maintenance Cloud Functions.
 *
 * Firestore rules forbid a client writing another user's `followerCount`
 * (see firestore.rules `users/{userId}` update: owner || admin). So the
 * denormalized social counters are owned by the server: a follow relationship
 * is a single doc at
 *
 *   users/{userId}/followers/{followerUserId}
 *
 * and these triggers keep BOTH counters in sync from that one source of truth:
 *   - create  →  {userId}.followerCount +1  AND  {followerUserId}.followingCount +1
 *   - delete  →  both -1
 *
 * The admin SDK bypasses security rules, and FieldValue.increment is atomic, so
 * this is race-safe against concurrent follows and cannot be manipulated by a
 * client (which can only create its own single followers doc per target).
 *
 * Trigger path: users/{userId}/followers/{followerUserId}
 */

import {
  onDocumentCreated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

const FOLLOW_PATH = "users/{userId}/followers/{followerUserId}";

async function applyFollowDelta(
  targetUserId: string,
  followerUserId: string,
  delta: 1 | -1
): Promise<void> {
  // Guard against a self-follow edge case producing a double-counted own doc.
  if (targetUserId === followerUserId) {
    return;
  }

  const increment = admin.firestore.FieldValue.increment(delta);
  const batch = db.batch();

  batch.set(
    db.collection("users").doc(targetUserId),
    { followerCount: increment },
    { merge: true }
  );
  batch.set(
    db.collection("users").doc(followerUserId),
    { followingCount: increment },
    { merge: true }
  );

  await batch.commit();
}

export const onFollowCreated = onDocumentCreated(FOLLOW_PATH, async (event) => {
  const { userId, followerUserId } = event.params;
  await applyFollowDelta(userId, followerUserId, 1);
});

export const onFollowDeleted = onDocumentDeleted(FOLLOW_PATH, async (event) => {
  const { userId, followerUserId } = event.params;
  await applyFollowDelta(userId, followerUserId, -1);
});
