/**
 * Server-Side Claim Operations (Callable Functions)
 *
 * Atomic, race-safe claim operations for Firebase Auth users.
 * All business logic is delegated to the shared claimService.
 *
 * Authentication:
 * - Firebase Auth users: context.auth is populated
 * - Service accounts: IAM validates the request, context.auth is null
 *
 * For service account calls, we trust the request because:
 * 1. IAM only allows authenticated service accounts to invoke the function
 * 2. The service account must be explicitly granted the Cloud Functions Invoker role
 */

import * as functions from "firebase-functions";
import {
  claimFeedback as claimFeedbackService,
  validateHeartbeat as validateHeartbeatService,
  unclaimFeedback as unclaimFeedbackService,
  updateFeedbackStatus as updateFeedbackStatusService,
  isClaimError,
} from "./shared";
import { ADMIN_USER_ID } from "./shared/constants";

/**
 * Check if the request is authenticated via either:
 * 1. Firebase Auth (browser clients)
 * 2. Service Account IAM (CLI clients)
 *
 * For service account calls, context.auth is null but the request is
 * authenticated at the infrastructure level by Google Cloud IAM.
 */
function getAuthenticatedUserId(
  context: functions.https.CallableContext
): string | null {
  // Firebase Auth user
  if (context.auth?.uid) {
    return context.auth.uid;
  }

  // Service account call (IAM-authenticated, no Firebase Auth context)
  // The request is already authenticated by Cloud Functions infrastructure
  // We use the admin user ID for these calls
  if (context.rawRequest?.headers?.authorization) {
    // If we got here with an auth header but no context.auth,
    // it's a service account with an IAM token
    return ADMIN_USER_ID;
  }

  return null;
}

/**
 * Map ClaimError types to HttpsError codes
 */
function getHttpsErrorCode(
  errorType: string
): functions.https.FunctionsErrorCode {
  switch (errorType) {
    case "not-found":
      return "not-found";
    case "permission-denied":
      return "permission-denied";
    case "already-claimed":
    case "recently-claimed":
    case "not-stale":
    case "not-claimable":
    case "invalid-transition":
    case "emergency-confirmation":
      return "failed-precondition";
    case "session-not-found":
      return "invalid-argument";
    case "wip-limit":
    case "emergency-cooldown":
      return "resource-exhausted";
    default:
      return "internal";
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
  // Verify authentication (supports both Firebase Auth and Service Account IAM)
  const userId = getAuthenticatedUserId(context);
  if (!userId) {
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

  // Delegate to shared service
  const result = await claimFeedbackService({
    feedbackId,
    sessionId,
    userId,
    isReclaim,
    force,
    source: "callable",
  });

  if (isClaimError(result)) {
    throw new functions.https.HttpsError(
      getHttpsErrorCode(result.type),
      result.message
    );
  }

  console.log(
    `Claim successful: ${feedbackId} by session ${sessionId} [${result.claimTokenShort}]`
  );

  return result;
});

/**
 * Validate a heartbeat on a claimed item
 *
 * Verifies the caller owns the claim before updating activity.
 */
export const validateHeartbeat = functions.https.onCall(
  async (data, context) => {
    const userId = getAuthenticatedUserId(context);
    if (!userId) {
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

    // Delegate to shared service
    const result = await validateHeartbeatService({
      feedbackId,
      sessionId,
      userId,
      message,
      source: "callable",
    });

    if (isClaimError(result)) {
      throw new functions.https.HttpsError(
        getHttpsErrorCode(result.type),
        result.message
      );
    }

    return result;
  }
);

/**
 * Unclaim a feedback item
 *
 * Releases the claim and updates status appropriately.
 */
export const unclaimFeedback = functions.https.onCall(async (data, context) => {
  const userId = getAuthenticatedUserId(context);
  if (!userId) {
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

  // Delegate to shared service
  const result = await unclaimFeedbackService({
    feedbackId,
    sessionId,
    userId,
    newStatus,
    notes,
    emergency,
    emergencyReason,
    confirmEmergency,
    source: "callable",
  });

  if (isClaimError(result)) {
    throw new functions.https.HttpsError(
      getHttpsErrorCode(result.type),
      result.message
    );
  }

  console.log(`Unclaim successful: ${feedbackId} (emergency: ${emergency})`);

  return result;
});

/**
 * Update feedback status with proper validation
 */
export const updateFeedbackStatus = functions.https.onCall(
  async (data, context) => {
    const userId = getAuthenticatedUserId(context);
    if (!userId) {
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

    // Delegate to shared service
    const result = await updateFeedbackStatusService({
      feedbackId,
      sessionId,
      userId,
      newStatus,
      adminNotes: notes,
      source: "callable",
    });

    if (isClaimError(result)) {
      throw new functions.https.HttpsError(
        getHttpsErrorCode(result.type),
        result.message
      );
    }

    return result;
  }
);
