/**
 * Transformation families - base patterns and their inverted variants.
 * If all pairs match members of the same family, we can report the base pattern.
 */
export const TRANSFORMATION_FAMILIES: { base: string; members: string[] }[] = [
  {
    base: "mirrored_swapped",
    members: ["mirrored_swapped", "mirrored_swapped_inverted"],
  },
  {
    base: "flipped_swapped",
    members: ["flipped_swapped", "flipped_swapped_inverted"],
  },
  {
    base: "rotated_180_swapped",
    members: ["rotated_180_swapped", "rotated_180_swapped_inverted"],
  },
  {
    base: "rotated_90_cw_swapped",
    members: ["rotated_90_cw_swapped", "rotated_90_cw_swapped_inverted"],
  },
  {
    base: "rotated_90_ccw_swapped",
    members: ["rotated_90_ccw_swapped", "rotated_90_ccw_swapped_inverted"],
  },
  { base: "mirrored", members: ["mirrored", "mirrored_inverted"] },
  { base: "flipped", members: ["flipped", "flipped_inverted"] },
  { base: "rotated_180", members: ["rotated_180", "rotated_180_inverted"] },
  {
    base: "rotated_90_cw",
    members: ["rotated_90_cw", "rotated_90_cw_inverted"],
  },
  {
    base: "rotated_90_ccw",
    members: ["rotated_90_ccw", "rotated_90_ccw_inverted"],
  },
  { base: "swapped", members: ["swapped", "swapped_inverted"] },
];

/**
 * Related transformation groups for axis-alternating detection.
 * These are transformations that are conceptually related (e.g., perpendicular reflections).
 */
export interface RelatedTransformationGroup {
  name: string;
  description: string;
  members: string[]; // Base transformations (without _inverted suffix)
}

export const RELATED_TRANSFORMATION_GROUPS: RelatedTransformationGroup[] = [
  {
    name: "perpendicular_reflections",
    description: "Perpendicular reflection axes",
    members: ["flipped", "mirrored"], // Horizontal and vertical reflections
  },
  {
    name: "opposite_rotations",
    description: "Opposite rotation directions",
    members: ["rotated_90_cw", "rotated_90_ccw"],
  },
  {
    name: "perpendicular_reflections_swapped",
    description: "Perpendicular reflections with swap",
    members: ["flipped_swapped", "mirrored_swapped"],
  },
];
