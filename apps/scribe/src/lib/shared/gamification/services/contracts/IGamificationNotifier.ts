/**
 * Notification Service Interface
 *
 * Handles achievement unlock notifications and toast messages.
 */

import type { AchievementNotification } from "../../domain/models/achievement-models";

export interface IGamificationNotifier {
  /**
   * Show an achievement unlock notification
   */
  showAchievementUnlock(
    achievementId: string,
    title: string,
    icon: string,
    xpGained: number
  ): Promise<void>;

  /**
   * Show a level up notification
   */
  showLevelUp(newLevel: number, milestoneTitle?: string): Promise<void>;

  /**
   * Show a daily challenge completion notification
   */
  showChallengeComplete(
    challengeTitle: string,
    xpGained: number
  ): Promise<void>;

  /**
   * Show a streak milestone notification
   */
  showStreakMilestone(streakDays: number): Promise<void>;

  /**
   * Show a quick XP gain notification (lightweight, brief)
   */
  showXPGain(amount: number, reason?: string): void;

  /**
   * Get unread notifications
   */
  getUnreadNotifications(): Promise<AchievementNotification[]>;

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): Promise<void>;

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Promise<void>;

  /**
   * Get notification history
   */
  getNotificationHistory(limit?: number): Promise<AchievementNotification[]>;

  /**
   * Clear all notifications
   */
  clearAll(): Promise<void>;
}
