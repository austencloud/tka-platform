/**
 * LOOP Explanation Text Generator
 *
 * Generates explanation text for LOOP transformations.
 * Provides detailed, user-friendly descriptions for all LOOP component combinations.
 * Each combination has a unique description explaining exactly what happens to the sequence.
 */

import { LOOPComponent } from "../domain/models/generate-models";

/**
 * Detailed descriptions for individual LOOP components.
 * Reserved orientation primitives (ZONE_HOLD_INVERT / FLIP / CROSS) are
 * intentionally absent - they are never user-surfaced.
 */
const singleDescriptions: Partial<Record<LOOPComponent, string>> = {
  [LOOPComponent.ROTATED]:
    "Rotates the entire sequence 180° around the grid center. North becomes South, East becomes West. The sequence plays out in the opposite quadrants while maintaining the same motion patterns.",
  [LOOPComponent.MIRRORED]:
    "Mirrors the sequence across the vertical axis. Left becomes Right and vice versa. Creates a reflection of your original movement pattern, like seeing it in a mirror.",
  [LOOPComponent.FLIPPED]:
    "Flips the sequence across the horizontal axis. Top becomes Bottom and vice versa. Creates a vertical reflection of your original movement pattern.",
  [LOOPComponent.SWAPPED]:
    "Exchanges which hand performs each movement. Your blue hand does what red was doing, and red does what blue was doing. The spatial positions stay the same.",
  [LOOPComponent.INVERTED]:
    "Inverts each motion's rotation relative to its path. Pro becomes anti, and anti becomes pro. Base motion types (static, dash) remain unchanged.",
  [LOOPComponent.REWOUND]:
    "Reverses the sequence direction. The last beat becomes the first, playing backward to create a perfect loop back to the start position.",
};

/**
 * Descriptions for two-component combinations.
 * Key format: sorted alphabetically, joined with underscore.
 */
const twoComponentDescriptions: Record<string, string> = {
  // Mirrored + Inverted
  inverted_mirrored:
    "Mirrors the sequence across the vertical axis and inverts motion types (Pro ↔ Anti). Rotation directions are preserved as the two flips cancel out.",

  // Mirrored + Rotated
  mirrored_rotated:
    "Applies vertical mirroring and 180° rotation, resulting in a sequence that plays in the diagonally opposite quadrants.",

  // Mirrored + Swapped
  mirrored_swapped:
    "Mirrors the sequence across the vertical axis and swaps hand roles (Blue ↔ Red). Each hand performs the other's mirrored movement.",

  // Rotated + Inverted
  inverted_rotated:
    "Applies 180° rotation and inverts motion types (Pro ↔ Anti).",

  // Rotated + Swapped
  rotated_swapped:
    "Applies 180° rotation and swaps hand roles (Blue ↔ Red). Each hand performs the other's rotated movement.",

  // Swapped + Inverted
  inverted_swapped:
    "Swaps hand roles (Blue ↔ Red) and inverts motion types (Pro ↔ Anti). Each hand performs the other's inverted movement.",
};

/**
 * Descriptions for three-component combinations.
 */
const threeComponentDescriptions: Record<string, string> = {
  // Mirrored + Rotated + Inverted
  inverted_mirrored_rotated:
    "Applies vertical mirroring, 180° rotation, and inverts motion types (Pro ↔ Anti).",

  // Mirrored + Rotated + Swapped
  mirrored_rotated_swapped:
    "Applies vertical mirroring, 180° rotation, and swaps hand roles (Blue ↔ Red).",

  // Mirrored + Swapped + Inverted
  inverted_mirrored_swapped:
    "Applies vertical mirroring, swaps hand roles (Blue ↔ Red), and inverts motion types (Pro ↔ Anti).",

  // Rotated + Swapped + Inverted
  inverted_rotated_swapped:
    "Applies 180° rotation, swaps hand roles (Blue ↔ Red), and inverts motion types (Pro ↔ Anti).",
};

/**
 * Description for all four components.
 */
const fourComponentDescription =
  "The ultimate transformation: All four operations combined. Your sequence is rotated 180°, mirrored, hands swapped, AND motion inverted. Despite all these changes, the sequence still mathematically loops back to the start. This is the most complex LOOP type available.";

/**
 * Generate a unique key for a set of components (sorted alphabetically).
 */
function getComponentKey(components: LOOPComponent[]): string {
  return [...components].sort().join("_");
}

/**
 * Generate explanation text based on selected components.
 */
export function generateExplanationText(selectedComponents: Set<LOOPComponent>): string {
  const selected = Array.from(selectedComponents);

  if (selected.length === 0) {
    return "Select multiple components above to build a custom combo. The description will update to explain what your combination does.";
  }

  if (selected.length === 1) {
    return (
      singleDescriptions[selected[0]!] ??
      "This LOOP transformation is not user-facing."
    );
  }

  if (selected.length === 2) {
    const key = getComponentKey(selected);
    const description = twoComponentDescriptions[key];
    if (description) {
      return description;
    }
  }

  if (selected.length === 3) {
    const key = getComponentKey(selected);
    const description = threeComponentDescriptions[key];
    if (description) {
      return description;
    }
  }

  if (selected.length === 4) {
    return fourComponentDescription;
  }

  // Fallback for any unhandled combinations
  const labels = selected
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase())
    .join(" + ");
  return `Combines ${labels}. This transformation applies all selected operations to create a unique variation of your sequence.`;
}
