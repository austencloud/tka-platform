/**
 * Achievement Definitions
 *
 * All available achievements in TKA Composer.
 * These are the "templates" that users can unlock.
 */

import type { Achievement } from "../models/achievement-models";

// ============================================================================
// CREATOR ACHIEVEMENTS (Building Sequences)
// ============================================================================

const CREATOR_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_sequence",
    title: "First Steps",
    description: "Create your first sequence",
    category: "creator",
    tier: "bronze",
    xpReward: 50,
    icon: "fa-magic-wand-sparkles",
    requirement: {
      type: "sequence_count",
      target: 1,
    },
  },
  {
    id: "spell_name",
    title: "Personal Touch",
    description: "Create a sequence that spells your name",
    category: "creator",
    tier: "bronze",
    xpReward: 75,
    icon: "fa-pen-fancy",
    requirement: {
      type: "specific_action",
      target: 1,
      metadata: { action: "spell_name" },
    },
  },
  {
    id: "alphabet_master",
    title: "Alphabet Master",
    description: "Create sequences using all 26 letters",
    category: "creator",
    tier: "gold",
    xpReward: 300,
    icon: "fa-spell-check",
    requirement: {
      type: "letter_usage",
      target: 26,
    },
  },
  {
    id: "long_sequence",
    title: "Marathon Flow",
    description: "Create a sequence with 10+ steps",
    category: "creator",
    tier: "silver",
    xpReward: 150,
    icon: "fa-ruler",
    requirement: {
      type: "sequence_length",
      target: 10,
    },
  },
];

// ============================================================================
// SCHOLAR ACHIEVEMENTS (Learning Concepts)
// ============================================================================

const SCHOLAR_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_concept",
    title: "Curious Mind",
    description: "Complete your first concept",
    category: "scholar",
    tier: "bronze",
    xpReward: 50,
    icon: "fa-book-open",
    requirement: {
      type: "concept_completion",
      target: 1,
    },
  },
  {
    id: "concepts_28",
    title: "TKA Master",
    description: "Complete all 28 concepts",
    category: "scholar",
    tier: "platinum",
    xpReward: 500,
    icon: "fa-trophy",
    requirement: {
      type: "concept_completion",
      target: 28,
    },
  },
];

// ============================================================================
// PRACTITIONER ACHIEVEMENTS (Daily Streaks & Practice)
// ============================================================================

const PRACTITIONER_ACHIEVEMENTS: Achievement[] = [
  {
    id: "streak_3",
    title: "Getting Started",
    description: "Practice 3 days in a row",
    category: "practitioner",
    tier: "bronze",
    xpReward: 75,
    icon: "fa-fire",
    requirement: {
      type: "daily_streak",
      target: 3,
    },
  },
  {
    id: "streak_7",
    title: "Weekly Warrior",
    description: "Practice 7 days in a row",
    category: "practitioner",
    tier: "silver",
    xpReward: 150,
    icon: "fa-calendar-days",
    requirement: {
      type: "daily_streak",
      target: 7,
    },
  },
  {
    id: "streak_30",
    title: "Dedicated Practitioner",
    description: "Practice 30 days in a row",
    category: "practitioner",
    tier: "gold",
    xpReward: 300,
    icon: "fa-dumbbell",
    requirement: {
      type: "daily_streak",
      target: 30,
    },
  },
  {
    id: "streak_100",
    title: "Flow Master",
    description: "Practice 100 days in a row",
    category: "practitioner",
    tier: "platinum",
    xpReward: 1000,
    icon: "fa-star",
    requirement: {
      type: "daily_streak",
      target: 100,
    },
  },
];

// ============================================================================
// TRAINER ACHIEVEMENTS (Training Challenges)
// ============================================================================

const TRAINER_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_challenge",
    title: "Challenge Accepted",
    description: "Complete your first training challenge",
    category: "trainer",
    tier: "bronze",
    xpReward: 50,
    icon: "fa-dumbbell",
    requirement: {
      type: "challenge_count",
      target: 1,
      metadata: { challengeType: "train" },
    },
  },
  {
    id: "perfect_practice",
    title: "Perfectionist",
    description: "Complete a training session with 100% accuracy",
    category: "trainer",
    tier: "silver",
    xpReward: 100,
    icon: "fa-star",
    requirement: {
      type: "specific_action",
      target: 1,
      metadata: { action: "perfect_training_run" },
    },
  },
  {
    id: "combo_king",
    title: "Combo King",
    description: "Achieve a combo of 20 or more",
    category: "trainer",
    tier: "gold",
    xpReward: 200,
    icon: "fa-bolt",
    requirement: {
      type: "specific_action",
      target: 1,
      metadata: { action: "training_combo_20" },
    },
  },
  {
    id: "speed_demon",
    title: "Speed Demon",
    description: "Complete 5 sequences in Timed mode at 150 BPM",
    category: "trainer",
    tier: "gold",
    xpReward: 250,
    icon: "fa-stopwatch",
    requirement: {
      type: "specific_action",
      target: 5,
      metadata: { action: "timed_150bpm" },
    },
  },
  {
    id: "challenge_master",
    title: "Challenge Master",
    description: "Complete all available training challenges",
    category: "trainer",
    tier: "platinum",
    xpReward: 500,
    icon: "fa-crown",
    requirement: {
      type: "specific_action",
      target: 1,
      metadata: { action: "all_train_challenges_complete" },
    },
  },
];

// ============================================================================
// BROWSER ACHIEVEMENTS (Browsing Gallery)
// Removed: browse_10/50/100 were pure quantity spam with no skill component
// ============================================================================

// ============================================================================
// CONTRIBUTOR ACHIEVEMENTS (Feedback Submission)
// ============================================================================

const CONTRIBUTOR_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_feedback",
    title: "Voice Heard",
    description: "Submit your first feedback",
    category: "contributor",
    tier: "bronze",
    xpReward: 50,
    icon: "fa-comment",
    requirement: {
      type: "feedback_count",
      target: 1,
    },
  },
];

// ============================================================================
// ALL ACHIEVEMENTS
// ============================================================================

export const ALL_ACHIEVEMENTS: Achievement[] = [
  ...CREATOR_ACHIEVEMENTS,
  ...SCHOLAR_ACHIEVEMENTS,
  ...PRACTITIONER_ACHIEVEMENTS,
  ...TRAINER_ACHIEVEMENTS,
  ...CONTRIBUTOR_ACHIEVEMENTS,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAchievementById(id: string): Achievement | undefined {
  return ALL_ACHIEVEMENTS.find((achievement) => achievement.id === id);
}

export function getAchievementsByCategory(
  category: Achievement["category"]
): Achievement[] {
  return ALL_ACHIEVEMENTS.filter(
    (achievement) => achievement.category === category
  );
}

export function getAchievementsByTier(
  tier: Achievement["tier"]
): Achievement[] {
  return ALL_ACHIEVEMENTS.filter((achievement) => achievement.tier === tier);
}
