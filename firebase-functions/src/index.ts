/**
 * Firebase Cloud Functions for TKA Composer
 *
 * Handles subscription-related background tasks like role sync,
 * custom email delivery via Resend, and feedback claim management.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

// Export magic link function
export { sendMagicLink } from "./sendMagicLink";

// Export audio transcription function
export { transcribeAudio } from "./transcribeAudio";

// Export push notification triggers (v2 Firestore triggers)
export { onNewMessage } from "./push/onNewMessage";
export { onNewNotification } from "./push/onNewNotification";

// Export scheduled Firestore backup function
export { scheduledFirestoreExport } from "./scheduledFirestoreExport";

// Export feedback claims module (bulletproof claim management)
export {
  // Agent session management
  cleanupStaleAgentSessions,
  registerAgentSession,
  heartbeatAgentSession,
  // Claim operations
  claimFeedback,
  validateHeartbeat,
  unclaimFeedback,
  updateFeedbackStatus,
  // File conflict detection
  touchFile,
  checkFileConflicts,
  getActiveFileEdits,
  releaseFileEdit,
  // HTTP endpoints for CLI (service account auth)
  httpClaimFeedback,
  httpValidateHeartbeat,
  httpUnclaimFeedback,
  httpRegisterAgentSession,
  httpTouchFile,
  httpCheckFileConflicts,
  httpUpdateFeedbackStatus,
} from "./feedbackClaims";

// R2 storage functions (presigned URLs, multipart, delete)
// Deploy after R2 secrets are configured:
//   firebase functions:secrets:set R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME R2_PUBLIC_URL
export {
  r2PresignUrl,
  r2MultipartStart,
  r2MultipartPartUrl,
  r2MultipartComplete,
  r2MultipartAbort,
  r2MultipartListParts,
  r2DeleteObject,
  r2DeleteByPrefix,
} from "./r2/index";

// Export staged upload cleanup (orphan prevention)
export { cleanupStagedUploads } from "./cleanupStagedUploads";

// Merch store: checkout session creation and order recording via Stripe webhook
export { createMerchCheckout } from "./merch/createMerchCheckout";
export { handleMerchWebhook } from "./merch/handleMerchWebhook";

const db = admin.firestore();

// Role hierarchy: user < premium < tester < admin
const ROLE_HIERARCHY = ["user", "premium", "tester", "admin"] as const;
type UserRole = (typeof ROLE_HIERARCHY)[number];

/**
 * Sync Subscription Role
 *
 * Triggers when a subscription document is created or updated.
 * Updates the user's role to "premium" if subscription is active,
 * or reverts to "user" if canceled (unless they have a higher role).
 */
export const syncSubscriptionRole = functions.firestore
  .document("customers/{userId}/subscriptions/{subscriptionId}")
  .onWrite(async (change, context) => {
    const { userId } = context.params;
    const subscriptionData = change.after.exists ? change.after.data() : null;

    // Get current user document
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`User ${userId} not found, skipping role sync`);
      return null;
    }

    const userData = userDoc.data();
    const currentRole = (userData?.role as UserRole) || "user";

    // Determine if subscription is active
    const isSubscriptionActive =
      subscriptionData?.status === "active" ||
      subscriptionData?.status === "trialing";

    if (isSubscriptionActive) {
      // Upgrade to premium if not already at a higher tier
      const currentRoleIndex = ROLE_HIERARCHY.indexOf(currentRole);
      const premiumIndex = ROLE_HIERARCHY.indexOf("premium");

      if (currentRoleIndex < premiumIndex) {
        console.log(`Upgrading user ${userId} from ${currentRole} to premium`);
        await userRef.update({
          role: "premium",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Set custom claims for Firebase Auth
        await admin.auth().setCustomUserClaims(userId, {
          ...((await admin.auth().getUser(userId)).customClaims || {}),
          role: "premium",
        });
      }
    } else {
      // Subscription ended - revert to user role if currently premium
      if (currentRole === "premium") {
        console.log(`Reverting user ${userId} from premium to user`);
        await userRef.update({
          role: "user",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update custom claims
        await admin.auth().setCustomUserClaims(userId, {
          ...((await admin.auth().getUser(userId)).customClaims || {}),
          role: "user",
        });
      }
      // If user is tester or admin, don't downgrade
    }

    return null;
  });

/**
 * Clean up expired checkout sessions
 *
 * Runs daily to remove checkout sessions older than 24 hours that were never completed.
 */
export const cleanupExpiredCheckoutSessions = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const cutoffTime = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const customersSnapshot = await db.collection("customers").get();
    let deletedCount = 0;

    for (const customerDoc of customersSnapshot.docs) {
      const sessionsRef = customerDoc.ref.collection("checkout_sessions");
      const expiredSessions = await sessionsRef
        .where("created", "<", cutoffTime)
        .where("url", "==", null)
        .get();

      for (const sessionDoc of expiredSessions.docs) {
        await sessionDoc.ref.delete();
        deletedCount++;
      }
    }

    console.log(`Cleaned up ${deletedCount} expired checkout sessions`);
    return null;
  });
