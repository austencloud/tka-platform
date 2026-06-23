/**
 * System State Service Implementation
 *
 * Unified data hub that loads and caches core admin collections.
 * Fetches users, challenges, and announcements once and derives all views from this snapshot.
 */

import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance, getAuthSync } from "$lib/shared/auth/firebase";
import type { SystemState, CachedUserMetadata, CachedChallenge, CachedAnnouncement } from "./types";

// Cache TTL: 2-3 minutes for ops work (stale data is acceptable)
const SYSTEM_STATE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Query timeout for Firebase operations
const QUERY_TIMEOUT_MS = 10000;

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

export class SystemStateManager {
  private cachedState: SystemState | null = null;

  constructor() {}

  /**
   * Check if Firestore is available
   */
  private async isFirestoreAvailable(): Promise<boolean> {
    const firestore = await getFirestoreInstance();
    return (
      firestore !== null && firestore !== undefined && getAuthSync().currentUser !== null
    );
  }

  /**
   * Get system state (cached or fresh)
   */
  async getSystemState(): Promise<SystemState> {
    // Return cached data if still valid
    if (this.cachedState && this.isCacheValid()) {
      return this.cachedState;
    }

    if (!(await this.isFirestoreAvailable())) {
      return this.getEmptySystemState();
    }

    try {
      const now = Date.now();
      const expiresAt = now + SYSTEM_STATE_CACHE_TTL_MS;

      // Load all collections in parallel
      const [users, challenges, announcements] = await Promise.all([
        this.loadUsers(),
        this.loadChallenges(),
        this.loadAnnouncements(),
      ]);

      const systemState: SystemState = {
        users,
        challenges,
        announcements,
        loadedAt: now,
        expiresAt,
      };

      // Cache the result
      this.cachedState = systemState;
      return systemState;
    } catch (error) {
      console.error("Failed to load system state:", error);
      return this.getEmptySystemState();
    }
  }

