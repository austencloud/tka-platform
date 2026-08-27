/**
 * Claim Service
 *
 * Core business logic for claiming, heartbeating, and unclaiming feedback.
 * This is the single source of truth - both HTTP and callable wrappers use this.
 */

import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { checkClaimStaleness, STALE_THRESHOLDS } from "../types";
import {
  ADMIN_USER_ID,
  VALID_TRANSITIONS,
  WIP_LIMITS,
  EMERGENCY_COOLDOWN_MS,
  getDb,
} from "./constants";
import { addJournalEntry } from "./journalService";


export interface ClaimParams {
  feedbackId: string;
  sessionId: string;
  userId: string;
  isReclaim?: boolean;
  force?: boolean;
  source?: "http-cli" | "callable";
}

export interface ClaimResult {
  success: boolean;
  feedbackId: string;
  claimToken?: string;
  claimTokenShort?: string;
  message: string;
  title?: string;
  type?: string;
  priority?: string;
}

export interface HeartbeatParams {
  feedbackId: string;
  sessionId: string;
  userId: string;
  message?: string;
  source?: "http-cli" | "callable";
}

export interface HeartbeatResult {
  success: boolean;
  message: string;
}

export interface UnclaimParams {
  feedbackId: string;
  sessionId?: string;
  userId: string;
  newStatus?: string;
  notes?: string;
  emergency?: boolean;
  emergencyReason?: string;
  confirmEmergency?: boolean;
  source?: "http-cli" | "callable";
}

export interface UnclaimResult {
  success: boolean;
  message: string;
  newStatus: string;
}

export interface StatusUpdateParams {
  feedbackId: string;
  sessionId?: string;
  userId: string;
  newStatus: string;
  adminNotes?: string;
  resolution?: string;
  source?: "http-cli" | "callable";
}

export interface StatusUpdateResult {
  success: boolean;
  message: string;
  previousStatus: string;
  newStatus: string;
}

export type ClaimError =
  | { type: "not-found"; message: string }
  | { type: "already-claimed"; message: string }
  | { type: "recently-claimed"; message: string }
  | { type: "not-stale"; message: string }
  | { type: "not-claimable"; message: string }
  | { type: "session-not-found"; message: string }
  | { type: "wip-limit"; message: string }
  | { type: "permission-denied"; message: string }
  | { type: "invalid-transition"; message: string }
  | { type: "emergency-cooldown"; message: string }
  | { type: "emergency-confirmation"; message: string }
  | { type: "internal"; message: string };


/**
 * Claim a feedback item
 *
 * Atomic operation with server-side token generation.
 */
