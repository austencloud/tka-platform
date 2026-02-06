/**
 * SwappedInvertedLOOPExecutor Tests
 *
 * Tests the swapped-inverted LOOP pattern generation.
 * HIGH VALUE: This algorithm transforms sequences and errors would silently
 * produce incorrect choreography that users wouldn't immediately notice.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { BeatData } from "../../../src/lib/features/create/shared/domain/models/BeatData";
import { Letter } from "../../../src/lib/shared/foundation/domain/models/Letter";
import {
  GridLocation,
  GridPosition,
} from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "../../../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { SwappedInvertedLOOPExecutor } from "../../../src/lib/features/create/generate/circular/services/implementations/SwappedInvertedLOOPExecutor";
import type { IOrientationCalculator } from "../../../src/lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import { SliceSize } from "../../../src/lib/features/create/generate/circular/domain/models/circular-models";

// Mock OrientationCalculator that passes through unchanged
const mockOrientationCalculator: IOrientationCalculator = {
  updateStartOrientations: (beat: BeatData, _previousBeat: BeatData) => beat,
  updateEndOrientations: (beat: BeatData) => beat,
  calculateEndOrientation: () => Orientation.IN,
  calculateStartOrientation: () => Orientation.IN,
};

describe("SwappedInvertedLOOPExecutor", () => {
  let executor: SwappedInvertedLOOPExecutor;

  beforeEach(() => {
    executor = new SwappedInvertedLOOPExecutor(mockOrientationCalculator);
  });

  describe("executeLOOP", () => {
    it("should correctly generate swapped-inverted completion with proper grid positions", () => {
      // Input sequence: β (beta5) → D (alpha3) → J (beta5)
      // This is an "already complete" sequence (ends at start position)
      const inputSequence: BeatData[] = [
        // Start position (beat 0): β at beta5
        {
          id: "beat-0",
          beatNumber: 0,
          duration: 1.0,
          letter: Letter.β,
          startPosition: GridPosition.BETA5,
          endPosition: GridPosition.BETA5,
          motions: {
            [MotionColor.BLUE]: {
              motionType: MotionType.STATIC,
              rotationDirection: RotationDirection.NO_ROTATION,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.BLUE,
            },
            [MotionColor.RED]: {
              motionType: MotionType.STATIC,
              rotationDirection: RotationDirection.NO_ROTATION,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.RED,
            },
          },
          blueReversal: false,
          redReversal: false,
          isBlank: false,
        },
        // Beat 1: D - beta5 → alpha3
        {
          id: "beat-1",
          beatNumber: 1,
          duration: 1.0,
          letter: Letter.D,
          startPosition: GridPosition.BETA5,
          endPosition: GridPosition.ALPHA3,
          motions: {
            [MotionColor.BLUE]: {
              motionType: MotionType.PRO,
              rotationDirection: RotationDirection.CLOCKWISE,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.WEST,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.BLUE,
            },
            [MotionColor.RED]: {
              motionType: MotionType.PRO,
              rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.EAST,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.RED,
            },
          },
          blueReversal: false,
          redReversal: false,
          isBlank: false,
        },
        // Beat 2: J - alpha3 → beta5
        {
          id: "beat-2",
          beatNumber: 2,
          duration: 1.0,
          letter: Letter.J,
          startPosition: GridPosition.ALPHA3,
          endPosition: GridPosition.BETA5,
          motions: {
            [MotionColor.BLUE]: {
              motionType: MotionType.PRO,
              rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
              startLocation: GridLocation.WEST,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.BLUE,
            },
            [MotionColor.RED]: {
              motionType: MotionType.PRO,
              rotationDirection: RotationDirection.CLOCKWISE,
              startLocation: GridLocation.EAST,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.RED,
            },
          },
          blueReversal: false,
          redReversal: false,
          isBlank: false,
        },
      ];

      // Execute the LOOP
      const result = executor.executeLOOP([...inputSequence], SliceSize.HALVED);

      // Should have 5 beats total: start + 2 original + 2 generated
      expect(result.length).toBe(5);

      // Beat 3 checks
      const beat3 = result[3];
      expect(beat3).toBeDefined();

      // Grid position should be SWAPPED: alpha3 → alpha7
      // (alpha3 = blue:west, red:east → alpha7 = blue:east, red:west)
      expect(beat3!.endPosition).toBe(GridPosition.ALPHA7);

      // Motion locations should be swapped pattern with inversion:
      // Blue does what Red did (s→e), Red does what Blue did (s→w)
      expect(beat3!.motions[MotionColor.BLUE]?.startLocation).toBe(
        GridLocation.SOUTH
      );
      expect(beat3!.motions[MotionColor.BLUE]?.endLocation).toBe(
        GridLocation.EAST
      );
      expect(beat3!.motions[MotionColor.RED]?.startLocation).toBe(
        GridLocation.SOUTH
      );
      expect(beat3!.motions[MotionColor.RED]?.endLocation).toBe(
        GridLocation.WEST
      );

      // Motion types should be inverted: PRO → ANTI
      expect(beat3!.motions[MotionColor.BLUE]?.motionType).toBe(
        MotionType.ANTI
      );
      expect(beat3!.motions[MotionColor.RED]?.motionType).toBe(MotionType.ANTI);

      // Beat 4 checks
      const beat4 = result[4];
      expect(beat4).toBeDefined();

      // Should return to start position beta5
      expect(beat4!.endPosition).toBe(GridPosition.BETA5);

      // Blue should continue from where Blue ended (east → south)
      // Red should continue from where Red ended (west → south)
      expect(beat4!.motions[MotionColor.BLUE]?.startLocation).toBe(
        GridLocation.EAST
      );
      expect(beat4!.motions[MotionColor.BLUE]?.endLocation).toBe(
        GridLocation.SOUTH
      );
      expect(beat4!.motions[MotionColor.RED]?.startLocation).toBe(
        GridLocation.WEST
      );
      expect(beat4!.motions[MotionColor.RED]?.endLocation).toBe(
        GridLocation.SOUTH
      );

      // Motion types should be inverted: PRO → ANTI
      expect(beat4!.motions[MotionColor.BLUE]?.motionType).toBe(
        MotionType.ANTI
      );
      expect(beat4!.motions[MotionColor.RED]?.motionType).toBe(MotionType.ANTI);
    });

    it("should reject sequences that don't return to start position", () => {
      // Sequence that ends at different position than start
      const invalidSequence: BeatData[] = [
        {
          id: "beat-0",
          beatNumber: 0,
          duration: 1.0,
          letter: Letter.β,
          startPosition: GridPosition.BETA5,
          endPosition: GridPosition.BETA5,
          motions: {
            [MotionColor.BLUE]: {
              motionType: MotionType.STATIC,
              rotationDirection: RotationDirection.NO_ROTATION,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.BLUE,
            },
            [MotionColor.RED]: {
              motionType: MotionType.STATIC,
              rotationDirection: RotationDirection.NO_ROTATION,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.SOUTH,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.RED,
            },
          },
          blueReversal: false,
          redReversal: false,
          isBlank: false,
        },
        {
          id: "beat-1",
          beatNumber: 1,
          duration: 1.0,
          letter: Letter.D,
          startPosition: GridPosition.BETA5,
          endPosition: GridPosition.ALPHA3, // Ends at alpha3, not beta5
          motions: {
            [MotionColor.BLUE]: {
              motionType: MotionType.PRO,
              rotationDirection: RotationDirection.CLOCKWISE,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.WEST,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.BLUE,
            },
            [MotionColor.RED]: {
              motionType: MotionType.PRO,
              rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.EAST,
              turns: 0,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              color: MotionColor.RED,
            },
          },
          blueReversal: false,
          redReversal: false,
          isBlank: false,
        },
      ];

      expect(() => {
        executor.executeLOOP([...invalidSequence], SliceSize.HALVED);
      }).toThrow(/Invalid position pair for swapped-inverted LOOP/);
    });
  });
});
