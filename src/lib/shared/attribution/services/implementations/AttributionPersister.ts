/**
 * Attribution Persister Service Implementation
 *
 * Handles storage of attribution data in localStorage (pre-signup)
 * and Firestore (post-signup).
 */

import type {
  AnonymousAttributionSession,
  UserAttribution,
  TouchData,
  SelfReportedAttribution,
  SignupContext,
} from "../../domain/types";
import { captureTouchData, isDifferentTouch } from "../attribution-capture";

const STORAGE_KEY = "tka-attribution-session";
const MAX_TOUCHES = 20;

export class AttributionPersister {

  /**
   * Get or create an anonymous session for tracking before signup
   */
  getOrCreateSession(): AnonymousAttributionSession {
    const existing = this.getSession();
    if (existing) {
      return existing;
    }

    // Create new session with current touch data
    const touch = captureTouchData();
    const session: AnonymousAttributionSession = {
      sessionId: this.generateSessionId(),
      firstTouch: touch,
      lastTouch: touch,
      touches: [touch],
      sessionCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveSession(session);
    return session;
  }

  /**
   * Get the current anonymous session if it exists
   */
  getSession(): AnonymousAttributionSession | null {
    if (typeof localStorage === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored) as AnonymousAttributionSession;

      // Validate session structure
      if (!session.sessionId || !session.firstTouch) {
        console.warn("[Attribution] Invalid session structure, clearing");
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.warn("[Attribution] Failed to parse session:", error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Record a new touch to the current session
   */
  recordTouch(touch: TouchData): void {
    const session = this.getSession();
    if (!session) {
      // No session yet, create one
      this.getOrCreateSession();
      return;
    }

    // Check if this touch is meaningfully different
    if (!isDifferentTouch(session.lastTouch, touch)) {
      // Same attribution, just update the timestamp and session count
      session.sessionCount += 1;
      session.updatedAt = new Date().toISOString();
      this.saveSession(session);
      return;
    }

    // New attribution data - add as a new touch
    session.lastTouch = touch;
    session.touches.push(touch);
    session.sessionCount += 1;
    session.updatedAt = new Date().toISOString();

    // Cap touches to prevent unbounded growth
    if (session.touches.length > MAX_TOUCHES) {
      // Keep first touch, last N-1 touches
      const firstTouch = session.touches[0];
      if (firstTouch) {
        session.touches = [
          firstTouch,
          ...session.touches.slice(-(MAX_TOUCHES - 1)),
        ];
      }
    }

    this.saveSession(session);
  }

  /**
   * Add self-reported attribution to the session
   * This is stored temporarily until signup
   */
  recordSelfReported(data: SelfReportedAttribution): void {
    const session = this.getSession();
    if (!session) {
      console.warn("[Attribution] No session to record self-reported data");
      return;
    }

    // Store in session (will be merged into user attribution on signup)
    const sessionWithSelfReported = {
      ...session,
      selfReported: data,
      updatedAt: new Date().toISOString(),
    };

    this.saveSession(sessionWithSelfReported as AnonymousAttributionSession);
  }

  /**
   * Finalize attribution on signup
   */
  async finalizeForUser(
    userId: string,
    signupContext: SignupContext
  ): Promise<UserAttribution> {
    const session = this.getSession();

    // Calculate derived metrics
    const firstTouchDate = session
      ? new Date(session.firstTouch.timestamp)
      : new Date();
    const daysSinceFirstVisit = Math.floor(
      (Date.now() - firstTouchDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Build user attribution
    const currentTouch = captureTouchData();
    const attribution: UserAttribution = {
      firstTouch: session?.firstTouch || currentTouch,
      lastTouch: session?.lastTouch || currentTouch,
      touches: session?.touches || [currentTouch],
      sessionCount: session?.sessionCount || 1,
      daysSinceFirstVisit,
      selfReported: (session as unknown as { selfReported?: SelfReportedAttribution })?.selfReported,
      signup: signupContext,
    };

    // Persist to Firestore
    await this.saveToFirestore(userId, attribution);

    // Clear the anonymous session
    this.clearSession();

    return attribution;
  }

  /**
   * Get attribution data for a user from Firestore
   */
  async getUserAttribution(userId: string): Promise<UserAttribution | null> {
    try {
      const { getFirestoreInstance } = await import(
        "$lib/shared/auth/firebase"
      );
      const { doc, getDoc } = await import("firebase/firestore");

      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, `users/${userId}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();
      return data.attribution as UserAttribution | null;
    } catch (error) {
      console.error("[Attribution] Failed to get user attribution:", error);
      return null;
    }
  }

  /**
   * Update self-reported attribution for an existing user
   */
  async updateSelfReported(
    userId: string,
    data: SelfReportedAttribution
  ): Promise<void> {
    try {
      const { getFirestoreInstance } = await import(
        "$lib/shared/auth/firebase"
      );
      const { doc, updateDoc } = await import("firebase/firestore");

      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, `users/${userId}`);

      await updateDoc(docRef, {
        "attribution.selfReported": data,
      });
    } catch (error) {
      console.error("[Attribution] Failed to update self-reported:", error);
      throw error;
    }
  }

  /**
   * Add self-reported data - auto-routes based on auth state
   * For deferred attribution prompt that appears after engagement
   */
  async addSelfReportedData(data: SelfReportedAttribution): Promise<void> {
    try {
      // Check if user is authenticated
      const { authState } = await import("$lib/shared/auth/state/authState.svelte");
      const userId = authState.user?.uid;

      if (userId) {
        // User is authenticated - save to Firestore
        await this.updateSelfReported(userId, data);
        console.log("[Attribution] Saved self-reported data for user:", userId);
      } else {
        // User not authenticated - save to session
        this.recordSelfReported(data);
        console.log("[Attribution] Saved self-reported data to anonymous session");
      }
    } catch (error) {
      console.error("[Attribution] Failed to add self-reported data:", error);
      throw error;
    }
  }

  /**
   * Clear the anonymous session
   */
  clearSession(): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Check if we have an existing session
   */
  hasSession(): boolean {
    return this.getSession() !== null;
  }

  // === Private Helpers ===

  private saveSession(session: AnonymousAttributionSession): void {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error("[Attribution] Failed to save session:", error);
    }
  }

  private async saveToFirestore(
    userId: string,
    attribution: UserAttribution
  ): Promise<void> {
    try {
      const { getFirestoreInstance } = await import(
        "$lib/shared/auth/firebase"
      );
      const { doc, setDoc } = await import("firebase/firestore");

      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, `users/${userId}`);

      await setDoc(
        docRef,
        { attribution },
        { merge: true }
      );

      console.log("[Attribution] Saved attribution for user:", userId);
    } catch (error) {
      console.error("[Attribution] Failed to save to Firestore:", error);
      // Don't throw - attribution is non-critical
    }
  }

  private generateSessionId(): string {
    // Simple unique ID using timestamp + random
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }
}
