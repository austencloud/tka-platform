/**
 * Skill Progression Definitions
 *
 * Defines all skills available for users to progress through.
 * Skills are organized into three categories:
 * 1. Letter Mastery (26 skills) - One per letter A-Z
 * 2. Concept Mastery (~10 skills) - Based on learning concepts
 * 3. Practice Goals (~5 skills) - Streak and engagement based
 */

import type {
  SkillProgression,
  SkillCategory,
  SkillLevel,
  SkillRequirementType,
} from "../models/challenge-models";

// ============================================================================
// SKILL LEVEL TEMPLATES
// ============================================================================

/**
 * Standard level progression for letter mastery skills
 */
function createLetterMasteryLevels(letter: string): SkillLevel[] {
  return [
    {
      level: 1,
      title: "Novice",
      description: `Create 3 sequences containing the letter ${letter}`,
      requirement: {
        type: "sequence_with_letter" as SkillRequirementType,
        target: 3,
        metadata: { letter },
      },
      xpReward: 25,
    },
    {
      level: 2,
      title: "Apprentice",
      description: `Create 10 sequences containing the letter ${letter}`,
      requirement: {
        type: "sequence_with_letter" as SkillRequirementType,
        target: 10,
        metadata: { letter },
      },
      xpReward: 50,
    },
    {
      level: 3,
      title: "Expert",
      description: `Create 25 sequences containing the letter ${letter}`,
      requirement: {
        type: "sequence_with_letter" as SkillRequirementType,
        target: 25,
        metadata: { letter },
      },
      xpReward: 100,
    },
    {
      level: 4,
      title: "Master",
      description: `Create 50 unique sequences containing the letter ${letter}`,
      requirement: {
        type: "unique_sequences_with_letter" as SkillRequirementType,
        target: 50,
        metadata: { letter },
      },
      xpReward: 200,
    },
  ];
}

/**
 * Standard level progression for concept mastery skills
 */
function createConceptMasteryLevels(
  conceptName: string,
  conceptIds: string[]
): SkillLevel[] {
  return [
    {
      level: 1,
      title: "Learner",
      description: `Complete ${conceptName} concepts`,
      requirement: {
        type: "concept_drills_completed" as SkillRequirementType,
        target: conceptIds.length,
        metadata: { conceptIds },
      },
      xpReward: 50,
    },
    {
      level: 2,
      title: "Practitioner",
      description: `Score 80%+ on all ${conceptName} quizzes`,
      requirement: {
        type: "concept_quiz_score" as SkillRequirementType,
        target: 80,
        metadata: { conceptIds, minScore: 80 },
      },
      xpReward: 100,
    },
    {
      level: 3,
      title: "Expert",
      description: `Score 95%+ on all ${conceptName} quizzes`,
      requirement: {
        type: "concept_quiz_score" as SkillRequirementType,
        target: 95,
        metadata: { conceptIds, minScore: 95 },
      },
      xpReward: 200,
    },
  ];
}

// ============================================================================
// LETTER MASTERY SKILLS (26)
// ============================================================================

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const LETTER_MASTERY_SKILLS: SkillProgression[] = LETTERS.map(
  (letter, index) => ({
    id: `skill_letter_${letter}`,
    skillId: `letter_${letter}`,
    skillName: `Letter ${letter} Mastery`,
    skillCategory: "letter_mastery" as SkillCategory,
    description: `Master the letter ${letter} by creating sequences that use it`,
    icon: letter,
    levels: createLetterMasteryLevels(letter),
    totalLevels: 4,
    prerequisiteSkillIds: [],
    minimumUserLevel: 1,
    xpPerLevel: 75,
    completionBadgeId: `badge_letter_${letter}_master`,
    isActive: true,
    order: index + 1,
    createdAt: new Date("2025-01-01"),
  })
);

// ============================================================================
// CONCEPT MASTERY SKILLS (~10)
// ============================================================================

