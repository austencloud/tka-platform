/**
 * File Conflict Detection
 *
 * Tracks which files are being edited by which agent/claim
 * to prevent silent overwrites when multiple agents work on the same files.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Admin User ID - the service account user for CLI operations
 */
const ADMIN_USER_ID = "rKWiPd1SthNJLMmCwKR4lgKwJuD3";

/**
 * Get authenticated user ID from Firebase Auth or Service Account IAM
 */
function getAuthenticatedUserId(context: functions.https.CallableContext): string | null {
  if (context.auth?.uid) {
    return context.auth.uid;
  }
  if (context.rawRequest?.headers?.authorization) {
    return ADMIN_USER_ID;
  }
  return null;
}

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
 * Register that a file is being edited
 *
 * Returns conflict information if another agent is editing the same file.
 */
export const touchFile = functions.https.onCall(async (data, context) => {
  const userId = getAuthenticatedUserId(context);
  if (!userId) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated"
    );
  }

  const { feedbackId, sessionId, filePath } = data;

  if (!feedbackId || !sessionId || !filePath) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "feedbackId, sessionId, and filePath are required"
    );
  }

  // Normalize file path (remove leading slashes, use forward slashes)
  const normalizedPath = filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .toLowerCase();

  // Verify session owns the claim
  const feedbackRef = db.collection("feedback").doc(feedbackId);
  const feedbackDoc = await feedbackRef.get();

  if (!feedbackDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Feedback not found");
  }

  const feedbackData = feedbackDoc.data()!;

  if (feedbackData.claimSession !== sessionId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "This session does not own the claim"
    );
  }

  // Check for existing edit by ANOTHER agent on the same file
  const editId = normalizedPath.replace(/\//g, "_");
  const existingEdit = await db.collection("activeFileEdits").doc(editId).get();

  let conflict = null;

  if (existingEdit.exists) {
    const existingData = existingEdit.data()!;

    // If same feedback item, just update the timestamp
    if (existingData.feedbackId === feedbackId) {
      await existingEdit.ref.update({
        lastTouched: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        conflict: null,
        message: `Updated: ${filePath}`,
      };
    }

    // Different feedback item - potential conflict!
    conflict = {
      filePath,
      existingFeedbackId: existingData.feedbackId,
      existingSessionId: existingData.sessionId,
      startedAt: existingData.startedAt?.toDate?.()?.toISOString(),
    };

    // Log warning but don't block - let the user decide
    console.warn(
      `File conflict detected: ${filePath} is being edited by ${existingData.feedbackId}`
    );
  }

  // Register this file edit (overwrites if conflict - user was warned)
  await db.collection("activeFileEdits").doc(editId).set({
    filePath: normalizedPath,
    originalPath: filePath,
    feedbackId,
    sessionId,
    userId,
    startedAt: existingEdit.exists
      ? existingEdit.data()!.startedAt
      : admin.firestore.FieldValue.serverTimestamp(),
    lastTouched: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update feedback activity
  await feedbackRef.update({
    lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    lastActivityType: "file_touch",
  });

  // Log to journal
  await addJournalEntry(feedbackId, "file_touched", sessionId, filePath, {
    filePath: normalizedPath,
    hadConflict: conflict !== null,
    conflictWith: conflict?.existingFeedbackId,
  });

  return {
    success: true,
    conflict,
    message: conflict
      ? `WARNING: ${filePath} is also being edited by feedback ${conflict.existingFeedbackId}`
      : `Registered: ${filePath}`,
  };
});

/**
 * Check for conflicts on multiple files at once
 *
 * Useful for checking a set of files before starting work.
 */
export const checkFileConflicts = functions.https.onCall(
  async (data, context) => {
    const userId = getAuthenticatedUserId(context);
    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated"
      );
    }

    const { feedbackId, filePaths } = data;

    if (!feedbackId || !Array.isArray(filePaths)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "feedbackId and filePaths array are required"
      );
    }

    const conflicts: Array<{
      filePath: string;
      existingFeedbackId: string;
      existingSessionId: string;
    }> = [];

    for (const filePath of filePaths) {
      const normalizedPath = filePath
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .toLowerCase();

      const editId = normalizedPath.replace(/\//g, "_");
      const existingEdit = await db
        .collection("activeFileEdits")
        .doc(editId)
        .get();

      if (existingEdit.exists) {
        const existingData = existingEdit.data()!;

        // Only report if different feedback item
        if (existingData.feedbackId !== feedbackId) {
          conflicts.push({
            filePath,
            existingFeedbackId: existingData.feedbackId,
            existingSessionId: existingData.sessionId,
          });
        }
      }
    }

    return {
      success: true,
      hasConflicts: conflicts.length > 0,
      conflicts,
      checkedFiles: filePaths.length,
    };
  }
);

/**
 * Get all active file edits for a feedback item
 */
export const getActiveFileEdits = functions.https.onCall(
  async (data, context) => {
    const userId = getAuthenticatedUserId(context);
    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated"
      );
    }

    const { feedbackId } = data;

    if (!feedbackId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "feedbackId is required"
      );
    }

    const edits = await db
      .collection("activeFileEdits")
      .where("feedbackId", "==", feedbackId)
      .get();

    const files = edits.docs.map((doc) => {
      const data = doc.data();
      return {
        filePath: data.originalPath || data.filePath,
        startedAt: data.startedAt?.toDate?.()?.toISOString(),
        lastTouched: data.lastTouched?.toDate?.()?.toISOString(),
      };
    });

    return {
      success: true,
      feedbackId,
      files,
      count: files.length,
    };
  }
);

/**
 * Release file edits when done with a file
 *
 * Called when an agent finishes editing a file.
 */
export const releaseFileEdit = functions.https.onCall(async (data, context) => {
  const userId = getAuthenticatedUserId(context);
  if (!userId) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated"
    );
  }

  const { feedbackId, sessionId, filePath } = data;

  if (!feedbackId || !sessionId || !filePath) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "feedbackId, sessionId, and filePath are required"
    );
  }

  const normalizedPath = filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .toLowerCase();

  const editId = normalizedPath.replace(/\//g, "_");
  const editRef = db.collection("activeFileEdits").doc(editId);
  const editDoc = await editRef.get();

  if (!editDoc.exists) {
    return {
      success: true,
      message: "File edit not found (already released)",
    };
  }

  const editData = editDoc.data()!;

  // Verify ownership
  if (editData.feedbackId !== feedbackId || editData.sessionId !== sessionId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Cannot release file edit owned by another session"
    );
  }

  await editRef.delete();

  return {
    success: true,
    message: `Released: ${filePath}`,
  };
});
