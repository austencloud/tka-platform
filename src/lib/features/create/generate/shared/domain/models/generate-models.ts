/**
 * Generation Service Interfaces - Complete interface definitions
 *
 * Complete interfaces for motion generation, sequence generation, and related algorithms.
 * Updated to match exact legacy generation parameters and options.
 */
// ============================================================================
// GENERATION OPTIONS
// ============================================================================
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type {
  LOOPType,
  Period,
} from "../../../circular/domain/models/circular-models";

// Re-export LOOPType for convenience
export type { LOOPType };
import type {
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

// ============================================================================
// DATA CONTRACTS (Domain Models)
// ============================================================================

export interface GenerationOptions {
  mode?: GenerationMode | undefined;
  length: number;
  /**
   * Word to spell (e.g. "BOOK", "AΣ-B"). When provided, the engine parses
   * letters from the word instead of using `length` for freeform generation.
   * Used by spell mode to route through the same engine pipeline as freeform.
   */
  word?: string;
  gridMode: GridMode;
  propType: PropType;
  difficulty: DifficultyLevel;
  propContinuity?: PropContinuity | undefined;
  turnIntensity?: number | undefined;
  period?: Period | undefined; // For circular generation
  loopType?: LOOPType | undefined; // LOOP type for circular generation

  // 3-axis constraint system
  constraintPreset?: "smooth" | "mixed" | "choppy" | undefined;
  handPathMode?: "smooth" | "mixed" | "choppy" | undefined;
  motionTypeFilter?: "no-dash" | "prefer-dash" | null | undefined;

  // Customize options - advanced constraints for generation
  /** @deprecated Use blockedStartPositions for multi-select */
  startPosition?: PictographData | null; // Specific start position constraint
  endPosition?: PictographData | null; // Specific end position constraint
  mustContainLetters?: Letter[]; // Letters that must appear in the sequence
  mustNotContainLetters?: Letter[]; // Letters that must NOT appear in the sequence

  // Multi-select start position constraints (blocklist approach)
  blockedStartPositions?: GridPosition[]; // Positions that should NOT be used
}

export interface LetterDerivationResult {
  letter: Letter | null;
  confidence: "exact" | "partial" | "none";
  matchedParameters: string[];
}

export interface PictographOperation {
  type: "add" | "remove" | "modify" | "reorder";
  targetIndex?: number;
  data?: Record<string, unknown>;
}
// NOTE: Period and LOOPType are now in circular/domain/models/circular-models.ts
// Import from there if needed

// Fundamental LOOP components that can be combined
// The 6 transformation primitives + reserved orientation primitives (not user-surfaced)
export enum LOOPComponent {
  ROTATED = "rotated",    // 180° or 90° position rotation
  MIRRORED = "mirrored",  // Vertical reflection (left ↔ right)
  FLIPPED = "flipped",    // Horizontal reflection (north ↔ south)
  SWAPPED = "swapped",    // Blue/red hand exchange
  INVERTED = "inverted",  // PRO ↔ ANTI motion direction flip
  REWOUND = "rewound",    // Time reversal (plays backward)

  // Reserved orientation primitives - detected but never surfaced in UI.
  // Filter via RESERVED_ORIENTATION_PRIMITIVES in consumer resolvers.
  ZONE_HOLD_INVERT = "zone_hold_invert", // all beats stay in the same radial zone; orientations invert in-zone
  ZONE_HOLD_FLIP = "zone_hold_flip",     // all beats stay in the same nonradial zone; orientations flip in-zone
  ZONE_CROSS = "zone_cross",             // beats alternate radial/nonradial zones across the cycle
}

/**
 * LOOP components that live in the enum and in detection output but are NEVER
 * surfaced to UI consumers. Introduced as a reserved taxonomy for orientation
 * primitives we have not yet fully explored (zone-hold-invert etc.).
 *
 * Resolvers and icon strips consume `resolveLoopDisplay`, which filters these
 * out before returning. If you are a new UI consumer, use the resolver - do
 * not read `SequenceData.components` directly, or you will see these.
 */
export const RESERVED_ORIENTATION_PRIMITIVES = new Set<LOOPComponent>([
  LOOPComponent.ZONE_HOLD_INVERT,
  LOOPComponent.ZONE_HOLD_FLIP,
  LOOPComponent.ZONE_CROSS,
]);

/**
 * Domain of a LOOP transformation.
 *
 * A LOOP component can operate in one of three spaces:
 * - `location`: grid positions transform between passes (classic LOOPs)
 * - `orientation`: orientations transform between passes (positions stay pinned)
 * - `both`: detected in both spaces (e.g., a sequence that rotates in location
 *   AND accumulates an orientation cycle that matches the positional cycle)
 */
export type LOOPDomain = "location" | "orientation" | "both";

/**
 * A detected LOOP component with its operating domain.
 *
 * The detector emits one DetectedComponent per (component, domain) pair.
 * UI consumers consume a deduplicated Set<LOOPComponent> paired with a
 * Record<LOOPComponent, LOOPDomain> (see resolveLoopDisplay).
 */
export interface DetectedComponent {
  readonly component: LOOPComponent;
  readonly domain?: LOOPDomain;
}

/**
 * Display metadata for LOOP component UI
 * Short descriptions shown in-button, full descriptions handled by LOOPExplanationTextGenerator
 */
export interface LOOPComponentInfo {
  component: LOOPComponent;
  label: string;
  shortLabel: string;
  description: string; // Short description for in-button display
  icon: string;
  color: string;
}

export enum PositionSystem {
  ALPHA_TO_ALPHA = "alpha_to_alpha",
  ALPHA_TO_BETA = "alpha_to_beta",
  ALPHA_TO_GAMMA = "alpha_to_gamma",
  BETA_TO_ALPHA = "beta_to_alpha",
  BETA_TO_BETA = "beta_to_beta",
  BETA_TO_GAMMA = "beta_to_gamma",
  GAMMA_TO_ALPHA = "gamma_to_alpha",
  GAMMA_TO_BETA = "gamma_to_beta",
  GAMMA_TO_GAMMA = "gamma_to_gamma",
}

export enum DifficultyLevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
  SKEWED = "skewed",
}

export enum PropContinuity {
  CONTINUOUS = "continuous",
  RANDOM = "random",
}

export enum GenerationMode {
  FREEFORM = "freeform",
  SPELL = "spell",
  /** @internal Used by the generation orchestrator when loopEnabled=true + freeform mode */
  CIRCULAR = "circular",
}

// ============================================================================
// LOOP PARAMETER TYPES
// ============================================================================

/**
 * Rotation directions for blue and red props
 * Used during continuous prop generation to determine rotation behavior
 */
export interface RotationDirections {
  blueRotationDirection: string;
  redRotationDirection: string;
}

// TurnAllocation is exported from services/contracts/ITurnAllocator.ts
// Re-exporting here for backwards compatibility
export type { TurnAllocation } from "../../services/contracts/ITurnAllocator";
