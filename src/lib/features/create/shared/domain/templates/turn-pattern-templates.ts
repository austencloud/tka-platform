/**
 * Turn Pattern Templates
 *
 * Pre-made turn patterns organized by complexity level.
 * Based on analysis of 357 real gallery sequences.
 *
 * Complexity Levels:
 * - Simple: All zeros/ones, low variance, symmetric - great for beginners
 * - Medium: Mix of 0-2 turns, some asymmetry - intermediate
 * - Complex: Higher turns, half-turns, high variance, floats - advanced
 */

import type { Timestamp } from "firebase/firestore";
import type {
  TurnPattern,
  TurnPatternEntry,
  TurnValue,
} from "../models/TurnPatternData";

// Re-export TurnValue for consumers
export type { TurnValue } from "../models/TurnPatternData";

/**
 * Complexity level for pattern categorization
 */
export type PatternComplexity = "simple" | "medium" | "complex";

/**
 * Template pattern data with complexity metadata
 */
export interface TurnPatternTemplate {
  readonly name: string;
  readonly stepCount: number;
  readonly entries: readonly TurnPatternEntry[];
  readonly description: string;
  readonly complexity: PatternComplexity;
}

/**
 * Calculate complexity score for a pattern
 * Higher score = more complex
 */
export function calculateComplexityScore(
  entries: readonly TurnPatternEntry[]
): number {
  let score = 0;

  const allTurns = entries
    .flatMap((e) => [e.blue, e.red])
    .filter((t): t is TurnValue => t !== null);
  const numericTurns = allTurns.filter(
    (t): t is number => typeof t === "number"
  );

  if (numericTurns.length === 0) return 0;

  // Factor 1: Max turn value (0-3 scale)
  const maxTurn = Math.max(...numericTurns);
  score += maxTurn * 2; // 0-6 points

  // Factor 2: Average turn value
  const avgTurn = numericTurns.reduce((a, b) => a + b, 0) / numericTurns.length;
  score += avgTurn; // 0-3 points

  // Factor 3: Presence of half turns (0.5, 1.5, 2.5) - automatic complexity bump
  const hasHalfTurns = numericTurns.some((t) => t % 1 !== 0);
  if (hasHalfTurns) score += 3; // +3 points

  // Factor 4: Presence of floats
  const hasFloats = allTurns.includes("fl" as TurnValue);
  if (hasFloats) score += 2; // +2 points

  // Factor 5: Variance in turn values (more variety = more complex)
  const uniqueTurns = new Set(allTurns.map((t) => String(t)));
  score += Math.min(uniqueTurns.size - 1, 3); // 0-3 points for variety

  // Factor 6: Asymmetry (blue ≠ red)
  const asymmetricBeats = entries.filter((e) => e.blue !== e.red).length;
  const asymmetryRatio = asymmetricBeats / entries.length;
  score += asymmetryRatio * 2; // 0-2 points

  // Factor 7: Total rotation (more total turns = more movement)
  const totalTurns = numericTurns.reduce((a, b) => a + b, 0);
  const avgTotalPerBeat = totalTurns / entries.length;
  score += Math.min(avgTotalPerBeat, 3); // 0-3 points

  return score;
}

/**
 * Get complexity level from score
 */
export function getComplexityLevel(score: number): PatternComplexity {
  if (score <= 3) return "simple";
  if (score <= 8) return "medium";
  return "complex";
}

/**
 * Get complexity from pattern entries
 */
export function getPatternComplexity(
  entries: readonly TurnPatternEntry[]
): PatternComplexity {
  return getComplexityLevel(calculateComplexityScore(entries));
}

// =============================================================================
// 8-STEP TEMPLATES
// =============================================================================

/**
 * 8-step template patterns organized by complexity
 */