  /**
   * Load all users with metadata
   */
  private async loadUsers(): Promise<CachedUserMetadata[]> {
    try {
      const firestore = await getFirestoreInstance();
      const usersRef = collection(firestore, "users");
      const snapshot = await withTimeout(
        getDocs(usersRef),
        QUERY_TIMEOUT_MS,
        null
      );

      if (!snapshot) {
        return [];
      }

      const users: CachedUserMetadata[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        users.push(this.parseUserDocument(doc.id, data));
      });

      return users;
    } catch (error) {
      console.error("Failed to load users:", error);
      return [];
    }
  }

  /**
   * Parse user document into CachedUserMetadata
   */
  private parseUserDocument(
    userId: string,
    data: Record<string, unknown>
  ): CachedUserMetadata {
    const lastActivity = data["lastActivityDate"];
    let lastActivityDate: Date | null = null;
    if (lastActivity) {
      lastActivityDate =
        lastActivity instanceof Timestamp
          ? lastActivity.toDate()
          : new Date(lastActivity as string);
    }

    const createdAt = data["createdAt"];
    let createdAtDate: Date | null = null;
    if (createdAt) {
      createdAtDate =
        createdAt instanceof Timestamp
          ? createdAt.toDate()
          : new Date(createdAt as string);
    }

    return {
      id: userId,
      displayName: (data["displayName"] as string) ?? "Unknown",
      email: (data["email"] as string) ?? null,
      photoURL: (data["photoURL"] as string) ?? null,
      sequenceCount: (data["sequenceCount"] as number) ?? 0,
      publicSequenceCount: (data["publicSequenceCount"] as number) ?? 0,
      totalViews: (data["totalViews"] as number) ?? 0,
      shareCount: (data["shareCount"] as number) ?? 0,
      challengesCompleted: (data["challengesCompleted"] as number) ?? 0,
      achievementCount: (data["achievementCount"] as number) ?? 0,
      currentStreak: (data["currentStreak"] as number) ?? 0,
      totalXP: (data["totalXP"] as number) ?? 0,
      lastActivityDate,
      createdAt: createdAtDate,
      disabled: (data["disabled"] as boolean) ?? false,
      role: (data["role"] as string) ?? "user",
      isAnonymous: (data["isAnonymous"] as boolean) ?? false,
      attribution: (data["attribution"] as Record<string, unknown> | undefined) ?? null,
      lastLocation: (data["lastLocation"] as
        | import("$lib/shared/presence/domain/models/presence-models").PresenceLocation
        | undefined) ?? null,
    };
  }

  /**
   * Load all challenges (daily and train)
   */
  private async loadChallenges(): Promise<CachedChallenge[]> {
    try {
      const [dailyChallenges, trainChallenges] = await Promise.all([
        this.loadDailyChallenges(),
        this.loadTrainChallenges(),
      ]);

      return [...dailyChallenges, ...trainChallenges];
    } catch (error) {
      console.error("Failed to load challenges:", error);
      return [];
    }
  }

  /**
   * Load daily challenges
   */
  private async loadDailyChallenges(): Promise<CachedChallenge[]> {
    try {
      const firestore = await getFirestoreInstance();
      const challengesRef = collection(firestore, "dailyChallenges");
      const snapshot = await withTimeout(
        getDocs(challengesRef),
        QUERY_TIMEOUT_MS,
        null
      );

      if (!snapshot) {
        return [];
      }

      const challenges: CachedChallenge[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const scheduledDate = data["scheduledDate"];
        let scheduledDateObj: Date | null = null;
        if (scheduledDate) {
          scheduledDateObj =
            scheduledDate instanceof Timestamp
              ? scheduledDate.toDate()
              : new Date(scheduledDate as string);
        }

        const createdAt = data["createdAt"];
        let createdAtDate: Date | null = null;
        if (createdAt) {
          createdAtDate =
            createdAt instanceof Timestamp
              ? createdAt.toDate()
              : new Date(createdAt as string);
        }

        challenges.push({
          id: doc.id,
          name: (data["name"] as string) ?? "Untitled",
          description: (data["description"] as string) ?? null,
          difficulty: (data["difficulty"] as string) ?? "intermediate",
          xpReward: (data["xpReward"] as number) ?? 0,
          sequenceId: (data["sequenceId"] as string) ?? null,
          scheduledDate: scheduledDateObj,
          createdAt: createdAtDate,
          type: "daily",
        });
      });

      return challenges;
    } catch (error) {
      console.error("Failed to load daily challenges:", error);
      return [];
    }
  }

  /**
   * Load train challenges
   */
  private async loadTrainChallenges(): Promise<CachedChallenge[]> {
    try {
      const firestore = await getFirestoreInstance();
      const challengesRef = collection(firestore, "trainChallenges");
      const snapshot = await withTimeout(
        getDocs(challengesRef),
        QUERY_TIMEOUT_MS,
        null
      );

      if (!snapshot) {
        return [];
      }

      const challenges: CachedChallenge[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data["createdAt"];
        let createdAtDate: Date | null = null;
        if (createdAt) {
          createdAtDate =
            createdAt instanceof Timestamp
              ? createdAt.toDate()
              : new Date(createdAt as string);
        }

        challenges.push({
          id: doc.id,
          name: (data["name"] as string) ?? "Untitled",
          description: (data["description"] as string) ?? null,
          difficulty: (data["difficulty"] as string) ?? "intermediate",
          xpReward: (data["xpReward"] as number) ?? 0,
          sequenceId: null, // Train challenges don't have sequences
          scheduledDate: null,
          createdAt: createdAtDate,
          type: "train",
        });
      });

      return challenges;
    } catch (error) {
      console.error("Failed to load train challenges:", error);
      return [];
    }
  }

  /**
   * Load all announcements
   */
  private async loadAnnouncements(): Promise<CachedAnnouncement[]> {
    try {
      const firestore = await getFirestoreInstance();
      const announcementsRef = collection(firestore, "announcements");
      const snapshot = await withTimeout(
        getDocs(announcementsRef),
        QUERY_TIMEOUT_MS,
        null
      );

      if (!snapshot) {
        return [];
      }

      const announcements: CachedAnnouncement[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data["createdAt"];
        let createdAtDate: Date | null = null;
        if (createdAt) {
          createdAtDate =
            createdAt instanceof Timestamp
              ? createdAt.toDate()
              : new Date(createdAt as string);
        }

        const expiresAt = data["expiresAt"];
        let expiresAtDate: Date | null = null;
        if (expiresAt) {
          expiresAtDate =
            expiresAt instanceof Timestamp
              ? expiresAt.toDate()
              : new Date(expiresAt as string);
        }

        announcements.push({
          id: doc.id,
          title: (data["title"] as string) ?? "Untitled",
          message: (data["message"] as string) ?? "",
          severity:
            (data["severity"] as "info" | "warning" | "critical") ?? "info",
          audiences: (data["audiences"] as string[]) ?? [],
          displayMode: (data["displayMode"] as "modal" | "banner") ?? "modal",
          createdAt: createdAtDate,
          expiresAt: expiresAtDate,
          actionLabel: (data["actionLabel"] as string) ?? undefined,
          actionUrl: (data["actionUrl"] as string) ?? undefined,
        });
      });

      return announcements;
    } catch (error) {
      console.error("Failed to load announcements:", error);
      return [];
    }
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid(): boolean {
    if (!this.cachedState) {
      return false;
    }
    return Date.now() < this.cachedState.expiresAt;
  }

  /**
   * Invalidate the cache
   */
  invalidateCache(): void {
    this.cachedState = null;
  }

  /**
   * Get TTL remaining in milliseconds
   */
  getCacheTTLRemaining(): number {
    if (!this.cachedState) {
      return 0;
    }
    const remaining = this.cachedState.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Return empty system state when Firebase is unavailable
   */
  private getEmptySystemState(): SystemState {
    return {
      users: [],
      challenges: [],
      announcements: [],
      loadedAt: Date.now(),
      expiresAt: Date.now(),
    };
  }
}
