/**
 * LeaderboardManager
 * Service implementation for leaderboard data and rankings
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  where,
  getCountFromServer,
  onSnapshot,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { isPermissionDeniedError } from "$lib/shared/auth/utils/isPermissionDeniedError";
import type { ILeaderboardManager } from "../contracts/ILeaderboardManager";
import type {
  LeaderboardCategory,
  LeaderboardData,
  LeaderboardEntry,
  LeaderboardQueryOptions,
  RankHistoryEntry,
} from "../../domain/models/leaderboard-models";

/**
 * Interface for user data stored in Firestore
 */
interface FirestoreUserData extends DocumentData {
  displayName?: string;
  username?: string;
  photoURL?: string;
  avatar?: string;
  totalXP?: number;
  currentLevel?: number;
  sequenceCount?: number;
  achievementCount?: number;
  currentStreak?: number;
  longestStreak?: number;
  weeklyChallengesCompleted?: number;
  skillsCompleted?: number;
}

export class LeaderboardManager implements ILeaderboardManager {
  constructor() {}

  /**
   * Map Firestore user data to LeaderboardEntry
   */
  private mapToLeaderboardEntry(
    doc: QueryDocumentSnapshot<FirestoreUserData>,
    rank: number,
    category: LeaderboardCategory,
    currentUserId?: string
  ): LeaderboardEntry {
    const data = doc.data();
    const userId = doc.id;

    // Get the metric value based on category
    let totalXP: number | undefined;
    let currentLevel: number | undefined;
    let sequenceCount: number | undefined;
    let achievementCount: number | undefined;
    let currentStreak: number | undefined;
    let longestStreak: number | undefined;
    let weeklyChallengesCompleted: number | undefined;
    let skillsCompleted: number | undefined;

    switch (category) {
      case "xp":
        totalXP = data.totalXP ?? 0;
        currentLevel = data.currentLevel;
        break;
      case "level":
        currentLevel = data.currentLevel ?? 0;
        totalXP = data.totalXP;
        break;
      case "sequences":
        sequenceCount = data.sequenceCount ?? 0;
        break;
      case "achievements":
        achievementCount = data.achievementCount ?? 0;
        break;
      case "streak":
        currentStreak = data.currentStreak ?? 0;
        longestStreak = data.longestStreak ?? 0;
        break;
      case "weekly_challenges":
        weeklyChallengesCompleted = data.weeklyChallengesCompleted ?? 0;
        break;
      case "skill_mastery":
        skillsCompleted = data.skillsCompleted ?? 0;
        break;
    }

    const avatarValue = data.photoURL ?? data.avatar;
    const tierValue =
      rank === 1
        ? "gold"
        : rank === 2
          ? "silver"
          : rank === 3
            ? "bronze"
            : undefined;

    return {
      rank,
      userId,
      displayName: data.displayName ?? "Unknown User",
      username: data.username ?? userId,
      ...(avatarValue && { avatar: avatarValue }),
      ...(totalXP !== undefined && { totalXP }),
      ...(currentLevel !== undefined && { currentLevel }),
      ...(sequenceCount !== undefined && { sequenceCount }),
      ...(achievementCount !== undefined && { achievementCount }),
      ...(currentStreak !== undefined && { currentStreak }),
      ...(longestStreak !== undefined && { longestStreak }),
      ...(weeklyChallengesCompleted !== undefined && {
        weeklyChallengesCompleted,
      }),
      ...(skillsCompleted !== undefined && { skillsCompleted }),
      isCurrentUser: userId === currentUserId,
      ...(tierValue && { tier: tierValue }),
    };
  }

  /**
   * Get field name for ordering based on category
   */
  private getOrderByField(category: LeaderboardCategory): string {
    switch (category) {
      case "xp":
        return "totalXP";
      case "level":
        return "currentLevel";
      case "sequences":
        return "sequenceCount";
      case "achievements":
        return "achievementCount";
      case "streak":
        return "currentStreak";
      case "weekly_challenges":
        return "weeklyChallengesCompleted";
      case "skill_mastery":
        return "skillsCompleted";
    }
  }

