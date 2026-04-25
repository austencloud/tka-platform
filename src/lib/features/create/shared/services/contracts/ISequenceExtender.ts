/**
 * Sequence Extender Interface
 *
 * Detects when a sequence is in an extendable state (end position is a rotation of start)
 * and provides extension options using LOOP (Linked Orbital Offset Pattern) types.
 *
 * LOOP = TKA's algorithmic extension patterns (Mirrored, Rotated, Swapped, etc.)
 * that transform and extend sequences based on position symmetries.
 */

import type { StepData } from "../../domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

// Re-export LOOPType for convenience
export type { LOOPType };

/**
 * Describes the type of extension available for a sequence
 */
export type ExtensionType =
  | "already_complete" // End position equals start position
  | "half_rotation" // End position is 180° rotation of start (4 positions away)
  | "quarter_rotation" // End position is 90° rotation of start (2 positions away)
  | "not_extendable"; // End position is not a rotation of start

/**
 * Describes a single LOOP option available for extension
 * LOOP = Linked Orbital Offset Pattern
 */
export interface LOOPOption {
  /** The LOOP type */
  loopType: LOOPType;
  /** Human-readable name */
  name: string;
  /** Short description of what this LOOP does */
  description: string;
  /** Icon class (FontAwesome) */
  icon: string;
}

/**
 * Result of analyzing whether a sequence can be extended
 */
export interface ExtensionAnalysis {
  /** Whether extension is available */
  canExtend: boolean;
  /** The type of extension possible */
  extensionType: ExtensionType;
  /** Start position of the sequence */
  startPosition: GridPosition | null;
  /** Current end position of the sequence */
  currentEndPosition: GridPosition | null;
  /** Available LOOP options for extension (will actually work) */
  availableLOOPOptions: LOOPOption[];
  /** Unavailable LOOP options (exist but won't work for this sequence) */
  unavailableLOOPOptions: LOOPOption[];
  /** Human-readable description of the extension */
  description: string;
}

/**
 * Options for generating extension steps
 */
export interface ExtensionOptions {
  /** The LOOP type to use for extension */
  loopType: LOOPType;
  /** Slice size override (halved=2×, quartered=4×). If omitted, derived from position pair. */
  sliceSize?: import("$lib/features/create/generate/circular/domain/models/circular-models").SliceSize;
  /** Difficulty level (1-3) */
  difficulty?: number;
  /** Turn intensity (0-1) */
  turnIntensity?: number;
}

/**
 * Describes the rotation relationship between end position and start position.
 * This affects which LOOPs are available and final sequence length.
 */
export type RotationRelation =
  | "exact" // End position equals start position (0°)
  | "quarter" // End position is 90° rotation of start (4x sequence length with rotated LOOPs)
  | "half"; // End position is 180° rotation of start (2x sequence length with mirrored LOOPs)

/**
 * Describes orientation alignment status for exact position matches.
 * When a sequence returns to its start position, orientations may or may not match.
 */
export interface OrientationAlignment {
  /** Whether both blue and red orientations match the start position */
  matches: boolean;
  /** End orientation of blue prop after adding bridge letter */
  blueEndOri: string;
  /** End orientation of red prop after adding bridge letter */
  redEndOri: string;
  /** Start orientation of blue prop (from sequence start position) */
  blueStartOri: string;
  /** Start orientation of red prop (from sequence start position) */
  redStartOri: string;
  /**
   * How many times the sequence needs to repeat to return to original orientations.
   * 1 = orientations already match (true loop)
   * 2 = orientations flip once, need 2 repetitions
   * 4 = orientations quarter-cycle, need 4 repetitions
   */
  repetitionsNeeded: 1 | 2 | 4;
}

/**
 * Option for making a non-loopable sequence circular via bridge letter.
 * When a sequence ends at a different position group than it starts,
 * adding a bridge letter can bring it to a position where LOOPs work.
 */
