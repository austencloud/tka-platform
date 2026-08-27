/**
 * Duration Pattern Templates
 *
 * Pre-defined duration patterns organized by category (music theory based).
 * Templates use generator functions to adapt to any sequence length.
 *
 * Categories:
 * - accent: Emphasize specific beats (teal)
 * - meter: Time signature patterns (amber)
 * - feel: Rhythmic character (violet)
 */

import type { Timestamp } from "firebase/firestore";
import type {
  DurationPatternEntry,
  DurationValue,
  DurationPattern,
} from "../models/duration-pattern-data";

/**
 * Template categories for duration patterns
 */
export type DurationCategory = "accent" | "meter" | "feel" | "world";

/**
 * Category display info
 */
export interface DurationCategoryInfo {
  readonly label: string;
  readonly description: string;
  readonly color: string;
}

export function getCategoryInfo(category: DurationCategory): DurationCategoryInfo {
  switch (category) {
    case "accent":
      return {
        label: "Accent",
        description: "Emphasize specific beats",
        color: "#14b8a6", // teal
      };
    case "meter":
      return {
        label: "Meter",
        description: "Time signature patterns",
        color: "#f59e0b", // amber
      };
    case "feel":
      return {
        label: "Feel",
        description: "Rhythmic character",
        color: "#8b5cf6", // violet
      };
    case "world":
      return {
        label: "World",
        description: "Global rhythm traditions",
        color: "#ea580c", // amber-orange
      };
  }
}

/**
 * Template definition with generator function
 */
export interface DurationTemplateDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: DurationCategory;
  /** Minimum steps required for this template to be applicable */
  readonly minSteps: number;
  /** Only show when step count is a multiple of this value */
  readonly divisibleBy?: number;
  /** Generator function to create entries for a given beat count */
  readonly generator: (stepCount: number) => DurationPatternEntry[];
}


/**
 * Generate uniform pattern (same duration for all steps)
 */
function _generateUniformPattern(
  stepCount: number,
  duration: DurationValue
): DurationPatternEntry[] {
  const entries: DurationPatternEntry[] = [];
  for (let i = 0; i < stepCount; i++) {
    entries.push({ stepIndex: i, duration });
  }
  return entries;
}

/**
 * Generate alternating pattern (two values alternate)
 */
function generateAlternatingPattern(
  stepCount: number,
  first: DurationValue,
  second: DurationValue
): DurationPatternEntry[] {
  const entries: DurationPatternEntry[] = [];
  for (let i = 0; i < stepCount; i++) {
    entries.push({
      stepIndex: i,
      duration: i % 2 === 0 ? first : second,
    });
  }
  return entries;
}

/**
 * Generate pattern where every Nth beat (0-indexed offset) gets a different duration
 */
function generateEveryNthPattern(
  stepCount: number,
  n: number,
  offset: number,
  accentDuration: DurationValue,
  normalDuration: DurationValue = 1.0
): DurationPatternEntry[] {
  const entries: DurationPatternEntry[] = [];
  for (let i = 0; i < stepCount; i++) {
    // 0-indexed: offset 2 with n=3 means indices 2, 5, 8, 11...
    const isAccent = (i - offset) % n === 0 && i >= offset;
    entries.push({
      stepIndex: i,
      duration: isAccent ? accentDuration : normalDuration,
    });
  }
  return entries;
}

/**
 * Generate repeating pattern from a template array
 */
function generateRepeatingPattern(
  stepCount: number,
  template: DurationValue[]
): DurationPatternEntry[] {
  const entries: DurationPatternEntry[] = [];
  for (let i = 0; i < stepCount; i++) {
    const duration = template[i % template.length] ?? 1.0;
    entries.push({
      stepIndex: i,
      duration,
    });
  }
  return entries;
}

/**
 * Generate gradual change pattern (ritardando/accelerando)
 */
function _generateGradualPattern(
  stepCount: number,
  startDuration: DurationValue,
  endDuration: DurationValue
): DurationPatternEntry[] {
  const entries: DurationPatternEntry[] = [];
  const step = (endDuration - startDuration) / Math.max(stepCount - 1, 1);
  for (let i = 0; i < stepCount; i++) {
    entries.push({
      stepIndex: i,
      duration: Math.max(1.0, startDuration + step * i),
    });
  }
  return entries;
}


const TEMPLATE_DEFINITIONS: readonly DurationTemplateDefinition[] = [
  {
    id: "every-third-doubled",
    name: "Every Third Doubled",
    description: "Beats 3, 6, 9... held twice as long",
    category: "accent",
    minSteps: 3,
    divisibleBy: 3,
    generator: (stepCount) =>
      generateEveryNthPattern(stepCount, 3, 2, 2.0, 1.0),
  },
  {
    id: "tresillo",
    name: "Tresillo",
    description: "3+3+2 foundation rhythm",
    category: "feel",
    minSteps: 3,
    divisibleBy: 3,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.5, 1.5, 1.0]),
  },
  {
    id: "waltz-3-4",
    name: "3/4 Waltz",
    description: "ONE-two-three feel - downbeat held longer",
    category: "feel",
    minSteps: 3,
    divisibleBy: 3,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [2, 1, 1]),
  },
  {
    id: "swing",
    name: "Swing",
    description: "Long-short alternation",
    category: "feel",
    minSteps: 2,
    generator: (stepCount) =>
      generateAlternatingPattern(stepCount, 1.67, 1.0),
  },
  {
    id: "shuffle",
    name: "Shuffle",
    description: "Heavy-light alternation",
    category: "feel",
    minSteps: 2,
    generator: (stepCount) =>
      generateAlternatingPattern(stepCount, 1.5, 1.0),
  },
];


/**
 * Look up a single template by its ID
 */
export function getTemplateById(
  id: string
): DurationTemplateDefinition | null {
  return TEMPLATE_DEFINITIONS.find((t) => t.id === id) ?? null;
}

/**
 * Get all templates applicable for a given beat count
 */
export function getTemplatesForStepCount(
  stepCount: number
): DurationTemplateDefinition[] {
  return TEMPLATE_DEFINITIONS.filter(
    (t) => stepCount >= t.minSteps && (!t.divisibleBy || stepCount % t.divisibleBy === 0)
  );
}

export function getTemplatesByCategory(
  stepCount: number,
  category: DurationCategory | "all"
): DurationTemplateDefinition[] {
  const templates = getTemplatesForStepCount(stepCount);
  if (category === "all") return templates;
  return templates.filter((t) => t.category === category);
}

/**
 * Convert a template definition to a pattern for a given beat count
 */
export function templateToPattern(
  template: DurationTemplateDefinition,
  userId: string,
  stepCount: number,
  createdAt?: Timestamp
): DurationPattern {
  return {
    id: template.id,
    name: template.name,
    userId,
    stepCount,
    entries: template.generator(stepCount),
    createdAt: createdAt ?? (null as unknown as Timestamp), // Not stored in Firebase unless provided
  };
}

export function getAvailableCategories(stepCount: number): DurationCategory[] {
  const templates = getTemplatesForStepCount(stepCount);
  const categories = new Set(templates.map((t) => t.category));
  return Array.from(categories);
}

