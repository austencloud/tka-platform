import type { LoopBaseComponent, LoopComponent, CompoundLoopType } from "../types/loop.js";

export const LOOP_DEFINITION = "Sequences where words repeat to trace complementary patterns. The word must end on a variation of its start position, eventually returning to the exact starting position (home)." as const;

export const LOOP_BASE_COMPONENTS: Record<LoopComponent, LoopBaseComponent> = {
  rotated: {
    description: "Positions rotate around the grid to return home",
    keyInsight: "Rotated means COMPLETING the full rotation, not just reaching a rotated midpoint. The second half must CONTINUE rotating in the same direction to return home.",
    variants: {
      halved: {
        sliceSize: "180 degrees",
        pattern: "Two halves, each rotates 180 degrees, completing 360 degrees total",
        mentalModel: "Like a clock hand moving continuously: starts at 12 o'clock, first half reaches 6 o'clock (180 degrees), second half CONTINUES to 12 o'clock (360 degrees). NOT going 0 to 180 then reversing back (that's Rewound).",
      },
      quartered: {
        sliceSize: "90 degrees",
        pattern: "Four quarters, each rotates 90 degrees, completing 360 degrees total",
        mentalModel: "Clock hand: 12 to 3 to 6 to 9 to 12 (continuing same direction)",
      },
    },
  },
  mirrored: {
    description: "Positions mirror vertically to return home",
    axis: "Vertical axis through center",
    effect: "Left-right positions swap across the vertical midline",
  },
  flipped: {
    description: "Positions mirror horizontally to return home",
    axis: "Horizontal axis through center",
    effect: "Top-bottom positions swap across the horizontal midline",
    note: "Same concept as mirrored but along perpendicular axis",
  },
  swapped: {
    description: "Blue and Red hands swap roles",
    effect: "What blue hand did, red hand now does (and vice versa)",
    note: "Changes body motion significantly",
  },
  inverted: {
    description: "Motion types flip between PRO and ANTI",
    effect: "Prospin becomes antispin, antispin becomes prospin",
  },
  rewound: {
    description: "Second half plays in reverse - hands trace back",
    keyInsight: "The hands retrace their path backwards to return home. Like pressing rewind on a video.",
    distinctionFromRotated: "Rewound: Hands reverse direction to go back. Rotated: Hands continue same rotational direction forward.",
  },
} as const satisfies Record<LoopComponent, LoopBaseComponent>;

export const COMPOUND_LOOP_TYPES: Record<string, CompoundLoopType> = {
  strictRotated: { components: ["rotated"] },
  strictMirrored: { components: ["mirrored"] },
  strictSwapped: { components: ["swapped"] },
  mirroredSwapped: { components: ["mirrored", "swapped"] },
  rotatedSwapped: { components: ["rotated", "swapped"] },
  mirroredRotated: { components: ["mirrored", "rotated"] },
  invertedRotated: { components: ["inverted", "rotated"] },
  invertedMirrored: { components: ["inverted", "mirrored"] },
  invertedSwapped: { components: ["inverted", "swapped"] },
  invertedMirroredSwapped: { components: ["inverted", "mirrored", "swapped"] },
  rewoundInverted: { components: ["rewound", "inverted"] },
} as const satisfies Record<string, CompoundLoopType>;

export const LOOP_CONSTRUCTION_PRINCIPLES = {
  wordEndingRequirement: "Word must end on variation of start position to enable seamless repetition",
  homeReturn: "Return to exact starting position and orientation through calculated repetitions with transformations",
  patternCompletion: "Trace geometric or symmetric patterns in space for visual and kinesthetic satisfaction",
} as const;
