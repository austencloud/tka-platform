import type { GridMode } from "../../../grid/domain/enums/grid-enums";
import { GridPosition } from "../../../grid/domain/enums/grid-enums";
import type { Letter } from "../../../../foundation/domain/models/Letter";
import { MotionColor, HandPath, SkewDirection } from "../../domain/enums/pictograph-enums";
import { createMotionData } from "../../domain/models/MotionData";
import type { PictographData } from "../../domain/models/PictographData";
import { createPictographData } from "../../domain/factories/createPictographData";
import type { EnumMapper } from "../../../../foundation/services/implementations/data/EnumMapper";
import type { OrientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import type {
  CSVRow,
  ICSVPictographParser,
} from "../../../../foundation/services/data/ICSVPictographParser";
import { Orientation } from "../../domain/enums/pictograph-enums";

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
    private readonly enumMapper: EnumMapper,
    private readonly orientationService: OrientationCalculator
  ) {}

  parseCSVRowToPictograph(row: CSVRow, gridMode: GridMode): PictographData {
    const letter = row.letter as Letter;

    const tempBlueMotion = createMotionData({
      motionType: this.enumMapper.mapMotionType(row.blueMotionType),
      rotationDirection: this.enumMapper.mapRotationDirection(
        row.blueRotationDirection
      ),
      startLocation: this.enumMapper.mapLocation(row.blueStartLocation),
      endLocation: this.enumMapper.mapLocation(row.blueEndLocation),
      startOrientation: Orientation.IN, 
      turns: 0, 
      color: MotionColor.BLUE,
      gridMode: gridMode, 
    });

    const blueEndOrientation = this.orientationService.calculateEndOrientation(
      tempBlueMotion,
      MotionColor.BLUE
    );

    const blueHandPath = mapHandPath(row.blueHandPath);
    const blueSkewSteps = row.blueSkewSteps ? parseInt(row.blueSkewSteps, 10) : null;
    const blueSkewDir = mapSkewDir(row.blueSkewDir);

    const blueMotion = createMotionData({
      motionType: this.enumMapper.mapMotionType(row.blueMotionType),
      rotationDirection: this.enumMapper.mapRotationDirection(
        row.blueRotationDirection
      ),
      startLocation: this.enumMapper.mapLocation(row.blueStartLocation),
      endLocation: this.enumMapper.mapLocation(row.blueEndLocation),
      startOrientation: Orientation.IN,
      endOrientation: blueEndOrientation, 
      turns: 0,
      color: MotionColor.BLUE,
      gridMode: gridMode, 
      ...(blueHandPath !== null && { handPath: blueHandPath }),
      ...(blueSkewSteps !== null && { skewSteps: blueSkewSteps }),
      ...(blueSkewDir !== null && { skewDir: blueSkewDir }),
    });

    const tempRedMotion = createMotionData({
      motionType: this.enumMapper.mapMotionType(row.redMotionType),
      rotationDirection: this.enumMapper.mapRotationDirection(
        row.redRotationDirection
      ),
      startLocation: this.enumMapper.mapLocation(row.redStartLocation),
      endLocation: this.enumMapper.mapLocation(row.redEndLocation),
      startOrientation: Orientation.IN, 
      turns: 0, 
      color: MotionColor.RED,
      gridMode: gridMode, 
    });

    const redEndOrientation = this.orientationService.calculateEndOrientation(
      tempRedMotion,
      MotionColor.RED
    );

    const redHandPath = mapHandPath(row.redHandPath);
    const redSkewSteps = row.redSkewSteps ? parseInt(row.redSkewSteps, 10) : null;
    const redSkewDir = mapSkewDir(row.redSkewDir);

    const redMotion = createMotionData({
      motionType: this.enumMapper.mapMotionType(row.redMotionType),
      rotationDirection: this.enumMapper.mapRotationDirection(
        row.redRotationDirection
      ),
      startLocation: this.enumMapper.mapLocation(row.redStartLocation),
      endLocation: this.enumMapper.mapLocation(row.redEndLocation),
      startOrientation: Orientation.IN,
      endOrientation: redEndOrientation, 
      turns: 0,
      color: MotionColor.RED,
      gridMode: gridMode, 
      ...(redHandPath !== null && { handPath: redHandPath }),
      ...(redSkewSteps !== null && { skewSteps: redSkewSteps }),
      ...(redSkewDir !== null && { skewDir: redSkewDir }),
    });

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

  private mapStringToGridPosition(position: string): GridPosition | null {
    const upperPosition = position.toUpperCase();

    if (upperPosition in GridPosition) {
      return GridPosition[upperPosition as keyof typeof GridPosition];
    }

    return null;
  }

  parseLetterPictographs(
    letterRows: CSVRow[],
    gridMode: GridMode
  ): PictographData[] {
    return letterRows.map((row) => this.parseCSVRowToPictograph(row, gridMode));
  }

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

import { enumMapper } from "../../../../foundation/services/implementations/data/EnumMapper";
import { orientationCalculator } from "../../../prop/services/implementations/OrientationCalculator";

export const csvPictographParser = new CSVPictographParser(
  enumMapper,
  orientationCalculator
);
