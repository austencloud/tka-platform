/**
 * Tests for transform example filtering logic
 * Ensures pictographs selected for transform demos will show visible changes
 */

import { describe, it, expect } from "vitest";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  RotationDirection,
  MotionType,
  MotionColor
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

// Recreate the filter logic for testing
const EW_LOCATIONS = new Set([
  GridLocation.EAST,
  GridLocation.WEST,
  GridLocation.NORTHEAST,
  GridLocation.NORTHWEST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
]);

const NS_LOCATIONS = new Set([
  GridLocation.NORTH,
  GridLocation.SOUTH,
  GridLocation.NORTHEAST,
  GridLocation.NORTHWEST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
]);

function hasEastWestComponent(motion: MotionData): boolean {
  return EW_LOCATIONS.has(motion.startLocation) || EW_LOCATIONS.has(motion.endLocation);
}

function hasNorthSouthComponent(motion: MotionData): boolean {
  return NS_LOCATIONS.has(motion.startLocation) || NS_LOCATIONS.has(motion.endLocation);
}

function hasRotation(motion: MotionData): boolean {
  return motion.rotationDirection === RotationDirection.CLOCKWISE ||
         motion.rotationDirection === RotationDirection.COUNTER_CLOCKWISE;
}

function hasMovement(motion: MotionData): boolean {
  return motion.startLocation !== motion.endLocation;
}

type TransformId = "mirror" | "flip" | "invert" | "rotate" | "swap" | "rewind";

function isSuitableForTransform(p: PictographData, transformId: TransformId): boolean {
  const blue = p.motions?.blue;
  const red = p.motions?.red;
  if (!blue || !red) return false;

  switch (transformId) {
    case "mirror":
      return hasEastWestComponent(blue) || hasEastWestComponent(red);
    case "flip":
      return hasNorthSouthComponent(blue) || hasNorthSouthComponent(red);
    case "invert":
      return hasRotation(blue) || hasRotation(red);
    case "rewind":
      return hasMovement(blue) || hasMovement(red);
    case "rotate":
      return true;
    case "swap":
      return blue.startLocation !== red.startLocation ||
             blue.endLocation !== red.endLocation ||
             blue.rotationDirection !== red.rotationDirection;
    default:
      return true;
  }
}

// Helper to create test pictograph data
function createTestPictograph(
  blueStart: GridLocation,
  blueEnd: GridLocation,
  blueRotation: RotationDirection,
  redStart: GridLocation,
  redEnd: GridLocation,
  redRotation: RotationDirection
): PictographData {
  return {
    id: "test-id",
    letter: "A",
    gridMode: "diamond" as any,
    motions: {
      [MotionColor.BLUE]: {
        color: MotionColor.BLUE,
        motionType: MotionType.PRO,
        startLocation: blueStart,
        endLocation: blueEnd,
        rotationDirection: blueRotation,
        turns: 1,
        startOrientation: "in" as any,
        endOrientation: "out" as any,
      } as MotionData,
      [MotionColor.RED]: {
        color: MotionColor.RED,
        motionType: MotionType.PRO,
        startLocation: redStart,
        endLocation: redEnd,
        rotationDirection: redRotation,
        turns: 1,
        startOrientation: "in" as any,
        endOrientation: "out" as any,
      } as MotionData,
    },
  } as PictographData;
}

