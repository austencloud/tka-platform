/**
 * Server-Side Claim Operations
 *
 * Atomic, race-safe claim operations that prevent all client-side vulnerabilities.
 * These functions are the ONLY way to claim/unclaim feedback items.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { checkClaimStaleness, STALE_THRESHOLDS } from "./types";

const db = admin.firestore();

/**
 * Valid status transitions (mirrors feedback.config.js)
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["in-progress"],
  "in-progress": ["new", "in-review"],
  "in-review": ["in-progress", "completed"],
  completed: ["archived", "in-review"],
  archived: ["new"],
};

/**
 * WIP limits per status
 */
const WIP_LIMITS: Record<string, number> = {
  new: 0,
  "in-progress": 4,
  "in-review": 5,
  completed: 0,
};

/**
 * Add a tamper-proof journal entry
 * Uses Admin SDK so it bypasses client-side rules
 */
async function addJournalEntry(
  feedbackId: string,
  type: string,
  sessionId: string,
  message: string,
  data: Record<string, unknown> = {}
): Promise<string | null> {
  try {
    const journalRef = db
      .collection("feedback")
      .doc(feedbackId)
      .collection("journal")
      .doc();

    await journalRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type,
      sessionId,
      message,
      data,
    });

    return journalRef.id;
  } catch (error) {
    console.error(`Failed to write journal entry for ${feedbackId}:`, error);
    return null;
  }
}

/**
 * Claim a feedback item
 *
 * Atomic operation that:
 * 1. Validates the session
 * 2. Checks WIP limits
 * 3. Verifies the item is claimable
 * 4. Generates server-side claim token
 * 5. Updates in a transaction
 * 6. Logs to tamper-proof journal
 */
export const claimFeedback = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated to claim feedback"
    );
  }

  const { feedbackId, sessionId, isReclaim = false, force = false } = data;

  // Validate inputs
  if (!feedbackId || typeof feedbackId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "feedbackId is required"
    );
  }

  if (!sessionId || typeof sessionId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "sessionId is required"
    );
  }

  // Verify session exists and belongs to this user
  const sessionRef = db.collection("agentSessions").doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Session not found. Please register a session first."
    );
  }

  const sessionData = sessionDoc.data();
  if (sessionData?.userId !== context.auth.uid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Session does not belong to this user"
    );
  }

  // Check WIP limit (unless force flag is set)
  if (!isReclaim && !force) {
    const inProgressSnapshot = await db
      .collection("feedback")
      .where("status", "==", "in-progress")
      .get();

    // Count only items with active (non-stale) claims
    let activeClaimCount = 0;
    for (const doc of inProgressSnapshot.docs) {
      const feedbackData = doc.data();
      if (feedbackData.claimToken && feedbackData.claimedAt) {
        const staleness = checkClaimStaleness(
          feedbackData.claimedAt,
          feedbackData.lastActivity
        );
        if (!staleness.isStale) {
          activeClaimCount++;
        }
      }
    }

    const wipLimit = WIP_LIMITS["in-progress"];
    if (wipLimit > 0 && activeClaimCount >= wipLimit) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `WIP limit reached (${activeClaimCount}/${wipLimit} active claims). Use force=true to override.`
      );
    }
  }

  // Generate server-side claim token (this is the key to preventing race conditions)
  const claimToken = uuidv4();

  // Perform atomic claim in transaction
  const feedbackRef = db.collection("feedback").doc(feedbackId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const feedbackDoc = await transaction.get(feedbackRef);

      if (!feedbackDoc.exists) {
        throw new Error("Feedback item not found");
      }

      const feedbackData = feedbackDoc.data()!;

      // Check if claimable
      if (
        feedbackData.status === "in-progress" &&
        !isReclaim
      ) {
        const otherToken = feedbackData.claimToken?.substring(0, 8) || "unknown";
        throw new Error(`Already claimed by another agent [${otherToken}]`);
      }

      // Secondary check for recent claims (race condition protection)
      if (!isReclaim && feedbackData.claimToken && feedbackData.claimedAt) {
        const claimAge = feedbackData.claimedAt?.toMillis
          ? Date.now() - feedbackData.claimedAt.toMillis()
          : Infinity;

        if (claimAge < 5000) {
          const otherToken = feedbackData.claimToken.substring(0, 8);
          throw new Error(
            `Recently claimed by another agent [${otherToken}] (${Math.round(claimAge / 1000)}s ago)`
          );
        }
      }

      // For reclaims, verify staleness
      if (isReclaim && feedbackData.status === "in-progress") {
        const staleness = checkClaimStaleness(
          feedbackData.claimedAt,
          feedbackData.lastActivity
        );

        const hasExpiredRequest =
          feedbackData.claimRequestedAt &&
          Date.now() - feedbackData.claimRequestedAt.toMillis() >
            STALE_THRESHOLDS.REQUEST_WAIT_MS;

        if (!staleness.isStale && !hasExpiredRequest) {
          const otherToken = feedbackData.claimToken?.substring(0, 8) || "unknown";
          throw new Error(`Item is no longer stale (claimed by [${otherToken}])`);
        }
      }

      // Check status is claimable
      if (["completed", "archived"].includes(feedbackData.status)) {
        throw new Error("Item is no longer claimable");
      }

      // Perform the claim update
      const updateData = {
        status: "in-progress",
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        claimedBy: context.auth!.uid,
        claimToken: claimToken,
        claimSession: sessionId,
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        lastActivityType: "claimed",
        // Clear any pending claim request
        claimRequestedAt: admin.firestore.FieldValue.delete(),
        claimRequestedBy: admin.firestore.FieldValue.delete(),
        claimRequestReason: admin.firestore.FieldValue.delete(),
      };

      transaction.update(feedbackRef, updateData);

      // Update session's active claims
      transaction.update(sessionRef, {
        activeClaims: admin.firestore.FieldValue.arrayUnion(feedbackId),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        feedbackId,
        claimToken,
        title: feedbackData.title || "Untitled",
        type: feedbackData.type,
        priority: feedbackData.priority,
        isReclaim,
      };
    });

    // Log to tamper-proof journal (after transaction succeeds)
    await addJournalEntry(
      feedbackId,
      "claimed",
      sessionId,
      isReclaim ? "Reclaimed (was stale)" : "Claimed",
      {
        claimToken: claimToken.substring(0, 8),
        isReclaim,
        title: result.title,
        priority: result.priority,
      }
    );

    console.log(
      `Claim successful: ${feedbackId} by session ${sessionId} [${claimToken.substring(0, 8)}]`
    );

    return {
      success: true,
      feedbackId,
      claimToken,
      claimTokenShort: claimToken.substring(0, 8),
      message: isReclaim ? "Reclaimed successfully" : "Claimed successfully",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Already claimed") ||
      errorMessage.includes("no longer") ||
      errorMessage.includes("not found") ||
      errorMessage.includes("Recently claimed")
    ) {
      throw new functions.https.HttpsError("failed-precondition", errorMessage);
    }

    console.error(`Claim failed for ${feedbackId}:`, error);
    throw new functions.https.HttpsError("internal", "Failed to claim feedback");
  }
});

