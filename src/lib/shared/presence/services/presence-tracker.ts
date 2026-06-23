/**
 * Presence Service Implementation
 *
 * Manages real-time user presence using Firebase Realtime Database.
 * Uses activity-based detection (like Facebook) to show actual user engagement,
 * not just whether they have the app open.
 */

import {
  ref,
  set,
  update,
  onValue,
  onDisconnect,
  serverTimestamp,
  off,
  get,
  remove,
} from "firebase/database";
import { doc, getDoc, setDoc, serverTimestamp as fsServerTimestamp } from "firebase/firestore";
import posthog from "posthog-js";
import { database, auth, getFirestoreInstance } from "../../auth/firebase";
import { BREAKPOINTS } from "../../device/domain/constants/device-constants";
import type {
  UserPresence,
  UserPresenceWithId,
  PresenceStats,
  ActivityStatus,
  PresenceLocation,
} from "../domain/models/presence-models";
import { computeActivityStatus } from "../domain/models/presence-models";
import { ActivityTracker } from "../utils/activity-tracker";

export class PresenceTracker {
  private currentPresence: UserPresence | null = null;
  private initialized = false;
  private presenceRef: ReturnType<typeof ref> | null = null;
  private activityTracker: ActivityTracker | null = null;
  private userDeleted = false;
  private pendingLocation: PresenceLocation | null = null;

  constructor() {}