describe("Transform Example Filter", () => {
  describe("Mirror filter", () => {
    it("should REJECT pictographs with only N/S locations (no E/W)", () => {
      // Φ- type: blue S→N, red N→S (purely vertical)
      const pureVertical = createTestPictograph(
        GridLocation.SOUTH, GridLocation.NORTH, RotationDirection.NO_ROTATION,
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.NO_ROTATION
      );
      expect(isSuitableForTransform(pureVertical, "mirror")).toBe(false);
    });

    it("should ACCEPT pictographs with E/W components", () => {
      // Motion going NE→SW has E/W component
      const hasEW = createTestPictograph(
        GridLocation.NORTHEAST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE,
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(hasEW, "mirror")).toBe(true);
    });

    it("should ACCEPT pictographs with pure E/W locations", () => {
      const pureHorizontal = createTestPictograph(
        GridLocation.EAST, GridLocation.WEST, RotationDirection.CLOCKWISE,
        GridLocation.WEST, GridLocation.EAST, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(pureHorizontal, "mirror")).toBe(true);
    });
  });

  describe("Flip filter", () => {
    it("should REJECT pictographs with only E/W locations (no N/S)", () => {
      // Pure horizontal motion
      const pureHorizontal = createTestPictograph(
        GridLocation.EAST, GridLocation.WEST, RotationDirection.CLOCKWISE,
        GridLocation.WEST, GridLocation.EAST, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(pureHorizontal, "flip")).toBe(false);
    });

    it("should ACCEPT pictographs with N/S components", () => {
      const hasNS = createTestPictograph(
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE,
        GridLocation.EAST, GridLocation.WEST, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(hasNS, "flip")).toBe(true);
    });

    it("should ACCEPT pictographs with diagonal locations (have both N/S and E/W)", () => {
      const diagonal = createTestPictograph(
        GridLocation.NORTHEAST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE,
        GridLocation.NORTHWEST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(diagonal, "flip")).toBe(true);
    });
  });

  describe("Invert filter", () => {
    it("should REJECT pictographs with no rotation (dashes/statics)", () => {
      const noRotation = createTestPictograph(
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.NO_ROTATION,
        GridLocation.SOUTH, GridLocation.NORTH, RotationDirection.NO_ROTATION
      );
      expect(isSuitableForTransform(noRotation, "invert")).toBe(false);
    });

    it("should ACCEPT pictographs with clockwise rotation", () => {
      const hasRotation = createTestPictograph(
        GridLocation.NORTH, GridLocation.EAST, RotationDirection.CLOCKWISE,
        GridLocation.SOUTH, GridLocation.WEST, RotationDirection.NO_ROTATION
      );
      expect(isSuitableForTransform(hasRotation, "invert")).toBe(true);
    });

    it("should ACCEPT pictographs with counter-clockwise rotation", () => {
      const hasCCW = createTestPictograph(
        GridLocation.NORTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE,
        GridLocation.SOUTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE
      );
      expect(isSuitableForTransform(hasCCW, "invert")).toBe(true);
    });
  });

  describe("Rewind filter", () => {
    it("should REJECT pictographs where start equals end (static)", () => {
      const noMovement = createTestPictograph(
        GridLocation.NORTH, GridLocation.NORTH, RotationDirection.CLOCKWISE,
        GridLocation.SOUTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(noMovement, "rewind")).toBe(false);
    });

    it("should ACCEPT pictographs with movement", () => {
      const hasMovement = createTestPictograph(
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE,
        GridLocation.SOUTH, GridLocation.NORTH, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(hasMovement, "rewind")).toBe(true);
    });
  });

  describe("Swap filter", () => {
    it("should REJECT pictographs where blue and red are identical", () => {
      const identical = createTestPictograph(
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE,
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(identical, "swap")).toBe(false);
    });

    it("should ACCEPT pictographs where blue and red differ in start location", () => {
      const differentStart = createTestPictograph(
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE,
        GridLocation.EAST, GridLocation.SOUTH, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(differentStart, "swap")).toBe(true);
    });

    it("should ACCEPT pictographs where blue and red differ in end location", () => {
      const differentEnd = createTestPictograph(
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE,
        GridLocation.NORTH, GridLocation.WEST, RotationDirection.CLOCKWISE
      );
      expect(isSuitableForTransform(differentEnd, "swap")).toBe(true);
    });

    it("should ACCEPT pictographs where blue and red differ in rotation", () => {
      const differentRotation = createTestPictograph(
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.CLOCKWISE,
        GridLocation.NORTH, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE
      );
      expect(isSuitableForTransform(differentRotation, "swap")).toBe(true);
    });
  });

  describe("Rotate filter", () => {
    it("should ACCEPT any valid pictograph (rotate always changes something)", () => {
      const anyPictograph = createTestPictograph(
        GridLocation.NORTH, GridLocation.NORTH, RotationDirection.NO_ROTATION,
        GridLocation.NORTH, GridLocation.NORTH, RotationDirection.NO_ROTATION
      );
      expect(isSuitableForTransform(anyPictograph, "rotate")).toBe(true);
    });
  });
});