/**
 * Validate a heartbeat on a claimed item
 *
 * Verifies the caller owns the claim before updating activity.
 */
export const validateHeartbeat = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated"
      );
    }

    const { feedbackId, sessionId, message = "" } = data;

    if (!feedbackId || !sessionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "feedbackId and sessionId are required"
      );
    }

    const feedbackRef = db.collection("feedback").doc(feedbackId);
    const feedbackDoc = await feedbackRef.get();

    if (!feedbackDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Feedback not found");
    }

    const feedbackData = feedbackDoc.data()!;

    // Verify ownership
    if (feedbackData.claimSession !== sessionId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "This session does not own the claim on this item"
      );
    }

    if (feedbackData.claimedBy !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "This user does not own the claim on this item"
      );
    }

    // Update activity timestamps
    await feedbackRef.update({
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      lastActivityType: "heartbeat",
    });

    // Update session activity
    await db.collection("agentSessions").doc(sessionId).update({
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log to journal
    await addJournalEntry(feedbackId, "heartbeat", sessionId, message || "Heartbeat", {
      message,
    });

    return {
      success: true,
      message: "Heartbeat recorded",
    };
  }
);

/**
 * Unclaim a feedback item
 *
 * Releases the claim and updates status appropriately.
 */
export const unclaimFeedback = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated"
    );
  }

  const {
    feedbackId,
    sessionId,
    newStatus = "new",
    notes = "",
    emergency = false,
    emergencyReason = "",
    confirmEmergency = false,
  } = data;

  if (!feedbackId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "feedbackId is required"
    );
  }

  const feedbackRef = db.collection("feedback").doc(feedbackId);
  const feedbackDoc = await feedbackRef.get();

  if (!feedbackDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Feedback not found");
  }

  const feedbackData = feedbackDoc.data()!;

  // Normal unclaim: verify ownership
  if (!emergency) {
    if (!sessionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "sessionId is required for normal unclaim"
      );
    }

    if (feedbackData.claimSession !== sessionId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "This session does not own the claim"
      );
    }
  }

  // Emergency unclaim: requires confirmation and logs audit trail
  if (emergency) {
    if (!emergencyReason) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Emergency reason is required"
      );
    }

    if (!confirmEmergency) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Emergency unclaim requires confirmation. Set confirmEmergency=true."
      );
    }

    // Check cooldown
    const recentEmergency = await db
      .collection("emergencyActions")
      .where("performedBy", "==", context.auth.uid)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (!recentEmergency.empty) {
      const lastAction = recentEmergency.docs[0].data();
      const cooldownExpires =
        lastAction.timestamp.toMillis() + 60 * 60 * 1000;

      if (Date.now() < cooldownExpires) {
        const remainingMins = Math.ceil(
          (cooldownExpires - Date.now()) / 60000
        );
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Emergency cooldown active. Try again in ${remainingMins} minutes.`
        );
      }
    }

    // Log emergency action
    await db.collection("emergencyActions").add({
      actionType: "unclaim",
      feedbackId,
      performedBy: context.auth.uid,
      reason: emergencyReason,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      previousClaimant: feedbackData.claimedBy,
      previousClaimToken: feedbackData.claimToken,
      previousSession: feedbackData.claimSession,
    });
  }

  // Validate status transition
  const currentStatus = feedbackData.status;
  if (newStatus !== currentStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Invalid status transition: ${currentStatus} → ${newStatus}`
      );
    }
  }

  // Perform unclaim
  const updateData: Record<string, unknown> = {
    status: newStatus,
    claimToken: admin.firestore.FieldValue.delete(),
    claimedAt: admin.firestore.FieldValue.delete(),
    claimedBy: admin.firestore.FieldValue.delete(),
    claimSession: admin.firestore.FieldValue.delete(),
    lastActivity: admin.firestore.FieldValue.delete(),
    lastActivityType: admin.firestore.FieldValue.delete(),
  };

  if (notes) {
    updateData.adminNotes = feedbackData.adminNotes
      ? `${feedbackData.adminNotes}\n\n---\n\n${notes}`
      : notes;
  }

  await feedbackRef.update(updateData);

  // Update session's active claims if we have a session
  if (feedbackData.claimSession) {
    try {
      await db
        .collection("agentSessions")
        .doc(feedbackData.claimSession)
        .update({
          activeClaims: admin.firestore.FieldValue.arrayRemove(feedbackId),
        });
    } catch {
      // Session may have been deleted, that's OK
    }
  }

  // Clean up active file edits for this feedback
  const fileEdits = await db
    .collection("activeFileEdits")
    .where("feedbackId", "==", feedbackId)
    .get();

  for (const edit of fileEdits.docs) {
    await edit.ref.delete();
  }

  // Log to journal
  await addJournalEntry(
    feedbackId,
    emergency ? "claim_stolen" : "unclaimed",
    sessionId || "system",
    emergency ? `Emergency unclaim: ${emergencyReason}` : notes || "Unclaimed",
    {
      newStatus,
      emergency,
      emergencyReason: emergency ? emergencyReason : undefined,
    }
  );

  console.log(
    `Unclaim successful: ${feedbackId} (emergency: ${emergency})`
  );

  return {
    success: true,
    message: emergency ? "Emergency unclaim completed" : "Unclaimed successfully",
    newStatus,
  };
});

