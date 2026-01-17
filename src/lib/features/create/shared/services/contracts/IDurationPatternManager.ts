import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  DurationPattern,
  DurationPatternCreateData,
} from "../../domain/models/DurationPatternData";

/**
 * Result of applying a duration pattern to a sequence
 */
export interface DurationPatternApplyResult {
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
 * Duration Pattern Service Contract
 *
 * Service for managing duration patterns - extracting them from sequences,
 * saving/loading from Firebase, and applying them to transform sequences.
 *
 * Duration patterns capture the duration multiplier for each beat
 * in a sequence, allowing users to save and reapply timing patterns.
 *
 * Note: Unlike Turn Patterns, duration is a step-level property, not per-motion.
 * Both hands share the same duration for each beat.
 */
export interface IDurationPatternManager {
  /**
   * Extract a duration pattern from a sequence
   *
   * Iterates through each beat and captures the duration values.
   *
   * @param sequence - The sequence to extract from
   * @param name - Name for the pattern
   * @returns Pattern data ready to be saved
   *
   * @example
   * const patternData = service.extractPattern(sequence, "My Timing");
   * // { name: "My Timing", stepCount: 4, entries: [...] }
   */
  extractPattern(
    sequence: SequenceData,
    name: string
  ): DurationPatternCreateData;

  /**
   * Apply a duration pattern to a sequence
   *
   * Applies the duration values from the pattern to the target sequence.
   * Duration is applied to the step level (affects both hands equally).
   *
   * @param pattern - The pattern to apply
   * @param sequence - The target sequence
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
    pattern: DurationPattern,
    sequence: SequenceData
  ): DurationPatternApplyResult;

  /**
   * Save a duration pattern to Firebase
   *
   * Creates a new pattern document in the user's durationPatterns collection.
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
    data: DurationPatternCreateData,
    userId: string
  ): Promise<DurationPattern>;

  /**
   * Load all duration patterns for a user
   *
   * Fetches all patterns from the user's durationPatterns collection,
   * ordered by creation date (newest first).
   *
   * @param userId - The user's ID
   * @returns Array of patterns
   *
   * @example
   * const patterns = await service.loadPatterns(userId);
   * patterns.forEach(p => console.log(p.name));
   */
  loadPatterns(userId: string): Promise<DurationPattern[]>;

  /**
   * Delete a duration pattern
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
    pattern: DurationPattern,
    sequence: SequenceData
  ): { valid: boolean; error?: string };
}
