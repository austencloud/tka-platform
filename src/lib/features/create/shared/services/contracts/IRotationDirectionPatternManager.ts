import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  RotationDirectionPattern,
  RotationDirectionPatternCreateData,
} from "../../domain/models/RotationDirectionPatternData";

/**
 * Specifies which hand(s) to apply pattern changes to
 */
export type TargetHand = "blue" | "red" | "both";

/**
 * Result of applying a rotation direction pattern to a sequence
 */
export interface RotationDirectionPatternApplyResult {
  /** Whether the application was successful */
  readonly success: boolean;
  /** The modified sequence (if successful) */
  readonly sequence?: SequenceData;
  /** Error message if not successful */
  readonly error?: string;
  /** Number of steps that were modified */
  readonly modifiedSteps?: number;
  /** Warnings about edge cases encountered (e.g., skipped motions) */
  readonly warnings?: readonly string[];
}

/**
 * Rotation Direction Pattern Service Contract
 *
 * Service for managing rotation direction patterns - extracting them from sequences,
 * saving/loading from Firebase, and applying them to transform sequences.
 *
 * Key difference from Turn Pattern Service:
 * - Turn patterns modify the NUMBER of turns (0, 1, 2, fl, etc.)
 * - Rotation direction patterns modify the DIRECTION of rotation (CW vs CCW)
 * - This service NEVER adds or removes turns - only changes direction where rotation exists
 *
 * Skip Logic (when applying):
 * - FLOAT → skip (floats have no rotation)
 * - STATIC @ 0 turns → skip (no rotation to modify)
 * - DASH @ 0 turns → skip (don't add turns)
 * - DASH @ turns > 0 + "none" → skip (don't remove turns)
 * - PRO/ANTI + "none" → skip (don't convert to static/dash)
 */
export interface IRotationDirectionPatternManager {
  /**
   * Extract a rotation direction pattern from a sequence
   *
   * Iterates through each beat and captures the rotation direction for
   * both blue and red motions.
   *
   * Extraction rules:
   * - FLOAT → "none"
   * - STATIC @ 0 turns → "none"
   * - DASH @ 0 turns → "none"
   * - PRO/ANTI/DASH/STATIC with turns > 0 → actual direction ("cw" or "ccw")
   *
   * @param sequence - The sequence to extract from
   * @param name - Name for the pattern
   * @returns Pattern data ready to be saved
   */
  extractPattern(
    sequence: SequenceData,
    name: string
  ): RotationDirectionPatternCreateData;

  /**
   * Apply a rotation direction pattern to a sequence
   *
   * Applies the rotation directions from the pattern to the target sequence.
   * Key behavior: NEVER adds or removes turns - only modifies direction.
   *
   * Application rules:
   * - PRO/ANTI getting CW/CCW → flip motion type if direction changes
   * - DASH with turns getting CW/CCW → apply direction
   * - Motions without rotation → skip (don't add turns)
   *
   * @param pattern - The pattern to apply
   * @param sequence - The target sequence
   * @param targetHand - Which hand(s) to apply to: 'blue', 'red', or 'both' (default: 'both')
   * @returns Result with modified sequence or error
   */
  applyPattern(
    pattern: RotationDirectionPattern,
    sequence: SequenceData,
    targetHand?: TargetHand
  ): Promise<RotationDirectionPatternApplyResult>;

  /**
   * Save a rotation direction pattern to Firebase
   *
   * Creates a new pattern document in the user's rotationDirectionPatterns collection.
   *
   * @param data - The pattern data to save
   * @param userId - The user's ID
   * @returns The created pattern with Firebase-assigned ID
   */
  savePattern(
    data: RotationDirectionPatternCreateData,
    userId: string
  ): Promise<RotationDirectionPattern>;

  /**
   * Load all rotation direction patterns for a user
   *
   * Fetches all patterns from the user's rotationDirectionPatterns collection,
   * ordered by creation date (newest first).
   *
   * @param userId - The user's ID
   * @returns Array of patterns
   */
  loadPatterns(userId: string): Promise<RotationDirectionPattern[]>;

  /**
   * Delete a rotation direction pattern
   *
   * Removes a pattern from Firebase.
   *
   * @param patternId - The pattern's Firebase document ID
   * @param userId - The user's ID (for security)
   */
  deletePattern(patternId: string, userId: string): Promise<void>;

  /**
   * Validate that a pattern can be applied to a sequence
   *
   * Checks beat count match and other constraints.
   *
   * @param pattern - The pattern to validate
   * @param sequence - The target sequence
   * @returns Validation result
   */
  validateForSequence(
    pattern: RotationDirectionPattern,
    sequence: SequenceData
  ): { valid: boolean; error?: string };
}
