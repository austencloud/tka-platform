/**
 * LOOP Preset Definitions
 *
 * Curated LOOP type combinations recommended by Austen Cloud.
 * Each preset includes a description of what it's good for and when to use it.
 */

import { LOOPComponent } from "../models/generate-models";

/**
 * A curated LOOP preset with metadata
 */
export interface LOOPPreset {
  /** Unique identifier for the preset */
  id: string;
  /** Display name for the preset */
  name: string;
  /** Short description of what this preset does */
  description: string;
  /** When/why to use this preset */
  useCase: string;
  /** The LOOP components that make up this preset */
  components: LOOPComponent[];
  /** Difficulty level: 1 = beginner, 2 = intermediate, 3 = advanced */
  difficulty: 1 | 2 | 3;
  /** Icon emoji for visual distinction */
  icon: string;
  /** Whether this is a featured/recommended preset */
  featured?: boolean;
}

/**
 * Curated LOOP presets - recommended combinations
 */
export const LOOP_PRESETS: readonly LOOPPreset[] = [
  // === BEGINNER PRESETS ===
  {
    id: "classic-rotated",
    name: "Classic Rotation",
    description: "Simple 180° rotation - the most intuitive LOOP",
    useCase: "Best for beginners. Your sequence plays in the opposite corner, making it easy to track visually.",
    components: [LOOPComponent.ROTATED],
    difficulty: 1,
    icon: "🔄",
    featured: true,
  },
  {
    id: "mirror-flow",
    name: "Mirror Flow",
    description: "Left-right reflection of your sequence",
    useCase: "Great for building ambidextrous skill. Practice your sequence and its mirror image back-to-back.",
    components: [LOOPComponent.MIRRORED],
    difficulty: 1,
    icon: "🪞",
    featured: true,
  },
  {
    id: "hand-swap",
    name: "Hand Swap",
    description: "Blue and red exchange their movements",
    useCase: "Perfect for prop independence training. Forces each hand to learn the other's pattern.",
    components: [LOOPComponent.SWAPPED],
    difficulty: 1,
    icon: "🤝",
  },

  // === INTERMEDIATE PRESETS ===
  {
    id: "shadow-self",
    name: "Shadow Self",
    description: "Inverted motion types create the 'opposite energy' version",
    useCase: "Browse the complementary version of your flow. Pro becomes anti, static becomes dash.",
    components: [LOOPComponent.INVERTED],
    difficulty: 2,
    icon: "👤",
  },
  {
    id: "diagonal-mirror",
    name: "Diagonal Mirror",
    description: "Mirror + Rotation for diagonal symmetry",
    useCase: "Creates beautiful diamond patterns. Your sequence reflects diagonally across the grid.",
    components: [LOOPComponent.MIRRORED, LOOPComponent.ROTATED],
    difficulty: 2,
    icon: "💎",
    featured: true,
  },
  {
    id: "balanced-circle",
    name: "Balanced Circle",
    description: "Rotation + Swap for perfectly balanced LOOPs",
    useCase: "The mathematically cleanest way to return to start. Both spatial and hand positions swap.",
    components: [LOOPComponent.ROTATED, LOOPComponent.SWAPPED],
    difficulty: 2,
    icon: "⭕",
  },
  {
    id: "energy-flip",
    name: "Energy Flip",
    description: "Swap hands while inverting motion energy",
    useCase: "Each hand does the other's pattern with opposite energy. Creates interesting push-pull dynamics.",
    components: [LOOPComponent.SWAPPED, LOOPComponent.INVERTED],
    difficulty: 2,
    icon: "⚡",
  },

  // === ADVANCED PRESETS ===
  {
    id: "mirror-shadow",
    name: "Mirror Shadow",
    description: "Your reflection with inverted energy",
    useCase: "Like seeing your shadow in a mirror. Spatial reflection + energy inversion.",
    components: [LOOPComponent.MIRRORED, LOOPComponent.INVERTED],
    difficulty: 3,
    icon: "🌑",
  },
  {
    id: "complete-reversal",
    name: "Complete Reversal",
    description: "Rotation + Inversion for total spatial/energy flip",
    useCase: "Everything changes: position AND energy. Maximum contrast while maintaining structure.",
    components: [LOOPComponent.ROTATED, LOOPComponent.INVERTED],
    difficulty: 3,
    icon: "🔃",
  },
  {
    id: "triple-transform",
    name: "Triple Transform",
    description: "Mirror + Rotate + Invert for complex patterns",
    useCase: "For advanced practitioners seeking maximum variation. Three simultaneous transformations.",
    components: [LOOPComponent.MIRRORED, LOOPComponent.ROTATED, LOOPComponent.INVERTED],
    difficulty: 3,
    icon: "🔺",
  },
  {
    id: "ultimate-loop",
    name: "Ultimate LOOP",
    description: "All four transformations combined",
    useCase: "The most complex LOOP possible. Only for those who've mastered all individual components.",
    components: [LOOPComponent.ROTATED, LOOPComponent.MIRRORED, LOOPComponent.SWAPPED, LOOPComponent.INVERTED],
    difficulty: 3,
    icon: "🌀",
    featured: true,
  },
] as const;

/**
 * Get presets filtered by difficulty
 */
export function getPresetsByDifficulty(difficulty: 1 | 2 | 3): LOOPPreset[] {
  return LOOP_PRESETS.filter((p) => p.difficulty === difficulty);
}

/**
 * Get featured presets
 */
export function getFeaturedPresets(): LOOPPreset[] {
  return LOOP_PRESETS.filter((p) => p.featured);
}

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): LOOPPreset | undefined {
  return LOOP_PRESETS.find((p) => p.id === id);
}