  async getLeaderboard(
    category: LeaderboardCategory,
    options?: LeaderboardQueryOptions
  ): Promise<LeaderboardData> {
    try {
      const firestore = await getFirestoreInstance();
      const auth = getAuth();
      const currentUserId = auth.currentUser?.uid;

      const limitCount = options?.limit ?? 100;
      const orderByField = this.getOrderByField(category);

      // Query users collection ordered by the relevant metric
      const usersRef = collection(firestore, "users");
      const q = query(
        usersRef,
        orderBy(orderByField, "desc"),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);

      const entries: LeaderboardEntry[] = [];
      let currentUserRank: number | undefined;
      let rank = (options?.offset ?? 0) + 1;

      snapshot.forEach((doc) => {
        const entry = this.mapToLeaderboardEntry(
          doc,
          rank,
          category,
          currentUserId
        );
        entries.push(entry);

        if (entry.isCurrentUser) {
          currentUserRank = rank;
        }

        rank++;
      });

      return {
        category,
        entries,
        ...(currentUserRank !== undefined && { currentUserRank }),
        totalUsers: snapshot.size,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("[LeaderboardManager] Error fetching leaderboard:", error);
      toast.error("Failed to load leaderboard. Please try again.");
      throw new Error(`Failed to fetch ${category} leaderboard`);
    }
  }

  async getCurrentUserRank(
    category: LeaderboardCategory
  ): Promise<number | null> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return null;
    }
    return this.getUserRank(currentUser.uid, category);
  }

  async getUserRank(
    userId: string,
    category: LeaderboardCategory
  ): Promise<number | null> {
    try {
      const firestore = await getFirestoreInstance();
      const orderByField = this.getOrderByField(category);

      // First, get the user's current metric value (1 read)
      const userDocRef = doc(firestore, "users", userId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data() as FirestoreUserData;
      const userMetricValue = this.getMetricValue(userData, category);

      // If user has no value for this metric, they're unranked
      if (userMetricValue === 0 || userMetricValue === undefined) {
        return null;
      }

      // Count how many users have a HIGHER value (1 aggregation query)
      const usersRef = collection(firestore, "users");
      const countQuery = query(
        usersRef,
        where(orderByField, ">", userMetricValue)
      );

      const countSnapshot = await getCountFromServer(countQuery);
      const usersAhead = countSnapshot.data().count;

      // Rank = users ahead + 1
      return usersAhead + 1;
    } catch (error) {
      console.error("[LeaderboardManager] Error fetching user rank:", error);
      // Silent failure for rank lookup - non-critical for UX
      return null;
    }
  }

  /**
   * Get the metric value from user data based on category
   */
  private getMetricValue(
    data: FirestoreUserData,
    category: LeaderboardCategory
  ): number {
    switch (category) {
      case "xp":
        return data.totalXP ?? 0;
      case "level":
        return data.currentLevel ?? 0;
      case "sequences":
        return data.sequenceCount ?? 0;
      case "achievements":
        return data.achievementCount ?? 0;
      case "streak":
        return data.currentStreak ?? 0;
      case "weekly_challenges":
        return data.weeklyChallengesCompleted ?? 0;
      case "skill_mastery":
        return data.skillsCompleted ?? 0;
    }
  }

  subscribeToLeaderboard(
    category: LeaderboardCategory,
    callback: (data: LeaderboardData) => void,
    options?: LeaderboardQueryOptions
  ): () => void {
    // Store unsubscribe function for cleanup
    let unsubscribe: Unsubscribe | null = null;

    // Use async IIFE to get firestore instance
    void (async () => {
      try {
        const firestore = await getFirestoreInstance();
        const auth = getAuth();
        const currentUserId = auth.currentUser?.uid;

        const limitCount = options?.limit ?? 100;
        const orderByField = this.getOrderByField(category);

        const usersRef = collection(firestore, "users");
        const q = query(
          usersRef,
          orderBy(orderByField, "desc"),
          limit(limitCount)
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const entries: LeaderboardEntry[] = [];
            let currentUserRank: number | undefined;
            let rank = (options?.offset ?? 0) + 1;

            snapshot.forEach((doc) => {
              const entry = this.mapToLeaderboardEntry(
                doc,
                rank,
                category,
                currentUserId
              );
              entries.push(entry);

              if (entry.isCurrentUser) {
                currentUserRank = rank;
              }

              rank++;
            });

            const leaderboardData: LeaderboardData = {
              category,
              entries,
              ...(currentUserRank !== undefined && { currentUserRank }),
              totalUsers: snapshot.size,
              lastUpdated: new Date(),
            };

            callback(leaderboardData);
          },
          (error) => {
            // Expected on sign-out - the listener is about to be cleaned up.
            if (isPermissionDeniedError(error)) return;
            console.error(
              "[LeaderboardManager] Error in leaderboard subscription:",
              error
            );
            toast.error("Lost connection to leaderboard. Please refresh.");
          }
        );
      } catch (error) {
        console.error(
          "[LeaderboardManager] Error subscribing to leaderboard:",
          error
        );
        toast.error("Failed to connect to leaderboard.");
      }
    })();

    // Return cleanup function that calls unsubscribe when available
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  getRankHistory(
    _userId: string,
    _category: LeaderboardCategory,
    _period: "day" | "week" | "month"
  ): RankHistoryEntry[] {
    // TODO: Implement rank history tracking
    // This would require a separate collection to track historical rank data
    console.warn("LeaderboardManager: getRankHistory not yet implemented");
    return [];
  }

  refreshLeaderboard(_category: LeaderboardCategory): void {
    // Refresh is handled automatically by Firestore real-time listeners
    // This method could be used to trigger cache invalidation if needed
  }
}
