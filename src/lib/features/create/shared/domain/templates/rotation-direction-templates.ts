/**
 * Rotation Direction Pattern Templates
 *
 * Pre-defined rotation direction patterns organized by structural category.
 * Templates are dynamically generated based on sequence beat count.
 *
 * Categories:
 * - uniform: Same direction for all beats
 * - alternating: Direction alternates each beat
 * - split-hand: Different direction per hand (blue vs red)
 * - split-half: First/second half of sequence have different directions
 */

import type { Timestamp } from "firebase/firestore";
import type {
  RotationDirectionPatternEntry,
  RotationDirectionValue,
  RotationDirectionPattern,
} from "../models/RotationDirectionPatternData";

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
  /** Minimum beats required for this template to be applicable */
  readonly minBeats: number;
  /** Generator function to create entries for a given beat count */
  readonly generator: (beatCount: number) => RotationDirectionPatternEntry[];
}

/**
 * Category display info
 */
export interface CategoryInfo {
  readonly label: string;
  readonly description: string;
  readonly color: string;
}

/**
 * Get display info for a category
 */
export function getCategoryInfo(category: TemplateCategory): CategoryInfo {
  switch (category) {
    case "uniform":
      return {
        label: "Uniform",
        description: "Same direction for all beats",
        color: "#14b8a6", // teal
      };
    case "alternating":
      return {
        label: "Alternating",
        description: "Direction alternates each beat",
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
    description: "Clockwise for all beats",
    category: "uniform",
    minBeats: 1,
    generator: (beatCount) => generateUniformPattern(beatCount, "cw", "cw"),
  },
  {
    id: "all-ccw",
    name: "All CCW",
    description: "Counter-clockwise for all beats",
    category: "uniform",
    minBeats: 1,
    generator: (beatCount) => generateUniformPattern(beatCount, "ccw", "ccw"),
  },

  // ===== ALTERNATING =====
  {
    id: "alternating-cw-first",
    name: "Alternating (CW first)",
    description: "CW, CCW, CW, CCW...",
    category: "alternating",
    minBeats: 2,
    generator: (beatCount) => generateAlternatingPattern(beatCount, "cw"),
  },
  {
    id: "alternating-ccw-first",
    name: "Alternating (CCW first)",
    description: "CCW, CW, CCW, CW...",
    category: "alternating",
    minBeats: 2,
    generator: (beatCount) => generateAlternatingPattern(beatCount, "ccw"),
  },

  // ===== SPLIT BY HAND =====
  {
    id: "blue-cw-red-ccw",
    name: "Blue CW / Red CCW",
    description: "Blue hand clockwise, red counter-clockwise",
    category: "split-hand",
    minBeats: 1,
    generator: (beatCount) => generateUniformPattern(beatCount, "cw", "ccw"),
  },
  {
    id: "blue-ccw-red-cw",
    name: "Blue CCW / Red CW",
    description: "Blue hand counter-clockwise, red clockwise",
    category: "split-hand",
    minBeats: 1,
    generator: (beatCount) => generateUniformPattern(beatCount, "ccw", "cw"),
  },

  // ===== SPLIT BY HALF =====
  {
    id: "first-half-cw",
    name: "First Half CW",
    description: "First half CW, second half CCW",
    category: "split-half",
    minBeats: 4,
    generator: (beatCount) => generateSplitHalfPattern(beatCount, "cw"),
  },
  {
    id: "first-half-ccw",
    name: "First Half CCW",
    description: "First half CCW, second half CW",
    category: "split-half",
    minBeats: 4,
    generator: (beatCount) => generateSplitHalfPattern(beatCount, "ccw"),
  },
];

/**
 * Generate uniform pattern (same direction for all beats)
 */
function generateUniformPattern(
  beatCount: number,
  blueDir: RotationDirectionValue,
  redDir: RotationDirectionValue
): RotationDirectionPatternEntry[] {
  const entries: RotationDirectionPatternEntry[] = [];
  for (let i = 0; i < beatCount; i++) {
    entries.push({
      beatIndex: i,
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
  beatCount: number,
  startDir: RotationDirectionValue
): RotationDirectionPatternEntry[] {
  const entries: RotationDirectionPatternEntry[] = [];
  const otherDir: RotationDirectionValue = startDir === "cw" ? "ccw" : "cw";

  for (let i = 0; i < beatCount; i++) {
    const dir = i % 2 === 0 ? startDir : otherDir;
    entries.push({
      beatIndex: i,
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
  beatCount: number,
  firstHalfDir: RotationDirectionValue
): RotationDirectionPatternEntry[] {
  const entries: RotationDirectionPatternEntry[] = [];
  const secondHalfDir: RotationDirectionValue =
    firstHalfDir === "cw" ? "ccw" : "cw";
  const halfPoint = Math.floor(beatCount / 2);

  for (let i = 0; i < beatCount; i++) {
    const dir = i < halfPoint ? firstHalfDir : secondHalfDir;
    entries.push({
      beatIndex: i,
      blue: dir,
      red: dir,
    });
  }
  return entries;
}

/**
 * Get all templates applicable for a given beat count
 */
export function getTemplatesForBeatCount(
  beatCount: number
): RotationDirectionTemplateDefinition[] {
  return TEMPLATE_DEFINITIONS.filter((t) => beatCount >= t.minBeats);
}

/**
 * Get templates filtered by category
 */
export function getTemplatesByCategory(
  beatCount: number,
  category: TemplateCategory | "all"
): RotationDirectionTemplateDefinition[] {
  const templates = getTemplatesForBeatCount(beatCount);
  if (category === "all") return templates;
  return templates.filter((t) => t.category === category);
}

/**
 * Convert a template definition to a pattern for a given beat count
 */
export function templateToPattern(
  template: RotationDirectionTemplateDefinition,
  userId: string,
  beatCount: number
): RotationDirectionPattern {
  return {
    id: template.id,
    name: template.name,
    userId,
    beatCount,
    entries: template.generator(beatCount),
    createdAt: null as unknown as Timestamp, // Not stored in Firebase
  };
}

/**
 * Get all unique categories from available templates
 */
export function getAvailableCategories(beatCount: number): TemplateCategory[] {
  const templates = getTemplatesForBeatCount(beatCount);
  const categories = new Set(templates.map((t) => t.category));
  return Array.from(categories);
}

/**
 * Create a uniform pattern directly (for quick apply buttons)
 */
export function createUniformPattern(
  beatCount: number,
  direction: "cw" | "ccw",
  userId: string
): RotationDirectionPattern {
  const template =
    direction === "cw"
      ? TEMPLATE_DEFINITIONS.find((t) => t.id === "all-cw")!
      : TEMPLATE_DEFINITIONS.find((t) => t.id === "all-ccw")!;

  return templateToPattern(template, userId, beatCount);
}
