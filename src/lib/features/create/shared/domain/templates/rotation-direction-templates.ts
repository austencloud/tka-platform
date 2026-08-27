/**
 * Rotation Direction Pattern Templates
 *
 * Pre-defined rotation direction patterns organized by structural category.
 * Templates are dynamically generated based on sequence beat count.
 *
 * Categories:
 * - uniform: Same direction for all steps
 * - alternating: Direction alternates each beat
 * - split-hand: Different direction per hand (blue vs red)
 * - split-half: First/second half of sequence have different directions
 */

import type { Timestamp } from "firebase/firestore";
import type {
  RotationDirectionPatternEntry,
  RotationDirectionValue,
  RotationDirectionPattern,
} from "../models/rotation-direction-pattern-data";

/**
 * Template categories
 */
export type TemplateCategory =
  | "uniform"
  | "alternating"
  | "split-hand"
  | "split-half";

/**
 * Template definition with generator function
 */
export interface RotationDirectionTemplateDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: TemplateCategory;
  /** Minimum steps required for this template to be applicable */
  readonly minSteps: number;
  /** Generator function to create entries for a given beat count */
  readonly generator: (stepCount: number) => RotationDirectionPatternEntry[];
}

/**
 * Category display info
 */
export interface CategoryInfo {
  readonly label: string;
  readonly description: string;
  readonly color: string;
}

export function getCategoryInfo(category: TemplateCategory): CategoryInfo {
  switch (category) {
    case "uniform":
      return {
        label: "Uniform",
        description: "Same direction for all steps",
        color: "#14b8a6", // teal
      };
    case "alternating":
      return {
        label: "Alternating",
        description: "Direction alternates each step",
        color: "#f59e0b", // amber
      };
    case "split-hand":
      return {
        label: "Split by Hand",
        description: "Different direction per hand",
        color: "#8b5cf6", // violet
      };
    case "split-half":
      return {
        label: "Split by Half",
        description: "First/second half different",
        color: "#06b6d4", // cyan
      };
  }
}

/**
 * All template definitions
 */
const TEMPLATE_DEFINITIONS: readonly RotationDirectionTemplateDefinition[] = [
  // ===== UNIFORM =====
  {
    id: "all-cw",
    name: "All CW",
    description: "Clockwise for all steps",
    category: "uniform",
    minSteps: 1,
    generator: (stepCount) => generateUniformPattern(stepCount, "cw", "cw"),
  },
  {
    id: "all-ccw",
    name: "All CCW",
    description: "Counter-clockwise for all steps",
    category: "uniform",
    minSteps: 1,
    generator: (stepCount) => generateUniformPattern(stepCount, "ccw", "ccw"),
  },

  // ===== ALTERNATING =====
  {
    id: "alternating-cw-first",
    name: "Alternating (CW first)",
    description: "CW, CCW, CW, CCW...",
    category: "alternating",
    minSteps: 2,
    generator: (stepCount) => generateAlternatingPattern(stepCount, "cw"),
  },
  {
    id: "alternating-ccw-first",
    name: "Alternating (CCW first)",
    description: "CCW, CW, CCW, CW...",
    category: "alternating",
    minSteps: 2,
    generator: (stepCount) => generateAlternatingPattern(stepCount, "ccw"),
  },

  // ===== SPLIT BY HAND =====
  {
    id: "blue-cw-red-ccw",
    name: "Blue CW / Red CCW",
    description: "Blue hand clockwise, red counter-clockwise",
    category: "split-hand",
    minSteps: 1,
    generator: (stepCount) => generateUniformPattern(stepCount, "cw", "ccw"),
  },
  {
    id: "blue-ccw-red-cw",
    name: "Blue CCW / Red CW",
    description: "Blue hand counter-clockwise, red clockwise",
    category: "split-hand",
    minSteps: 1,
    generator: (stepCount) => generateUniformPattern(stepCount, "ccw", "cw"),
  },

  // ===== SPLIT BY HALF =====
  {
    id: "first-half-cw",
    name: "First Half CW",
    description: "First half CW, second half CCW",
    category: "split-half",
    minSteps: 4,
    generator: (stepCount) => generateSplitHalfPattern(stepCount, "cw"),
  },
  {
    id: "first-half-ccw",
    name: "First Half CCW",
    description: "First half CCW, second half CW",
    category: "split-half",
    minSteps: 4,
    generator: (stepCount) => generateSplitHalfPattern(stepCount, "ccw"),
  },
];

