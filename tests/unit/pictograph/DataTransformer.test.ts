/**
 * DataTransformer Tests
 *
 * Comprehensive test suite for the DataTransformer service.
 * Tests beat-to-pictograph conversion and grid data adaptation.
 *
 * HIGH VALUE: This service transforms data between different formats,
 * and errors here could cause data corruption or rendering failures.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { BeatData } from "../../../src/lib/features/create/shared/domain/models/BeatData";
import { Letter } from "../../../src/lib/shared/foundation/domain/models/Letter";
import {
  GridLocation,
  GridMode,
} from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "../../../src/lib/shared/pictograph/prop/domain/enums/PropType";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "../../../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "../../../src/lib/shared/pictograph/shared/domain/models/MotionData";
import { DataTransformer } from "../../../src/lib/shared/pictograph/shared/services/implementations/DataTransformer";

describe("DataTransformer", () => {
  let service: DataTransformer;

  beforeEach(() => {
    service = new DataTransformer();
  });

  // ============================================================================
  // BEAT TO PICTOGRAPH CONVERSION TESTS
  // ============================================================================

  describe("beatToPictographData", () => {
    it("should convert beat with blue motion to pictograph", () => {
      const beat: BeatData = {
        id: "beat-1",
        beatNumber: 1,
        duration: 1.0,
        letter: Letter.A,
        motions: {
          blue: createMotionData({
            motionType: MotionType.STATIC,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.SOUTH,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.OUT,
            rotationDirection: RotationDirection.NO_ROTATION,
            turns: 0,
            isVisible: true,
            color: MotionColor.BLUE,
            propType: PropType.STAFF,
          }),
        },
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      };

      const result = service.beatToPictographData(beat);

      expect(result.id).toBe("beat-1");
      expect(result.letter).toBe(Letter.A);
      expect(result.motions.blue).toBeDefined();
      expect(result.motions.blue?.motionType).toBe(MotionType.STATIC);
      expect(result.motions.red).toBeUndefined();
    });

    it("should convert beat with both blue and red motions", () => {
      const beat: BeatData = {
        id: "beat-2",
        beatNumber: 2,
        duration: 1.0,
        letter: Letter.B,
        motions: {
          blue: createMotionData({
            motionType: MotionType.STATIC,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.SOUTH,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.OUT,
            rotationDirection: RotationDirection.NO_ROTATION,
            turns: 0,
            isVisible: true,
            color: MotionColor.BLUE,
            propType: PropType.STAFF,
          }),
          red: createMotionData({
            motionType: MotionType.STATIC,
            startLocation: GridLocation.EAST,
            endLocation: GridLocation.WEST,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.OUT,
            rotationDirection: RotationDirection.NO_ROTATION,
            turns: 0,
            isVisible: true,
            color: MotionColor.RED,
            propType: PropType.STAFF,
          }),
        },
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      };

      const result = service.beatToPictographData(beat);

      expect(result.motions.blue).toBeDefined();
      expect(result.motions.red).toBeDefined();
      expect(result.motions.blue?.color).toBe(MotionColor.BLUE);
      expect(result.motions.red?.color).toBe(MotionColor.RED);
    });

    it("should handle beat with no motions", () => {
      const beat: BeatData = {
        id: "beat-3",
        beatNumber: 3,
        duration: 1.0,
        letter: Letter.C,
        motions: {},
        blueReversal: false,
        redReversal: false,
        isBlank: true,
      };

      const result = service.beatToPictographData(beat);

      expect(result.id).toBe("beat-3");
      expect(result.letter).toBe(Letter.C);
      expect(result.motions.blue).toBeUndefined();
      expect(result.motions.red).toBeUndefined();
    });

    it("should handle beat with null letter", () => {
      const beat: BeatData = {
        id: "beat-4",
        beatNumber: 4,
        duration: 1.0,
        letter: null,
        motions: {
          blue: createMotionData({
            motionType: MotionType.STATIC,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.SOUTH,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.OUT,
            rotationDirection: RotationDirection.NO_ROTATION,
            turns: 0,
            isVisible: true,
            color: MotionColor.BLUE,
            propType: PropType.STAFF,
          }),
        },
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      };

      const result = service.beatToPictographData(beat);

      expect(result.letter).toBeNull();
      expect(result.motions.blue).toBeDefined();
    });

    it("should preserve motion data properties during conversion", () => {
      const blueMotion = createMotionData({
        motionType: MotionType.PRO,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.SOUTH,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.OUT,
        rotationDirection: RotationDirection.CLOCKWISE,
        turns: 1.5,
        isVisible: true,
        color: MotionColor.BLUE,
        propType: PropType.STAFF,
      });

      const beat: BeatData = {
        id: "beat-5",
        beatNumber: 5,
        duration: 1.0,
        letter: Letter.D,
        motions: {
          blue: blueMotion,
        },
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      };

      const result = service.beatToPictographData(beat);

      expect(result.motions.blue?.motionType).toBe(MotionType.PRO);
      expect(result.motions.blue?.startLocation).toBe(GridLocation.NORTH);
      expect(result.motions.blue?.endLocation).toBe(GridLocation.SOUTH);
      expect(result.motions.blue?.rotationDirection).toBe(
        RotationDirection.CLOCKWISE
      );
      expect(result.motions.blue?.turns).toBe(1.5);
    });

    it("should generate correct pictograph ID from beat number", () => {
      const beat: BeatData = {
        id: "original-beat-id",
        beatNumber: 42,
        duration: 1.0,
        letter: Letter.E,
        motions: {},
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      };

      const result = service.beatToPictographData(beat);

      expect(result.id).toBe("beat-42");
    });
  });

  // ============================================================================
  // GRID DATA ADAPTATION TESTS
  // ============================================================================

  describe("adaptGridData", () => {
    it("should adapt grid data for diamond mode", () => {
      const rawGridData = {
        allLayer2PointsNormal: {
          NORTH: { coordinates: { x: 475, y: 100 } },
          SOUTH: { coordinates: { x: 475, y: 850 } },
          EAST: { coordinates: { x: 850, y: 475 } },
          WEST: { coordinates: { x: 100, y: 475 } },
        },
        allHandPointsNormal: {
          NORTH: { coordinates: { x: 475, y: 200 } },
          SOUTH: { coordinates: { x: 475, y: 750 } },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = service.adaptGridData(rawGridData, GridMode.DIAMOND);

      expect(result.gridMode).toBe(GridMode.DIAMOND);
      expect(result.gridPointData.allLayer2PointsNormal.NORTH).toBeDefined();
      expect(
        result.gridPointData.allLayer2PointsNormal.NORTH!.coordinates
      ).toEqual({
        x: 475,
        y: 100,
      });
    });

    it("should adapt grid data for box mode", () => {
      const rawGridData = {
        allLayer2PointsNormal: {
          NORTH: { coordinates: { x: 475, y: 100 } },
        },
        allHandPointsNormal: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = service.adaptGridData(rawGridData, GridMode.BOX);

      expect(result.gridMode).toBe(GridMode.BOX);
    });

    it("should filter out null coordinates", () => {
      const rawGridData = {
        allLayer2PointsNormal: {
          NORTH: { coordinates: { x: 475, y: 100 } },
          SOUTH: { coordinates: null },
        },
        allHandPointsNormal: {
          EAST: { coordinates: null },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = service.adaptGridData(rawGridData, GridMode.DIAMOND);

      expect(result.gridPointData.allLayer2PointsNormal.NORTH).toBeDefined();
      expect(result.gridPointData.allLayer2PointsNormal.SOUTH).toBeUndefined();
      expect(result.gridPointData.allHandPointsNormal.EAST).toBeUndefined();
    });

    it("should handle empty grid data", () => {
      const rawGridData = {
        allLayer2PointsNormal: {},
        allHandPointsNormal: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = service.adaptGridData(rawGridData, GridMode.DIAMOND);

      expect(result.gridPointData.allLayer2PointsNormal).toEqual({});
      expect(result.gridPointData.allHandPointsNormal).toEqual({});
    });

    it("should set default center point", () => {
      const rawGridData = {
        allLayer2PointsNormal: {},
        allHandPointsNormal: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = service.adaptGridData(rawGridData, GridMode.DIAMOND);

      expect(result.gridPointData.centerPoint.coordinates).toEqual({
        x: 475,
        y: 475,
      });
    });

    it("should initialize empty strict and outer point collections", () => {
      const rawGridData = {
        allLayer2PointsNormal: {},
        allHandPointsNormal: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = service.adaptGridData(rawGridData, GridMode.DIAMOND);

      expect(result.gridPointData.allHandPointsStrict).toEqual({});
      expect(result.gridPointData.allLayer2PointsStrict).toEqual({});
      expect(result.gridPointData.allOuterPoints).toEqual({});
    });
  });
});