/**
 * Update feedback status with proper validation
 */
export const updateFeedbackStatus = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated"
      );
    }

    const { feedbackId, sessionId, newStatus, notes = "" } = data;

    if (!feedbackId || !newStatus) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "feedbackId and newStatus are required"
      );
    }

    const feedbackRef = db.collection("feedback").doc(feedbackId);
    const feedbackDoc = await feedbackRef.get();

    if (!feedbackDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Feedback not found");
    }

    const feedbackData = feedbackDoc.data()!;
    const currentStatus = feedbackData.status;

    // Validate transition
    if (newStatus !== currentStatus) {
      const allowed = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(newStatus)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(", ")}`
        );
      }
    }

    // If moving to in-progress, must have a claim
    if (newStatus === "in-progress" && !feedbackData.claimToken) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot move to in-progress without an active claim"
      );
    }

    // If claimed, verify session owns the claim (unless admin)
    if (feedbackData.claimSession && sessionId) {
      if (feedbackData.claimSession !== sessionId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "This session does not own the claim"
        );
      }
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // If moving away from in-progress, clear claim data
    if (
      currentStatus === "in-progress" &&
      ["new", "in-review", "completed"].includes(newStatus)
    ) {
      updateData.claimToken = admin.firestore.FieldValue.delete();
      updateData.claimedAt = admin.firestore.FieldValue.delete();
      updateData.claimedBy = admin.firestore.FieldValue.delete();
      updateData.claimSession = admin.firestore.FieldValue.delete();
      updateData.lastActivity = admin.firestore.FieldValue.delete();
      updateData.lastActivityType = admin.firestore.FieldValue.delete();
    }

    if (notes) {
      updateData.adminNotes = feedbackData.adminNotes
        ? `${feedbackData.adminNotes}\n\n---\n\n${notes}`
        : notes;
    }

    await feedbackRef.update(updateData);

    // Log to journal
    await addJournalEntry(
      feedbackId,
      "status_change",
      sessionId || context.auth.uid,
      `Status changed: ${currentStatus} → ${newStatus}`,
      {
        fromStatus: currentStatus,
        toStatus: newStatus,
        notes,
      }
    );

    return {
      success: true,
      message: `Status updated to ${newStatus}`,
      previousStatus: currentStatus,
      newStatus,
    };
  }
);
