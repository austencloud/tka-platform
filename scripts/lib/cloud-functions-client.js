/**
 * Cloud Functions Client for CLI
 *
 * Provides authenticated access to Cloud Functions from the CLI.
 * Uses Google IAM authentication with the service account credentials.
 *
 * This is the BULLETPROOF path - all operations go through server-side
 * functions that generate tokens, validate sessions, and write to
 * tamper-proof audit logs.
 */

import admin from "firebase-admin";
import { JWT } from "google-auth-library";
import { readFileSync } from "fs";

// Firebase project configuration
const PROJECT_ID = "the-kinetic-alphabet";
const REGION = "us-central1";

// HTTP endpoint names (these use onRequest, not onCall)
const HTTP_ENDPOINTS = {
  registerSession: "httpRegisterAgentSession",
  claimFeedback: "httpClaimFeedback",
  heartbeat: "httpValidateHeartbeat",
  unclaim: "httpUnclaimFeedback",
  touchFile: "httpTouchFile",
  checkFileConflicts: "httpCheckFileConflicts",
  updateFeedbackStatus: "httpUpdateFeedbackStatus",
};

// Lazy-load db to avoid accessing before Firebase is initialized
let _db = null;
function getDb() {
  if (!_db) {
    _db = admin.firestore();
  }
  return _db;
}

// Cache one token per exact Cloud Function audience. Reusing the register
// function's token for the status function produces an audience mismatch.
let _cachedToken = null;
let _tokenExpiry = 0;
let _cachedTokenAudience = null;

/**
 * Get or create a JWT client from the service account
 */
function getJwtClient(targetAudience) {
  try {
    const keyFile = "./serviceAccountKey.json";
    const credentials = JSON.parse(readFileSync(keyFile, "utf8"));

    return new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      additionalClaims: {
        target_audience: targetAudience,
      },
    });
  } catch (error) {
    throw new Error(`Failed to create JWT client: ${error.message}`);
  }
}

/**
 * Get an ID token for authenticating with Cloud Functions
 *
 * Cloud Functions require an ID token with the function URL as the audience.
 */
async function getIdToken(functionUrl) {
  // Check cache (tokens are valid for ~1 hour, we refresh at 50 min)
  if (
    _cachedToken &&
    _cachedTokenAudience === functionUrl &&
    Date.now() < _tokenExpiry
  ) {
    return _cachedToken;
  }

  try {
    const client = getJwtClient(functionUrl);
    const tokenResponse = await client.authorize();

    if (!tokenResponse.id_token) {
      throw new Error("No ID token in response");
    }

    // Cache the token (refresh 10 minutes before expiry)
    _cachedToken = tokenResponse.id_token;
    _cachedTokenAudience = functionUrl;
    _tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 minutes

    return _cachedToken;
  } catch (error) {
    throw new Error(`Failed to get ID token: ${error.message}`);
  }
}

/**
 * Check if Cloud Functions are available and we can authenticate
 */
let _functionsAvailable = null;
let _functionsCheckTime = 0;

export async function areFunctionsAvailable() {
  // Re-check every 5 minutes in case of transient failures
  if (_functionsAvailable !== null && Date.now() - _functionsCheckTime < 5 * 60 * 1000) {
    return _functionsAvailable;
  }

  try {
    const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${HTTP_ENDPOINTS.registerSession}`;
    const token = await getIdToken(url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ healthCheck: true }),
    });

    // 200 = worked (health check accepted)
    // 400 = function exists but rejected data (still good for auth)
    // 401/403 = auth failed
    _functionsAvailable = response.status === 200 || response.status === 400;
    _functionsCheckTime = Date.now();

    if (_functionsAvailable) {
      console.log("  ✅ Cloud Functions authenticated via IAM");
    } else {
      console.log(`  ⚠️  Cloud Functions returned ${response.status}, using direct mode`);
    }
  } catch (error) {
    console.log(`  ⚠️  Cloud Functions unavailable: ${error.message}`);
    _functionsAvailable = false;
    _functionsCheckTime = Date.now();
  }

  return _functionsAvailable;
}

/**
 * Call an HTTP Cloud Function with proper IAM authentication
 *
 * Unlike callable functions (onCall), HTTP functions (onRequest) accept
 * the data directly in the request body, not wrapped in { data: ... }.
 * The response is also { result: ... } which we extract.
 */
async function callHttpFunction(functionName, data) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;
  const token = await getIdToken(url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      responseData.error ||
      `Function call failed: ${response.status}`;
    throw new Error(errorMessage);
  }

  return responseData.result;
}

/**
 * Register agent session via Cloud Function
 */
export async function registerSession(sessionId, agentType, metadata = {}) {
  if (!(await areFunctionsAvailable())) {
    // Fall back to direct write
    await getDb()
      .collection("agentSessions")
      .doc(sessionId)
      .set({
        sessionId,
        agentType,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        activeClaims: [],
        metadata,
      });
    return { success: true, sessionId, mode: "direct" };
  }

  return await callHttpFunction(HTTP_ENDPOINTS.registerSession, {
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
    return null;
  }

  return await callHttpFunction(HTTP_ENDPOINTS.claimFeedback, {
    feedbackId,
    sessionId,
    isReclaim,
    force,
  });
}

/**
 * Send heartbeat via Cloud Function
 */
export async function heartbeatViaFunction(
  feedbackId,
  sessionId,
  message = ""
) {
  if (!(await areFunctionsAvailable())) {
    return null;
  }

  return await callHttpFunction(HTTP_ENDPOINTS.heartbeat, {
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

  return await callHttpFunction(HTTP_ENDPOINTS.unclaim, {
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

  return await callHttpFunction(HTTP_ENDPOINTS.touchFile, {
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

  return await callHttpFunction(HTTP_ENDPOINTS.checkFileConflicts, {
    feedbackId,
    filePaths,
  });
}

/**
 * Update feedback status via Cloud Function
 */
export async function updateStatusViaFunction(
  feedbackId,
  sessionId,
  newStatus,
  adminNotes = "",
  resolution = ""
) {
  if (!(await areFunctionsAvailable())) {
    return null;
  }

  return await callHttpFunction(HTTP_ENDPOINTS.updateFeedbackStatus, {
    feedbackId,
    sessionId,
    newStatus,
    adminNotes,
    resolution,
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
  updateStatusViaFunction,
};
