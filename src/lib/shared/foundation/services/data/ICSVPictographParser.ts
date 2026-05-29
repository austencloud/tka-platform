/**
 * CSV Pictograph Parser Service Interface
 *
 * Interface for converting CSV rows to PictographData objects.
 * Handles row-level parsing of BoxPictographDataframe.csv data.
 */

import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { GridMode } from "../../../pictograph/grid/domain/enums/grid-enums";

export interface CSVRow {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotionType: string;
  blueRotationDirection: string;
  blueStartLocation: string;
  blueEndLocation: string;
  redMotionType: string;
  redRotationDirection: string;
  redStartLocation: string;
  redEndLocation: string;
  // Skewed mode fields (optional - only present in SkewedPictographDataframe.csv)
  blueSkewDir?: string;
  blueHandPath?: string;
  blueSkewSteps?: string;
  redSkewDir?: string;
  redHandPath?: string;
  redSkewSteps?: string;
  category?: string;
}

export interface ICSVPictographParser {
  /**
   * Convert a CSV row to PictographData object
   * @param row - CSV row data
   * @param gridMode - Grid mode (diamond/box) for correct positioning
   */
  parseCSVRowToPictograph(row: CSVRow, gridMode: GridMode): PictographData;

  /**
   * Parse multiple CSV rows for a letter
   * @param letterRows - CSV rows to parse
   * @param gridMode - Grid mode (diamond/box) for correct positioning
   */
  parseLetterPictographs(
    letterRows: CSVRow[],
    gridMode: GridMode
  ): PictographData[];

  /**
   * Validate that a CSV row has the expected structure
   */
  validateCSVRow(row: unknown): row is CSVRow;
}
