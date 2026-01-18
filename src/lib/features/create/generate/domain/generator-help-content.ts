/**
 * Generator Help Content
 *
 * Static data for generator control help UI: descriptions, icons, colors.
 * Each control in the Generator tab has an entry explaining what it does.
 */

// Generator control IDs (matches card IDs in CardBasedSettingsContainer)
export type GeneratorHelpId =
  | "level"
  | "length"
  | "generation-mode"
  | "grid-mode"
  | "prop-continuity"
  | "turn-intensity"
  | "loop-type"
  | "slice-size"
  | "start-end"
  | "generate";

export interface GeneratorHelpItem {
  id: GeneratorHelpId;
  icon: string;
  name: string;
  color: string;
  shortDesc: string;
  fullDesc: string;
  /** Optional bullet points for complex explanations */
  bullets?: string[];
  /** Optional images with labels */
  images?: { src: string; label: string }[];
  /** Optional tip shown at bottom */
  tip?: string;
}

export const generatorHelpContent: GeneratorHelpItem[] = [
  // === CORE SETTINGS ===
  {
    id: "level",
    icon: "fa-layer-group",
    name: "Difficulty Level",
    color: "#3b82f6",
    shortDesc: "How complex the turns are",
    fullDesc:
      "Controls how much your props can rotate during each motion.",
    images: [
      { src: "/images/level_images/level_1.png", label: "Level 1 — No rotation" },
      { src: "/images/level_images/level_2.png", label: "Level 2 — 180° (whole)" },
      { src: "/images/level_images/level_3.png", label: "Level 3 — 90° (half)" },
    ],
    tip: "Start at Level 1 to learn the foundation, then progress to Level 3 for full variety.",
  },
  {
    id: "length",
    icon: "fa-ruler",
    name: "Sequence Length",
    color: "#6366f1",
    shortDesc: "Number of moves",
    fullDesc:
      "Sets how many steps (individual moves) your generated sequence will have. Each step is one pictograph showing a single movement.",
    bullets: [
      "Freeform mode: 1-64 steps",
      "LOOP mode: 2-64 steps (must be even for symmetry)",
    ],
    tip: "Shorter sequences are easier to learn and memorize.",
  },
  {
    id: "generation-mode",
    icon: "fa-circle-notch",
    name: "Generation Mode",
    color: "#8b5cf6",
    shortDesc: "LOOP vs Freeform",
    fullDesc:
      "Determines whether your sequence loops back to its starting position or ends freely.",
    bullets: [
      "LOOP: Creates a circular sequence that returns to start - perfect for continuous flow",
      "Freeform: Generates without constraints - ends wherever the pattern takes you",
    ],
    tip: "LOOP sequences are great for practice because you can repeat them seamlessly.",
  },
  {
    id: "grid-mode",
    icon: "fa-border-all",
    name: "Grid System",
    color: "#14b8a6",
    shortDesc: "Diamond vs Box positioning",
    fullDesc:
      "Changes the underlying grid that determines where your hands can be positioned.",
    bullets: [
      "Diamond: 8 positions arranged in a diamond shape (N, NE, E, SE, S, SW, W, NW)",
      "Box: 8 positions arranged in a square pattern - different geometric feel",
    ],
    tip: "Diamond grid is most common. Try Box for a different movement vocabulary.",
  },
  {
    id: "prop-continuity",
    icon: "fa-link",
    name: "Prop Continuity",
    color: "#f59e0b",
    shortDesc: "Continuous vs Reversals",
    fullDesc:
      "Controls whether props maintain their spinning direction or can reverse mid-sequence.",
    bullets: [
      "Continuous: Props keep spinning the same direction - smooth, flowing movements",
      "Reversals: Props can change spin direction - more dynamic, varied patterns",
    ],
    tip: "Continuous is easier to execute. Reversals add visual interest but require more control.",
  },
  {
    id: "turn-intensity",
    icon: "fa-gauge-high",
    name: "Turn Intensity",
    color: "#ef4444",
    shortDesc: "How much spinning",
    fullDesc:
      "Limits the maximum amount of rotation per beat. Lower intensity means gentler, simpler movements.",
    bullets: [
      "Minimal (≤0.5): Quarter turns max - very gentle",
      "Light (≤1.0): Up to full rotations",
      "Moderate (≤1.5): Up to 1.5 rotations",
      "Strong (≤2.0): Up to double rotations",
      "Intense (≤2.5+): Maximum spinning",
    ],
    tip: "The color gradient (green→red) indicates intensity visually.",
  },

  // === LOOP-SPECIFIC SETTINGS ===
  {
    id: "loop-type",
    icon: "fa-rotate",
    name: "LOOP Type",
    color: "#ec4899",
    shortDesc: "How the sequence loops",
    fullDesc:
      "When using LOOP mode, this determines HOW your sequence returns to start. Each type creates a different visual effect.",
    bullets: [
      "Rotated: Sequence repeats with a rotation offset",
      "Mirrored: Second half mirrors the first (left↔right)",
      "Swapped: Hands switch roles in the return",
      "Inverted: Rotation directions flip on return",
      "Combinations: Mix multiple types for complex patterns",
    ],
    tip: "Try different LOOP types with the same settings to see how they change the feel.",
  },
  {
    id: "slice-size",
    icon: "fa-circle-half-stroke",
    name: "Slice Size",
    color: "#06b6d4",
    shortDesc: "Quartered vs Halved",
    fullDesc:
      "In LOOP mode, this controls how the sequence is divided before the return pattern is applied.",
    bullets: [
      "Halved: Sequence splits into 2 parts - simpler, more obvious loop point",
      "Quartered: Sequence splits into 4 parts - more complex, subtler transitions",
    ],
    tip: "Halved is easier to follow. Quartered creates more intricate patterns.",
  },

  // === START/END POSITIONS ===
  {
    id: "start-end",
    icon: "fa-sliders",
    name: "Start/End",
    color: "#22c55e",
    shortDesc: "Lock start/end positions",
    fullDesc:
      "Lets you constrain where your sequence begins and/or ends by selecting specific grid positions.",
    bullets: [
      "Start Position: Force the sequence to begin from a specific hand placement",
      "End Position: (Freeform only) Force the sequence to end at a specific position",
    ],
    tip: "Use this to practice transitioning into or out of specific positions.",
  },

  // === GENERATE ACTION ===
  {
    id: "generate",
    icon: "fa-dice",
    name: "Generate",
    color: "#22c55e",
    shortDesc: "Create a new sequence",
    fullDesc:
      "Generates a random sequence based on all your current settings. The new sequence will replace whatever is currently in your workspace.",
    bullets: [
      "Creates a brand new sequence using the Level, Length, Mode, and other settings above",
      "Replaces the current sequence in your workspace - save first if you want to keep it!",
      "Each generation is unique - tap again for a different result",
    ],
    tip: "Don't like what you got? Just tap again! You can generate as many times as you want.",
  },
];

/**
 * Get help content for a specific generator control
 */
export function getGeneratorHelpContent(
  id: GeneratorHelpId
): GeneratorHelpItem | undefined {
  return generatorHelpContent.find((item) => item.id === id);
}