  /**
   * Get session ID from PostHog (automatic session tracking)
   * Falls back to generated ID if PostHog not available
   */
  private getSessionId(): string {
    try {
      const posthogSessionId = posthog.get_session_id?.();
      if (posthogSessionId) return posthogSessionId;
    } catch {
      // PostHog not initialized
    }

    // Fallback: generate a simple session ID
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Detect device type from user agent and screen size
   */
  private detectDevice(): "desktop" | "mobile" | "tablet" {
    if (typeof window === "undefined") return "desktop";

    const userAgent = navigator.userAgent.toLowerCase();
    const screenWidth = window.innerWidth;

    const isMobileUA =
      /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
    const isTabletUA = /ipad|tablet|playbook|silk/i.test(userAgent);

    if (isTabletUA || (isMobileUA && screenWidth >= BREAKPOINTS.MOBILE)) {
      return "tablet";
    }

    if (isMobileUA || screenWidth < BREAKPOINTS.MOBILE) {
      return "mobile";
    }

    return "desktop";
  }

  /**
   * Check if the user's Firestore document exists.
   * If not, the user was deleted and we should not write presence.
   */
  private async checkUserExists(userId: string): Promise<boolean> {
    try {
      const firestore = await getFirestoreInstance();
      const userDoc = await getDoc(doc(firestore, "users", userId));
      return userDoc.exists();
    } catch (err) {
      console.warn("[PresenceTracker] Could not verify user exists:", err);
      // If we can't check, assume user exists to avoid breaking presence for real users
      return true;
    }
  }

  /**
   * Clean up presence for a deleted user.
   */
  private async cleanupDeletedUser(): Promise<void> {
    this.userDeleted = true;
    this.stopActivityTracking();

    if (this.presenceRef) {
      try {
        await remove(this.presenceRef);
      } catch {
        // Could not remove presence
      }
    }

    this.currentPresence = null;
    this.initialized = false;
    this.presenceRef = null;
  }

  /**
   * Provide the caller's IP-derived location (from the layout server load).
   * Stored and written into the presence record + user doc on initialize().
   * Null is ignored so a prior good location is never clobbered.
   */
  setLocation(location: PresenceLocation | null): void {
    if (!location) return;
    this.pendingLocation = location;
    // If already initialized this session, persist immediately.
    if (this.initialized) {
      void this.persistLocation();
    }
  }

  /** Write the pending location to the RTDB presence record and the user doc. */
  private async persistLocation(): Promise<void> {
    const loc = this.pendingLocation;
    if (!loc) return;
    const user = auth.currentUser;
    if (!user) return;

    // 1) Live location on the presence record (for the map of online users).
    if (this.presenceRef && this.currentPresence) {
      this.currentPresence.location = loc;
      await update(this.presenceRef, { location: loc });
    }

    // 2) Persistent last-known location on the Firestore user doc.
    try {
      const firestore = await getFirestoreInstance();
      await setDoc(
        doc(firestore, "users", user.uid),
        { lastLocation: { ...loc, updatedAt: fsServerTimestamp() } },
        { merge: true }
      );
    } catch (error) {
      console.warn("[PresenceTracker] lastLocation write failed:", error);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.userDeleted) return; // User was deleted, don't reinitialize

    const user = auth.currentUser;
    if (!user) return;

    const userId = user.uid;

    // Verify user document exists in Firestore before setting up presence
    const userExists = await this.checkUserExists(userId);
    if (!userExists) {
      await this.cleanupDeletedUser();
      return;
    }

    this.presenceRef = ref(database, `presence/${userId}`);

    const now = Date.now();

    // Create presence data with activity tracking
    // Session ID from PostHog (or fallback), device detected locally.
    // Anonymous (guest) users have no displayName/email/photoURL — RTDB rejects
    // any object containing `undefined`, so omit those keys entirely when absent
    // rather than writing `undefined`/`null` values.
    this.currentPresence = {
      online: true,
      activityStatus: "active",
      lastActivity: now,
      lastSeen: now,
      currentModule: "create",
      currentTab: null,
      sessionId: this.getSessionId(),
      device: this.detectDevice(),
      ...(this.pendingLocation ? { location: this.pendingLocation } : {}),
      ...(user.displayName ? { displayName: user.displayName } : {}),
      ...(user.email ? { email: user.email } : {}),
      ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    };

    // Set up onDisconnect handler FIRST
    // This ensures we mark as offline even if the browser crashes
    const disconnectData: Record<string, unknown> = {
      online: false,
      activityStatus: "offline",
      lastSeen: serverTimestamp(),
      lastActivity: serverTimestamp(),
    };

    await onDisconnect(this.presenceRef).update(disconnectData);

    // Now set the presence data
    await set(this.presenceRef, {
      ...this.currentPresence,
      lastSeen: serverTimestamp(),
      lastActivity: serverTimestamp(),
    });

    // Start activity tracking
    this.startActivityTracking();

    this.initialized = true;

    // Persist last-known location to the user doc (non-blocking).
    if (this.pendingLocation) {
      void this.persistLocation();
    }
  }

  /** Start tracking user interactions for activity-based presence */
  private startActivityTracking(): void {
    if (this.activityTracker) return;

    this.activityTracker = new ActivityTracker({
      onActivity: () => this.handleUserActivity(),
    });

    this.activityTracker.start();
  }

  /** Stop activity tracking */
  private stopActivityTracking(): void {
    if (this.activityTracker) {
      this.activityTracker.stop();
      this.activityTracker = null;
    }
  }

  /** Handle detected user activity */
  private async handleUserActivity(): Promise<void> {
    if (!this.presenceRef || !this.currentPresence) return;
    if (this.userDeleted) return;

    // Periodically verify user still exists (every ~30 activity updates)
    if (Math.random() < 0.03) {
      const user = auth.currentUser;
      if (user) {
        const userExists = await this.checkUserExists(user.uid);
        if (!userExists) {
          await this.cleanupDeletedUser();
          return;
        }
      }
    }

    const now = Date.now();
    this.currentPresence.lastActivity = now;
    this.currentPresence.activityStatus = "active";

    // Update only activity-related fields to minimize writes
    await update(this.presenceRef, {
      lastActivity: serverTimestamp(),
      activityStatus: "active",
    });
  }

  async updateLocation(module: string, tab?: string | null): Promise<void> {
    if (this.userDeleted) return;

    if (!this.presenceRef || !this.currentPresence) {
      // Try to initialize first
      await this.initialize();
      if (!this.presenceRef || !this.currentPresence) return;
    }

    const now = Date.now();
    this.currentPresence.currentModule = module;
    this.currentPresence.currentTab = tab ?? null;
    this.currentPresence.lastSeen = now;
    this.currentPresence.lastActivity = now;
    this.currentPresence.activityStatus = "active";

    // Navigation counts as activity
    if (this.activityTracker) {
      this.activityTracker.forceActivityUpdate();
    }

    await set(this.presenceRef, {
      ...this.currentPresence,
      lastSeen: serverTimestamp(),
      lastActivity: serverTimestamp(),
    });
  }

  async goOffline(): Promise<void> {
    // Stop activity tracking first
    this.stopActivityTracking();

    if (!this.presenceRef) return;

    await update(this.presenceRef, {
      online: false,
      activityStatus: "offline",
      lastSeen: serverTimestamp(),
      lastActivity: serverTimestamp(),
    });

    this.currentPresence = null;
    this.initialized = false;
  }

  getCurrentPresence(): UserPresence | null {
    return this.currentPresence ? { ...this.currentPresence } : null;
  }

  subscribeToAllPresence(
    callback: (users: UserPresenceWithId[]) => void
  ): () => void {
    const presenceListRef = ref(database, "presence");

    const handleValue = (snapshot: {
      val: () => Record<string, UserPresence> | null;
    }) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }

      const users: UserPresenceWithId[] = Object.entries(data).map(
        ([userId, presence]) => {
          // Compute real-time activity status based on lastActivity
          const computedStatus = computeActivityStatus(
            presence.lastActivity ?? presence.lastSeen,
            presence.online
          );
          return {
            userId,
            ...presence,
            // Override stored status with computed status for accuracy
            activityStatus: computedStatus,
          };
        }
      );

      // Sort: active first, then offline, then by lastActivity (most recent first)
      users.sort((a, b) => {
        const statusA = a.activityStatus ?? "offline";
        const statusB = b.activityStatus ?? "offline";

        // Active users first
        if (statusA !== statusB) {
          return statusA === "active" ? -1 : 1;
        }
        // Within same status, sort by most recent activity
        const activityA = a.lastActivity ?? a.lastSeen;
        const activityB = b.lastActivity ?? b.lastSeen;
        return activityB - activityA;
      });

      callback(users);
    };