export interface CircularizationOption {
  /** Bridge letters needed to reach a loopable position */
  bridgeLetters: Letter[];
  /** The position we'd end at after adding bridge letters */
  endPosition: string;
  /** Available LOOP types for this ending position */
  availableLOOPs: LOOPOption[];
  /** Description for UI display */
  description: string;
  /** Pictograph data for visual display of the bridge letter */
  pictographData?: PictographData;
  /** Rotation relationship to start position (affects sequence length multiplier) */
  rotationRelation?: RotationRelation;
  /** Orientation alignment info (only for exact position matches) */
  orientationAlignment?: OrientationAlignment;
  /** Current sequence length (number of steps before extension) */
  currentLength?: number;
  /** Resulting sequence length after applying LOOP with this bridge */
  resultingLength?: number;
}

export interface ISequenceExtender {
  /**
   * Analyze a sequence to determine if it can be extended
   * @param sequence The sequence to analyze
   * @returns Analysis result with extension information
   */
  analyzeSequence(sequence: SequenceData): ExtensionAnalysis;

  /**
   * Generate steps to extend a sequence back to its starting position
   * @param sequence The sequence to extend
   * @param options Optional generation options
   * @returns The extension steps (excluding the existing sequence)
   * @throws Error if sequence cannot be extended
   */
  generateExtensionSteps(
    sequence: SequenceData,
    options?: ExtensionOptions
  ): Promise<StepData[]>;

  /**
   * Extend a sequence by appending the generated extension steps
   * @param sequence The sequence to extend
   * @param options Optional generation options
   * @returns A new sequence with extension steps appended
   * @throws Error if sequence cannot be extended
   */
  extendSequence(
    sequence: SequenceData,
    options?: ExtensionOptions
  ): Promise<SequenceData>;

  /**
   * Get circularization options for a sequence that isn't directly loopable.
   * Returns bridge letter options that would bring the sequence to a loopable position.
   * @param sequence The sequence to analyze
   * @returns Array of circularization options, or empty if already loopable or no options exist
   */
  getCircularizationOptions(
    sequence: SequenceData
  ): Promise<CircularizationOption[]>;

  /**
   * Get extension options that would bring the sequence to a loopable position.
   * Only returns pictographs that END in the same position GROUP as the sequence starts.
   * For example: if sequence starts at alpha3, only shows letters that end in alpha1/3/5/7.
   * Used for pictograph-first UX where users select visually, then pick LOOP.
   * @param sequence The sequence to analyze
   * @returns Array of extension options with pictograph data and available LOOPs
   */
  getAllExtensionOptions(
    sequence: SequenceData
  ): Promise<CircularizationOption[]>;

  /**
   * Extend a sequence by first appending a bridge letter, then applying a LOOP.
   * @param sequence The sequence to extend
   * @param bridgeLetter The bridge letter to append before applying LOOP
   * @param loopType The LOOP type to apply after adding bridge letter
   * @returns A new sequence with bridge letter and LOOP applied
   * @throws Error if extension fails
   */
  extendWithBridge(
    sequence: SequenceData,
    bridgeLetter: Letter,
    loopType: LOOPType,
    pictographData?: import("$lib/shared/pictograph/shared/domain/models/PictographData").PictographData,
    sliceSize?: import("$lib/features/create/generate/circular/domain/models/circular-models").SliceSize
  ): Promise<SequenceData>;

  /**
   * Append just a bridge beat to a sequence (without applying LOOP).
   * Used when user selects a bridge pictograph and wants to see it in the sequence
   * before choosing which LOOP to apply.
   * @param sequence The sequence to append to
   * @param bridgeLetter The bridge letter to append
   * @param pictographData Optional specific pictograph to use. If provided, this exact
   *        pictograph will be used instead of randomly selecting a variation.
   *        This ensures the sequence ends at the expected position for LOOP application.
   * @returns A new sequence with the bridge beat appended
   * @throws Error if no valid pictograph found for the bridge letter
   */
  appendBridgeBeat(
    sequence: SequenceData,
    bridgeLetter: Letter,
    pictographData?: PictographData
  ): Promise<SequenceData>;
}
