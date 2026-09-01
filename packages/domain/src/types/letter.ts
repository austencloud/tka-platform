export interface MotionPattern {
  leftMotion: string;
  rightMotion: string;
  note?: string;
}

export interface LetterTypeDefinition {
  name: string;
  description: string;
  characteristics: string[];
  /** Letters represented in the current Level 1 pictograph dataframe. */
  letters: string[];
  /** Registered higher-level letters that do not yet have dataframe variations. */
  extendedLetters?: string[];
  motionPattern: MotionPattern;
}

/** The 47 Level 1 letters plus registered higher-level letter extensions. */
export type Letter =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
  | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R"
  | "S" | "T" | "U" | "V"
  | "W" | "X" | "Y" | "Z" | "Σ" | "Δ" | "Θ" | "Ω"
  | "W-" | "X-" | "Y-" | "Z-" | "Σ-" | "Δ-" | "Θ-" | "Ω-"
  | "Φ" | "Ψ" | "Λ" | "τ-"
  | "Φ-" | "Ψ-" | "Λ-"
  | "α" | "β" | "γ";

export type LetterTypeNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type LetterTypeName =
  | "Dual-Shift"
  | "Shift"
  | "Cross-Shift"
  | "Dash"
  | "Dual-Dash"
  | "Static";

export interface LetterTypeInfo {
  type: string;
  name: string;
  typeNumber: LetterTypeNumber;
}
