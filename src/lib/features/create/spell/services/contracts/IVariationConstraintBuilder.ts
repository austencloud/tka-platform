/**
 * Variation Constraint Builder Service Interface
 *
 * Converts user preferences into exploration constraints for efficient
 * variation generation. Enables "constrain → generate-only-matching" flow
 * instead of "generate-all → filter" for 10x-100x performance improvement.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type {
  SpellPreferences,
  VariationConstraints,
} from "../../domain/models/spell-models";

export interface IVariationConstraintBuilder {
  /**
   * Build exploration constraints from user preferences and letter sequence.
   * Converts high-level user preferences into specific constraints that can
   * be used to prune invalid branches during exploration.
   *
   * @param preferences - User preferences for generation
   * @param expandedLetters - The expanded letter sequence (including bridges)
   * @returns Constraints for variation exploration
   */
  buildConstraints(
    preferences: SpellPreferences,
    expandedLetters: Letter[]
  ): VariationConstraints;
}
