/**
 * Firestore Collection Names and Paths
 *
 * Centralized constants for Firestore collections used in gamification.
 */

export const FIRESTORE_COLLECTIONS = {
  // User-specific collections
  USER_ACHIEVEMENTS: "userAchievements",
  USER_XP: "userXP",
  XP_EVENTS: "xpEvents",
  USER_CHALLENGE_PROGRESS: "userChallengeProgress",
  USER_STREAKS: "userStreaks",
  USER_NOTIFICATIONS: "userNotifications",
  USER_WEEKLY_PROGRESS: "userWeeklyProgress",
  USER_SKILL_PROGRESS: "userSkillProgress",
  USER_TRAIN_PROGRESS: "userTrainProgress",

  // Global collections
  DAILY_CHALLENGES: "dailyChallenges",
  WEEKLY_CHALLENGES: "weeklyChallenges",
  SKILL_PROGRESSIONS: "skillProgressions",
  TRAIN_CHALLENGES: "trainChallenges",
} as const;

/**
 * Get path to user's achievements collection
 */
export function getUserAchievementsPath(userId: string): string {
  return `users/${userId}/achievements`;
}

/**
 * Get path to user's XP document
 */
export function getUserXPPath(userId: string): string {
  return `users/${userId}/xp/current`;
}

/**
 * Get path to user's XP events collection
 */
export function getUserXPEventsPath(userId: string): string {
  return `users/${userId}/xpEvents`;
}

/**
 * Get path to user's challenge progress collection
 */
export function getUserChallengeProgressPath(userId: string): string {
  return `users/${userId}/challengeProgress`;
}

/**
 * Get path to user's streak document
 */
export function getUserStreakPath(userId: string): string {
  return `users/${userId}/streak/current`;
}

/**
 * Get path to user's notifications collection
 */
export function getUserNotificationsPath(userId: string): string {
  return `users/${userId}/notifications`;
}

/**
 * Get path to daily challenges collection
 */
export function getDailyChallengesPath(): string {
  return "dailyChallenges";
}

/**
 * Get path to weekly challenges collection
 */
export function getWeeklyChallengesPath(): string {
  return "weeklyChallenges";
}

/**
 * Get path to user's weekly challenge progress collection
 */
export function getUserWeeklyProgressPath(userId: string): string {
  return `users/${userId}/weeklyProgress`;
}

/**
 * Get path to skill progressions collection
 */
export function getSkillProgressionsPath(): string {
  return "skillProgressions";
}

/**
 * Get path to user's skill progress collection
 */
export function getUserSkillProgressPath(userId: string): string {
  return `users/${userId}/skillProgress`;
}

/**
 * Get path to train challenges collection
 */
export function getTrainChallengesPath(): string {
  return "trainChallenges";
}

/**
 * Get path to user's train challenge progress collection
 */
export function getUserTrainProgressPath(userId: string): string {
  return `users/${userId}/trainProgress`;
}
