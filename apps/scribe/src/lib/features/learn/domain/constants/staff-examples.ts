/**
 * Staff Examples - Predefined staff position examples for learning experiences
 *
 * Used by StaffConceptExperience to demonstrate thumb orientations and spin types.
 */

export type HandPosition = "N" | "E" | "S" | "W";
export type ThumbOrientation = "in" | "out";

export interface StaffExample {
  leftPos: HandPosition;
  rightPos: HandPosition;
  leftThumb: ThumbOrientation;
  rightThumb: ThumbOrientation;
}

export interface ThumbExample extends StaffExample {
  label: string;
}

export interface SpinExample extends StaffExample {
  description: string;
}

/**
 * Thumb orientation examples - Shows different combinations of in/out
 */
export const THUMB_EXAMPLES: ThumbExample[] = [
  {
    leftPos: "N",
    rightPos: "S",
    leftThumb: "in",
    rightThumb: "in",
    label: "Both Thumbs In",
  },
  {
    leftPos: "N",
    rightPos: "S",
    leftThumb: "out",
    rightThumb: "out",
    label: "Both Thumbs Out",
  },
  {
    leftPos: "E",
    rightPos: "W",
    leftThumb: "in",
    rightThumb: "out",
    label: "Left In / Right Out",
  },
  {
    leftPos: "E",
    rightPos: "W",
    leftThumb: "out",
    rightThumb: "in",
    label: "Left Out / Right In",
  },
];

/**
 * Prospin examples - Staff rotates same direction as handpath
 */
export const PROSPIN_EXAMPLES: SpinExample[] = [
  {
    leftPos: "N",
    rightPos: "S",
    leftThumb: "in",
    rightThumb: "in",
    description: "Thumbs stay IN during the entire motion",
  },
  {
    leftPos: "E",
    rightPos: "W",
    leftThumb: "in",
    rightThumb: "in",
    description: "Staff rotates WITH the hand direction",
  },
];

/**
 * Antispin examples - Staff rotates opposite direction of handpath
 */
export const ANTISPIN_EXAMPLES: SpinExample[] = [
  {
    leftPos: "N",
    rightPos: "S",
    leftThumb: "in",
    rightThumb: "in",
    description: "Start: Thumbs IN",
  },
  {
    leftPos: "E",
    rightPos: "W",
    leftThumb: "out",
    rightThumb: "out",
    description: "End: Thumbs OUT (swapped during motion)",
  },
];