/**
 * Generate uniform pattern (same direction for all steps)
 */
function generateUniformPattern(
  stepCount: number,
  blueDir: RotationDirectionValue,
  redDir: RotationDirectionValue
): RotationDirectionPatternEntry[] {
  const entries: RotationDirectionPatternEntry[] = [];
  for (let i = 0; i < stepCount; i++) {
    entries.push({
      stepIndex: i,
      blue: blueDir,
      red: redDir,
    });
  }
  return entries;
}

/**
 * Generate alternating pattern (direction alternates each beat)
 */
function generateAlternatingPattern(
  stepCount: number,
  startDir: RotationDirectionValue
): RotationDirectionPatternEntry[] {
  const entries: RotationDirectionPatternEntry[] = [];
  const otherDir: RotationDirectionValue = startDir === "cw" ? "ccw" : "cw";

  for (let i = 0; i < stepCount; i++) {
    const dir = i % 2 === 0 ? startDir : otherDir;
    entries.push({
      stepIndex: i,
      blue: dir,
      red: dir,
    });
  }
  return entries;
}

/**
 * Generate split-half pattern (first half one direction, second half other)
 */
function generateSplitHalfPattern(
  stepCount: number,
  firstHalfDir: RotationDirectionValue
): RotationDirectionPatternEntry[] {
  const entries: RotationDirectionPatternEntry[] = [];
  const secondHalfDir: RotationDirectionValue =
    firstHalfDir === "cw" ? "ccw" : "cw";
  const halfPoint = Math.floor(stepCount / 2);

  for (let i = 0; i < stepCount; i++) {
    const dir = i < halfPoint ? firstHalfDir : secondHalfDir;
    entries.push({
      stepIndex: i,
      blue: dir,
      red: dir,
    });
  }
  return entries;
}

/**
 * Get all templates applicable for a given beat count
 */
export function getTemplatesForStepCount(
  stepCount: number
): RotationDirectionTemplateDefinition[] {
  return TEMPLATE_DEFINITIONS.filter((t) => stepCount >= t.minSteps);
}

export function getTemplatesByCategory(
  stepCount: number,
  category: TemplateCategory | "all"
): RotationDirectionTemplateDefinition[] {
  const templates = getTemplatesForStepCount(stepCount);
  if (category === "all") return templates;
  return templates.filter((t) => t.category === category);
}

/**
 * Convert a template definition to a pattern for a given beat count
 */
export function templateToPattern(
  template: RotationDirectionTemplateDefinition,
  userId: string,
  stepCount: number
): RotationDirectionPattern {
  return {
    id: template.id,
    name: template.name,
    userId,
    stepCount,
    entries: template.generator(stepCount),
    createdAt: null as unknown as Timestamp, // Not stored in Firebase
  };
}

export function getAvailableCategories(stepCount: number): TemplateCategory[] {
  const templates = getTemplatesForStepCount(stepCount);
  const categories = new Set(templates.map((t) => t.category));
  return Array.from(categories);
}

/**
 * Create a uniform pattern directly (for quick apply buttons)
 */
export function createUniformPattern(
  stepCount: number,
  direction: "cw" | "ccw",
  userId: string
): RotationDirectionPattern {
  const template =
    direction === "cw"
      ? TEMPLATE_DEFINITIONS.find((t) => t.id === "all-cw")!
      : TEMPLATE_DEFINITIONS.find((t) => t.id === "all-ccw")!;

  return templateToPattern(template, userId, stepCount);
}
