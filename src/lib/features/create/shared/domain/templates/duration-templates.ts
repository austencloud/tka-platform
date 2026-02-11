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
} from "../models/DurationPatternData";

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

/**
 * Get display info for a category
 */
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
  /** Generator function to create entries for a given beat count */
  readonly generator: (stepCount: number) => DurationPatternEntry[];
}

// =============================================================================
// HELPER GENERATORS
// =============================================================================

/**
 * Generate uniform pattern (same duration for all steps)
 */
function generateUniformPattern(
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
function generateGradualPattern(
  stepCount: number,
  startDuration: DurationValue,
  endDuration: DurationValue
): DurationPatternEntry[] {
  const entries: DurationPatternEntry[] = [];
  const step = (endDuration - startDuration) / Math.max(stepCount - 1, 1);
  for (let i = 0; i < stepCount; i++) {
    entries.push({
      stepIndex: i,
      duration: Math.max(0.1, startDuration + step * i),
    });
  }
  return entries;
}

// =============================================================================
// TEMPLATE DEFINITIONS
// =============================================================================

const TEMPLATE_DEFINITIONS: readonly DurationTemplateDefinition[] = [
  // =============================================================================
  // ACCENT - Beat Emphasis (12 templates)
  // =============================================================================
  {
    id: "every-third-doubled",
    name: "Every Third Doubled",
    description: "Beats 3, 6, 9, 12... held twice as long",
    category: "accent",
    minSteps: 3,
    generator: (stepCount) =>
      generateEveryNthPattern(stepCount, 3, 2, 2.0, 1.0),
  },
  {
    id: "downbeat-accent",
    name: "Downbeat Accent",
    description: "4/4 downbeats (1, 5, 9...) emphasized",
    category: "accent",
    minSteps: 4,
    generator: (stepCount) =>
      generateEveryNthPattern(stepCount, 4, 0, 1.5, 1.0),
  },
  {
    id: "backbeat-accent",
    name: "Backbeat Accent",
    description: "Rock/funk feel - beats 3, 7, 11... emphasized",
    category: "accent",
    minSteps: 4,
    generator: (stepCount) =>
      generateEveryNthPattern(stepCount, 4, 2, 1.5, 1.0),
  },
  {
    id: "first-and-last",
    name: "First and Last",
    description: "First and last beats doubled",
    category: "accent",
    minSteps: 2,
    generator: (stepCount) => {
      const entries: DurationPatternEntry[] = [];
      for (let i = 0; i < stepCount; i++) {
        const isBookend = i === 0 || i === stepCount - 1;
        entries.push({
          stepIndex: i,
          duration: isBookend ? 2.0 : 1.0,
        });
      }
      return entries;
    },
  },
  {
    id: "every-second-accent",
    name: "Every Other",
    description: "Beats 2, 4, 6... emphasized",
    category: "accent",
    minSteps: 2,
    generator: (stepCount) =>
      generateEveryNthPattern(stepCount, 2, 1, 1.5, 1.0),
  },
  {
    id: "strong-weak",
    name: "Strong-Weak",
    description: "Classical 2/4 feel",
    category: "accent",
    minSteps: 2,
    generator: (stepCount) =>
      generateAlternatingPattern(stepCount, 1.25, 0.75),
  },
  {
    id: "triplet-accent",
    name: "Triplet Accent",
    description: "Every 3rd beat strong",
    category: "accent",
    minSteps: 3,
    generator: (stepCount) =>
      generateEveryNthPattern(stepCount, 3, 0, 1.5, 1.0),
  },
  {
    id: "last-beat-accent",
    name: "Final Flourish",
    description: "Last beat extended",
    category: "accent",
    minSteps: 2,
    generator: (stepCount) => {
      const entries: DurationPatternEntry[] = [];
      for (let i = 0; i < stepCount; i++) {
        entries.push({
          stepIndex: i,
          duration: i === stepCount - 1 ? 2.0 : 1.0,
        });
      }
      return entries;
    },
  },
  {
    id: "middle-accent",
    name: "Center Emphasis",
    description: "Middle beat(s) doubled",
    category: "accent",
    minSteps: 3,
    generator: (stepCount) => {
      const entries: DurationPatternEntry[] = [];
      const midStart = Math.floor((stepCount - 1) / 2);
      const midEnd = Math.ceil((stepCount - 1) / 2);
      for (let i = 0; i < stepCount; i++) {
        const isMid = i >= midStart && i <= midEnd;
        entries.push({
          stepIndex: i,
          duration: isMid ? 2.0 : 1.0,
        });
      }
      return entries;
    },
  },
  {
    id: "crescendo-accent",
    name: "Building",
    description: "Increasing emphasis",
    category: "accent",
    minSteps: 4,
    generator: (stepCount) => generateGradualPattern(stepCount, 1.0, 1.5),
  },
  {
    id: "decrescendo-accent",
    name: "Fading",
    description: "Decreasing emphasis",
    category: "accent",
    minSteps: 4,
    generator: (stepCount) => generateGradualPattern(stepCount, 1.5, 1.0),
  },
  {
    id: "bookend-accent",
    name: "Framed",
    description: "Strong first & last, soft middle",
    category: "accent",
    minSteps: 4,
    generator: (stepCount) => {
      const entries: DurationPatternEntry[] = [];
      for (let i = 0; i < stepCount; i++) {
        const isBookend = i === 0 || i === stepCount - 1;
        entries.push({
          stepIndex: i,
          duration: isBookend ? 1.5 : 0.8,
        });
      }
      return entries;
    },
  },

  // =============================================================================
  // METER - Time Signature Patterns (16 templates)
  // =============================================================================
  {
    id: "half-time",
    name: "Half Time",
    description: "Everything slower - all beats 2x duration",
    category: "meter",
    minSteps: 1,
    generator: (stepCount) => generateUniformPattern(stepCount, 2.0),
  },
  {
    id: "double-time",
    name: "Double Time",
    description: "Everything faster - all beats 0.5x duration",
    category: "meter",
    minSteps: 1,
    generator: (stepCount) => generateUniformPattern(stepCount, 0.5),
  },
  {
    id: "waltz-3-4",
    name: "3/4 Waltz",
    description: "ONE-two-three feel",
    category: "meter",
    minSteps: 3,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.5, 0.75, 0.75]),
  },
  {
    id: "compound-6-8",
    name: "6/8 Compound",
    description: "Jig feel - grouped in threes",
    category: "meter",
    minSteps: 6,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.0, 0.5, 0.5, 1.0, 0.5, 0.5]),
  },
  {
    id: "meter-5-4",
    name: "5/4 Take Five",
    description: "Jazz quintuple meter",
    category: "meter",
    minSteps: 5,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.25, 1.0, 1.0, 1.0, 0.75]),
  },
  {
    id: "meter-7-8",
    name: "7/8 Balkan",
    description: "Bulgarian/Greek folk rhythm",
    category: "meter",
    minSteps: 7,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.0, 1.0, 0.75, 1.0, 1.0, 1.0, 0.75]),
  },
  {
    id: "meter-9-8",
    name: "9/8 Compound",
    description: "Triple compound time",
    category: "meter",
    minSteps: 9,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [
        1.0, 0.5, 0.5, 1.0, 0.5, 0.5, 1.0, 0.5, 0.5,
      ]),
  },
  {
    id: "meter-12-8",
    name: "12/8 Slow Blues",
    description: "Four groups of three",
    category: "meter",
    minSteps: 12,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [
        1.0, 0.5, 0.5, 1.0, 0.5, 0.5, 1.0, 0.5, 0.5, 1.0, 0.5, 0.5,
      ]),
  },
  {
    id: "quarter-time",
    name: "Quarter Time",
    description: "Ultra slow - all beats 4x duration",
    category: "meter",
    minSteps: 1,
    generator: (stepCount) => generateUniformPattern(stepCount, 4.0),
  },
  {
    id: "triple-time",
    name: "Triple Time",
    description: "Fast - all beats 0.33x duration",
    category: "meter",
    minSteps: 1,
    generator: (stepCount) => generateUniformPattern(stepCount, 0.33),
  },
  {
    id: "march-2-4",
    name: "March",
    description: "Military 2/4 rhythm",
    category: "meter",
    minSteps: 2,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.25, 0.75]),
  },
  {
    id: "polonaise",
    name: "Polonaise",
    description: "Polish 3/4 dance",
    category: "meter",
    minSteps: 3,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [0.75, 1.25, 1.0]),
  },
  {
    id: "siciliana",
    name: "Siciliana",
    description: "Pastoral 6/8",
    category: "meter",
    minSteps: 6,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.25, 0.75, 1.0, 1.0, 0.75, 0.25]),
  },
  {
    id: "mazurka",
    name: "Mazurka",
    description: "Polish 3/4, accent on beat 2",
    category: "meter",
    minSteps: 3,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.0, 1.25, 0.75]),
  },
  {
    id: "habanera",
    name: "Habanera",
    description: "Cuban 4/4",
    category: "meter",
    minSteps: 4,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.5, 0.5, 1.0, 1.0]),
  },
  {
    id: "tango",
    name: "Tango",
    description: "Argentine sharp rhythm",
    category: "meter",
    minSteps: 4,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.0, 1.0, 1.5, 0.5]),
  },

  // =============================================================================
  // FEEL - Rhythmic Character (9 templates)
  // =============================================================================
  {
    id: "swing",
    name: "Swing",
    description: "Triplet feel - long-short alternation",
    category: "feel",
    minSteps: 2,
    generator: (stepCount) =>
      generateAlternatingPattern(stepCount, 1.33, 0.67),
  },
  {
    id: "shuffle",
    name: "Shuffle",
    description: "Blues shuffle - heavy/light alternation",
    category: "feel",
    minSteps: 2,
    generator: (stepCount) =>
      generateAlternatingPattern(stepCount, 1.5, 0.5),
  },
  {
    id: "push",
    name: "Push",
    description: "Anticipation - short-long alternation",
    category: "feel",
    minSteps: 2,
    generator: (stepCount) =>
      generateAlternatingPattern(stepCount, 0.75, 1.25),
  },
  {
    id: "ritardando",
    name: "Ritardando",
    description: "Gradual slowdown through sequence",
    category: "feel",
    minSteps: 4,
    generator: (stepCount) => generateGradualPattern(stepCount, 1.0, 2.0),
  },
  {
    id: "accelerando",
    name: "Accelerando",
    description: "Gradual speedup through sequence",
    category: "feel",
    minSteps: 4,
    generator: (stepCount) => generateGradualPattern(stepCount, 2.0, 1.0),
  },
  {
    id: "four-on-floor",
    name: "Four on Floor",
    description: "House/disco steady pulse",
    category: "feel",
    minSteps: 4,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.0, 1.0, 1.0, 1.05]),
  },
  {
    id: "trap-hihat",
    name: "Trap Rolls",
    description: "Fast 16th note feel",
    category: "feel",
    minSteps: 6,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [0.25, 0.25, 0.25, 0.25, 1.0, 1.0]),
  },
  {
    id: "dnb-two-step",
    name: "Drum & Bass",
    description: "Fast broken beat",
    category: "feel",
    minSteps: 6,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [0.75, 0.25, 0.5, 0.5, 0.5, 0.5]),
  },
  {
    id: "laid-back",
    name: "Laid Back",
    description: "Behind the beat - slight drag",
    category: "feel",
    minSteps: 2,
    generator: (stepCount) => generateUniformPattern(stepCount, 1.1),
  },

  // =============================================================================
  // WORLD - Global Rhythm Traditions (10 templates)
  // =============================================================================
  {
    id: "clave-3-2",
    name: "Son Clave 3-2",
    description: "Cuban foundation rhythm",
    category: "world",
    minSteps: 8,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [
        1.5, 0.5, 1.0, 0.5, 0.5, 1.0, 1.0, 2.0,
      ]),
  },
  {
    id: "clave-2-3",
    name: "Son Clave 2-3",
    description: "Reverse clave pattern",
    category: "world",
    minSteps: 8,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [
        0.5, 0.5, 1.0, 1.0, 1.5, 0.5, 1.0, 2.0,
      ]),
  },
  {
    id: "tresillo",
    name: "Tresillo",
    description: "3+3+2 foundation rhythm",
    category: "world",
    minSteps: 3,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.5, 1.5, 1.0]),
  },
  {
    id: "bossa-nova",
    name: "Bossa Nova",
    description: "Brazilian clave variant",
    category: "world",
    minSteps: 5,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.5, 0.5, 1.0, 1.5, 0.5]),
  },
  {
    id: "reggaeton",
    name: "Reggaeton/Dembow",
    description: "Modern Latin rhythm",
    category: "world",
    minSteps: 5,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [0.75, 0.75, 0.5, 1.0, 1.0]),
  },
  {
    id: "rumba",
    name: "Rumba Clave",
    description: "Cuban dance rhythm",
    category: "world",
    minSteps: 6,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.25, 0.75, 0.5, 1.0, 0.5, 1.0]),
  },
  {
    id: "samba",
    name: "Samba",
    description: "Brazilian 2/4",
    category: "world",
    minSteps: 4,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [0.75, 0.5, 0.75, 1.0]),
  },
  {
    id: "reggae-one-drop",
    name: "Reggae One Drop",
    description: "Laid back Jamaican",
    category: "world",
    minSteps: 4,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [2.0, 0.5, 0.5, 1.0]),
  },
  {
    id: "ska-offbeat",
    name: "Ska Offbeat",
    description: "Syncopated upbeat",
    category: "world",
    minSteps: 4,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [0.5, 1.5, 0.5, 1.5]),
  },
  {
    id: "bolero",
    name: "Bolero",
    description: "Romantic slow Latin",
    category: "world",
    minSteps: 4,
    generator: (stepCount) =>
      generateRepeatingPattern(stepCount, [1.5, 1.0, 1.0, 0.5]),
  },
];

// =============================================================================
// PUBLIC API
// =============================================================================

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
  return TEMPLATE_DEFINITIONS.filter((t) => stepCount >= t.minSteps);
}

/**
 * Get templates filtered by category
 */
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

/**
 * Get all unique categories from available templates
 */
export function getAvailableCategories(stepCount: number): DurationCategory[] {
  const templates = getTemplatesForStepCount(stepCount);
  const categories = new Set(templates.map((t) => t.category));
  return Array.from(categories);
}

