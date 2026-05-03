/**
 * VoiceSessionRepository - Firebase Implementation
 *
 * Persists voice command sessions to Firestore.
 * Follows the TikaSessionRepository pattern but simpler (no review workflow).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type {
  VoiceSession,
  VoiceSessionPreview,
  VoiceSessionStats,
} from "$lib/shared/voice-control/domain/voice-session-types";
import {
  getUserVoiceSessionsPath,
  getUserVoiceSessionPath,
  VOICE_SESSION_LIMITS,
} from "../../data/firestore-paths";

export class VoiceSessionError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "UNAUTHORIZED" | "NETWORK"
  ) {
    super(message);
    this.name = "VoiceSessionError";
  }
}

export interface VoiceSessionQueryOptions {
  limit?: number;
  sortDirection?: "asc" | "desc";
}

export class VoiceSessionRepository {
  private getUserId(): string {
    const userId = authState.effectiveUserId;
    if (!userId) {
      throw new VoiceSessionError("User not authenticated", "UNAUTHORIZED");
    }
    return userId;
  }

  private toDate(timestamp: unknown): Date {
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date();
  }

  async saveSession(session: VoiceSession): Promise<VoiceSession> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const sessionWithUser: VoiceSession = { ...session, userId };

    const docRef = doc(
      firestore,
      getUserVoiceSessionPath(userId, session.id)
    );

    try {
      await trackWrite(
        () =>
          setDoc(docRef, sanitizeForFirestore({
            ...sessionWithUser,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            savedAt: serverTimestamp(),
          })),
        "voice-sessions"
      );

      return sessionWithUser;
    } catch (error) {
      console.error("[VoiceSessionRepository] Failed to save session:", error);
      throw new VoiceSessionError("Failed to save voice session", "NETWORK");
    }
  }

  async getSession(sessionId: string): Promise<VoiceSession | null> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserVoiceSessionPath(userId, sessionId)
    );

    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return this.mapDocToSession(docSnap.data(), docSnap.id);
    } catch (error) {
      console.error("[VoiceSessionRepository] Failed to get session:", error);
      throw new VoiceSessionError("Failed to load voice session", "NETWORK");
    }
  }

  async listSessions(options?: VoiceSessionQueryOptions): Promise<VoiceSessionPreview[]> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const collectionRef = collection(
      firestore,
      getUserVoiceSessionsPath(userId)
    );

    const sortDir = options?.sortDirection ?? "desc";
    const limitCount = options?.limit ?? VOICE_SESSION_LIMITS.DEFAULT_QUERY_LIMIT;

    const q = query(
      collectionRef,
      orderBy("startedAt", sortDir),
      firestoreLimit(limitCount)
    );

    try {
      const snapshot = await getDocs(q);
      const previews: VoiceSessionPreview[] = [];
      snapshot.forEach((docSnap) => {
        previews.push(this.mapDocToPreview(docSnap.data(), docSnap.id));
      });
      return previews;
    } catch (error) {
      console.error("[VoiceSessionRepository] Failed to list sessions:", error);
      throw new VoiceSessionError("Failed to load voice session list", "NETWORK");
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserVoiceSessionPath(userId, sessionId)
    );

    try {
      await trackWrite(() => deleteDoc(docRef), "voice-sessions");
    } catch (error) {
      console.error("[VoiceSessionRepository] Failed to delete session:", error);
      throw new VoiceSessionError("Failed to delete voice session", "NETWORK");
    }
  }

  async enforceSessionLimit(): Promise<number> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const collectionRef = collection(
      firestore,
      getUserVoiceSessionsPath(userId)
    );

    // Query all sessions ordered by date (oldest first)
    const q = query(
      collectionRef,
      orderBy("startedAt", "asc")
    );

    try {
      const snapshot = await getDocs(q);
      const totalCount = snapshot.size;
      const excess = totalCount - VOICE_SESSION_LIMITS.MAX_SESSIONS_PER_USER;

      if (excess <= 0) return 0;

      // Delete the oldest sessions to get back within limit
      let deleted = 0;
      for (const docSnap of snapshot.docs) {
        if (deleted >= excess) break;
        await trackWrite(() => deleteDoc(docSnap.ref), "voice-sessions");
        deleted++;
      }

      console.log(`[VoiceSessionRepository] Enforced session limit: deleted ${deleted} oldest sessions`);
      return deleted;
    } catch (error) {
      console.error("[VoiceSessionRepository] Failed to enforce session limit:", error);
      return 0;
    }
  }

  private mapDocToSession(data: DocumentData, id: string): VoiceSession {
    return {
      id,
      userId: data.userId || "",
      startedAt: this.toDate(data.startedAt),
      endedAt: this.toDate(data.endedAt),
      durationMs: data.durationMs || 0,
      events: data.events || [],
      stats: this.mapStats(data.stats),
    };
  }

  private mapDocToPreview(data: DocumentData, id: string): VoiceSessionPreview {
    return {
      id,
      startedAt: this.toDate(data.startedAt),
      endedAt: this.toDate(data.endedAt),
      durationMs: data.durationMs || 0,
      stats: this.mapStats(data.stats),
    };
  }

  private mapStats(raw: DocumentData | undefined): VoiceSessionStats {
    if (!raw) {
      return {
        totalEvents: 0,
        successCount: 0,
        failureCount: 0,
        unresolvedCount: 0,
        tierBreakdown: { tier1_regex: 0, tier2_llm: 0, tier3_chat: 0, unresolved: 0 },
        categoryBreakdown: {
          navigation: 0, settings: 0, playback: 0, create: 0, generator: 0,
          sequence: 0, ui: 0, search: 0, prop: 0, system: 0, none: 0,
        },
        avgLatencyMs: 0,
        avgLatencyByTier: {},
      };
    }

    return {
      totalEvents: raw.totalEvents || 0,
      successCount: raw.successCount || 0,
      failureCount: raw.failureCount || 0,
      unresolvedCount: raw.unresolvedCount || 0,
      tierBreakdown: raw.tierBreakdown || { tier1_regex: 0, tier2_llm: 0, tier3_chat: 0, unresolved: 0 },
      categoryBreakdown: raw.categoryBreakdown || {},
      avgLatencyMs: raw.avgLatencyMs || 0,
      avgLatencyByTier: raw.avgLatencyByTier || {},
    };
  }
}

/**
 * Recursively remove undefined values from an object.
 * Firestore doesn't accept undefined.
 */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as T;
  }

  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }

  return obj;
}