    onValue(presenceListRef, handleValue);

    return () => {
      off(presenceListRef, "value", handleValue);
    };
  }

  subscribeToUserPresence(
    userId: string,
    callback: (presence: UserPresence | null) => void
  ): () => void {
    const userPresenceRef = ref(database, `presence/${userId}`);

    const handleValue = (snapshot: { val: () => UserPresence | null }) => {
      callback(snapshot.val());
    };

    onValue(userPresenceRef, handleValue);

    return () => {
      off(userPresenceRef, "value", handleValue);
    };
  }

  async getPresenceStats(): Promise<PresenceStats> {
    const presenceListRef = ref(database, "presence");
    const snapshot = await get(presenceListRef);
    const data = snapshot.val() as Record<string, UserPresence> | null;

    if (!data) {
      return {
        activeCount: 0,
        inactiveCount: 0,
        byModule: {},
        byDevice: { desktop: 0, mobile: 0, tablet: 0 },
      };
    }

    const stats: PresenceStats = {
      activeCount: 0,
      inactiveCount: 0,
      byModule: {},
      byDevice: { desktop: 0, mobile: 0, tablet: 0 },
    };

    for (const presence of Object.values(data)) {
      // Compute real-time activity status
      const status = computeActivityStatus(
        presence.lastActivity ?? presence.lastSeen,
        presence.online
      );

      if (status === "active") {
        stats.activeCount++;
        stats.byModule[presence.currentModule] =
          (stats.byModule[presence.currentModule] ?? 0) + 1;
        stats.byDevice[presence.device]++;
      } else {
        stats.inactiveCount++;
      }
    }

    return stats;
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const userPresenceRef = ref(database, `presence/${userId}`);
    const snapshot = await get(userPresenceRef);
    const presence = snapshot.val() as UserPresence | null;

    if (!presence) return false;

    // Use activity-based status, not just connection status
    const status = computeActivityStatus(
      presence.lastActivity ?? presence.lastSeen,
      presence.online
    );
    return status === "active";
  }

  /** Get detailed activity status for a user */
  async getUserActivityStatus(userId: string): Promise<ActivityStatus> {
    const userPresenceRef = ref(database, `presence/${userId}`);
    const snapshot = await get(userPresenceRef);
    const presence = snapshot.val() as UserPresence | null;

    if (!presence) return "offline";

    return computeActivityStatus(
      presence.lastActivity ?? presence.lastSeen,
      presence.online
    );
  }
}
