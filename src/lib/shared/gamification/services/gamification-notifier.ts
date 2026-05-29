/**
 * Gamification Notifier
 *
 * Handles achievement unlock notifications, level-ups, and toast messages.
 * Uses both Firestore (persistent history) and Svelte 5 runes (reactive UI).
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../auth/firebase";
import { db } from "../../persistence/database/tka-database";
import { getUserNotificationsPath } from "../data/firestore-collections";
import type { AchievementNotification } from "../domain/models/achievement-models";
import { getMilestoneForLevel } from "../domain/constants/xp-constants";
import {
  addNotification,
  clearNotifications,
} from "../state/notification-state.svelte";
import { addXPToast } from "../state/xp-toast-state.svelte";

async function saveAndQueueNotification(
  notification: AchievementNotification
): Promise<void> {
  const user = auth.currentUser;

  addNotification(notification);
  await db.achievementNotifications.add(notification);

  if (user) {
    try {
      const firestore = await getFirestoreInstance();
      const notificationsPath = getUserNotificationsPath(user.uid);
      const notificationRef = doc(
        firestore,
        `${notificationsPath}/${notification.id}`
      );

      await setDoc(notificationRef, {
        ...notification,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("❌ Failed to save notification to Firestore:", error);
    }
  }
}

export async function showAchievementUnlock(
  achievementId: string,
  title: string,
  icon: string,
  xpGained: number
): Promise<void> {
  const notification: AchievementNotification = {
    id: `achievement_${achievementId}_${Date.now()}`,
    type: "achievement",
    title: "Achievement Unlocked!",
    message: `${title} (+${xpGained} XP)`,
    icon,
    timestamp: new Date(),
    isRead: false,
    data: { achievementId, xpGained },
  };

  await saveAndQueueNotification(notification);
}

export async function showLevelUp(newLevel: number, milestoneTitle?: string): Promise<void> {
  const milestone = getMilestoneForLevel(newLevel);
  const title = milestone?.title ?? milestoneTitle;

  const notification: AchievementNotification = {
    id: `level_${newLevel}_${Date.now()}`,
    type: "level_up",
    title: "Level Up!",
    message: title
      ? `${milestone?.icon ?? "⭐"} Level ${newLevel}: ${title}`
      : `⭐ You've reached Level ${newLevel}!`,
    icon: milestone?.icon ?? "⭐",
    timestamp: new Date(),
    isRead: false,
    data: { newLevel, milestoneTitle: title },
  };

  await saveAndQueueNotification(notification);
}

export async function showChallengeComplete(
  challengeTitle: string,
  xpGained: number
): Promise<void> {
  const notification: AchievementNotification = {
    id: `challenge_${Date.now()}`,
    type: "challenge_complete",
    title: "Daily Challenge Complete!",
    message: `🎯 ${challengeTitle} (+${xpGained} XP)`,
    icon: "🎯",
    timestamp: new Date(),
    isRead: false,
    data: { challengeTitle, xpGained },
  };

  await saveAndQueueNotification(notification);
}

export async function showStreakMilestone(streakDays: number): Promise<void> {
  const getStreakIcon = (days: number): string => {
    if (days >= 100) return "⭐";
    if (days >= 30) return "💪";
    if (days >= 7) return "📅";
    return "🔥";
  };

  const getStreakMessage = (days: number): string => {
    if (days >= 100) return "Legendary 100-Day Streak!";
    if (days >= 30) return "Amazing 30-Day Streak!";
    if (days >= 7) return "One Week Streak!";
    return `${days}-Day Streak!`;
  };

  const notification: AchievementNotification = {
    id: `streak_${streakDays}_${Date.now()}`,
    type: "streak_milestone",
    title: "Streak Milestone!",
    message: `${getStreakIcon(streakDays)} ${getStreakMessage(streakDays)}`,
    icon: getStreakIcon(streakDays),
    timestamp: new Date(),
    isRead: false,
    data: { streakDays },
  };

  await saveAndQueueNotification(notification);
}

export function showXPGain(amount: number, reason?: string): void {
  addXPToast(amount, reason);
}

export async function getUnreadNotifications(): Promise<AchievementNotification[]> {
  const user = auth.currentUser;
  if (!user) {
    return await db.achievementNotifications
      .filter((n) => n.isRead === false)
      .toArray();
  }

  const firestore = await getFirestoreInstance();
  const notificationsPath = getUserNotificationsPath(user.uid);
  const unreadQuery = query(
    collection(firestore, notificationsPath),
    where("isRead", "==", false),
    orderBy("timestamp", "desc"),
    limit(50)
  );

  const snapshot = await getDocs(unreadQuery);
  return snapshot.docs.map(
    (doc) => ({ ...doc.data(), id: doc.id }) as AchievementNotification
  );
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const user = auth.currentUser;

  await db.achievementNotifications.update(notificationId, { isRead: true });

  if (user) {
    try {
      const firestore = await getFirestoreInstance();
      const notificationsPath = getUserNotificationsPath(user.uid);
      const notificationRef = doc(
        firestore,
        `${notificationsPath}/${notificationId}`
      );

      await updateDoc(notificationRef, { isRead: true });
    } catch (error) {
      console.error("❌ Failed to mark notification as read:", error);
    }
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const user = auth.currentUser;

  const unread = await db.achievementNotifications
    .filter((n) => n.isRead === false)
    .toArray();

  for (const notification of unread) {
    await db.achievementNotifications.update(notification.id, { isRead: true });
  }

  if (user) {
    try {
      const firestore = await getFirestoreInstance();
      const notificationsPath = getUserNotificationsPath(user.uid);
      const unreadQuery = query(
        collection(firestore, notificationsPath),
        where("isRead", "==", false)
      );

      const snapshot = await getDocs(unreadQuery);
      const batch = writeBatch(firestore);

      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });

      await batch.commit();
    } catch (error) {
      console.error("❌ Failed to mark all notifications as read:", error);
    }
  }
}

export async function getNotificationHistory(
  limitCount: number = 50
): Promise<AchievementNotification[]> {
  const user = auth.currentUser;
  if (!user) {
    return await db.achievementNotifications
      .orderBy("timestamp")
      .reverse()
      .limit(limitCount)
      .toArray();
  }

  const firestore = await getFirestoreInstance();
  const notificationsPath = getUserNotificationsPath(user.uid);
  const historyQuery = query(
    collection(firestore, notificationsPath),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(historyQuery);
  return snapshot.docs.map(
    (doc) => ({ ...doc.data(), id: doc.id }) as AchievementNotification
  );
}

export async function clearAllNotifications(): Promise<void> {
  const user = auth.currentUser;

  await db.achievementNotifications.clear();

  if (user) {
    try {
      const firestore = await getFirestoreInstance();
      const notificationsPath = getUserNotificationsPath(user.uid);
      const allQuery = query(collection(firestore, notificationsPath));

      const snapshot = await getDocs(allQuery);
      const batch = writeBatch(firestore);

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error("❌ Failed to clear notifications:", error);
    }
  }

  clearNotifications();
}
