/** LOOP component identifiers — shared between app and MCP */
export type LOOPComponentId =
  | "rotated"
  | "mirrored"
  | "flipped"
  | "swapped"
  | "inverted"
  | "rewound";

/** Gradient stop for canvas rendering */
export interface GradientStop {
  offset: number;
  color: string;
}

/** Difficulty level visual config */
export interface DifficultyLevel {
  /** CSS background string for Svelte UI components */
  cssBg: string;
  /** Canvas gradient stops */
  stops: GradientStop[];
  /** Border color */
  border: string;
  /** Text color */
  text: string;
}

/** Start position layout mode */
export type StartPositionLayout = "sidebar" | "top" | "column" | "row" | "none";

/** Letter styling for header (bridge/derived letters) */
export interface LetterStyle {
  letter: string;
  dimmed: boolean;
}