export const CONCEPT_MASTERY_SKILLS: SkillProgression[] = [
  {
    id: "skill_concept_grid_basics",
    skillId: "concept_grid_basics",
    skillName: "Grid Basics",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master the fundamental grid system and hand positions",
    icon: "fa-border-all",
    levels: createConceptMasteryLevels("Grid Basics", [
      "grid",
      "hand-positions",
      "hand-motions-intro",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: [],
    minimumUserLevel: 1,
    xpPerLevel: 75,
    completionBadgeId: "badge_grid_master",
    isActive: true,
    order: 1,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_concept_dual_shifts",
    skillId: "concept_dual_shifts",
    skillName: "Dual-Shift Mastery",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master split-same, tog-same, and gamma dual-shift patterns",
    icon: "fa-arrows-left-right",
    levels: createConceptMasteryLevels("Dual-Shift", [
      "dual-shifts-alpha-beta",
      "gamma-motion",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: ["concept_grid_basics"],
    minimumUserLevel: 2,
    xpPerLevel: 75,
    completionBadgeId: "badge_dual_shift_master",
    isActive: true,
    order: 2,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_concept_shifts_dashes",
    skillId: "concept_shifts_dashes",
    skillName: "Shifts & Dashes",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master shift, cross-shift, dash, and static motions",
    icon: "fa-arrow-right-long",
    levels: createConceptMasteryLevels("Shifts & Dashes", [
      "shifts-type2",
      "cross-shifts-type3",
      "dash-type4",
      "dual-dash-type5",
      "static-type6",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: ["concept_dual_shifts"],
    minimumUserLevel: 3,
    xpPerLevel: 75,
    completionBadgeId: "badge_shifts_dashes_master",
    isActive: true,
    order: 3,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_concept_staff",
    skillId: "concept_staff",
    skillName: "Staff Techniques",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master staff positions, motions, and negative space",
    icon: "fa-grip-lines-vertical",
    levels: createConceptMasteryLevels("Staff Techniques", [
      "staff-positions",
      "staff-motions",
      "negative-space",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: ["concept_shifts_dashes"],
    minimumUserLevel: 4,
    xpPerLevel: 75,
    completionBadgeId: "badge_staff_master",
    isActive: true,
    order: 4,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_concept_letter_types",
    skillId: "concept_letter_types",
    skillName: "Letter Types 1-3",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master Type 1-3 letter notation and patterns",
    icon: "fa-font",
    levels: createConceptMasteryLevels("Letter Types", [
      "letter-codex-intro",
      "type1-abc-ghi",
      "type1-compound",
      "type1-gamma-compound",
      "type1-stuv",
      "type2-wxyz",
      "type3-cross-shift-letters",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: ["concept_staff"],
    minimumUserLevel: 5,
    xpPerLevel: 100,
    completionBadgeId: "badge_letter_types_master",
    isActive: true,
    order: 5,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_concept_letter_types_456",
    skillId: "concept_letter_types_456",
    skillName: "Letter Types 4-6",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master Type 4-6 letters (Dash, Dual-Dash, Static)",
    icon: "fa-circle-dot",
    levels: createConceptMasteryLevels("Advanced Letters", [
      "type456-dash-static",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: ["concept_letter_types"],
    minimumUserLevel: 6,
    xpPerLevel: 100,
    completionBadgeId: "badge_all_letters_master",
    isActive: true,
    order: 6,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_concept_words",
    skillId: "concept_words",
    skillName: "Word Building",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master word construction and compound patterns",
    icon: "fa-spell-check",
    levels: createConceptMasteryLevels("Word Building", [
      "words-alpha-beta",
      "compound-words",
      "gamma-words",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: ["concept_letter_types_456"],
    minimumUserLevel: 7,
    xpPerLevel: 100,
    completionBadgeId: "badge_words_master",
    isActive: true,
    order: 7,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_concept_caps",
    skillId: "concept_caps",
    skillName: "LOOP Patterns",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master Continuous Assembly Patterns and reversals",
    icon: "fa-arrows-rotate",
    levels: createConceptMasteryLevels("LOOPs", [
      "caps-intro",
      "reversals",
      "advanced-caps",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: ["concept_words"],
    minimumUserLevel: 8,
    xpPerLevel: 150,
    completionBadgeId: "badge_caps_master",
    isActive: true,
    order: 8,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_concept_motion_mastery",
    skillId: "concept_motion_mastery",
    skillName: "Motion Type Mastery",
    skillCategory: "concept_mastery" as SkillCategory,
    description: "Master all 6 motion types completely",
    icon: "fa-bolt",
    levels: createConceptMasteryLevels("Motion Mastery", [
      "motion-type-mastery",
    ]),
    totalLevels: 3,
    prerequisiteSkillIds: ["concept_caps"],
    minimumUserLevel: 10,
    xpPerLevel: 200,
    completionBadgeId: "badge_motion_master",
    isActive: true,
    order: 9,
    createdAt: new Date("2025-01-01"),
  },
];

// ============================================================================
// PRACTICE GOALS SKILLS (~5)
// ============================================================================

export const PRACTICE_GOALS_SKILLS: SkillProgression[] = [
  {
    id: "skill_practice_consistency",
    skillId: "practice_consistency",
    skillName: "Consistency Champion",
    skillCategory: "practice_goals" as SkillCategory,
    description: "Build a consistent practice habit",
    icon: "fa-fire",
    levels: [
      {
        level: 1,
        title: "Getting Started",
        description: "Practice for 3 consecutive days",
        requirement: {
          type: "consecutive_days" as SkillRequirementType,
          target: 3,
        },
        xpReward: 50,
      },
      {
        level: 2,
        title: "Building Momentum",
        description: "Practice for 7 consecutive days",
        requirement: {
          type: "consecutive_days" as SkillRequirementType,
          target: 7,
        },
        xpReward: 100,
      },
      {
        level: 3,
        title: "Dedicated",
        description: "Practice for 14 consecutive days",
        requirement: {
          type: "consecutive_days" as SkillRequirementType,
          target: 14,
        },
        xpReward: 200,
      },
      {
        level: 4,
        title: "Unstoppable",
        description: "Practice for 30 consecutive days",
        requirement: {
          type: "consecutive_days" as SkillRequirementType,
          target: 30,
        },
        xpReward: 500,
      },
    ],
    totalLevels: 4,
    prerequisiteSkillIds: [],
    minimumUserLevel: 1,
    xpPerLevel: 100,
    completionBadgeId: "badge_consistency_champion",
    isActive: true,
    order: 1,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_practice_creator",
    skillId: "practice_creator",
    skillName: "Sequence Creator",
    skillCategory: "practice_goals" as SkillCategory,
    description: "Create sequences to build your library",
    icon: "fa-plus-circle",
    levels: [
      {
        level: 1,
        title: "First Steps",
        description: "Create 5 sequences",
        requirement: {
          type: "sequences_created_total" as SkillRequirementType,
          target: 5,
        },
        xpReward: 25,
      },
      {
        level: 2,
        title: "Growing Library",
        description: "Create 25 sequences",
        requirement: {
          type: "sequences_created_total" as SkillRequirementType,
          target: 25,
        },
        xpReward: 75,
      },
      {
        level: 3,
        title: "Prolific Creator",
        description: "Create 100 sequences",
        requirement: {
          type: "sequences_created_total" as SkillRequirementType,
          target: 100,
        },
        xpReward: 200,
      },
      {
        level: 4,
        title: "Sequence Master",
        description: "Create 500 sequences",
        requirement: {
          type: "sequences_created_total" as SkillRequirementType,
          target: 500,
        },
        xpReward: 500,
      },
    ],
    totalLevels: 4,
    prerequisiteSkillIds: [],
    minimumUserLevel: 1,
    xpPerLevel: 100,
    completionBadgeId: "badge_sequence_creator",
    isActive: true,
    order: 2,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_practice_challenger",
    skillId: "practice_challenger",
    skillName: "Challenge Crusher",
    skillCategory: "practice_goals" as SkillCategory,
    description: "Complete daily and weekly challenges",
    icon: "fa-trophy",
    levels: [
      {
        level: 1,
        title: "Challenge Accepted",
        description: "Complete 5 challenges",
        requirement: {
          type: "challenges_completed" as SkillRequirementType,
          target: 5,
        },
        xpReward: 50,
      },
      {
        level: 2,
        title: "Challenge Hunter",
        description: "Complete 25 challenges",
        requirement: {
          type: "challenges_completed" as SkillRequirementType,
          target: 25,
        },
        xpReward: 150,
      },
      {
        level: 3,
        title: "Challenge Legend",
        description: "Complete 100 challenges",
        requirement: {
          type: "challenges_completed" as SkillRequirementType,
          target: 100,
        },
        xpReward: 400,
      },
    ],
    totalLevels: 3,
    prerequisiteSkillIds: [],
    minimumUserLevel: 1,
    xpPerLevel: 100,
    completionBadgeId: "badge_challenge_crusher",
    isActive: true,
    order: 3,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_practice_browser",
    skillId: "practice_browser",
    skillName: "Alphabet Browser",
    skillCategory: "practice_goals" as SkillCategory,
    description: "Use all letters of the alphabet in sequences",
    icon: "fa-compass",
    levels: [
      {
        level: 1,
        title: "Curious Mind",
        description: "Use 5 different letters",
        requirement: {
          type: "unique_sequences_with_letter" as SkillRequirementType,
          target: 5,
          metadata: { trackUnique: true },
        },
        xpReward: 50,
      },
      {
        level: 2,
        title: "Alphabet Dabbler",
        description: "Use 13 different letters (half the alphabet)",
        requirement: {
          type: "unique_sequences_with_letter" as SkillRequirementType,
          target: 13,
          metadata: { trackUnique: true },
        },
        xpReward: 150,
      },
      {
        level: 3,
        title: "Alphabet Master",
        description: "Use all 26 letters",
        requirement: {
          type: "unique_sequences_with_letter" as SkillRequirementType,
          target: 26,
          metadata: { trackUnique: true },
        },
        xpReward: 500,
      },
    ],
    totalLevels: 3,
    prerequisiteSkillIds: [],
    minimumUserLevel: 1,
    xpPerLevel: 100,
    completionBadgeId: "badge_alphabet_browser",
    isActive: true,
    order: 4,
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "skill_practice_marathon",
    skillId: "practice_marathon",
    skillName: "Practice Marathon",
    skillCategory: "practice_goals" as SkillCategory,
    description: "Achieve long-term practice milestones",
    icon: "fa-road",
    levels: [
      {
        level: 1,
        title: "Week Warrior",
        description: "Practice for 7 total days",
        requirement: {
          type: "total_practice_time" as SkillRequirementType,
          target: 7,
          metadata: { timeUnit: "days" },
        },
        xpReward: 50,
      },
      {
        level: 2,
        title: "Month Master",
        description: "Practice for 30 total days",
        requirement: {
          type: "total_practice_time" as SkillRequirementType,
          target: 30,
          metadata: { timeUnit: "days" },
        },
        xpReward: 200,
      },
      {
        level: 3,
        title: "Quarter Champion",
        description: "Practice for 90 total days",
        requirement: {
          type: "total_practice_time" as SkillRequirementType,
          target: 90,
          metadata: { timeUnit: "days" },
        },
        xpReward: 500,
      },
      {
        level: 4,
        title: "Year Legend",
        description: "Practice for 365 total days",
        requirement: {
          type: "total_practice_time" as SkillRequirementType,
          target: 365,
          metadata: { timeUnit: "days" },
        },
        xpReward: 1000,
      },
    ],
    totalLevels: 4,
    prerequisiteSkillIds: [],
    minimumUserLevel: 1,
    xpPerLevel: 150,
    completionBadgeId: "badge_practice_marathon",
    isActive: true,
    order: 5,
    createdAt: new Date("2025-01-01"),
  },
];

// ============================================================================
// ALL SKILLS
// ============================================================================

/**
 * All skill progressions combined
 */
export const ALL_SKILLS: SkillProgression[] = [
  ...LETTER_MASTERY_SKILLS,
  ...CONCEPT_MASTERY_SKILLS,
  ...PRACTICE_GOALS_SKILLS,
];

/**
 * Get skills by category
 */
export function getSkillsByCategory(
  category: SkillCategory
): SkillProgression[] {
  return ALL_SKILLS.filter((skill) => skill.skillCategory === category);
}

/**
 * Get skill by ID
 */
export function getSkillById(skillId: string): SkillProgression | undefined {
  return ALL_SKILLS.find((skill) => skill.skillId === skillId);
}

/**
 * Get skill counts by category
 */
export const SKILL_COUNTS = {
  letter_mastery: LETTER_MASTERY_SKILLS.length,
  concept_mastery: CONCEPT_MASTERY_SKILLS.length,
  practice_goals: PRACTICE_GOALS_SKILLS.length,
  total: ALL_SKILLS.length,
} as const;
