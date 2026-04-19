/**
 * LOOPExplanationTextGenerator - Generates explanation text for LOOP transformations
 *
 * Provides detailed, user-friendly descriptions for all LOOP component combinations.
 * Each combination has a unique description explaining exactly what happens to the sequence.
 */

import { LOOPComponent } from "../../domain/models/generate-models";
import type { ILOOPExplanationTextGenerator } from "../contracts/ILOOPExplanationTextGenerator";

/**
 * Service for generating user-friendly explanation text for LOOP transformations
 */
export class LOOPExplanationTextGenerator implements ILOOPExplanationTextGenerator {
  /**
   * Detailed descriptions for individual LOOP components.
   * Reserved orientation primitives (ZONE_HOLD_INVERT / FLIP / CROSS) are
   * intentionally absent — they are never user-surfaced.
   */
  private readonly singleDescriptions: Partial<Record<LOOPComponent, string>> = {
    [LOOPComponent.ROTATED]:
      "Rotates the entire sequence 180° around the grid center. North becomes South, East becomes West. The sequence plays out in the opposite quadrants while maintaining the same motion patterns.",
    [LOOPComponent.MIRRORED]:
      "Mirrors the sequence across the vertical axis. Left becomes Right and vice versa. Creates a reflection of your original movement pattern, like seeing it in a mirror.",
    [LOOPComponent.FLIPPED]:
      "Flips the sequence across the horizontal axis. Top becomes Bottom and vice versa. Creates a vertical reflection of your original movement pattern.",
    [LOOPComponent.SWAPPED]:
      "Exchanges which hand performs each movement. Your blue hand does what red was doing, and red does what blue was doing. The spatial positions stay the same.",
    [LOOPComponent.INVERTED]:
      "Transforms each motion to its complement. Pro motions become anti, static becomes dash. Creates the 'opposite energy' version of your sequence.",
    [LOOPComponent.REWOUND]:
      "Reverses the sequence direction. The last beat becomes the first, playing backward to create a perfect loop back to the start position.",
  };

  /**
   * Descriptions for two-component combinations
   * Key format: sorted alphabetically, joined with underscore
   */
  private readonly twoComponentDescriptions: Record<string, string> = {
    // Mirrored + Inverted
    inverted_mirrored:
      "Mirrors your sequence left-to-right AND inverts the motion types. The reflection plays with opposite energy - pro becomes anti, creating a 'shadow version' of your flow.",

    // Mirrored + Rotated
    mirrored_rotated:
      "Applies both mirror and 180° rotation. The sequence appears in the diagonally opposite corner as a reflection. Great for creating symmetrical diamond patterns.",

    // Mirrored + Swapped
    mirrored_swapped:
      "Mirrors the sequence AND swaps which hand does what. Blue performs red's mirrored movements and vice versa. Creates an 'alternate universe' version of your flow.",

    // Rotated + Inverted
    inverted_rotated:
      "Rotates 180° AND inverts motion types. The sequence plays in the opposite position with opposite energy. Creates a complete spatial and energetic reversal.",

    // Rotated + Swapped
    rotated_swapped:
      "Rotates 180° AND swaps hands. Blue does red's rotated movements. Particularly useful for creating balanced circular sequences that return to start.",

    // Swapped + Inverted
    inverted_swapped:
      "Swaps hands AND inverts motion types. Each hand performs the other's movements with opposite energy. Creates interesting call-and-response patterns.",
  };

  /**
   * Descriptions for three-component combinations
   */
  private readonly threeComponentDescriptions: Record<string, string> = {
    // Mirrored + Rotated + Inverted
    inverted_mirrored_rotated:
      "The triple transformation: Mirror + Rotate + Invert. Your sequence appears in the opposite corner, reflected, with inverted energy. Maximum transformation while maintaining the core movement structure.",

    // Mirrored + Rotated + Swapped
    mirrored_rotated_swapped:
      "Mirror + Rotate + Swap hands. The sequence plays diagonally opposite, reflected, with hands exchanged. Creates complex but balanced circular patterns.",

    // Mirrored + Swapped + Inverted
    inverted_mirrored_swapped:
      "Mirror + Swap + Invert. Your reflection plays with swapped hands and opposite energy. Like watching your mirror image's shadow perform the sequence.",

    // Rotated + Swapped + Inverted
    inverted_rotated_swapped:
      "Rotate + Swap + Invert. The sequence rotates 180°, hands swap, and energy inverts. A complete transformation that still loops back naturally.",
  };

  /**
   * Description for all four components
   */
  private readonly fourComponentDescription =
    "The ultimate transformation: All four operations combined. Your sequence is rotated 180°, mirrored, hands swapped, AND motion inverted. Despite all these changes, the sequence still mathematically loops back to the start. This is the most complex LOOP type available.";

  /**
   * Generate a unique key for a set of components (sorted alphabetically)
   */
  private getComponentKey(components: LOOPComponent[]): string {
    return [...components].sort().join("_");
  }

  /**
   * Generate explanation text based on selected components
   */
  public generateExplanationText(selectedComponents: Set<LOOPComponent>): string {
    const selected = Array.from(selectedComponents);

    if (selected.length === 0) {
      return "Select multiple components above to build a custom combo. The description will update to explain what your combination does.";
    }

    if (selected.length === 1) {
      return (
        this.singleDescriptions[selected[0]!] ??
        "This LOOP transformation is not user-facing."
      );
    }

    if (selected.length === 2) {
      const key = this.getComponentKey(selected);
      const description = this.twoComponentDescriptions[key];
      if (description) {
        return description;
      }
    }

    if (selected.length === 3) {
      const key = this.getComponentKey(selected);
      const description = this.threeComponentDescriptions[key];
      if (description) {
        return description;
      }
    }

    if (selected.length === 4) {
      return this.fourComponentDescription;
    }

    // Fallback for any unhandled combinations
    const labels = selected
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase())
      .join(" + ");
    return `Combines ${labels}. This transformation applies all selected operations to create a unique variation of your sequence.`;
  }
}
