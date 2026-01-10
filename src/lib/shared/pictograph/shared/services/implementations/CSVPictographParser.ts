/**
 * CSV Pictograph Parser Service - Converts CSV rows to PictographData objects
 *
 * Parses the BoxPictographDataframe.csv data and converts it to typed PictographData.
 * Uses the correct position mapping based on hand location combinations.
 */

import type { GridMode } from "../../../grid/domain/enums/grid-enums";
import { GridPosition } from "../../../grid/domain/enums/grid-enums";
import type { Letter } from "../../../../foundation/domain/models/Letter";
import { MotionColor } from "../../domain/enums/pictograph-enums";
import { createMotionData } from "../../domain/models/MotionData";
import type { PictographData } from "../../domain/models/PictographData";
import { createPictographData } from "../../domain/factories/createPictographData";
import type { IEnumMapper } from "../../../../foundation/services/contracts/data/IEnumMapper";
import type { IOrientationCalculator } from "../../../prop/services/contracts/IOrientationCalculator";
import type {
  CSVRow,
  ICSVPictographParser,
} from "../../../../foundation/services/contracts/data/ICSVPictographParser";
import { Orientation } from "../../domain/enums/pictograph-enums";
import { TYPES } from "../../../../inversify/types";
import { inject, injectable } from "inversify";

@injectable()
export class CSVPictographParser implements ICSVPictographParser {
  constructor(
    @inject(TYPES.IEnumMapper)
    private readonly enumMapper: IEnumMapper,
    @inject(TYPES.IOrientationCalculator)
    private readonly orientationService: IOrientationCalculator
  ) {}

  /**
   * Convert a CSV row to PictographData object
   * @param row - CSV row data
   * @param gridMode - Grid mode (diamond/box) for correct positioning
   */
  parseCSVRowToPictograph(row: CSVRow, gridMode: GridMode): PictographData {
    // Convert string letter to Letter enum (e.g., "A" -> Letter.A)
    const letter = row.letter as Letter;

    // Create temporary blue motion for orientation calculation
    const tempBlueMotion = createMotionData({
      motionType: this.enumMapper.mapMotionType(row.blueMotionType),
      rotationDirection: this.enumMapper.mapRotationDirection(
        row.blueRotationDirection
      ),
      startLocation: this.enumMapper.mapLocation(row.blueStartLocation),
      endLocation: this.enumMapper.mapLocation(row.blueEndLocation),
      startOrientation: Orientation.IN, // Default start orientation
      turns: 0, // Default turns for CSV data
      color: MotionColor.BLUE,
      gridMode: gridMode, // Set grid mode for positioning
    });

    // Calculate blue end orientation dynamically
    const blueEndOrientation = this.orientationService.calculateEndOrientation(
      tempBlueMotion,
      MotionColor.BLUE
    );

    // Create final blue motion with calculated end orientation
    const blueMotion = createMotionData({
      motionType: this.enumMapper.mapMotionType(row.blueMotionType),
      rotationDirection: this.enumMapper.mapRotationDirection(
        row.blueRotationDirection
      ),
      startLocation: this.enumMapper.mapLocation(row.blueStartLocation),
      endLocation: this.enumMapper.mapLocation(row.blueEndLocation),
      startOrientation: Orientation.IN,
      endOrientation: blueEndOrientation, // Include calculated orientation
      turns: 0,
      color: MotionColor.BLUE,
      gridMode: gridMode, // Set grid mode for positioning
    });

    // Create temporary red motion for orientation calculation
    const tempRedMotion = createMotionData({
      motionType: this.enumMapper.mapMotionType(row.redMotionType),
      rotationDirection: this.enumMapper.mapRotationDirection(
        row.redRotationDirection
      ),
      startLocation: this.enumMapper.mapLocation(row.redStartLocation),
      endLocation: this.enumMapper.mapLocation(row.redEndLocation),
      startOrientation: Orientation.IN, // Default start orientation
      turns: 0, // Default turns for CSV data
      color: MotionColor.RED,
      gridMode: gridMode, // Set grid mode for positioning
    });

    // Calculate red end orientation dynamically
    const redEndOrientation = this.orientationService.calculateEndOrientation(
      tempRedMotion,
      MotionColor.RED
    );

    // Create final red motion with calculated end orientation
    const redMotion = createMotionData({
      motionType: this.enumMapper.mapMotionType(row.redMotionType),
      rotationDirection: this.enumMapper.mapRotationDirection(
        row.redRotationDirection
      ),
      startLocation: this.enumMapper.mapLocation(row.redStartLocation),
      endLocation: this.enumMapper.mapLocation(row.redEndLocation),
      startOrientation: Orientation.IN,
      endOrientation: redEndOrientation, // Include calculated orientation
      turns: 0,
      color: MotionColor.RED,
      gridMode: gridMode, // Set grid mode for positioning
    });

    // CSV parsing completed successfully
    // Parse category if present (skewed mode CSV only)
    const category = row.category ? parseInt(row.category, 10) : null;

    return createPictographData({
      letter,
      startPosition: this.mapStringToGridPosition(row.startPosition),
      endPosition: this.mapStringToGridPosition(row.endPosition),
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
      ...(category !== null && { category }),
    });
  }

  /**
   * Convert string position to GridPosition enum
   */
  private mapStringToGridPosition(position: string): GridPosition | null {
    const upperPosition = position.toUpperCase();

    // Check if it's a valid GridPosition
    if (upperPosition in GridPosition) {
      return GridPosition[upperPosition as keyof typeof GridPosition];
    }

    return null;
  }

  /**
   * Parse multiple CSV rows for a letter
   * @param letterRows - CSV rows to parse
   * @param gridMode - Grid mode (diamond/box) for correct positioning
   */
  parseLetterPictographs(
    letterRows: CSVRow[],
    gridMode: GridMode
  ): PictographData[] {
    return letterRows.map((row) => this.parseCSVRowToPictograph(row, gridMode));
  }

  /**
   * Validate that a CSV row has the expected structure
   */
  validateCSVRow(row: unknown): row is CSVRow {
    const requiredFields = [
      "letter",
      "startPosition",
      "endPosition",
      "timing",
      "direction",
      "blueMotionType",
      "blueRotationDirection",
      "blueStartLocation",
      "blueEndLocation",
      "redMotionType",
      "redRotationDirection",
      "redStartLocation",
      "redEndLocation",
    ];

    return requiredFields.every(
      (field) =>
        row &&
        typeof row === "object" &&
        field in row &&
        (row as Record<string, unknown>)[field] !== undefined
    );
  }
}