export const EIGHT_BEAT_TEMPLATES: TurnPatternTemplate[] = [
  // ========================
  // SIMPLE (Beginner-friendly)
  // ========================
  {
    name: "Zeros",
    stepCount: 8,
    description: "No rotation - focus on positions",
    complexity: "simple",
    entries: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i,
      blue: 0,
      red: 0,
    })),
  },
  {
    name: "Alternating",
    stepCount: 8,
    description: "0-1 symmetric alternation",
    complexity: "simple",
    entries: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i,
      blue: i % 2,
      red: i % 2,
    })),
  },

  // ========================
  // MEDIUM (Intermediate)
  // ========================
  {
    name: "Alternating Opposition",
    stepCount: 8,
    description: "Blue and red swap each beat",
    complexity: "medium",
    entries: [
      { stepIndex: 0, blue: 0, red: 1 },
      { stepIndex: 1, blue: 1, red: 0 },
      { stepIndex: 2, blue: 0, red: 1 },
      { stepIndex: 3, blue: 1, red: 0 },
      { stepIndex: 4, blue: 0, red: 1 },
      { stepIndex: 5, blue: 1, red: 0 },
      { stepIndex: 6, blue: 0, red: 1 },
      { stepIndex: 7, blue: 1, red: 0 },
    ],
  },
  {
    name: "Alternating Opposition (Inverted)",
    stepCount: 8,
    description: "Inverted blue/red swap",
    complexity: "medium",
    entries: [
      { stepIndex: 0, blue: 1, red: 0 },
      { stepIndex: 1, blue: 0, red: 1 },
      { stepIndex: 2, blue: 1, red: 0 },
      { stepIndex: 3, blue: 0, red: 1 },
      { stepIndex: 4, blue: 1, red: 0 },
      { stepIndex: 5, blue: 0, red: 1 },
      { stepIndex: 6, blue: 1, red: 0 },
      { stepIndex: 7, blue: 0, red: 1 },
    ],
  },
  {
    name: "Blue Leads",
    stepCount: 8,
    description: "Blue rotates more than red",
    complexity: "medium",
    entries: [
      { stepIndex: 0, blue: 1, red: 0 },
      { stepIndex: 1, blue: 1, red: 0 },
      { stepIndex: 2, blue: 1, red: 1 },
      { stepIndex: 3, blue: 1, red: 0 },
      { stepIndex: 4, blue: 1, red: 0 },
      { stepIndex: 5, blue: 1, red: 1 },
      { stepIndex: 6, blue: 1, red: 0 },
      { stepIndex: 7, blue: 1, red: 0 },
    ],
  },
  {
    name: "Red Leads",
    stepCount: 8,
    description: "Red rotates more than blue",
    complexity: "medium",
    entries: [
      { stepIndex: 0, blue: 0, red: 1 },
      { stepIndex: 1, blue: 0, red: 1 },
      { stepIndex: 2, blue: 1, red: 1 },
      { stepIndex: 3, blue: 0, red: 1 },
      { stepIndex: 4, blue: 0, red: 1 },
      { stepIndex: 5, blue: 1, red: 1 },
      { stepIndex: 6, blue: 0, red: 1 },
      { stepIndex: 7, blue: 0, red: 1 },
    ],
  },

  // ========================
  // COMPLEX (Advanced)
  // ========================
  {
    name: "Pyramid",
    stepCount: 8,
    description: "Build up then back down",
    complexity: "complex",
    entries: [
      { stepIndex: 0, blue: 0, red: 0 },
      { stepIndex: 1, blue: 1, red: 1 },
      { stepIndex: 2, blue: 2, red: 2 },
      { stepIndex: 3, blue: 2, red: 2 },
      { stepIndex: 4, blue: 2, red: 2 },
      { stepIndex: 5, blue: 2, red: 2 },
      { stepIndex: 6, blue: 1, red: 1 },
      { stepIndex: 7, blue: 0, red: 0 },
    ],
  },
  {
    name: "Half Steps",
    stepCount: 8,
    description: "Smooth half-turn progression",
    complexity: "complex",
    entries: [
      { stepIndex: 0, blue: 0, red: 0 },
      { stepIndex: 1, blue: 0.5, red: 0.5 },
      { stepIndex: 2, blue: 1, red: 1 },
      { stepIndex: 3, blue: 1.5, red: 1.5 },
      { stepIndex: 4, blue: 1.5, red: 1.5 },
      { stepIndex: 5, blue: 1, red: 1 },
      { stepIndex: 6, blue: 0.5, red: 0.5 },
      { stepIndex: 7, blue: 0, red: 0 },
    ],
  },
  {
    name: "Float Wave",
    stepCount: 8,
    description: "Floats in the middle",
    complexity: "complex",
    entries: [
      { stepIndex: 0, blue: 0, red: 0 },
      { stepIndex: 1, blue: 1, red: 1 },
      { stepIndex: 2, blue: "fl", red: "fl" },
      { stepIndex: 3, blue: "fl", red: "fl" },
      { stepIndex: 4, blue: "fl", red: "fl" },
      { stepIndex: 5, blue: "fl", red: "fl" },
      { stepIndex: 6, blue: 1, red: 1 },
      { stepIndex: 7, blue: 0, red: 0 },
    ],
  },
  {
    name: "Contrast",
    stepCount: 8,
    description: "Opposing high and low turns",
    complexity: "complex",
    entries: [
      { stepIndex: 0, blue: 0, red: 2 },
      { stepIndex: 1, blue: 2, red: 0 },
      { stepIndex: 2, blue: 0, red: 2 },
      { stepIndex: 3, blue: 2, red: 0 },
      { stepIndex: 4, blue: 0, red: 2 },
      { stepIndex: 5, blue: 2, red: 0 },
      { stepIndex: 6, blue: 0, red: 2 },
      { stepIndex: 7, blue: 2, red: 0 },
    ],
  },
];

