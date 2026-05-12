/**
 * Broadcast Repository Implementation
 *
 * Subscribes to the live broadcast system via Firestore real-time listeners.
 * Provides synchronized playback state and history access.
 */

import type { Timestamp} from "firebase/firestore";
import { doc, onSnapshot, type Firestore } from "firebase/firestore";
import { httpsCallable, type Functions } from "firebase/functions";
import { firestoreListen } from "$lib/shared/firestore";
import { BroadcastHistoryEntrySchema } from "../domain/models/broadcast-schemas";
import type { BroadcastState, BroadcastStateClient, BroadcastHistoryEntry, ServerTimeResponse, } from "$lib/shared/landing/domain/broadcast-models";
import type {
  BroadcastStateCallback, BroadcastHistoryCallback } from "$lib/shared/landing/domain/types";
import { getFirestoreInstance, getFunctionsInstance } from "$lib/shared/auth/firebase";
// Firestore paths
const BROADCAST_STATE_DOC = "liveBroadcast/current";
const BROADCAST_HISTORY_COLLECTION = "liveBroadcast/history/entries";

/**
 * Convert Firestore Timestamp to milliseconds.
 */
function timestampToMs(timestamp: Timestamp | undefined | null): number {
  if (!timestamp) return Date.now();
  return timestamp.toMillis();
}

/**
 * Convert BroadcastState (with Timestamps) to BroadcastStateClient (with ms).
 */
function convertToClientState(state: BroadcastState): BroadcastStateClient {
  return {
    currentSequence: state.currentSequence,
    sequenceNumber: state.sequenceNumber,
    startedAtMs: timestampToMs(state.startedAt),
    endsAtMs: timestampToMs(state.endsAt),
    durationMs: state.durationMs,
    beatsPerMinute: state.beatsPerMinute,
    generatedAtMs: timestampToMs(state.generatedAt),
  };
}

export class BroadcastRepository {
  private serverTimeOffset: number | null = null;
  private firestoreInstance: Firestore | null = null;
  private functionsInstance: Functions | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize Firestore and Functions instances.
   * Called automatically before any operation that needs them.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.firestoreInstance && this.functionsInstance) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // Both use the same HMR-safe app instance from firebase module
      this.firestoreInstance = await getFirestoreInstance();
      this.functionsInstance = await getFunctionsInstance();
    })();

    return this.initPromise;
  }

  subscribeToBroadcast(callback: BroadcastStateCallback): () => void {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    // Initialize async then set up subscription
    this.ensureInitialized().then(() => {
      if (cancelled || !this.firestoreInstance) return;

      const docRef = doc(this.firestoreInstance, BROADCAST_STATE_DOC);

      unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            callback(null);
            return;
          }

          const data = snapshot.data() as BroadcastState;
          callback(convertToClientState(data));
        },
        (error) => {
          console.error("[BroadcastRepository] Error subscribing to broadcast:", error);
          callback(null);
        }
      );
    }).catch((error) => {
      console.error("[BroadcastRepository] Failed to initialize:", error);
      callback(null);
    });

    // Return unsubscribe function
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }

  subscribeToHistory(historyLimit: number, callback: BroadcastHistoryCallback): () => void {
    return firestoreListen(
      BROADCAST_HISTORY_COLLECTION,
      BroadcastHistoryEntrySchema,
      (items) => {
        const entries = items.map((item) => ({
          sequence: item.sequence as unknown as BroadcastHistoryEntry["sequence"],
          sequenceNumber: item.sequenceNumber,
          playedAtMs: item.playedAt instanceof Date ? item.playedAt.getTime() : Date.now(),
        })) as BroadcastHistoryEntry[];
        callback(entries);
      },
      {
        orderBy: [{ field: "sequenceNumber", direction: "desc" }],
        limit: historyLimit,
      },
      (error) => {
        console.error("[BroadcastRepository] Error subscribing to history:", error);
        callback([]);
      },
    );
  }

  async getServerTime(): Promise<ServerTimeResponse> {
    try {
      await this.ensureInitialized();

      if (!this.functionsInstance) {
        throw new Error("Functions not initialized");
      }

      const getServerTimeFn = httpsCallable<void, ServerTimeResponse>(
        this.functionsInstance,
        "broadcastGetServerTime"
      );

      const result = await getServerTimeFn();
      return result.data;
    } catch (error) {
      console.error("[BroadcastRepository] Error getting server time:", error);
      // Fallback to client time
      return {
        serverTime: Date.now(),
        timestamp: Date.now(),
      };
    }
  }

  async calculateServerTimeOffset(): Promise<number> {
    // Return cached offset if available
    if (this.serverTimeOffset !== null) {
      return this.serverTimeOffset;
    }

    try {
      const before = Date.now();
      const serverTimeResponse = await this.getServerTime();
      const after = Date.now();

      // Estimate network latency as half the round-trip time
      const roundTrip = after - before;
      const estimatedLatency = roundTrip / 2;

      // Calculate offset: positive means client is ahead of server
      // serverTime + offset = client time at the moment server responded
      this.serverTimeOffset = before + estimatedLatency - serverTimeResponse.serverTime;

      return this.serverTimeOffset;
    } catch (error) {
      console.error("[BroadcastRepository] Error calculating time offset:", error);
      this.serverTimeOffset = 0;
      return 0;
    }
  }

  getCurrentStepPosition(
    startedAtMs: number,
    durationMs: number,
    totalSteps: number,
    beatsPerMinute: number
  ): number {
    // Adjust client time by server offset
    const offset = this.serverTimeOffset ?? 0;
    const serverNow = Date.now() - offset;

    // Calculate elapsed time since sequence started
    const elapsed = serverNow - startedAtMs;

    // If sequence hasn't started yet, return beat 1
    if (elapsed < 0) {
      return 1;
    }

    // If sequence has ended, return last beat
    if (elapsed >= durationMs) {
      return totalSteps;
    }

    // Calculate ms per beat
    const msPerBeat = 60000 / beatsPerMinute;

    // Calculate current beat (1-indexed)
    const stepIndex = Math.floor(elapsed / msPerBeat);
    return Math.min(stepIndex + 1, totalSteps);
  }
}
