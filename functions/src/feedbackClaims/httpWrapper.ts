/**
 * HTTP Wrapper for Service Account Authentication
 *
 * Firebase callable functions (onCall) use Firebase Auth tokens, which don't work
 * with service account IAM authentication. This wrapper creates HTTPS endpoints
 * that validate service account tokens and call the same logic.
 *
 * All business logic is delegated to the shared claimService to eliminate duplication.
 *
 * Usage from CLI:
 *   POST https://us-central1-the-kinetic-alphabet.cloudfunctions.net/httpClaimFeedback
 *   Authorization: Bearer <id-token>
 *   Content-Type: application/json
 *   Body: { "feedbackId": "...", "sessionId": "..." }
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { OAuth2Client } from "google-auth-library";
import {
  claimFeedback,
  validateHeartbeat,
  unclaimFeedback,
  updateFeedbackStatus,
  isClaimError,
} from "./shared";
import { ADMIN_USER_ID, VALID_AGENT_TYPES, getDb } from "./shared/constants";
import { addJournalEntry } from "./shared/journalService";

const PROJECT_ID = "the-kinetic-alphabet";

/**
 * Service account email that's authorized to make CLI calls
 */
const AUTHORIZED_SERVICE_ACCOUNT =
  "firebase-adminsdk-fbsvc@the-kinetic-alphabet.iam.gserviceaccount.com";

/**
 * All valid audience URLs for our HTTP functions
 * JWT tokens are signed with the target function URL as audience,
 * so we need to accept any of our function URLs.
 */
const VALID_AUDIENCES = [
  `https://us-central1-${PROJECT_ID}.cloudfunctions.net/httpClaimFeedback`,
  `https://us-central1-${PROJECT_ID}.cloudfunctions.net/httpValidateHeartbeat`,
  `https://us-central1-${PROJECT_ID}.cloudfunctions.net/httpUnclaimFeedback`,
  `https://us-central1-${PROJECT_ID}.cloudfunctions.net/httpRegisterAgentSession`,
  `https://us-central1-${PROJECT_ID}.cloudfunctions.net/httpTouchFile`,
  `https://us-central1-${PROJECT_ID}.cloudfunctions.net/httpCheckFileConflicts`,
  `https://us-central1-${PROJECT_ID}.cloudfunctions.net/httpUpdateFeedbackStatus`,
];

/**
 * Verify the ID token from a service account
 *
 * Accepts tokens signed for any of our HTTP function endpoints.
 */
async function verifyServiceAccountToken(
  authHeader: string | undefined
): Promise<{ valid: boolean; email?: string; error?: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }

  const token = authHeader.substring(7);

  // Try verifying against each valid audience
  const client = new OAuth2Client();
  let lastError = "";

  for (const audience of VALID_AUDIENCES) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience,
      });

      const payload = ticket.getPayload();
      if (!payload?.email) {
        continue; // Try next audience
      }

      // Verify it's our authorized service account
      if (payload.email !== AUTHORIZED_SERVICE_ACCOUNT) {
        return {
          valid: false,
          error: `Unauthorized service account: ${payload.email}`,
        };
      }

      return { valid: true, email: payload.email };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      // Continue to next audience
    }
  }

  return { valid: false, error: `Token verification failed: ${lastError}` };
}

/**
 * Map ClaimError types to HTTP status codes
 */
function getHttpStatusForError(errorType: string): number {
  switch (errorType) {
    case "not-found":
      return 404;
    case "permission-denied":
      return 403;
    case "already-claimed":
    case "recently-claimed":
    case "not-stale":
    case "not-claimable":
    case "invalid-transition":
      return 409;
    case "session-not-found":
      return 400;
    case "wip-limit":
    case "emergency-cooldown":
      return 429;
    case "emergency-confirmation":
      return 400;
    default:
      return 500;
  }
}

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * HTTP endpoint for claiming feedback (service account auth)
 *
 * Delegates to shared claimService for business logic.
 */
export const httpClaimFeedback = functions.https.onRequest(async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.set(corsHeaders).status(204).send("");
    return;
  }

  res.set(corsHeaders);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify service account token
  const authResult = await verifyServiceAccountToken(req.headers.authorization);
  if (!authResult.valid) {
    res.status(401).json({ error: authResult.error });
    return;
  }

  const { feedbackId, sessionId, isReclaim = false, force = false } = req.body;

  // Validate inputs
  if (!feedbackId || typeof feedbackId !== "string") {
    res.status(400).json({ error: "feedbackId is required" });
    return;
  }

  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  // Delegate to shared service
  const result = await claimFeedback({
    feedbackId,
    sessionId,
    userId: ADMIN_USER_ID,
    isReclaim,
    force,
    source: "http-cli",
  });

  if (isClaimError(result)) {
    res.status(getHttpStatusForError(result.type)).json({ error: result.message });
    return;
  }

  console.log(
    `HTTP Claim successful: ${feedbackId} by session ${sessionId} [${result.claimTokenShort}]`
  );

  res.status(200).json({ result });
});