// =============================================================================
// 16-STEP TEMPLATES
// =============================================================================

/**
 * 16-step template patterns organized by complexity
 */
export const SIXTEEN_BEAT_TEMPLATES: TurnPatternTemplate[] = [
  // ========================
  // SIMPLE (Beginner-friendly)
  // ========================
  {
    name: "Zeros",
    stepCount: 16,
    description: "No rotation - focus on positions",
    complexity: "simple",
    entries: Array.from({ length: 16 }, (_, i) => ({
      stepIndex: i,
      blue: 0,
      red: 0,
    })),
  },
  {
    name: "Alternating",
    stepCount: 16,
    description: "0-1 symmetric alternation",
    complexity: "simple",
    entries: Array.from({ length: 16 }, (_, i) => ({
      stepIndex: i,
      blue: i % 2,
      red: i % 2,
    })),
  },

  // ========================
  // MEDIUM (Intermediate)
  // ========================
  {
    name: "Alternating Opposition",
    stepCount: 16,
    description: "Blue and red swap each beat",
    complexity: "medium",
    entries: Array.from({ length: 16 }, (_, i) => ({
      stepIndex: i,
      blue: i % 2,
      red: (i + 1) % 2,
    })),
  },
  {
    name: "Alternating Opposition (Inverted)",
    stepCount: 16,
    description: "Inverted blue/red swap",
    complexity: "medium",
    entries: Array.from({ length: 16 }, (_, i) => ({
      stepIndex: i,
      blue: (i + 1) % 2,
      red: i % 2,
    })),
  },
  {
    name: "Blue Leads",
    stepCount: 16,
    description: "Blue consistently rotates more",
    complexity: "medium",
    entries: Array.from({ length: 16 }, (_, i) => ({
      stepIndex: i,
      blue: 1,
      red: i % 3 === 0 ? 1 : 0,
    })),
  },
  {
    name: "Red Leads",
    stepCount: 16,
    description: "Red consistently rotates more",
    complexity: "medium",
    entries: Array.from({ length: 16 }, (_, i) => ({
      stepIndex: i,
      blue: i % 3 === 0 ? 1 : 0,
      red: 1,
    })),
  },
  {
    name: "Quarters",
    stepCount: 16,
    description: "Different intensity each quarter",
    complexity: "medium",
    entries: Array.from({ length: 16 }, (_, i) => {
      const quarter = Math.floor(i / 4);
      return {
        stepIndex: i,
        blue: quarter === 0 || quarter === 2 ? 0 : 1,
        red: quarter === 0 || quarter === 2 ? 0 : 1,
      };
    }),
  },

  // ========================
  // COMPLEX (Advanced)
  // ========================
  {
    name: "Pyramid",
    stepCount: 16,
    description: "Build to peak, then descend",
    complexity: "complex",
    entries: [
      { stepIndex: 0, blue: 0, red: 0 },
      { stepIndex: 1, blue: 0, red: 0 },
      { stepIndex: 2, blue: 1, red: 1 },
      { stepIndex: 3, blue: 1, red: 1 },
      { stepIndex: 4, blue: 2, red: 2 },
      { stepIndex: 5, blue: 2, red: 2 },
      { stepIndex: 6, blue: 2, red: 2 },
      { stepIndex: 7, blue: 2, red: 2 },
      { stepIndex: 8, blue: 2, red: 2 },
      { stepIndex: 9, blue: 2, red: 2 },
      { stepIndex: 10, blue: 2, red: 2 },
      { stepIndex: 11, blue: 2, red: 2 },
      { stepIndex: 12, blue: 1, red: 1 },
      { stepIndex: 13, blue: 1, red: 1 },
      { stepIndex: 14, blue: 0, red: 0 },
      { stepIndex: 15, blue: 0, red: 0 },
    ],
  },
  {
    name: "Half Steps",
    stepCount: 16,
    description: "Smooth half-turn progression",
    complexity: "complex",
    entries: [
      { stepIndex: 0, blue: 0, red: 0 },
      { stepIndex: 1, blue: 0.5, red: 0.5 },
      { stepIndex: 2, blue: 0.5, red: 0.5 },
      { stepIndex: 3, blue: 1, red: 1 },
      { stepIndex: 4, blue: 1, red: 1 },
      { stepIndex: 5, blue: 1.5, red: 1.5 },
      { stepIndex: 6, blue: 1.5, red: 1.5 },
      { stepIndex: 7, blue: 2, red: 2 },
      { stepIndex: 8, blue: 2, red: 2 },
      { stepIndex: 9, blue: 1.5, red: 1.5 },
      { stepIndex: 10, blue: 1.5, red: 1.5 },
      { stepIndex: 11, blue: 1, red: 1 },
      { stepIndex: 12, blue: 1, red: 1 },
      { stepIndex: 13, blue: 0.5, red: 0.5 },
      { stepIndex: 14, blue: 0.5, red: 0.5 },
      { stepIndex: 15, blue: 0, red: 0 },
    ],
  },
  {
    name: "Float Wave",
    stepCount: 16,
    description: "Float sections with turn breaks",
    complexity: "complex",
    entries: Array.from({ length: 16 }, (_, i) => ({
      stepIndex: i,
      blue: i >= 4 && i <= 7 ? "fl" : i >= 12 && i <= 15 ? "fl" : 1,
      red: i >= 4 && i <= 7 ? "fl" : i >= 12 && i <= 15 ? "fl" : 1,
    })),
  },
  {
    name: "Contrast",
    stepCount: 16,
    description: "Opposing high and low turns",
    complexity: "complex",
    entries: Array.from({ length: 16 }, (_, i) => ({
      stepIndex: i,
      blue: i % 2 === 0 ? 0 : 2,
      red: i % 2 === 0 ? 2 : 0,
    })),
  },
  {
    name: "Diverge",
    stepCount: 16,
    description: "Blue and red diverge then converge",
    complexity: "complex",
    entries: [
      { stepIndex: 0, blue: 1, red: 1 },
      { stepIndex: 1, blue: 0, red: 2 },
      { stepIndex: 2, blue: 0, red: 2 },
      { stepIndex: 3, blue: 0, red: 2 },
      { stepIndex: 4, blue: 1, red: 1 },
      { stepIndex: 5, blue: 2, red: 0 },
      { stepIndex: 6, blue: 2, red: 0 },
      { stepIndex: 7, blue: 2, red: 0 },
      { stepIndex: 8, blue: 1, red: 1 },
      { stepIndex: 9, blue: 0, red: 2 },
      { stepIndex: 10, blue: 0, red: 2 },
      { stepIndex: 11, blue: 0, red: 2 },
      { stepIndex: 12, blue: 1, red: 1 },
      { stepIndex: 13, blue: 2, red: 0 },
      { stepIndex: 14, blue: 2, red: 0 },
      { stepIndex: 15, blue: 1, red: 1 },
    ],
  },
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a uniform pattern (same turn value for all steps)
 * This replaces individual "All Ones", "All Twos", "All Threes" templates
 */
export function createUniformPattern(
  stepCount: number,
  turnValue: TurnValue
): TurnPatternTemplate {
  const complexity: PatternComplexity =
    turnValue === 0
      ? "simple"
      : turnValue === 1
        ? "simple"
        : turnValue === 2
          ? "medium"
          : "complex";

  const label = turnValue === "fl" ? "Float" : String(turnValue);

  return {
    name: `Uniform ${label}`,
    stepCount,
    description: `All steps set to ${label}`,
    complexity,
    entries: Array.from({ length: stepCount }, (_, i) => ({
      stepIndex: i,
      blue: turnValue,
      red: turnValue,
    })),
  };
}

/**
 * Get all templates for a given beat count
 */
export function getTemplatesForStepCount(
  stepCount: number
): TurnPatternTemplate[] {
  if (stepCount === 8) return EIGHT_BEAT_TEMPLATES;
  if (stepCount === 16) return SIXTEEN_BEAT_TEMPLATES;
  return [];
}

/**
 * Get templates filtered by complexity
 */
export function getTemplatesByComplexity(
  stepCount: number,
  complexity: PatternComplexity
): TurnPatternTemplate[] {
  return getTemplatesForStepCount(stepCount).filter(
    (t) => t.complexity === complexity
  );
}

/**
 * Get complexity display info
 */
export function getComplexityInfo(complexity: PatternComplexity): {
  label: string;
  emoji: string;
  color: string;
} {
  switch (complexity) {
    case "simple":
      return { label: "Simple", emoji: "🟢", color: "#22c55e" };
    case "medium":
      return { label: "Medium", emoji: "🟡", color: "#eab308" };
    case "complex":
      return { label: "Complex", emoji: "🔴", color: "#ef4444" };
  }
}

/**
 * Convert a template to a TurnPattern (for UI display)
 */
export function templateToPattern(
  template: TurnPatternTemplate,
  userId: string
): TurnPattern {
  return {
    id: `template-${template.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: template.name,
    userId,
    createdAt: null as unknown as Timestamp, // Not stored in Firebase
    stepCount: template.stepCount,
    entries: template.entries,
  };
}
