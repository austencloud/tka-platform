/**
 * CSV Pictograph Parser Service - Converts CSV rows to PictographData objects
 *
 * Parses the BoxPictographDataframe.csv data and converts it to typed PictographData.
 * Uses the correct position mapping based on hand location combinations.
 */

import type { GridMode } from "../../../grid/domain/enums/grid-enums";
import { GridPosition } from "../../../grid/domain/enums/grid-enums";
import type { Letter } from "../../../../foundation/domain/models/Letter";
import { MotionColor, HandPath, SkewDirection } from "../../domain/enums/pictograph-enums";
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

// Map CSV hand path strings to HandPath enum
function mapHandPath(value: string | undefined): HandPath | null {
  if (!value) return null;
  switch (value.toLowerCase()) {
    case "cw":
      return HandPath.CLOCKWISE;
    case "ccw":
      return HandPath.COUNTER_CLOCKWISE;
    case "dash":
      return HandPath.DASH;
    case "static":
      return HandPath.STATIC;
    case "hashin":
      return HandPath.HASH_IN;
    case "hashout":
      return HandPath.HASH_OUT;
    default:
      return null;
  }
}

// Map CSV skew direction strings to SkewDirection enum
function mapSkewDir(value: string | undefined): SkewDirection | null {
  if (!value) return null;
  switch (value.trim()) {
    case "+":
      return SkewDirection.PLUS;
    case "-":
      return SkewDirection.MINUS;
    default:
      return null;
  }
}
export class CSVPictographParser implements ICSVPictographParser {
  constructor(
    private readonly enumMapper: IEnumMapper,
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

    // Parse blue hand path, skew steps, and skew direction if present (skewed mode CSV)
    const blueHandPath = mapHandPath(row.blueHandPath);
    const blueSkewSteps = row.blueSkewSteps ? parseInt(row.blueSkewSteps, 10) : null;
    const blueSkewDir = mapSkewDir(row.blueSkewDir);

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
      ...(blueHandPath !== null && { handPath: blueHandPath }),
      ...(blueSkewSteps !== null && { skewSteps: blueSkewSteps }),
      ...(blueSkewDir !== null && { skewDir: blueSkewDir }),
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

    // Parse red hand path, skew steps, and skew direction if present (skewed mode CSV)
    const redHandPath = mapHandPath(row.redHandPath);
    const redSkewSteps = row.redSkewSteps ? parseInt(row.redSkewSteps, 10) : null;
    const redSkewDir = mapSkewDir(row.redSkewDir);

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
      ...(redHandPath !== null && { handPath: redHandPath }),
      ...(redSkewSteps !== null && { skewSteps: redSkewSteps }),
      ...(redSkewDir !== null && { skewDir: redSkewDir }),
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

// Direct singleton export for HMR-friendly imports
import { enumMapper } from "../../../../foundation/services/implementations/data/EnumMapper";
import { orientationCalculator } from "../../../prop/services/implementations/OrientationCalculator";

export const csvPictographParser = new CSVPictographParser(
  enumMapper,
  orientationCalculator
);