/**
 * HTTP endpoint for heartbeat (service account auth)
 *
 * Delegates to shared claimService for business logic.
 */
export const httpValidateHeartbeat = functions.https.onRequest(
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(corsHeaders).status(204).send("");
      return;
    }

    res.set(corsHeaders);

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authResult = await verifyServiceAccountToken(
      req.headers.authorization
    );
    if (!authResult.valid) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    const { feedbackId, sessionId, message = "" } = req.body;

    if (!feedbackId || !sessionId) {
      res.status(400).json({ error: "feedbackId and sessionId are required" });
      return;
    }

    // Delegate to shared service
    const result = await validateHeartbeat({
      feedbackId,
      sessionId,
      userId: ADMIN_USER_ID,
      message,
      source: "http-cli",
    });

    if (isClaimError(result)) {
      res.status(getHttpStatusForError(result.type)).json({ error: result.message });
      return;
    }

    res.status(200).json({ result });
  }
);

/**
 * HTTP endpoint for unclaim (service account auth)
 *
 * Delegates to shared claimService for business logic.
 */
export const httpUnclaimFeedback = functions.https.onRequest(
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(corsHeaders).status(204).send("");
      return;
    }

    res.set(corsHeaders);

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authResult = await verifyServiceAccountToken(
      req.headers.authorization
    );
    if (!authResult.valid) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    const {
      feedbackId,
      sessionId,
      newStatus = "new",
      notes = "",
      emergency = false,
      emergencyReason = "",
      confirmEmergency = false,
    } = req.body;

    if (!feedbackId) {
      res.status(400).json({ error: "feedbackId is required" });
      return;
    }

    // Delegate to shared service
    const result = await unclaimFeedback({
      feedbackId,
      sessionId,
      userId: ADMIN_USER_ID,
      newStatus,
      notes,
      emergency,
      emergencyReason,
      confirmEmergency,
      source: "http-cli",
    });

    if (isClaimError(result)) {
      res.status(getHttpStatusForError(result.type)).json({ error: result.message });
      return;
    }

    console.log(
      `HTTP Unclaim successful: ${feedbackId} (emergency: ${emergency})`
    );

    res.status(200).json({ result });
  }
);

/**
 * HTTP endpoint to register agent session (service account auth)
 *
 * Session registration is unique to HTTP (no callable equivalent needed).
 */
export const httpRegisterAgentSession = functions.https.onRequest(
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(corsHeaders).status(204).send("");
      return;
    }

    res.set(corsHeaders);

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // For health checks, allow without auth
    if (req.body?.healthCheck === true) {
      res.status(200).json({ result: { healthy: true } });
      return;
    }

    const authResult = await verifyServiceAccountToken(
      req.headers.authorization
    );
    if (!authResult.valid) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    const { sessionId, agentType, agentName, metadata } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    if (!agentType || !VALID_AGENT_TYPES.includes(agentType)) {
      res.status(400).json({
        error: `agentType must be one of: ${VALID_AGENT_TYPES.join(", ")}`,
      });
      return;
    }

    const db = getDb();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const sessionData = {
      sessionId,
      agentType,
      agentName: agentName || null,
      registeredAt: now,
      lastActivity: now,
      activeClaims: [],
      userId: ADMIN_USER_ID,
      metadata: metadata || {},
    };

    try {
      await db.collection("agentSessions").doc(sessionId).set(sessionData);

      console.log(
        `HTTP Registered agent session: ${sessionId} (type: ${agentType})`
      );

      res.status(200).json({
        result: {
          success: true,
          sessionId,
          message: "Session registered successfully",
        },
      });
    } catch (error) {
      console.error("HTTP Error registering agent session:", error);
      res.status(500).json({ error: "Failed to register agent session" });
    }
  }
);

/**
 * HTTP endpoint for touching a file (registering file edit)
 *
 * File tracking is HTTP-only (no callable equivalent needed).
 */
