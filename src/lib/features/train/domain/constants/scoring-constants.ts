export const TIMING_WINDOWS = {
  PERFECT_MS: 50,
  GOOD_MS: 150,
  LATE_THRESHOLD_MS: 300,
} as const;

export const SCORE_VALUES = {
  PERFECT: 100,
  GOOD: 50,
  MISS: 0,
} as const;

export const GRADE_THRESHOLDS = {
  S: 95,
  A: 85,
  B: 70,
  C: 55,
  D: 40,
} as const;

export const COMBO_MULTIPLIERS = {
  BASE: 1,
  AT_10: 1.5,
  AT_25: 2,
  AT_50: 2.5,
  AT_100: 3,
} as const;

export const XP_REWARDS = {
  PERFORMANCE_COMPLETED: 20,
  PERFECT_BEAT: 2,
  FULL_COMBO: 50,
  GRADE_S: 100,
  GRADE_A: 50,
  GRADE_B: 25,
} as const;
