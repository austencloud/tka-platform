"use strict";
/**
 * Broadcast Conductor
 *
 * Cloud Function that generates sequences on a schedule and broadcasts
 * them to all connected clients via Firestore.
 *
 * This is the "conductor" of the live broadcast - it determines what
 * everyone sees and when.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerTime = exports.forceGenerate = exports.conductorTick = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const sequence_generator_1 = require("./sequence-generator");
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
 * Get or initialize conductor state.
 */
async function getConductorState() {
    const doc = await db.doc(CONDUCTOR_STATE_DOC).get();
    if (!doc.exists) {
        const initial = {
            loopTypeIndex: Math.floor(Math.random() * 11), // Start at random position
            totalGenerated: 0,
            lastGeneratedAt: firestore_1.Timestamp.now(),
        };
        await db.doc(CONDUCTOR_STATE_DOC).set(initial);
        return initial;
    }
    return doc.data();
}
/**
 * Update conductor state after generation.
 */
async function updateConductorState(loopTypeIndex, totalGenerated) {
    await db.doc(CONDUCTOR_STATE_DOC).update({
        loopTypeIndex,
        totalGenerated,
        lastGeneratedAt: firestore_1.Timestamp.now(),
    });
}
/**
 * Archive current sequence to history.
 */
async function archiveToHistory(state) {
    const historyEntry = {
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
async function generateAndBroadcast() {
    try {
        // Get conductor state
        const conductorState = await getConductorState();
        // Generate new sequence
        const { sequence, nextLoopTypeIndex } = (0, sequence_generator_1.generateLOOPSequence)(conductorState.loopTypeIndex);
        const newSequenceNumber = conductorState.totalGenerated + 1;
        const now = firestore_1.Timestamp.now();
        const durationMs = (0, sequence_generator_1.calculateDuration)(sequence.totalBeats, BEATS_PER_MINUTE);
        const endsAt = firestore_1.Timestamp.fromMillis(now.toMillis() + durationMs);
        // Create broadcast state
        const broadcastState = {
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
            const currentState = currentDoc.data();
            await archiveToHistory(currentState);
        }
        // Update broadcast state
        await db.doc(BROADCAST_STATE_DOC).set(broadcastState);
        // Update conductor state
        await updateConductorState(nextLoopTypeIndex, newSequenceNumber);
        // Update global metrics
        await db.doc("appMetrics/spinner").set({
            totalGenerated: firestore_1.FieldValue.increment(1),
            lastGeneratedAt: now,
        }, { merge: true });
        console.log(`Generated sequence #${newSequenceNumber}: ${sequence.word} (${sequence.loopType}, ${sequence.totalBeats} beats)`);
        return { success: true, sequenceNumber: newSequenceNumber };
    }
    catch (error) {
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
async function isSequenceFinished() {
    const doc = await db.doc(BROADCAST_STATE_DOC).get();
    if (!doc.exists) {
        return true; // No sequence = need to generate one
    }
    const state = doc.data();
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
exports.conductorTick = functions.pubsub
    .schedule("every 1 minutes")
    .onRun(async () => {
    const finished = await isSequenceFinished();
    if (finished) {
        const result = await generateAndBroadcast();
        if (result.success) {
            console.log(`Broadcast tick: generated sequence #${result.sequenceNumber}`);
        }
        else {
            console.error(`Broadcast tick failed: ${result.error}`);
        }
    }
    else {
        console.log("Broadcast tick: sequence still playing");
    }
});
/**
 * HTTP endpoint to manually trigger generation (for testing).
 * Should be protected in production.
 */
exports.forceGenerate = functions.https.onRequest(async (req, res) => {
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
    }
    else {
        res.status(500).json({
            success: false,
            error: result.error,
        });
    }
});
/**
 * HTTP endpoint to get server time for client synchronization.
 */
exports.getServerTime = functions.https.onCall(async () => {
    return {
        serverTime: Date.now(),
        timestamp: firestore_1.Timestamp.now().toMillis(),
    };
});
//# sourceMappingURL=conductor.js.map