export const httpTouchFile = functions.https.onRequest(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.set(corsHeaders).status(204).send("");
    return;
  }

  res.set(corsHeaders);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authResult = await verifyServiceAccountToken(req.headers.authorization);
  if (!authResult.valid) {
    res.status(401).json({ error: authResult.error });
    return;
  }

  const { feedbackId, sessionId, filePath } = req.body;

  if (!feedbackId || !sessionId || !filePath) {
    res
      .status(400)
      .json({ error: "feedbackId, sessionId, and filePath are required" });
    return;
  }

  const db = getDb();

  // Normalize file path
  const normalizedPath = filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .toLowerCase();

  // Verify session owns the claim
  const feedbackRef = db.collection("feedback").doc(feedbackId);
  const feedbackDoc = await feedbackRef.get();

  if (!feedbackDoc.exists) {
    res.status(404).json({ error: "Feedback not found" });
    return;
  }

  const feedbackData = feedbackDoc.data()!;

  if (feedbackData.claimSession !== sessionId) {
    res.status(403).json({ error: "This session does not own the claim" });
    return;
  }

  // Check for existing edit by another agent
  const editId = normalizedPath.replace(/\//g, "_");
  const existingEdit = await db.collection("activeFileEdits").doc(editId).get();

  let conflict = null;

  if (existingEdit.exists) {
    const existingData = existingEdit.data()!;

    // Same feedback item - just update timestamp
    if (existingData.feedbackId === feedbackId) {
      await existingEdit.ref.update({
        lastTouched: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        result: {
          success: true,
          conflict: null,
          message: `Updated: ${filePath}`,
        },
      });
      return;
    }

    // Different feedback item - conflict
    conflict = {
      filePath,
      existingFeedbackId: existingData.feedbackId,
      existingSessionId: existingData.sessionId,
      startedAt: existingData.startedAt?.toDate?.()?.toISOString(),
    };

    console.warn(
      `File conflict detected: ${filePath} is being edited by ${existingData.feedbackId}`
    );
  }

  // Register the file edit
  await db.collection("activeFileEdits").doc(editId).set({
    filePath: normalizedPath,
    originalPath: filePath,
    feedbackId,
    sessionId,
    userId: ADMIN_USER_ID,
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
    source: "http-cli",
  });

  res.status(200).json({
    result: {
      success: true,
      conflict,
      message: conflict
        ? `WARNING: ${filePath} is also being edited by feedback ${conflict.existingFeedbackId}`
        : `Registered: ${filePath}`,
    },
  });
});

/**
 * HTTP endpoint for checking file conflicts
 *
 * File tracking is HTTP-only (no callable equivalent needed).
 */
export const httpCheckFileConflicts = functions.https.onRequest(
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(corsHeaders).status(204).send("");
      return;
    }

    res.set(corsHeaders);

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authResult = await verifyServiceAccountToken(
      req.headers.authorization
    );
    if (!authResult.valid) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    const { feedbackId, filePaths } = req.body;

    if (!feedbackId || !Array.isArray(filePaths)) {
      res
        .status(400)
        .json({ error: "feedbackId and filePaths array are required" });
      return;
    }

    const db = getDb();
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

        if (existingData.feedbackId !== feedbackId) {
          conflicts.push({
            filePath,
            existingFeedbackId: existingData.feedbackId,
            existingSessionId: existingData.sessionId,
          });
        }
      }
    }

    res.status(200).json({
      result: {
        success: true,
        hasConflicts: conflicts.length > 0,
        conflicts,
        checkedFiles: filePaths.length,
      },
    });
  }
);

/**
 * HTTP endpoint for updating feedback status
 *
 * Delegates to shared claimService for business logic.
 */
export const httpUpdateFeedbackStatus = functions.https.onRequest(
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(corsHeaders).status(204).send("");
      return;
    }

    res.set(corsHeaders);

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authResult = await verifyServiceAccountToken(
      req.headers.authorization
    );
    if (!authResult.valid) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    const { feedbackId, sessionId, newStatus, adminNotes = "", resolution = "" } = req.body;

    if (!feedbackId || !newStatus) {
      res.status(400).json({ error: "feedbackId and newStatus are required" });
      return;
    }

    // Delegate to shared service
    const result = await updateFeedbackStatus({
      feedbackId,
      sessionId,
      userId: ADMIN_USER_ID,
      newStatus,
      adminNotes,
      resolution,
      source: "http-cli",
    });

    if (isClaimError(result)) {
      res.status(getHttpStatusForError(result.type)).json({ error: result.message });
      return;
    }

    res.status(200).json({ result });
  }
);
