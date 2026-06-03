/**
 * Mathematical Foundations - Content Data
 *
 * Real data for the mathematical foundations page.
 * Uses actual TKA concepts and domain models.
 */

import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  Orientation,
  RotationDirection,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

export interface PositionGroupData {
  name: string;
  greek: string;
  count: number;
  description: string;
  relationship: string;
  color: string;
}

export const POSITION_GROUPS: PositionGroupData[] = [
  {
    name: "Alpha",
    greek: "α",
    count: 8,
    description: "Hands point in opposite directions",
    relationship: "180° apart",
    color: "#6366f1", // Indigo
  },
  {
    name: "Beta",
    greek: "β",
    count: 8,
    description: "Hands point in the same direction",
    relationship: "0° apart",
    color: "#ec4899", // Pink
  },
  {
    name: "Gamma",
    greek: "γ",
    count: 16,
    description: "All other combinations (perpendicular, adjacent)",
    relationship: "Contains two halves (1-8 and 9-16)",
    color: "#14b8a6", // Teal
  },
];

export interface LetterTriadData {
  letter: Letter;
  label: string;
  blueMotion: MotionType;
  redMotion: MotionType;
  pattern: "thesis" | "antithesis" | "synthesis";
  patternLabel: string;
  description: string;
}

export const LETTER_TRIAD: LetterTriadData[] = [
  {
    letter: Letter.A,
    label: "A",
    blueMotion: MotionType.PRO,
    redMotion: MotionType.PRO,
    pattern: "thesis",
    patternLabel: "Pro + Pro",
    description: "Both hands rotate with their movement direction",
  },
  {
    letter: Letter.B,
    label: "B",
    blueMotion: MotionType.ANTI,
    redMotion: MotionType.ANTI,
    pattern: "antithesis",
    patternLabel: "Anti + Anti",
    description: "Both hands rotate against their movement direction",
  },
  {
    letter: Letter.C,
    label: "C",
    blueMotion: MotionType.PRO,
    redMotion: MotionType.ANTI,
    pattern: "synthesis",
    patternLabel: "Pro + Anti",
    description: "One hand rotates with, one against - the hybrid",
  },
];

/**
 * Creates real PictographData for letter A (Pro + Pro)
 */
export function createLetterAPictograph(): PictographData {
  return {
    id: "math-foundations-letter-a",
    letter: Letter.A,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.ALPHA3,
    motions: {
      blue: createMotionData({
        motionType: MotionType.PRO,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.WEST,
        turns: 0,
        color: MotionColor.BLUE,
        propType: PropType.STAFF,
        gridMode: GridMode.DIAMOND,
      }),
      red: createMotionData({
        motionType: MotionType.PRO,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        turns: 0,
        color: MotionColor.RED,
        propType: PropType.STAFF,
        gridMode: GridMode.DIAMOND,
      }),
    },
  };
}

/**
 * Creates real PictographData for letter B (Anti + Anti)
 */
export function createLetterBPictograph(): PictographData {
  return {
    id: "math-foundations-letter-b",
    letter: Letter.B,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.ALPHA3,
    motions: {
      blue: createMotionData({
        motionType: MotionType.ANTI,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.OUT,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.WEST,
        turns: 0,
        color: MotionColor.BLUE,
        propType: PropType.STAFF,
        gridMode: GridMode.DIAMOND,
      }),
      red: createMotionData({
        motionType: MotionType.ANTI,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.OUT,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        turns: 0,
        color: MotionColor.RED,
        propType: PropType.STAFF,
        gridMode: GridMode.DIAMOND,
      }),
    },
  };
}

/**
 * Creates real PictographData for letter C (Pro + Anti hybrid)
 */
export function createLetterCPictograph(): PictographData {
  return {
    id: "math-foundations-letter-c",
    letter: Letter.C,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.ALPHA3,
    motions: {
      blue: createMotionData({
        motionType: MotionType.PRO,
        startOrientation: Orientation.OUT,
        endOrientation: Orientation.OUT,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.WEST,
        turns: 0,
        color: MotionColor.BLUE,
        propType: PropType.STAFF,
        gridMode: GridMode.DIAMOND,
      }),
      red: createMotionData({
        motionType: MotionType.ANTI,
        startOrientation: Orientation.OUT,
        endOrientation: Orientation.IN,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        turns: 0,
        color: MotionColor.RED,
        propType: PropType.STAFF,
        gridMode: GridMode.DIAMOND,
      }),
    },
  };
}

export interface MotionTypeTriadData {
  type: MotionType | "SHIFT";
  label: string;
  pattern: "thesis" | "antithesis" | "synthesis";
  patternLabel: string;
  description: string;
  intensity: string;
  variations?: number;
}

export const MOTION_TYPE_TRIAD: MotionTypeTriadData[] = [
  {
    type: MotionType.STATIC,
    label: "Static",
    pattern: "antithesis",
    patternLabel: "No Movement",
    description: "The prop stays in place (0 steps) - no grid movement at all",
    intensity: "Minimal",
  },
  {
    type: MotionType.DASH,
    label: "Dash",
    pattern: "thesis",
    patternLabel: "Opposite Position",
    description: "The prop moves to the opposite position via straight line through center (2 steps)",
    intensity: "Maximum",
  },
  {
    type: "SHIFT",
    label: "Shift",
    pattern: "synthesis",
    patternLabel: "Adjacent Position",
    description: "The prop moves to an adjacent position (1 step) - TWO variations: clockwise or counter-clockwise",
    intensity: "Medium",
    variations: 2,
  },
];

export interface OrientationPairingData {
  family: string;
  members: string[];
  behavior: string;
  description: string;
  color: string;
}

export const ORIENTATION_PAIRINGS: OrientationPairingData[] = [
  {
    family: "Preserving",
    members: ["Pro", "Static"],
    behavior: "Retain orientation at 0 turns",
    description: "Both PRO and STATIC keep the prop pointing the same direction when no turns are applied",
    color: "#6366f1",
  },
  {
    family: "Swapping",
    members: ["Anti", "Dash"],
    behavior: "Swap orientation at 0 turns",
    description: "Both ANTI and DASH flip the prop's direction (IN↔OUT or CLOCK↔COUNTER) even with no turns",
    color: "#ec4899",
  },
];

export interface OrientationData {
  value: Orientation;
  label: string;
  category: "radial" | "non-radial";
  description: string;
  opposite: Orientation;
}

export const ORIENTATIONS: OrientationData[] = [
  {
    value: Orientation.IN,
    label: "In",
    category: "radial",
    description: "Prop points toward the center",
    opposite: Orientation.OUT,
  },
  {
    value: Orientation.OUT,
    label: "Out",
    category: "radial",
    description: "Prop points away from the center",
    opposite: Orientation.IN,
  },
  {
    value: Orientation.CLOCK,
    label: "Clock",
    category: "non-radial",
    description: "Prop points in clockwise direction",
    opposite: Orientation.COUNTER,
  },
  {
    value: Orientation.COUNTER,
    label: "Counter",
    category: "non-radial",
    description: "Prop points in counter-clockwise direction",
    opposite: Orientation.CLOCK,
  },
];

export const CORE_PATTERN = {
  title: "The Core Pattern",
  subtitle: "Binary Synthesis",
  description: `Throughout The Kinetic Alphabet, a single mathematical pattern repeats at multiple levels:
    Two elements exist as opposites of each other, and a third element fuses them-containing aspects of both.
    The fusion is often twice as large or has two internal halves.`,
  diagram: {
    thesis: "Thesis",
    antithesis: "Antithesis",
    synthesis: "Synthesis (contains both)",
  },
};
