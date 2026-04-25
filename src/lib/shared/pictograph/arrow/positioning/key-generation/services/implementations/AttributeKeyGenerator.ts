/**
 * Modern Attribute Key Generator
 *
 * Generates attribute keys for arrow positioning using modern data structures.
 * Replaces the legacy AttrKeyGenerator to work with ArrowPlacementData and PictographData.
 *
 * Direct TypeScript mirror of reference/modern/application/services/positioning/arrows/key_generators/attribute_key_generator.py
 */

import type { ArrowPlacementData } from "../../../placement/domain/ArrowPlacementData";
import type { IAttributeKeyGenerator } from "../contracts/IAttributeKeyGenerator";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";


export class AttributeKeyGenerator implements IAttributeKeyGenerator {
  /**
   * Modern implementation of attribute key generation for arrow positioning.
   *
   * Generates keys used for special placement and default placement lookups.
   * Works with modern ArrowPlacementData and PictographData objects.
   */

  getKeyFromArrow(
    _arrowData: ArrowPlacementData,
    pictographData: PictographData,
    color: string
  ): string {
    /**
     * Get attribute key from modern arrow data.
     *
     * Args:
     *     arrowData: Arrow data containing color and other attributes
     *     pictographData: Pictograph data for context
     *
     * Returns:
     *     Attribute key string for positioning lookups
     */
    try {
      // Extract motion data for this arrow color
      const motionData =
        pictographData.motions[color as keyof typeof pictographData.motions];

      if (!motionData) {
        // Fallback to color if no motion data
        console.debug(`No motion data for ${color}, using color as key`);
        return color;
      }

      // Extract required attributes
      const motionType = motionData.motionType || "";
      const letter = pictographData.letter || "";
      const startOrientation = motionData.startOrientation || "";
      // Color is now passed as parameter

      // For modern data, we don't have lead_state, so use undefined
      const leadState: string | undefined = undefined;

      // Determine motion characteristics
      const hasHybridMotions = this.hasHybridMotions(pictographData);
      const startsFromMixedOrientation =
        this.startsFromMixedOrientation(pictographData);
      const startsFromStandardOrientation = !startsFromMixedOrientation;

      return this.generateKey(
        motionType,
        letter,
        startOrientation,
        color,
        leadState,
        hasHybridMotions,
        startsFromMixedOrientation,
        startsFromStandardOrientation
      );
    } catch (error) {
      console.error(`Error generating attribute key for ${color}:`, error);
      // Fallback to color
      return color;
    }
  }

  generateKey(
    motionType: string,
    letter: string,
    startOrientation: string,
    color: string,
    leadState?: string,
    hasHybridMotions?: boolean,
    startsFromMixedOrientation?: boolean,
    _startsFromStandardOrientation?: boolean
  ): string {
    /**
     * Core key generation logic matching legacy implementation.
     *
     * Args:
     *     motionType: Motion type string
     *     letter: Letter string
     *     startOrientation: Start orientation string
     *     color: Arrow color
     *     leadState: Lead state (may be undefined for modern data)
     *     hasHybridMotions: Whether there are hybrid motions
     *     startsFromMixedOrientation: Whether starts from mixed orientation
     *     startsFromStandardOrientation: Whether starts from standard orientation
     *
     * Returns:
     *     Generated attribute key string
     */
    try {
      // Define orientation constants matching legacy
      const IN = "in";
      const OUT = "out";
      const CLOCK = "clock";
      const COUNTER = "counter";

      if (startsFromMixedOrientation) {
        if (["S", "T"].includes(letter)) {
          return leadState || color;
        } else if (hasHybridMotions) {
          if ([IN, OUT].includes(startOrientation)) {
            return `${motionType}_from_layer1`;
          } else if ([CLOCK, COUNTER].includes(startOrientation)) {
            return `${motionType}_from_layer2`;
          } else {
            return color;
          }
        } else if (this.isNonHybridLetter(letter)) {
          return color;
        } else {
          return motionType;
        }
      } else {
        // Standard orientation - return color for most cases
        return color;
      }
    } catch (error) {
      console.error("Error in key generation:", error);
      // Fallback to color
      return color;
    }
  }

  private hasHybridMotions(pictographData: PictographData): boolean {
    /**
     * Check if pictograph has hybrid motions.
     *
     * Args:
     *     pictographData: Pictograph data to check
     *
     * Returns:
     *     True if has hybrid motions
     */
    try {
      // Check if we have both blue and red motions with different types
      const blueMotion = pictographData.motions.blue;
      const redMotion = pictographData.motions.red;

      if (!blueMotion || !redMotion) {
        return false;
      }

      // Different motion types indicate hybrid
      const blueType = blueMotion.motionType || "";
      const redType = redMotion.motionType || "";

      return blueType !== redType;
    } catch {
      return false;
    }
  }

  private startsFromMixedOrientation(pictographData: PictographData): boolean {
    /**
     * Check if pictograph starts from mixed orientation.
     *
     * Args:
     *     pictographData: Pictograph data to check
     *
     * Returns:
     *     True if starts from mixed orientation
     */
    try {
      const IN = "in";
      const OUT = "out";

      const blueMotion = pictographData.motions.blue;
      const redMotion = pictographData.motions.red;

      if (!blueMotion || !redMotion) {
        return false;
      }

      const blueStart = blueMotion.startOrientation || "";
      const redStart = redMotion.startOrientation || "";

      // Mixed if one is layer1 (IN/OUT) and other is layer2 (CLOCK/COUNTER)
      const blueLayer1 = [IN, OUT].includes(blueStart);
      const redLayer1 = [IN, OUT].includes(redStart);

      return blueLayer1 !== redLayer1;
    } catch {
      return false;
    }
  }

  private isNonHybridLetter(letter: string): boolean {
    /**
     * Check if letter is non-hybrid.
     *
     * Args:
     *     letter: Letter to check
     *
     * Returns:
     *     True if letter is non-hybrid
     */
    // Basic non-hybrid letters (this may need expansion based on actual letter conditions)
    const nonHybridLetters = [
      "A",
      "B",
      "D",
      "E",
      "G",
      "H",
      "J",
      "K",
      "M",
      "N",
      "P",
      "Q",
      "S",
      "T",
    ];
    return nonHybridLetters.includes(letter);
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of attributeKeyGenerator to avoid DI container rebuilds.
// ============================================================================

export const attributeKeyGenerator = new AttributeKeyGenerator();
