/**
 * Cloud Functions Client for CLI
 *
 * Provides a unified interface to call Cloud Functions from the CLI.
 * Falls back to direct Firestore operations when functions aren't available.
 *
 * This module allows the CLI to work in two modes:
 * 1. Cloud Functions mode (bulletproof) - all operations go through server
 * 2. Direct mode (legacy) - operations use Admin SDK directly
 */

import admin from "firebase-admin";

const db = admin.firestore();

// Firebase project configuration
const PROJECT_ID = "tka-scribe";
const REGION = "us-central1";

/**
 * Check if Cloud Functions are available
 *
 * We do this by checking if the function exists in Firebase.
 * This allows graceful degradation when functions aren't deployed.
 */
let _functionsAvailable = null;

export async function areFunctionsAvailable() {
  if (_functionsAvailable !== null) {
    return _functionsAvailable;
  }

  try {
    // Try to call a lightweight function to check availability
    // We use the registerAgentSession function as a health check
    const response = await fetch(
      `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/registerAgentSession`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} }), // Empty call will fail auth but confirms function exists
      }
    );

    // If we get a 401/403 (auth required) or 200, the function exists
    _functionsAvailable =
      response.status === 401 ||
      response.status === 403 ||
      response.status === 200;
  } catch (error) {
    // Network error or function doesn't exist
    _functionsAvailable = false;
  }

  return _functionsAvailable;
}

/**
 * Call a Cloud Function using Admin SDK token
 *
 * The CLI runs with a service account, so we can generate a custom token
 * to authenticate with Cloud Functions.
 */
async function callFunction(functionName, data) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;

  // For Admin SDK calls, we need to use a service account token
  // The functions verify auth via context.auth
  const token = await admin.auth().createCustomToken("admin-cli");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `Function call failed: ${response.status}`
    );
  }

  const result = await response.json();
  return result.result;
}

/**
 * Register agent session via Cloud Function
 */
export async function registerSession(sessionId, agentType, metadata = {}) {
  if (!(await areFunctionsAvailable())) {
    // Fall back to direct write
    await db.collection("agentSessions").doc(sessionId).set({
      sessionId,
      agentType,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      activeClaims: [],
      metadata,
    });
    return { success: true, sessionId, mode: "direct" };
  }

  return await callFunction("registerAgentSession", {
    sessionId,
    agentType,
    metadata,
  });
}

/**
 * Claim feedback via Cloud Function
 */
export async function claimFeedbackViaFunction(
  feedbackId,
  sessionId,
  isReclaim = false,
  force = false
) {
  if (!(await areFunctionsAvailable())) {
    // Return null to signal caller should use direct method
    return null;
  }

  return await callFunction("claimFeedback", {
    feedbackId,
    sessionId,
    isReclaim,
    force,
  });
}

/**
 * Send heartbeat via Cloud Function
 */
export async function heartbeatViaFunction(feedbackId, sessionId, message = "") {
  if (!(await areFunctionsAvailable())) {
    return null;
  }

  return await callFunction("validateHeartbeat", {
    feedbackId,
    sessionId,
    message,
  });
}

/**
 * Unclaim via Cloud Function
 */
export async function unclaimViaFunction(
  feedbackId,
  sessionId,
  newStatus = "new",
  notes = "",
  emergency = false,
  emergencyReason = "",
  confirmEmergency = false
) {
  if (!(await areFunctionsAvailable())) {
    return null;
  }

  return await callFunction("unclaimFeedback", {
    feedbackId,
    sessionId,
    newStatus,
    notes,
    emergency,
    emergencyReason,
    confirmEmergency,
  });
}

/**
 * Touch file via Cloud Function
 */
export async function touchFileViaFunction(feedbackId, sessionId, filePath) {
  if (!(await areFunctionsAvailable())) {
    return null;
  }

  return await callFunction("touchFile", {
    feedbackId,
    sessionId,
    filePath,
  });
}

/**
 * Check file conflicts via Cloud Function
 */
export async function checkFileConflictsViaFunction(feedbackId, filePaths) {
  if (!(await areFunctionsAvailable())) {
    return null;
  }

  return await callFunction("checkFileConflicts", {
    feedbackId,
    filePaths,
  });
}

export default {
  areFunctionsAvailable,
  registerSession,
  claimFeedbackViaFunction,
  heartbeatViaFunction,
  unclaimViaFunction,
  touchFileViaFunction,
  checkFileConflictsViaFunction,
};