export async function claimFeedback(
  params: ClaimParams
): Promise<ClaimResult | ClaimError> {
  const {
    feedbackId,
    sessionId,
    userId,
    isReclaim = false,
    force = false,
    source = "callable",
  } = params;

  const db = getDb();

  const sessionRef = db.collection("agentSessions").doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    return {
      type: "session-not-found",
      message: "Session not found. Please register a session first.",
    };
  }

  // For Firebase Auth users, verify session ownership
  // For service account calls (userId === ADMIN_USER_ID), trust the session
  const sessionData = sessionDoc.data();
  if (userId !== ADMIN_USER_ID && sessionData?.userId !== userId) {
    return {
      type: "permission-denied",
      message: "Session does not belong to this user",
    };
  }

  // Check WIP limit (unless force flag is set)
  if (!isReclaim && !force) {
    const inProgressSnapshot = await db
      .collection("feedback")
      .where("status", "==", "in-progress")
      .get();

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
      return {
        type: "wip-limit",
        message: `WIP limit reached (${activeClaimCount}/${wipLimit} active claims). Use force=true to override.`,
      };
    }
  }

  // Generate server-side claim token
  const claimToken = uuidv4();
  const feedbackRef = db.collection("feedback").doc(feedbackId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const feedbackDoc = await transaction.get(feedbackRef);

      if (!feedbackDoc.exists) {
        throw new Error("NOT_FOUND:Feedback item not found");
      }

      const feedbackData = feedbackDoc.data()!;

      // Check if claimable
      if (feedbackData.status === "in-progress" && !isReclaim) {
        const otherToken =
          feedbackData.claimToken?.substring(0, 8) || "unknown";
        throw new Error(
          `ALREADY_CLAIMED:Already claimed by another agent [${otherToken}]`
        );
      }

      // Secondary check for recent claims
      if (!isReclaim && feedbackData.claimToken && feedbackData.claimedAt) {
        const claimAge = feedbackData.claimedAt?.toMillis
          ? Date.now() - feedbackData.claimedAt.toMillis()
          : Infinity;

        if (claimAge < 5000) {
          const otherToken = feedbackData.claimToken.substring(0, 8);
          throw new Error(
            `RECENTLY_CLAIMED:Recently claimed by another agent [${otherToken}] (${Math.round(claimAge / 1000)}s ago)`
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
          const otherToken =
            feedbackData.claimToken?.substring(0, 8) || "unknown";
          throw new Error(
            `NOT_STALE:Item is no longer stale (claimed by [${otherToken}])`
          );
        }
      }

      // Check status is claimable
      if (["completed", "archived"].includes(feedbackData.status)) {
        throw new Error("NOT_CLAIMABLE:Item is no longer claimable");
      }

      // Perform the claim update
      const updateData = {
        status: "in-progress",
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        claimedBy: userId,
        claimToken: claimToken,
        claimSession: sessionId,
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        lastActivityType: "claimed",
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

    // Log to tamper-proof journal
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
        source,
      }
    );

    console.log(
      `Claim successful: ${feedbackId} by session ${sessionId} [${claimToken.substring(0, 8)}] via ${source}`
    );

    return {
      success: true,
      feedbackId,
      claimToken,
      claimTokenShort: claimToken.substring(0, 8),
      message: isReclaim ? "Reclaimed successfully" : "Claimed successfully",
      title: result.title,
      type: result.type,
      priority: result.priority,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Parse structured errors
    if (errorMessage.startsWith("NOT_FOUND:")) {
      return { type: "not-found", message: errorMessage.substring(10) };
    }
    if (errorMessage.startsWith("ALREADY_CLAIMED:")) {
      return { type: "already-claimed", message: errorMessage.substring(16) };
    }
    if (errorMessage.startsWith("RECENTLY_CLAIMED:")) {
      return { type: "recently-claimed", message: errorMessage.substring(17) };
    }
    if (errorMessage.startsWith("NOT_STALE:")) {
      return { type: "not-stale", message: errorMessage.substring(10) };
    }
    if (errorMessage.startsWith("NOT_CLAIMABLE:")) {
      return { type: "not-claimable", message: errorMessage.substring(14) };
    }

    console.error(`Claim failed for ${feedbackId}:`, error);
    return { type: "internal", message: "Failed to claim feedback" };
  }
}

// ============================================================================
// HEARTBEAT
// ============================================================================

/**
 * Validate and record a heartbeat on a claimed item
 */
export async function validateHeartbeat(
  params: HeartbeatParams
): Promise<HeartbeatResult | ClaimError> {
  const {
    feedbackId,
    sessionId,
    userId,
    message = "",
    source = "callable",
  } = params;

  const db = getDb();
  const feedbackRef = db.collection("feedback").doc(feedbackId);
  const feedbackDoc = await feedbackRef.get();

  if (!feedbackDoc.exists) {
    return { type: "not-found", message: "Feedback not found" };
  }

  const feedbackData = feedbackDoc.data()!;

  // Verify session ownership
  if (feedbackData.claimSession !== sessionId) {
    return {
      type: "permission-denied",
      message: "This session does not own the claim on this item",
    };
  }

  // For Firebase Auth users, also verify user ownership
  if (userId !== ADMIN_USER_ID && feedbackData.claimedBy !== userId) {
    return {
      type: "permission-denied",
      message: "This user does not own the claim on this item",
    };
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
    source,
  });

  return {
    success: true,
    message: "Heartbeat recorded",
  };
}

// ============================================================================
// UNCLAIM
// ============================================================================

/**
 * Unclaim a feedback item
 */
