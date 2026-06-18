/**
 * Session Manager Service
 *
 * Manages sequence session lifecycle:
 * - Session creation and tracking
 * - Session state persistence to Firestore
 * - Session cleanup
 *
 * Domain: Create module - Session management
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance, getAuthSync } from "$lib/shared/auth/firebase";
import {
  createSequenceSession,
  generateDeviceId,
  type SequenceSession,
} from "../domain/sequence-session";

export class SessionManager {
  private currentSession = $state<SequenceSession | null>(null);
  private deviceId: string;

  constructor() {
    this.deviceId = generateDeviceId();
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): SequenceSession | null {
    return this.currentSession;
  }

  /**
   * Create a new session
   */
  async createSession(): Promise<SequenceSession | null> {
    const user = getAuthSync().currentUser;
    if (!user) {
      // Guest (no Firebase identity): session tracking is a Firestore-backed
      // convenience, not a hard requirement. No-op rather than throw so the
      // create flow works for signed-out users without console noise.
      return null;
    }

    const sessionData = createSequenceSession(user.uid, this.deviceId);

    const session: SequenceSession = {
      ...sessionData,
      createdAt: serverTimestamp() as Timestamp,
      lastModified: serverTimestamp() as Timestamp,
      lastAutosave: null,
    };

    // Save to Firestore
    const firestore = await getFirestoreInstance();
    const sessionRef = doc(
      firestore,
      `users/${user.uid}/sessions/${session.sessionId}`
    );
    await setDoc(sessionRef, session);

    this.currentSession = session;
    return session;
  }

  /**
   * Update session metadata
   */
  async updateSession(
    updates: Partial<Omit<SequenceSession, "sessionId" | "userId">>
  ): Promise<void> {
    if (!this.currentSession) {
      // No session was created (e.g. guest) — nothing to update.
      return;
    }

    const user = getAuthSync().currentUser;
    if (!user) {
      // Auth lapsed (token expired / signed out) after the session was created.
      // Cleanup paths like abandonSession() run on unmount and must not throw an
      // uncaught rejection — drop the local session and return.
      this.currentSession = null;
      return;
    }

    const firestore = await getFirestoreInstance();
    const sessionRef = doc(
      firestore,
      `users/${user.uid}/sessions/${this.currentSession.sessionId}`
    );

    await updateDoc(sessionRef, {
      ...updates,
      lastModified: serverTimestamp(),
    });

    // Update local state
    this.currentSession = {
      ...this.currentSession,
      ...updates,
      lastModified: serverTimestamp() as Timestamp,
    };
  }

  /**
   * Mark session as saved with sequence ID
   */
  async markAsSaved(sequenceId: string): Promise<void> {
    await this.updateSession({
      isSaved: true,
      sequenceId,
      status: "completed",
    });
  }

  /**
   * Update beat count in session
   */
  async updateStepCount(stepCount: number): Promise<void> {
    await this.updateSession({ stepCount });
  }

  /**
   * Mark last autosave timestamp
   */
  async markAutosaved(): Promise<void> {
    await this.updateSession({
      lastAutosave: serverTimestamp() as Timestamp,
    });
  }

  /**
   * Get recent sessions for current user
   */
  async getRecentSessions(limit = 10): Promise<SequenceSession[]> {
    const user = getAuthSync().currentUser;
    if (!user) return [];

    const firestore = await getFirestoreInstance();
    const sessionsRef = collection(firestore, `users/${user.uid}/sessions`);
    const q = query(sessionsRef, where("deviceId", "==", this.deviceId));

    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map(
      (doc) => ({ ...doc.data(), sessionId: doc.id }) as SequenceSession
    );

    // Sort by lastModified descending
    return sessions
      .sort(
        (a, b) =>
          (b.lastModified?.toMillis() ?? 0) - (a.lastModified?.toMillis() ?? 0)
      )
      .slice(0, limit);
  }

  /**
   * Load a session by ID
   */
  async loadSession(sessionId: string): Promise<SequenceSession | null> {
    const user = getAuthSync().currentUser;
    if (!user) return null;

    const firestore = await getFirestoreInstance();
    const sessionRef = doc(
      firestore,
      `users/${user.uid}/sessions/${sessionId}`
    );
    const snapshot = await getDoc(sessionRef);

    if (!snapshot.exists()) return null;

    const session = { ...snapshot.data(), sessionId } as SequenceSession;
    this.currentSession = session;
    return session;
  }

  /**
   * Clear current session (doesn't delete from Firestore)
   */
  clearSession(): void {
    this.currentSession = null;
  }

  /**
   * Abandon current session (marks as abandoned in Firestore)
   */
  async abandonSession(): Promise<void> {
    if (this.currentSession) {
      await this.updateSession({ status: "abandoned" });
      this.currentSession = null;
    }
  }
}
