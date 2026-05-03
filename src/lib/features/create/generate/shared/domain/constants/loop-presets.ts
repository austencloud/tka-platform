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
  /** Font Awesome icon name (without fa- prefix), matches loop-constants.ts */
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
    description: "Standard 180° rotation around the grid center",
    useCase: "Basic circular transformation. Each position in the first half is rotated 180° in the second half.",
    components: [LOOPComponent.ROTATED],
    difficulty: 1,
    icon: "rotate",
    featured: true,
  },
  {
    id: "mirror-flow",
    name: "Mirror Flow",
    description: "Vertical reflection of the sequence path",
    useCase: "The second half reflects the first half across the vertical axis.",
    components: [LOOPComponent.MIRRORED],
    difficulty: 1,
    icon: "left-right",
    featured: true,
  },
  {
    id: "hand-swap",
    name: "Hand Swap",
    description: "Blue and red exchange their movements",
    useCase: "The second half swaps hand roles (Blue ↔ Red). Each hand performs the other's movement pattern.",
    components: [LOOPComponent.SWAPPED],
    difficulty: 1,
    icon: "shuffle",
  },

  // === INTERMEDIATE PRESETS ===
  {
    id: "shadow-self",
    name: "Shadow Self",
    description: "Inverted motion types (Pro ↔ Anti)",
    useCase: "Browse the inverted version of your flow. Pro becomes anti, and anti becomes pro. Base motion types (static, dash) remain unchanged.",
    components: [LOOPComponent.INVERTED],
    difficulty: 2,
    icon: "adjust",
  },
  {
    id: "diagonal-mirror",
    name: "Diagonal Mirror",
    description: "Mirror + Rotation for diagonal symmetry",
    useCase: "Positions reflect across the diagonal axes. Results in a sequence where positions mirror both vertically and rotationally.",
    components: [LOOPComponent.MIRRORED, LOOPComponent.ROTATED],
    difficulty: 2,
    icon: "left-right",
    featured: true,
  },
  {
    id: "balanced-circle",
    name: "Balanced Circle",
    description: "Rotation + Swap for dual-hand spatial symmetry",
    useCase: "The second half applies 180° rotation and swaps hand roles (Blue ↔ Red).",
    components: [LOOPComponent.ROTATED, LOOPComponent.SWAPPED],
    difficulty: 2,
    icon: "rotate",
  },
  {
    id: "swapped-inverted",
    name: "Swapped Inverted",
    description: "Swap hands while inverting rotation (Pro ↔ Anti)",
    useCase: "The second half swaps hand roles and inverts motion types.",
    components: [LOOPComponent.SWAPPED, LOOPComponent.INVERTED],
    difficulty: 2,
    icon: "shuffle",
  },

  // === ADVANCED PRESETS ===
  {
    id: "mirror-shadow",
    name: "Mirror Shadow",
    description: "Vertical reflection with inverted rotation",
    useCase: "Spatial reflection (Mirrored) + rotation inversion (Inverted).",
    components: [LOOPComponent.MIRRORED, LOOPComponent.INVERTED],
    difficulty: 3,
    icon: "left-right",
  },
  {
    id: "complete-reversal",
    name: "Complete Reversal",
    description: "Rotation + Inversion for total spatial/rotation flip",
    useCase: "The second half applies 180° rotation and inverts motion types (Pro ↔ Anti).",
    components: [LOOPComponent.ROTATED, LOOPComponent.INVERTED],
    difficulty: 3,
    icon: "rotate",
  },
  {
    id: "triple-transform",
    name: "Triple Transform",
    description: "Mirror + Rotate + Invert combination",
    useCase: "Applies vertical mirroring, 180° rotation, and inverts motion types (Pro ↔ Anti).",
    components: [LOOPComponent.MIRRORED, LOOPComponent.ROTATED, LOOPComponent.INVERTED],
    difficulty: 3,
    icon: "left-right",
  },
  {
    id: "full-transform",
    name: "Full Transformation",
    description: "All four transformations combined",
    useCase: "Applies 180° rotation, vertical mirroring, hand swapping (Blue ↔ Red), and motion inversion (Pro ↔ Anti).",
    components: [LOOPComponent.ROTATED, LOOPComponent.MIRRORED, LOOPComponent.SWAPPED, LOOPComponent.INVERTED],
    difficulty: 3,
    icon: "rotate",
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