export async function unclaimFeedback(
  params: UnclaimParams
): Promise<UnclaimResult | ClaimError> {
  const {
    feedbackId,
    sessionId,
    userId,
    newStatus = "new",
    notes = "",
    emergency = false,
    emergencyReason = "",
    confirmEmergency = false,
    source = "callable",
  } = params;

  const db = getDb();
  const feedbackRef = db.collection("feedback").doc(feedbackId);
  const feedbackDoc = await feedbackRef.get();

  if (!feedbackDoc.exists) {
    return { type: "not-found", message: "Feedback not found" };
  }

  const feedbackData = feedbackDoc.data()!;

  // Normal unclaim: verify ownership
  if (!emergency) {
    if (!sessionId) {
      return {
        type: "permission-denied",
        message: "sessionId is required for normal unclaim",
      };
    }

    if (feedbackData.claimSession !== sessionId) {
      return {
        type: "permission-denied",
        message: "This session does not own the claim",
      };
    }
  }

  // Emergency unclaim: requires confirmation and logs audit trail
  if (emergency) {
    if (!emergencyReason) {
      return {
        type: "permission-denied",
        message: "Emergency reason is required",
      };
    }

    if (!confirmEmergency) {
      return {
        type: "emergency-confirmation",
        message:
          "Emergency unclaim requires confirmation. Set confirmEmergency=true.",
      };
    }

    // Check cooldown per session
    const recentEmergency = await db
      .collection("emergencyActions")
      .where("sessionId", "==", sessionId || "unknown")
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (!recentEmergency.empty) {
      const lastAction = recentEmergency.docs[0].data();
      const cooldownExpires =
        lastAction.timestamp.toMillis() + EMERGENCY_COOLDOWN_MS;

      if (Date.now() < cooldownExpires) {
        const remainingMins = Math.ceil(
          (cooldownExpires - Date.now()) / 60000
        );
        return {
          type: "emergency-cooldown",
          message: `Emergency cooldown active. Try again in ${remainingMins} minutes.`,
        };
      }
    }

    // Log emergency action
    await db.collection("emergencyActions").add({
      actionType: "unclaim",
      feedbackId,
      performedBy: userId,
      sessionId: sessionId || "unknown",
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
      return {
        type: "invalid-transition",
        message: `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(", ")}`,
      };
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
      source,
    }
  );

  console.log(
    `Unclaim successful: ${feedbackId} (emergency: ${emergency}) via ${source}`
  );

  return {
    success: true,
    message: emergency ? "Emergency unclaim completed" : "Unclaimed successfully",
    newStatus,
  };
}

// ============================================================================
// STATUS UPDATE
// ============================================================================

/**
 * Update feedback status with proper validation
 */
export async function updateFeedbackStatus(
  params: StatusUpdateParams
): Promise<StatusUpdateResult | ClaimError> {
  const {
    feedbackId,
    sessionId,
    userId,
    newStatus,
    adminNotes = "",
    resolution = "",
    source = "callable",
  } = params;

  const db = getDb();
  const feedbackRef = db.collection("feedback").doc(feedbackId);
  const feedbackDoc = await feedbackRef.get();

  if (!feedbackDoc.exists) {
    return { type: "not-found", message: "Feedback not found" };
  }

  const feedbackData = feedbackDoc.data()!;
  const currentStatus = feedbackData.status;

  // Validate transition
  if (newStatus !== currentStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return {
        type: "invalid-transition",
        message: `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(", ")}`,
      };
    }
  }

  // If moving to in-progress, must have a claim
  if (newStatus === "in-progress" && !feedbackData.claimToken) {
    return {
      type: "permission-denied",
      message: "Cannot move to in-progress without an active claim",
    };
  }

  // If claimed, verify session owns the claim (unless admin)
  if (feedbackData.claimSession && sessionId) {
    if (feedbackData.claimSession !== sessionId) {
      return {
        type: "permission-denied",
        message: "This session does not own the claim",
      };
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

  if (adminNotes) {
    updateData.adminNotes = feedbackData.adminNotes
      ? `${feedbackData.adminNotes}\n\n---\n\n${adminNotes}`
      : adminNotes;
  }

  if (resolution) {
    updateData.resolution = resolution;
  }

  await feedbackRef.update(updateData);

  // Log to journal
  await addJournalEntry(
    feedbackId,
    "status_change",
    sessionId || userId,
    `Status changed: ${currentStatus} → ${newStatus}`,
    {
      fromStatus: currentStatus,
      toStatus: newStatus,
      adminNotes,
      resolution,
      source,
    }
  );

  return {
    success: true,
    message: `Status updated to ${newStatus}`,
    previousStatus: currentStatus,
    newStatus,
  };
}

/**
 * Type guard to check if result is an error
 */
export function isClaimError(
  result: ClaimResult | HeartbeatResult | UnclaimResult | StatusUpdateResult | ClaimError
): result is ClaimError {
  return "type" in result && !("success" in result);
}
