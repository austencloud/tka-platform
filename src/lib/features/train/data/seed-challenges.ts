/**
 * Seed Train Challenges
 *
 * Sample training challenges to populate Firestore.
 * These can be used for initial setup or testing.
 */

import type { TrainChallenge } from "../domain/models/train-challenge-models";
import { PracticeMode } from "../domain/enums/train-enums";

export const SEED_CHALLENGES: Omit<TrainChallenge, "id" | "createdAt">[] = [
  // === BEGINNER CHALLENGES ===
  {
    title: "First Steps",
    description:
      "Complete any sequence 3 times to get familiar with the practice interface.",
    difficulty: "easy",
    xpReward: 50,
    requirement: {
      type: "complete_sequence",
      target: 3,
    },
    isActive: true,
    order: 0,
  },
  {
    title: "Accuracy Basics",
    description:
      "Achieve 70% accuracy on any sequence. Take your time and focus on precision.",
    difficulty: "easy",
    xpReward: 75,
    bonusXP: 25,
    bonusCondition: "perfect_run",
    requirement: {
      type: "achieve_accuracy",
      target: 70,
    },
    isActive: true,
    order: 1,
  },
  {
    title: "Adaptive Practice",
    description:
      "Complete 5 sequences using Adaptive mode. This mode automatically advances as you match positions.",
    difficulty: "easy",
    xpReward: 100,
    requirement: {
      type: "complete_sequence",
      target: 5,
      metadata: {
        mode: PracticeMode.ADAPTIVE,
      },
    },
    isActive: true,
    order: 2,
  },

  // === INTERMEDIATE CHALLENGES ===
  {
    title: "Combo Master",
    description:
      "Build a combo streak of 10 or more correct positions in a single practice session.",
    difficulty: "medium",
    xpReward: 150,
    bonusXP: 50,
    bonusCondition: "perfect_run",
    requirement: {
      type: "achieve_combo",
      target: 10,
    },
    isActive: true,
    order: 3,
  },
  {
    title: "Precision Training",
    description:
      "Achieve 85% accuracy or higher on any sequence. Precision is key!",
    difficulty: "medium",
    xpReward: 200,
    bonusXP: 75,
    bonusCondition: "perfect_run",
    requirement: {
      type: "achieve_accuracy",
      target: 85,
    },
    isActive: true,
    order: 4,
  },
  {
    title: "Step-by-Step Mastery",
    description:
      "Complete 10 sequences using Step-by-Step mode. Use voice commands or tap to advance beat by beat.",
    difficulty: "medium",
    xpReward: 175,
    requirement: {
      type: "complete_sequence",
      target: 10,
      metadata: {
        mode: PracticeMode.STEP_BY_STEP,
      },
    },
    isActive: true,
    order: 5,
  },
  {
    title: "Variety Challenge",
    description:
      "Complete 5 different sequences to browse diverse movement patterns.",
    difficulty: "medium",
    xpReward: 180,
    requirement: {
      type: "complete_multiple",
      target: 5,
    },
    isActive: true,
    order: 6,
  },

  // === ADVANCED CHALLENGES ===
  {
    title: "Perfect Execution",
    description:
      "Complete any sequence with 100% accuracy. Every position must be perfect!",
    difficulty: "hard",
    xpReward: 300,
    bonusXP: 100,
    bonusCondition: "perfect_run",
    requirement: {
      type: "perfect_run",
      target: 1,
    },
    isActive: true,
    order: 7,
  },
  {
    title: "Combo Streak Pro",
    description:
      "Achieve a combo streak of 20 or more. This requires consistent accuracy and focus.",
    difficulty: "hard",
    xpReward: 275,
    bonusXP: 100,
    bonusCondition: "perfect_run",
    requirement: {
      type: "achieve_combo",
      target: 20,
    },
    isActive: true,
    order: 8,
  },
  {
    title: "Timed Excellence",
    description:
      "Complete 5 sequences in Timed mode at 120 BPM or higher. Stay in sync with the beat!",
    difficulty: "hard",
    xpReward: 250,
    requirement: {
      type: "complete_sequence",
      target: 5,
      metadata: {
        mode: PracticeMode.TIMED,
        bpm: 120,
      },
    },
    isActive: true,
    order: 9,
  },
  {
    title: "Marathon Trainer",
    description:
      "Complete 15 different sequences. Build your repertoire and muscle memory across varied patterns.",
    difficulty: "hard",
    xpReward: 350,
    bonusXP: 150,
    bonusCondition: "perfect_run",
    requirement: {
      type: "complete_multiple",
      target: 15,
    },
    isActive: true,
    order: 10,
  },

  // === EXPERT CHALLENGES ===
  {
    title: "Flawless Champion",
    description:
      "Complete 3 different sequences with 100% accuracy each. True mastery requires consistency.",
    difficulty: "expert",
    xpReward: 500,
    bonusXP: 200,
    bonusCondition: "perfect_run",
    requirement: {
      type: "perfect_run",
      target: 3,
    },
    isActive: true,
    order: 11,
  },
  {
    title: "Combo Legend",
    description:
      "Build a combo streak of 30 or more. Only the most focused practitioners succeed.",
    difficulty: "expert",
    xpReward: 450,
    bonusXP: 175,
    bonusCondition: "perfect_run",
    requirement: {
      type: "achieve_combo",
      target: 30,
    },
    isActive: true,
    order: 12,
  },
  {
    title: "Speed Demon",
    description:
      "Complete 10 sequences in Timed mode at 150 BPM or higher. Maximum speed, maximum challenge!",
    difficulty: "expert",
    xpReward: 400,
    requirement: {
      type: "complete_sequence",
      target: 10,
      metadata: {
        mode: PracticeMode.TIMED,
        bpm: 150,
      },
    },
    isActive: true,
    order: 13,
  },
  {
    title: "Ultimate Variety",
    description:
      "Complete 30 different sequences. Become a true master of diverse movement vocabulary.",
    difficulty: "expert",
    xpReward: 600,
    bonusXP: 250,
    bonusCondition: "perfect_run",
    requirement: {
      type: "complete_multiple",
      target: 30,
    },
    isActive: true,
    order: 14,
  },
];

/**
 * Get challenges by difficulty
 */
export function getChallengesByDifficulty(
  difficulty: string
): Omit<TrainChallenge, "id" | "createdAt">[] {
  return SEED_CHALLENGES.filter((c) => c.difficulty === difficulty);
}

/**
 * Get total XP available from all challenges
 */
export function getTotalAvailableXP(): number {
  return SEED_CHALLENGES.reduce((total, challenge) => {
    return total + challenge.xpReward + (challenge.bonusXP || 0);
  }, 0);
}
