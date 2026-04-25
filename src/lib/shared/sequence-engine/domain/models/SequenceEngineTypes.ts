/**
 * Sequence Engine Types - Shared domain models
 *
 * Platform-agnostic types for sequence generation.
 * Uses strings internally for maximum compatibility between
 * MCP server (Node.js) and browser contexts.
 */

/**
 * Position groups for letter transitions.
 * Letters can only follow other letters if their position groups match.
 */
export type PositionGroup = "alpha" | "beta" | "gamma";

/**
 * Motion types for hand movements.
 */
export type MotionType = "shift" | "dash" | "static" | "pro" | "anti" | "float";

/**
 * Rotation directions for props.
 */
export type RotationDirection = "cw" | "ccw" | "noRotation";

/**
 * Prop orientations.
 */
export type Orientation =
  | "in"
  | "out"
  | "clock"
  | "counter"
  // Interradial orientations (Level 6 - 45° between cardinal orientations)
  | "clockIn"
  | "clockOut"
  | "counterIn"
  | "counterOut"
  // Centric orientations (Level 5 - prop at center)
  | "centerN"
  | "centerNE"
  | "centerE"
  | "centerSE"
  | "centerS"
  | "centerSW"
  | "centerW"
  | "centerNW";

/**
 * Grid locations where hands can be placed.
 */
export type GridLocation = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw" | "c";

/**
 * Categories of letters based on motion type patterns.
 */
export type LetterCategory =
  | "dual-shift"
  | "shift"
  | "cross-shift"
  | "dash"
  | "dual-dash"
  | "static";

/**
 * Letter type numbers (1-6).
 * - Type 1: Dual-Shift (A-V)
 * - Type 2: Shift (W, X, Y, Z, Σ, Δ, Θ, Ω)
 * - Type 3: Cross-Shift (W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-)
 * - Type 4: Dash (Φ, Ψ, Λ)
 * - Type 5: Dual-Dash (Φ-, Ψ-, Λ-)
 * - Type 6: Static (α, β, γ)
 */
export type LetterType = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Information about a letter's position transitions.
 */
export interface LetterPositionInfo {
  letter: string;
  startPositionGroup: PositionGroup;
  endPositionGroup: PositionGroup;
  category?: LetterCategory;
}

/**
 * Raw letter mapping data from letter-mappings.json.
 */
export interface LetterMappingData {
  startPosition: string;
  endPosition: string;
  blueMotion: string;
  redMotion: string;
}

/**
 * Structure of letter-mappings.json file.
 */
export interface LetterMappingsJson {
  letters: Record<string, LetterMappingData>;
  categories: Record<string, string[]>;
}

/**
 * Motion data for one hand (prop).
 */
export interface MotionData {
  motionType: string;
  startLocation: string;
  endLocation: string;
  rotationDirection: string;
  startOrientation?: string;
  endOrientation?: string;
  turns?: number | "fl";
  /** Spinning plane (future concept, not yet assigned to a level). Defaults to "wall" when omitted. */
  plane?: "wall" | "wheel" | "floor";
}

/**
 * A step in a sequence (one beat of motion).
 */
export interface SequenceStep {
  /** The letter representing this motion */
  letter: string;
  /** Starting position (e.g., "alpha1", "beta3") */
  startPosition: string;
  /** Ending position */
  endPosition: string;
  /** Blue hand/prop motion data */
  blueMotion: MotionData;
  /** Red hand/prop motion data */
  redMotion: MotionData;
  /** Beat number in the sequence */
  stepNumber: number;
}

/**
 * Result of sequence building.
 */
export interface SequenceResult {
  /** Whether the build was successful */
  isValid: boolean;
  /** The sequence steps (index 0 is start position) */
  steps: SequenceStep[];
  /** Error message if build failed */
  error?: string;
  /** Word that was spelled (if word-based generation) */
  word?: string;
  /** Letters including any bridges */
  expandedLetters?: string[];
}

/**
 * Input for orientation calculation.
 */
export interface OrientationInput {
  motionType: string;
  turns?: number | "fl";
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  startOrientation?: string;
}
