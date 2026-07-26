/**
 * Follow-count maintenance and new-follower notification Cloud Functions.
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
 * The create trigger also writes the followed user's "user-followed"
 * notification. That write has to happen server-side for the same reason the
 * counters do: firestore.rules denies a non-admin writing into another user's
 * notifications subcollection, so a client-side attempt is silently swallowed
 * (the same bug that swallowed every Pulse signup alert — see
 * pulse/notifyAdmins.ts). The Admin SDK bypasses rules, and the existing
 * onNewNotification trigger picks the doc up and delivers FCM push.
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

/**
 * Write the followed user's inbox notification. onNewNotification turns this
 * into a push (respecting the user's `userFollowed` preference and the
 * pushEnabled master toggle — this function must NOT check those itself, or
 * the inbox entry would go missing for someone who only muted push).
 *
 * The doc id is deterministic (`follow-<followerUserId>`) rather than random,
 * so an unfollow/refollow cycle overwrites one entry instead of stacking a new
 * alert every time. Overwriting an existing doc is an update, not a create, so
 * it also can't re-fire the push trigger — a follow toggled repeatedly buzzes
 * the target's phone exactly once.
 */
async function notifyOfNewFollower(
  targetUserId: string,
  followerUserId: string
): Promise<void> {
  const followerSnap = await db.collection("users").doc(followerUserId).get();
  const followerData = followerSnap.data();
  const followerName =
    (followerData?.displayName as string | undefined) ||
    (followerData?.name as string | undefined) ||
    "Someone";

  await db
    .collection("users")
    .doc(targetUserId)
    .collection("notifications")
    .doc(`follow-${followerUserId}`)
    .set({
      userId: targetUserId,
      type: "user-followed",
      message: `${followerName} started following you`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      fromUserId: followerUserId,
      fromUserName: followerName,
    });
}

export const onFollowCreated = onDocumentCreated(FOLLOW_PATH, async (event) => {
  const { userId, followerUserId } = event.params;
  await applyFollowDelta(userId, followerUserId, 1);

  if (userId === followerUserId) {
    return;
  }

  // A failed notification must not fail the function: retrying would re-run
  // applyFollowDelta and double-count the follower.
  try {
    await notifyOfNewFollower(userId, followerUserId);
  } catch (error) {
    console.error(
      `onFollowCreated: failed to notify ${userId} of follower ${followerUserId}`,
      error
    );
  }
});

export const onFollowDeleted = onDocumentDeleted(FOLLOW_PATH, async (event) => {
  const { userId, followerUserId } = event.params;
  await applyFollowDelta(userId, followerUserId, -1);
});
