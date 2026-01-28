/**
 * Cleanup Stale Agent Sessions
 *
 * Scheduled function that runs hourly to clean up abandoned agent sessions.
 * Sessions are considered stale after 1 hour of inactivity.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { AGENT_SESSION_CONFIG } from "./types";

const db = admin.firestore();

/**
 * Cleanup stale agent sessions
 *
 * Runs hourly to remove sessions that haven't had activity in the past hour.
 * Also releases any claims held by those sessions.
 */
export const cleanupStaleAgentSessions = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    const cutoffTime = admin.firestore.Timestamp.fromMillis(
      Date.now() - AGENT_SESSION_CONFIG.SESSION_TIMEOUT_MS
    );

    console.log(
      `Cleaning up agent sessions with lastActivity before ${cutoffTime.toDate().toISOString()}`
    );

    let deletedSessions = 0;
    let releasedClaims = 0;

    try {
      // Find stale sessions
      const staleSessions = await db
        .collection("agentSessions")
        .where("lastActivity", "<", cutoffTime)
        .get();

      if (staleSessions.empty) {
        console.log("No stale agent sessions found");
        return null;
      }

      console.log(`Found ${staleSessions.size} stale agent sessions`);

      // Process each stale session
      for (const sessionDoc of staleSessions.docs) {
        const sessionData = sessionDoc.data();
        const sessionId = sessionDoc.id;

        console.log(`Processing stale session: ${sessionId}`);

        // Release any claims held by this session
        if (
          sessionData.activeClaims &&
          Array.isArray(sessionData.activeClaims)
        ) {
          for (const feedbackId of sessionData.activeClaims) {
            try {
              // Verify the claim is still held by this session before releasing
              const feedbackRef = db.collection("feedback").doc(feedbackId);
              const feedbackDoc = await feedbackRef.get();

              if (feedbackDoc.exists) {
                const feedbackData = feedbackDoc.data();

                // Only release if this session still holds the claim
                if (feedbackData?.claimSession === sessionId) {
                  await feedbackRef.update({
                    status: "new",
                    claimToken: admin.firestore.FieldValue.delete(),
                    claimedAt: admin.firestore.FieldValue.delete(),
                    claimedBy: admin.firestore.FieldValue.delete(),
                    claimSession: admin.firestore.FieldValue.delete(),
                    lastActivity: admin.firestore.FieldValue.delete(),
                    lastActivityType: admin.firestore.FieldValue.delete(),
                  });

                  // Add journal entry for audit trail
                  await feedbackRef.collection("journal").add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: "unclaimed",
                    sessionId: "system",
                    message: "Claim released due to stale session cleanup",
                    data: {
                      previousSession: sessionId,
                      reason: "session-timeout",
                    },
                  });

                  releasedClaims++;
                  console.log(
                    `Released claim on ${feedbackId} from stale session ${sessionId}`
                  );
                }
              }
            } catch (err) {
              console.error(
                `Error releasing claim ${feedbackId} from session ${sessionId}:`,
                err
              );
            }
          }
        }

        // Delete the stale session
        try {
          await sessionDoc.ref.delete();
          deletedSessions++;
        } catch (err) {
          console.error(`Error deleting stale session ${sessionId}:`, err);
        }
      }

      console.log(
        `Cleanup complete: ${deletedSessions} sessions deleted, ${releasedClaims} claims released`
      );
    } catch (error) {
      console.error("Error during agent session cleanup:", error);
    }

    return null;
  });

/**
 * Register or update an agent session
 *
 * Callable function for agents to register their session on startup.
 * Returns the session ID to use for subsequent operations.
 */
export const registerAgentSession = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to register an agent session"
      );
    }

    const { sessionId, agentType, agentName, metadata } = data;

    // Validate required fields
    if (!sessionId || typeof sessionId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "sessionId is required and must be a string"
      );
    }

    if (
      !agentType ||
      !AGENT_SESSION_CONFIG.VALID_AGENT_TYPES.includes(agentType)
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `agentType must be one of: ${AGENT_SESSION_CONFIG.VALID_AGENT_TYPES.join(", ")}`
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const sessionData = {
      sessionId,
      agentType,
      agentName: agentName || null,
      registeredAt: now,
      lastActivity: now,
      activeClaims: [],
      userId: context.auth.uid,
      metadata: metadata || {},
    };

    try {
      await db.collection("agentSessions").doc(sessionId).set(sessionData);

      console.log(
        `Registered agent session: ${sessionId} (type: ${agentType})`
      );

      return {
        success: true,
        sessionId,
        message: "Session registered successfully",
      };
    } catch (error) {
      console.error("Error registering agent session:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to register agent session"
      );
    }
  }
);

/**
 * Update agent session activity
 *
 * Called periodically by agents to keep their session alive.
 */
export const heartbeatAgentSession = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated"
      );
    }

    const { sessionId } = data;

    if (!sessionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "sessionId is required"
      );
    }

    const sessionRef = db.collection("agentSessions").doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Session not found. Please re-register."
      );
    }

    // Verify ownership
    const sessionData = sessionDoc.data();
    if (sessionData?.userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not authorized to update this session"
      );
    }

    await sessionRef.update({
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: "Session activity updated" };
  }
);
