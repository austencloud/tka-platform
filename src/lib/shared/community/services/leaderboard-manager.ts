/**
 * Leaderboard data and rankings
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
import { isPermissionDeniedError } from "$lib/shared/auth/utils/is-permission-denied-error";
import type {
  LeaderboardCategory,
  LeaderboardData,
  LeaderboardEntry,
  LeaderboardQueryOptions,
  RankHistoryEntry,
} from "../domain/models/leaderboard-models";

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

function getOrderByField(category: LeaderboardCategory): string {
  switch (category) {
    case "xp": return "totalXP";
    case "level": return "currentLevel";
    case "sequences": return "sequenceCount";
    case "achievements": return "achievementCount";
    case "streak": return "currentStreak";
    case "weekly_challenges": return "weeklyChallengesCompleted";
    case "skill_mastery": return "skillsCompleted";
  }
}

function getMetricValue(data: FirestoreUserData, category: LeaderboardCategory): number {
  switch (category) {
    case "xp": return data.totalXP ?? 0;
    case "level": return data.currentLevel ?? 0;
    case "sequences": return data.sequenceCount ?? 0;
    case "achievements": return data.achievementCount ?? 0;
    case "streak": return data.currentStreak ?? 0;
    case "weekly_challenges": return data.weeklyChallengesCompleted ?? 0;
    case "skill_mastery": return data.skillsCompleted ?? 0;
  }
}

function mapToLeaderboardEntry(
  docSnap: QueryDocumentSnapshot<FirestoreUserData>,
  rank: number,
  category: LeaderboardCategory,
  currentUserId?: string,
): LeaderboardEntry {
  const data = docSnap.data();
  const userId = docSnap.id;

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
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : undefined;

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
    ...(weeklyChallengesCompleted !== undefined && { weeklyChallengesCompleted }),
    ...(skillsCompleted !== undefined && { skillsCompleted }),
    isCurrentUser: userId === currentUserId,
    ...(tierValue && { tier: tierValue }),
  };
}

export async function getLeaderboard(
  category: LeaderboardCategory,
  options?: LeaderboardQueryOptions,
): Promise<LeaderboardData> {
  try {
    const firestore = await getFirestoreInstance();
    const auth = getAuth();
    const currentUserId = auth.currentUser?.uid;

    const limitCount = options?.limit ?? 100;
    const orderByField = getOrderByField(category);

    const usersRef = collection(firestore, "users");
    const q = query(usersRef, orderBy(orderByField, "desc"), limit(limitCount));

    const snapshot = await getDocs(q);

    const entries: LeaderboardEntry[] = [];
    let currentUserRank: number | undefined;
    let rank = (options?.offset ?? 0) + 1;

    snapshot.forEach((docSnap) => {
      const entry = mapToLeaderboardEntry(docSnap, rank, category, currentUserId);
      entries.push(entry);
      if (entry.isCurrentUser) currentUserRank = rank;
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
    console.error("[leaderboard-manager] Error fetching leaderboard:", error);
    toast.error("Failed to load leaderboard. Please try again.");
    throw new Error(`Failed to fetch ${category} leaderboard`);
  }
}

export async function getCurrentUserRank(
  category: LeaderboardCategory,
): Promise<number | null> {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return getUserRank(currentUser.uid, category);
}

export async function getUserRank(
  userId: string,
  category: LeaderboardCategory,
): Promise<number | null> {
  try {
    const firestore = await getFirestoreInstance();
    const orderByField = getOrderByField(category);

    const userDocRef = doc(firestore, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) return null;

    const userData = userDoc.data() as FirestoreUserData;
    const userMetricValue = getMetricValue(userData, category);

    if (userMetricValue === 0 || userMetricValue === undefined) return null;

    const usersRef = collection(firestore, "users");
    const countQuery = query(usersRef, where(orderByField, ">", userMetricValue));
    const countSnapshot = await getCountFromServer(countQuery);

    return countSnapshot.data().count + 1;
  } catch (error) {
    console.error("[leaderboard-manager] Error fetching user rank:", error);
    return null;
  }
}

export function subscribeToLeaderboard(
  category: LeaderboardCategory,
  callback: (data: LeaderboardData) => void,
  options?: LeaderboardQueryOptions,
): () => void {
  let unsubscribe: Unsubscribe | null = null;

  void (async () => {
    try {
      const firestore = await getFirestoreInstance();
      const auth = getAuth();
      const currentUserId = auth.currentUser?.uid;

      const limitCount = options?.limit ?? 100;
      const orderByField = getOrderByField(category);

      const usersRef = collection(firestore, "users");
      const q = query(usersRef, orderBy(orderByField, "desc"), limit(limitCount));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const entries: LeaderboardEntry[] = [];
          let currentUserRank: number | undefined;
          let rank = (options?.offset ?? 0) + 1;

          snapshot.forEach((docSnap) => {
            const entry = mapToLeaderboardEntry(docSnap, rank, category, currentUserId);
            entries.push(entry);
            if (entry.isCurrentUser) currentUserRank = rank;
            rank++;
          });

          callback({
            category,
            entries,
            ...(currentUserRank !== undefined && { currentUserRank }),
            totalUsers: snapshot.size,
            lastUpdated: new Date(),
          });
        },
        (error) => {
          if (isPermissionDeniedError(error)) return;
          console.error("[leaderboard-manager] Error in leaderboard subscription:", error);
          toast.error("Lost connection to leaderboard. Please refresh.");
        },
      );
    } catch (error) {
      console.error("[leaderboard-manager] Error subscribing to leaderboard:", error);
      toast.error("Failed to connect to leaderboard.");
    }
  })();

  return () => { if (unsubscribe) unsubscribe(); };
}

export function getRankHistory(
  _userId: string,
  _category: LeaderboardCategory,
  _period: "day" | "week" | "month",
): RankHistoryEntry[] {
  console.warn("leaderboard-manager: getRankHistory not yet implemented");
  return [];
}

export function refreshLeaderboard(_category: LeaderboardCategory): void {
  // Handled automatically by Firestore real-time listeners
}
