/**
 * Achievement Persistence
 *
 * Handles all Firestore and IndexedDB operations for achievements and XP.
 * Single Responsibility: Data persistence layer
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "../../../../auth/firebase";
import { db } from "../../../../persistence/database/TKADatabase";
import {
  getUserAchievementsPath,
  getUserXPPath,
} from "../../../data/firestore-collections";
import { ALL_ACHIEVEMENTS } from "../../../domain/constants/achievement-definitions";
import type {
  Achievement,
  UserAchievement,
  UserXP,
} from "../../../domain/models/achievement-models";

export class AchievementPersistence {
  /**
   * Initialize user XP document in Firestore if it doesn't exist
   */
  async initializeUserXP(userId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const xpDocRef = doc(firestore, getUserXPPath(userId));
    const xpDoc = await getDoc(xpDocRef);

    if (!xpDoc.exists()) {
      const initialXP: UserXP = {
        id: "current",
        userId,
        totalXP: 0,
        currentLevel: 1,
        xpToNextLevel: 100,
        lastUpdated: new Date(),
      };

      await setDoc(xpDocRef, {
        ...initialXP,
        lastUpdated: serverTimestamp(),
      });

      // Also cache locally
      await db.userXP.add(initialXP);

    } else {
      // Cache existing Firestore data locally
      const firestoreXP = xpDoc.data() as UserXP;
      await db.userXP.put({
        ...firestoreXP,
        lastUpdated:
          firestoreXP.lastUpdated instanceof Timestamp
            ? firestoreXP.lastUpdated.toDate()
            : new Date(firestoreXP.lastUpdated),
      });
    }
  }

  /**
   * Initialize user achievement progress for all achievements
   * Uses a single batch query instead of individual reads for each achievement
   */
  async initializeUserAchievements(userId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const achievementsPath = getUserAchievementsPath(userId);
    const achievementsCollectionRef = collection(firestore, achievementsPath);

    // Fetch ALL existing achievements in a single query (1 DB call instead of 22+)
    const existingSnapshot = await getDocs(achievementsCollectionRef);
    const existingAchievementIds = new Set(
      existingSnapshot.docs.map((d) => d.id)
    );

    // Only create achievements that don't exist yet
    const missingAchievements = ALL_ACHIEVEMENTS.filter(
      (a) => !existingAchievementIds.has(a.id)
    );

    // Batch create missing achievements
    for (const achievement of missingAchievements) {
      const achievementDocRef = doc(
        firestore,
        `${achievementsPath}/${achievement.id}`
      );

      const userAchievement: Omit<UserAchievement, "id"> = {
        achievementId: achievement.id,
        userId,
        unlockedAt: new Date(),
        progress: 0,
        isCompleted: false,
        notificationShown: false,
      };

      await setDoc(achievementDocRef, {
        ...userAchievement,
        unlockedAt: serverTimestamp(),
      });

      // Cache locally
      await db.userAchievements.add({
        id: achievement.id,
        ...userAchievement,
      });
    }

  }

  /**
   * Get user XP (tries local cache first, falls back to Firestore)
   */
  async getUserXP(userId: string): Promise<UserXP> {
    // Try local cache first
    const localXP = await db.userXP.get("current");
    if (localXP) {
      return localXP;
    }

    // Fall back to Firestore
    const firestore = await getFirestoreInstance();
    const xpDocRef = doc(firestore, getUserXPPath(userId));
    const xpDoc = await getDoc(xpDocRef);

    if (!xpDoc.exists()) {
      throw new Error("User XP record not found");
    }

    const firestoreXP = xpDoc.data() as UserXP;

    // Cache it locally
    await db.userXP.put({
      ...firestoreXP,
      lastUpdated:
        firestoreXP.lastUpdated instanceof Timestamp
          ? firestoreXP.lastUpdated.toDate()
          : new Date(firestoreXP.lastUpdated),
    });

    return firestoreXP;
  }

  /**
   * Get all achievements with user progress
   */
  async getAllAchievements(
    userId: string | null
  ): Promise<Array<Achievement & { userProgress: UserAchievement | null }>> {
    if (!userId) {
      return ALL_ACHIEVEMENTS.map((a) => ({ ...a, userProgress: null }));
    }

    const firestore = await getFirestoreInstance();
    const achievementsPath = getUserAchievementsPath(userId);
    const achievementsSnapshot = await getDocs(
      collection(firestore, achievementsPath)
    );

    const userProgressMap = new Map<string, UserAchievement>();
    achievementsSnapshot.docs.forEach((doc) => {
      const data = doc.data() as UserAchievement;
      userProgressMap.set(doc.id, { ...data, id: doc.id });
    });

    return ALL_ACHIEVEMENTS.map((achievement) => ({
      ...achievement,
      userProgress: userProgressMap.get(achievement.id) ?? null,
    }));
  }

  /**
   * Get achievements by category
   */
  async getAchievementsByCategory(
    userId: string | null,
    category: Achievement["category"]
  ): Promise<Array<Achievement & { userProgress: UserAchievement | null }>> {
    const allAchievements = await this.getAllAchievements(userId);
    return allAchievements.filter((a) => a.category === category);
  }

  /**
   * Get recent achievements (last 7 days)
   */
  async getRecentAchievements(userId: string): Promise<UserAchievement[]> {
    const firestore = await getFirestoreInstance();
    const achievementsPath = getUserAchievementsPath(userId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentQuery = query(
      collection(firestore, achievementsPath),
      where("isCompleted", "==", true),
      where("unlockedAt", ">=", Timestamp.fromDate(sevenDaysAgo)),
      orderBy("unlockedAt", "desc"),
      limit(10)
    );

    const snapshot = await getDocs(recentQuery);
    return snapshot.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id }) as UserAchievement
    );
  }

  /**
   * Get single achievement progress
   */
  async getAchievementProgress(
    userId: string,
    achievementId: string
  ): Promise<UserAchievement | null> {
    const firestore = await getFirestoreInstance();
    const achievementsPath = getUserAchievementsPath(userId);
    const achievementDocRef = doc(
      firestore,
      `${achievementsPath}/${achievementId}`
    );
    const achievementDoc = await getDoc(achievementDocRef);

    if (!achievementDoc.exists()) {
      return null;
    }

    return {
      ...achievementDoc.data(),
      id: achievementDoc.id,
    } as UserAchievement;
  }
}
