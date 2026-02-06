/**
 * XP and Leveling Constants
 *
 * Defines XP rewards and level progression formulas.
 */

// ============================================================================
// XP REWARDS BY ACTION
// ============================================================================

export const XP_REWARDS = {
  // Creation actions
  SEQUENCE_CREATED: 10,
  SEQUENCE_PUBLISHED: 50,

  // Learning actions
  CONCEPT_LEARNED: 20,
  DRILL_COMPLETED: 5,

  // Daily engagement
  DAILY_LOGIN: 15,
  DAILY_CHALLENGE_COMPLETED: 50,

  // Feedback & contributions
  FEEDBACK_SUBMITTED: 25,

  // Achievement unlocks (additional to achievement's own XP)
  ACHIEVEMENT_UNLOCKED_BRONZE: 25,
  ACHIEVEMENT_UNLOCKED_SILVER: 50,
  ACHIEVEMENT_UNLOCKED_GOLD: 100,
  ACHIEVEMENT_UNLOCKED_PLATINUM: 250,

  // Weekly challenges
  WEEKLY_CHALLENGE_COMPLETED: 200,
  WEEKLY_CHALLENGE_BONUS: 100, // Early completion bonus

  // Skill progressions
  SKILL_LEVEL_COMPLETED: 75,
  SKILL_MASTERY_ACHIEVED: 250, // Completing all levels of a skill

  // Train module
  TRAINING_SESSION_COMPLETED: 10, // Base XP for completing any training session
  TRAINING_PERFECT_RUN: 25, // Bonus for 100% accuracy
  TRAINING_HIGH_ACCURACY: 15, // Bonus for 85%+ accuracy
  TRAINING_GOOD_ACCURACY: 5, // Bonus for 70%+ accuracy
  TRAINING_COMBO_BONUS: 2, // XP per combo point achieved
  TRAIN_CHALLENGE_COMPLETED: 0, // Challenges have their own XP rewards
} as const;

// ============================================================================
// LEVEL PROGRESSION
// ============================================================================

/**
 * Calculate XP required for a specific level
 * Uses exponential formula: baseXP * (level ^ exponent)
 *
 * Example progression:
 * - Level 1 → 2: 100 XP
 * - Level 2 → 3: 150 XP
 * - Level 3 → 4: 210 XP
 * - Level 10 → 11: 750 XP
 * - Level 20 → 21: 2000 XP
 */
export function calculateXPForLevel(level: number): number {
  if (level <= 1) return 0;

  const baseXP = 100;
  const exponent = 1.5;

  return Math.floor(baseXP * Math.pow(level, exponent));
}

/**
 * Calculate total XP required to reach a level (cumulative)
 */
export function calculateTotalXPForLevel(level: number): number {
  let totalXP = 0;
  for (let i = 2; i <= level; i++) {
    totalXP += calculateXPForLevel(i);
  }
  return totalXP;
}

/**
 * Calculate current level from total XP
 */
export function calculateLevelFromXP(totalXP: number): {
  currentLevel: number;
  xpToNextLevel: number;
  xpIntoCurrentLevel: number;
} {
  let currentLevel = 1;
  let cumulativeXP = 0;

  // Find the highest level the user has reached
   
  while (true) {
    const xpForNextLevel = calculateXPForLevel(currentLevel + 1);
    if (cumulativeXP + xpForNextLevel > totalXP) {
      break;
    }
    cumulativeXP += xpForNextLevel;
    currentLevel++;
  }

  const xpForNextLevel = calculateXPForLevel(currentLevel + 1);
  const xpIntoCurrentLevel = totalXP - cumulativeXP;
  const xpToNextLevel = xpForNextLevel - xpIntoCurrentLevel;

  return {
    currentLevel,
    xpToNextLevel,
    xpIntoCurrentLevel,
  };
}

/**
 * Get level thresholds for displaying progress
 */
export function getLevelProgress(totalXP: number): {
  currentLevel: number;
  progress: number; // 0-100 percentage toward next level
  xpIntoCurrentLevel: number;
  xpRequiredForLevel: number;
  xpToNextLevel: number;
} {
  const { currentLevel, xpToNextLevel, xpIntoCurrentLevel } =
    calculateLevelFromXP(totalXP);
  const xpRequiredForLevel = calculateXPForLevel(currentLevel + 1);
  const progress = Math.floor((xpIntoCurrentLevel / xpRequiredForLevel) * 100);

  return {
    currentLevel,
    progress,
    xpIntoCurrentLevel,
    xpRequiredForLevel,
    xpToNextLevel,
  };
}

// ============================================================================
// LEVEL REWARDS
// ============================================================================

/**
 * Special rewards at milestone levels
 */
export const LEVEL_MILESTONES = {
  5: { title: "Beginner Flow Artist", icon: "🌱" },
  10: { title: "Intermediate Practitioner", icon: "🌿" },
  20: { title: "Advanced Flow Artist", icon: "🌳" },
  30: { title: "Expert Choreographer", icon: "🎯" },
  50: { title: "Master of Movement", icon: "👑" },
  75: { title: "Legendary Flow Artist", icon: "⭐" },
  100: { title: "TKA Grandmaster", icon: "💎" },
} as const;

export function getMilestoneForLevel(
  level: number
): { title: string; icon: string } | null {
  if (level in LEVEL_MILESTONES) {
    return LEVEL_MILESTONES[level as keyof typeof LEVEL_MILESTONES];
  }
  return null;
}

// ============================================================================
// XP MULTIPLIERS (Future Feature)
// ============================================================================

/**
 * Potential multipliers for special events or conditions
 * Not implemented in Phase 1, but defined for future use
 */
export const XP_MULTIPLIERS = {
  WEEKEND_BONUS: 1.5, // 50% more XP on weekends
  STREAK_BONUS_7: 1.2, // 20% more XP with 7-day streak
  STREAK_BONUS_30: 1.5, // 50% more XP with 30-day streak
  EVENT_BONUS: 2.0, // Double XP during special events
} as const;
