/**
 * Broadcast Conductor
 *
 * Cloud Function that generates sequences on a schedule and broadcasts
 * them to all connected clients via Firestore.
 *
 * This is the "conductor" of the live broadcast - it determines what
 * everyone sees and when.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { generateLOOPSequence, calculateDuration } from "./sequence-generator";
import { BroadcastState, BroadcastHistoryEntry } from "./types";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Firestore paths
const BROADCAST_STATE_DOC = "liveBroadcast/current";
const BROADCAST_HISTORY_COLLECTION = "liveBroadcast/history/entries";
const CONDUCTOR_STATE_DOC = "liveBroadcast/conductor";

// Configuration
const BEATS_PER_MINUTE = 60;
const HISTORY_LIMIT = 50; // Keep last 50 sequences in history

/**
 * Conductor state stored in Firestore.
 */
interface ConductorState {
  loopTypeIndex: number;
  totalGenerated: number;
  lastGeneratedAt: Timestamp;
}

/**
 * Get or initialize conductor state.
 */
async function getConductorState(): Promise<ConductorState> {
  const doc = await db.doc(CONDUCTOR_STATE_DOC).get();

  if (!doc.exists) {
    const initial: ConductorState = {
      loopTypeIndex: Math.floor(Math.random() * 11), // Start at random position
      totalGenerated: 0,
      lastGeneratedAt: Timestamp.now(),
    };
    await db.doc(CONDUCTOR_STATE_DOC).set(initial);
    return initial;
  }

  return doc.data() as ConductorState;
}

/**
 * Update conductor state after generation.
 */
async function updateConductorState(
  loopTypeIndex: number,
  totalGenerated: number
): Promise<void> {
  await db.doc(CONDUCTOR_STATE_DOC).update({
    loopTypeIndex,
    totalGenerated,
    lastGeneratedAt: Timestamp.now(),
  });
}

/**
 * Archive current sequence to history.
 */
async function archiveToHistory(
  state: BroadcastState
): Promise<void> {
  const historyEntry: BroadcastHistoryEntry = {
    sequence: state.currentSequence,
    sequenceNumber: state.sequenceNumber,
    playedAt: state.startedAt,
  };

  // Add to history collection
  await db.collection(BROADCAST_HISTORY_COLLECTION).add(historyEntry);

  // Prune old history entries
  const oldEntries = await db
    .collection(BROADCAST_HISTORY_COLLECTION)
    .orderBy("sequenceNumber", "desc")
    .offset(HISTORY_LIMIT)
    .get();

  const batch = db.batch();
  oldEntries.docs.forEach((doc) => batch.delete(doc.ref));
  if (!oldEntries.empty) {
    await batch.commit();
  }
}

/**
 * Generate and broadcast a new sequence.
 */
async function generateAndBroadcast(): Promise<{
  success: boolean;
  sequenceNumber?: number;
  error?: string;
}> {
  try {
    // Get conductor state
    const conductorState = await getConductorState();

    // Generate new sequence
    const { sequence, nextLoopTypeIndex } = generateLOOPSequence(
      conductorState.loopTypeIndex
    );

    const newSequenceNumber = conductorState.totalGenerated + 1;
    const now = Timestamp.now();
    const durationMs = calculateDuration(sequence.totalSteps, BEATS_PER_MINUTE);
    const endsAt = Timestamp.fromMillis(now.toMillis() + durationMs);

    // Create broadcast state
    const broadcastState: BroadcastState = {
      currentSequence: sequence,
      sequenceNumber: newSequenceNumber,
      startedAt: now,
      endsAt,
      durationMs,
      beatsPerMinute: BEATS_PER_MINUTE,
      generatedAt: now,
    };

    // Get current state for archiving
    const currentDoc = await db.doc(BROADCAST_STATE_DOC).get();
    if (currentDoc.exists) {
      const currentState = currentDoc.data() as BroadcastState;
      await archiveToHistory(currentState);
    }

    // Update broadcast state
    await db.doc(BROADCAST_STATE_DOC).set(broadcastState);

    // Update conductor state
    await updateConductorState(nextLoopTypeIndex, newSequenceNumber);

    // Update global metrics
    await db.doc("appMetrics/spinner").set(
      {
        totalGenerated: FieldValue.increment(1),
        lastGeneratedAt: now,
      },
      { merge: true }
    );

    console.log(
      `Generated sequence #${newSequenceNumber}: ${sequence.word} (${sequence.loopType}, ${sequence.totalSteps} beats)`
    );

    return { success: true, sequenceNumber: newSequenceNumber };
  } catch (error) {
    console.error("Error generating broadcast:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if the current sequence has finished playing.
 */
async function isSequenceFinished(): Promise<boolean> {
  const doc = await db.doc(BROADCAST_STATE_DOC).get();

  if (!doc.exists) {
    return true; // No sequence = need to generate one
  }

  const state = doc.data() as BroadcastState;
  const now = Date.now();
  const endsAt = state.endsAt.toMillis();

  // Add 500ms buffer for network latency
  return now >= endsAt - 500;
}

/**
 * Scheduled function that checks and generates sequences.
 *
 * Runs every minute to check if current sequence has ended.
 * When it ends, generates a new one immediately.
 *
 * Note: Cloud Scheduler minimum is 1 minute. Since sequences are ~16s,
 * there may be brief gaps between sequences. For production, consider
 * using Cloud Tasks or a more granular scheduling approach.
 */
export const conductorTick = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    const finished = await isSequenceFinished();

    if (finished) {
      const result = await generateAndBroadcast();
      if (result.success) {
        console.log(`Broadcast tick: generated sequence #${result.sequenceNumber}`);
      } else {
        console.error(`Broadcast tick failed: ${result.error}`);
      }
    } else {
      console.log("Broadcast tick: sequence still playing");
    }
  });

/**
 * HTTP endpoint to manually trigger generation (for testing).
 * Should be protected in production.
 */
export const forceGenerate = functions.https.onRequest(async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const result = await generateAndBroadcast();

  if (result.success) {
    res.json({
      success: true,
      message: `Generated sequence #${result.sequenceNumber}`,
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error,
    });
  }
});

/**
 * HTTP endpoint to get server time for client synchronization.
 */
export const getServerTime = functions.https.onCall(async () => {
  return {
    serverTime: Date.now(),
    timestamp: Timestamp.now().toMillis(),
  };
});
