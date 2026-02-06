import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  TurnPattern,
  TurnPatternCreateData,
} from "../../domain/models/TurnPatternData";

/**
 * Specifies which hand(s) to apply pattern changes to
 */
export type TargetHand = "blue" | "red" | "both";

/**
 * Result of applying a turn pattern to a sequence
 */
export interface TurnPatternApplyResult {
  /** Whether the application was successful */
  readonly success: boolean;
  /** The modified sequence (if successful) */
  readonly sequence?: SequenceData;
  /** Error message if not successful */
  readonly error?: string;
  /** Number of steps that were modified */
  readonly modifiedSteps?: number;
  /** Warnings about edge cases encountered */
  readonly warnings?: readonly string[];
}

/**
 * Turn Pattern Service Contract
 *
 * Service for managing turn patterns - extracting them from sequences,
 * saving/loading from Firebase, and applying them to transform sequences.
 *
 * Turn patterns capture the turn values (rotation amounts) for each beat
 * in a sequence, allowing users to save and reapply rotation patterns.
 */
export interface ITurnPatternManager {
  /**
   * Extract a turn pattern from a sequence
   *
   * Iterates through each beat and captures the turn values for
   * both blue and red motions.
   *
   * @param sequence - The sequence to extract from
   * @param name - Name for the pattern
   * @returns Pattern data ready to be saved
   *
   * @example
   * const patternData = service.extractPattern(sequence, "My Pattern");
   * // { name: "My Pattern", stepCount: 4, entries: [...] }
   */
  extractPattern(sequence: SequenceData, name: string): TurnPatternCreateData;

  /**
   * Apply a turn pattern to a sequence
   *
   * Applies the turn values from the pattern to the target sequence.
   * Handles edge cases:
   * - Float ("fl") applied to static/dash → applies 0 turns
   * - Turns applied to motion with no rotation → looks back for context
   *
   * @param pattern - The pattern to apply
   * @param sequence - The target sequence
   * @param targetHand - Which hand(s) to apply to: 'blue', 'red', or 'both' (default: 'both')
   * @returns Result with modified sequence or error
   *
   * @example
   * const result = service.applyPattern(pattern, sequence);
   * if (result.success) {
   *   updateSequence(result.sequence);
   * } else {
   *   showError(result.error);
   * }
   */
  applyPattern(
    pattern: TurnPattern,
    sequence: SequenceData,
    targetHand?: TargetHand
  ): TurnPatternApplyResult;

  /**
   * Save a turn pattern to Firebase
   *
   * Creates a new pattern document in the user's turnPatterns collection.
   *
   * @param data - The pattern data to save
   * @param userId - The user's ID
   * @returns The created pattern with Firebase-assigned ID
   *
   * @example
   * const saved = await service.savePattern(patternData, userId);
   * console.log(`Saved pattern: ${saved.id}`);
   */
  savePattern(
    data: TurnPatternCreateData,
    userId: string
  ): Promise<TurnPattern>;

  /**
   * Load all turn patterns for a user
   *
   * Fetches all patterns from the user's turnPatterns collection,
   * ordered by creation date (newest first).
   *
   * @param userId - The user's ID
   * @returns Array of patterns
   *
   * @example
   * const patterns = await service.loadPatterns(userId);
   * patterns.forEach(p => console.log(p.name));
   */
  loadPatterns(userId: string): Promise<TurnPattern[]>;

  /**
   * Delete a turn pattern
   *
   * Removes a pattern from Firebase.
   *
   * @param patternId - The pattern's Firebase document ID
   * @param userId - The user's ID (for security)
   *
   * @example
   * await service.deletePattern(pattern.id, userId);
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
   *
   * @example
   * const validation = service.validateForSequence(pattern, sequence);
   * if (!validation.valid) {
   *   showError(validation.error);
   * }
   */
  validateForSequence(
    pattern: TurnPattern,
    sequence: SequenceData
  ): { valid: boolean; error?: string };
}
