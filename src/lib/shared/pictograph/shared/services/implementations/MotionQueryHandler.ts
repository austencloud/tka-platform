/**
 * Motion Query Service - Motion parameter-based pictograph queries
 *
 * Single responsibility: Query pictographs by motion parameters
 * Uses shared services for CSV loading, parsing, and transformation.
 */

import type { Orientation } from "../../domain/enums/pictograph-enums";
import { MotionColor } from "../../domain/enums/pictograph-enums";
import { GridMode } from "../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../domain/models/MotionData";
import { createMotionData } from "../../domain/models/MotionData";
import type { PictographData } from "../../domain/models/PictographData";
import type { ICSVPictographParser as ICSVPictographParser } from "../../../../foundation/services/contracts/data/ICSVPictographParser";
import type { CSVRow } from "../../../../foundation/services/contracts/data/ICSVPictographParser";
import type { ParsedCsvRow } from "$lib/features/create/generate/shared/domain/csv-handling/CsvModels";
import type { ICSVLoader } from "../../../../foundation/services/contracts/data/ICSVLoader";
import type { IMotionQueryHandler } from "../../../../foundation/services/contracts/data/data-contracts";
import type { IOrientationCalculator } from "../../../prop/services/contracts/IOrientationCalculator";
// Temporary interface definition
interface ICSVParser {
  parseCSV(csvText: string): { rows: ParsedCsvRow[] };
}

export class MotionQueryHandler implements IMotionQueryHandler {
  private parsedData: Record<GridMode, ParsedCsvRow[]> | null = null;
  private isInitialized = false;

  constructor(
    private csvLoader: ICSVLoader,
    private CSVParser: ICSVParser,
    private csvPictographParser: ICSVPictographParser,
    private OrientationCalculator: IOrientationCalculator
  ) {}

  /**
   * Initialize CSV data if not already loaded
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load raw CSV data
      const csvData = await this.csvLoader.loadCSVDataSet();

      // Parse CSV data using shared service
      const diamondParseResult = this.CSVParser.parseCSV(
        csvData.data?.diamondData || ""
      );
      const boxParseResult = this.CSVParser.parseCSV(
        csvData.data?.boxData || ""
      );

      // Parse skewed data if available
      const skewedParseResult = csvData.data?.skewedData
        ? this.CSVParser.parseCSV(csvData.data.skewedData)
        : { rows: [] };

      this.parsedData = {
        [GridMode.DIAMOND]: diamondParseResult.rows,
        [GridMode.BOX]: boxParseResult.rows,
        [GridMode.SKEWED]: skewedParseResult.rows,
        [GridMode.CENTRIC]: [],
        [GridMode.TRIGRID]: [],
      };

      this.isInitialized = true;
    } catch (error) {
      console.error("❌ MotionQueryHandler: Error loading CSV data:", error);
      throw new Error(
        `Failed to load CSV data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Query motions based on criteria
   */
  async queryMotions(
    criteria: Record<string, unknown>
  ): Promise<PictographData[]> {
    await this.ensureInitialized();

    if (!this.parsedData) {
      console.error("❌ No parsed CSV data available");
      return [];
    }

    // Simple implementation - filter based on criteria
    const gridMode = (criteria["gridMode"] as GridMode) || GridMode.DIAMOND;
    // Use actual grid mode data, fallback to diamond only if skewed has no data
    let csvRows = this.parsedData[gridMode] || [];
    if (gridMode === GridMode.SKEWED && csvRows.length === 0) {
      csvRows = this.parsedData[GridMode.DIAMOND] || [];
    }
    const actualGridMode = gridMode;
    const pictographs: PictographData[] = [];

    for (const row of csvRows) {
      const pictograph = this.csvPictographParser.parseCSVRowToPictograph(
        row as unknown as CSVRow,
        actualGridMode
      );
      if (pictograph) {
        pictographs.push(pictograph);
      }
    }

    return pictographs;
  }

  /**
   * Get motion data by ID
   */
  async getMotionById(motionId: string): Promise<PictographData | null> {
    await this.ensureInitialized();

    if (!this.parsedData) {
      console.error("❌ No parsed CSV data available");
      return null;
    }

    // Search through all grid modes for the motion ID
    for (const gridMode of [GridMode.DIAMOND, GridMode.BOX]) {
      const csvRows =
        this.parsedData[gridMode as keyof typeof this.parsedData] || [];
      for (const row of csvRows) {
        const pictograph = this.csvPictographParser.parseCSVRowToPictograph(
          row as unknown as CSVRow,
          gridMode
        );
        if (pictograph?.id === motionId) {
          return pictograph;
        }
      }
    }

    return null;
  }

  /**
   * Search motions by pattern
   */
  async searchMotions(pattern: string): Promise<PictographData[]> {
    await this.ensureInitialized();

    if (!this.parsedData) {
      console.error("❌ No parsed CSV data available");
      return [];
    }

    const pictographs: PictographData[] = [];
    const lowerPattern = pattern.toLowerCase();

    // Search through all grid modes
    for (const gridMode of [GridMode.DIAMOND, GridMode.BOX]) {
      const csvRows =
        this.parsedData[gridMode as keyof typeof this.parsedData] || [];
      for (const row of csvRows.slice(0, 100)) {
        // Limit for performance
        const data = row;
        // Search in letter, motion types, and locations
        if (
          data.letter.toLowerCase().includes(lowerPattern) ||
          data.blueMotionType.toLowerCase().includes(lowerPattern) ||
          data.redMotionType.toLowerCase().includes(lowerPattern) ||
          data.blueStartLocation.toLowerCase().includes(lowerPattern) ||
          data.redStartLocation.toLowerCase().includes(lowerPattern)
        ) {
          const pictograph = this.csvPictographParser.parseCSVRowToPictograph(
            row as CSVRow,
            gridMode
          );
          if (pictograph) {
            pictographs.push(pictograph);
          }
        }
      }
    }

    return pictographs;
  }

  /**
   * Get next options for sequence building - contextual filtering and orientation transformation
   */
  async getNextOptionsForSequence(
    sequence: unknown[],
    gridMode: GridMode
  ): Promise<PictographData[]> {
    try {
      await this.ensureInitialized();

      if (!this.parsedData) {
        console.error("❌ No parsed CSV data available");
        return [];
      }

      // Get all available pictographs for the specified grid mode
      // SKEWED mode falls back to DIAMOND only if no skewed data available
      let csvRows = this.parsedData[gridMode] || [];
      if (gridMode === GridMode.SKEWED && csvRows.length === 0) {
        csvRows = this.parsedData[GridMode.DIAMOND] || [];
      }
      const effectiveMode = gridMode;

      // Parse all available pictographs with grid mode
      const allPictographs: PictographData[] = [];
      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        try {
          const pictograph = this.csvPictographParser.parseCSVRowToPictograph(
            row as unknown as CSVRow,
            effectiveMode // Pass grid mode for correct positioning
          );
          if (pictograph) {
            allPictographs.push(pictograph);
          }
        } catch (parseError) {
          console.warn(
            "⚠️ MotionQueryHandler: Failed to parse row:",
            parseError
          );
          // Continue with other rows
        }

      }

      // If no sequence context, return first 20 (fallback for empty sequences)
      if (!sequence || sequence.length === 0) {
        return allPictographs.slice(0, 20);
      }

      // Get the last beat from the sequence to determine end orientation
      const lastStep = sequence[sequence.length - 1] as PictographData;
      if (!lastStep.motions.blue || !lastStep.motions.red) {
        console.warn(
          "⚠️ MotionQueryHandler: Last beat has no motion data, returning all options"
        );
        return allPictographs;
      }

      // Get the end orientations from the last beat
      const endBlueOrientation = lastStep.motions.blue.endOrientation;
      const endRedOrientation = lastStep.motions.red.endOrientation;
      const endBlueLocation = lastStep.motions.blue.endLocation;
      const endRedLocation = lastStep.motions.red.endLocation;

      // Filter and transform pictographs to start with the correct orientation
      const transformedPictographs: PictographData[] = [];

      for (let i = 0; i < allPictographs.length; i++) {
        const pictograph = allPictographs[i];
        if (!pictograph?.motions.blue || !pictograph.motions.red) {
          continue;
        }

        const startBlueLocation = pictograph.motions.blue.startLocation;
        const startRedLocation = pictograph.motions.red.startLocation;

        // Check if this pictograph can connect (same locations)
        const canConnect =
          startBlueLocation === endBlueLocation &&
          startRedLocation === endRedLocation;

        if (canConnect) {
          // Transform the pictograph to start with the correct orientations
          const transformedPictograph =
            this.transformPictographStartOrientation(
              pictograph,
              endBlueOrientation,
              endRedOrientation
            );

          transformedPictographs.push(transformedPictograph);
        }

      }

      // If no transformed options found, return all options as fallback
      if (transformedPictographs.length === 0) {
        console.warn(
          "⚠️ MotionQueryHandler: No matching options found, returning all options as fallback"
        );
        return allPictographs;
      }

      return transformedPictographs;
    } catch (error) {
      console.error(
        "❌ MotionQueryHandler: Error in getNextOptionsForSequence:",
        error
      );
      throw error; // Re-throw to let caller handle it
    }
  }

  /**
   * Transform a pictograph to start with different orientations
   */
  private transformPictographStartOrientation(
    pictograph: PictographData,
    targetBlueStartOrientation: Orientation,
    targetRedStartOrientation: Orientation
  ): PictographData {
    if (!pictograph.motions.blue || !pictograph.motions.red) {
      return pictograph;
    }

    // Create deep copy of the pictograph to avoid mutating the original
    const transformedPictograph: PictographData = {
      ...pictograph,
      motions: {
        blue: { ...pictograph.motions.blue },
        red: { ...pictograph.motions.red },
      },
    };

    // Transform blue motion
    if (transformedPictograph.motions.blue) {
      transformedPictograph.motions.blue = {
        ...transformedPictograph.motions.blue,
        startOrientation: targetBlueStartOrientation,
        // Recalculate end orientation based on the new start orientation
        endOrientation: this.calculateTransformedEndOrientation(
          transformedPictograph.motions.blue,
          targetBlueStartOrientation,
          MotionColor.BLUE
        ),
      };
    }

    // Transform red motion
    if (transformedPictograph.motions.red) {
      transformedPictograph.motions.red = {
        ...transformedPictograph.motions.red,
        startOrientation: targetRedStartOrientation,
        // Recalculate end orientation based on the new start orientation
        endOrientation: this.calculateTransformedEndOrientation(
          transformedPictograph.motions.red,
          targetRedStartOrientation,
          MotionColor.RED
        ),
      };
    }

    return transformedPictograph;
  }

  /**
   * Calculate the end orientation for a motion with a different start orientation
   * Uses the proper OrientationCalculator for accurate calculations
   */
  private calculateTransformedEndOrientation(
    originalMotion: MotionData,
    newStartOrientation: Orientation,
    color: MotionColor
  ): Orientation {
    // Create a proper MotionData object with the new start orientation
    const transformedMotionData: MotionData = createMotionData({
      motionType: originalMotion.motionType,
      rotationDirection: originalMotion.rotationDirection,
      startLocation: originalMotion.startLocation,
      endLocation: originalMotion.endLocation,
      turns: originalMotion.turns,
      startOrientation: newStartOrientation, // Use the new start orientation
      endOrientation: originalMotion.endOrientation, // Will be recalculated
      isVisible: originalMotion.isVisible,
      color: color,
      propType: originalMotion.propType,
      arrowLocation: originalMotion.arrowLocation,
    });

    // Use the proper orientation calculation service
    return this.OrientationCalculator.calculateEndOrientation(
      transformedMotionData,
      color
    );
  }

  /**
   * Find letter by motion configuration
   * Used when reversing sequences to find the correct letter for the reversed motion
   *
   * @param blueMotion - Blue motion data
   * @param redMotion - Red motion data
   * @param gridMode - Grid mode (diamond/box)
   * @returns Letter enum or null if no match found
   */
  async findLetterByMotionConfiguration(
    blueMotion: MotionData,
    redMotion: MotionData,
    gridMode: GridMode
  ): Promise<string | null> {
    await this.ensureInitialized();

    if (!this.parsedData) {
      console.error("❌ No parsed CSV data available");
      return null;
    }

    // Use actual grid mode data, fallback to diamond only if skewed has no data
    let csvRows = this.parsedData[gridMode] || [];
    if (gridMode === GridMode.SKEWED && csvRows.length === 0) {
      csvRows = this.parsedData[GridMode.DIAMOND] || [];
    }

    // Revert float motions back to their pre-float state for CSV matching
    // Float motions are runtime conversions from pro/anti - the CSV only has the base types
    const getSearchMotionType = (motion: MotionData): string => {
      if (motion.prefloatMotionType) {
        return motion.prefloatMotionType;
      }
      if (motion.motionType.toLowerCase() === "float") {
        // Float without prefloat data - infer original type from movement
        if (motion.startLocation !== motion.endLocation) {
          // Movement between locations - was pro or anti
          // We'll try both in the search loop
          return "pro"; // Default to pro, we'll also try anti
        }
      }
      return motion.motionType;
    };

    const blueSearchMotion = {
      ...blueMotion,
      motionType: getSearchMotionType(blueMotion),
      rotationDirection:
        blueMotion.prefloatRotationDirection || blueMotion.rotationDirection,
    };
    const redSearchMotion = {
      ...redMotion,
      motionType: getSearchMotionType(redMotion),
      rotationDirection:
        redMotion.prefloatRotationDirection || redMotion.rotationDirection,
    };

    // Determine if we need to try alternative motion types for floats
    const blueIsFloatWithoutPrefloat =
      blueMotion.motionType.toLowerCase() === "float" &&
      !blueMotion.prefloatMotionType;
    const redIsFloatWithoutPrefloat =
      redMotion.motionType.toLowerCase() === "float" &&
      !redMotion.prefloatMotionType;
    const blueAlternativeTypes =
      blueIsFloatWithoutPrefloat && blueSearchMotion.motionType === "pro"
        ? ["pro", "anti"]
        : [blueSearchMotion.motionType];
    const redAlternativeTypes =
      redIsFloatWithoutPrefloat && redSearchMotion.motionType === "pro"
        ? ["pro", "anti"]
        : [redSearchMotion.motionType];

    // Search for a matching pictograph in the CSV data
    for (const blueType of blueAlternativeTypes) {
      for (const redType of redAlternativeTypes) {
        for (const row of csvRows) {
          // Match based on:
          // 1. Motion types (pro, anti, static, dash, etc.)
          // 2. Start locations
          // 3. End locations
          // 4. Rotation directions (EXCEPT in special cases - see note below)
          //
          // NOTE: We ignore rotation direction in these cases:
          // 1. Static/dash motions: Generator applies turns, changing rotation from noRotation to cw/ccw,
          //    but CSV only has base pictographs with noRotation
          // 2. Float motions without prefloat data: We don't know the original rotation,
          //    so we must ignore rotation when matching against pro/anti in CSV
          const blueIgnoreRotation =
            blueType.toLowerCase() === "static" ||
            blueType.toLowerCase() === "dash" ||
            blueIsFloatWithoutPrefloat;
          const redIgnoreRotation =
            redType.toLowerCase() === "static" ||
            redType.toLowerCase() === "dash" ||
            redIsFloatWithoutPrefloat;

          const matchesBlueMotion =
            row.blueMotionType.toLowerCase() === blueType.toLowerCase() &&
            row.blueStartLocation.toLowerCase() ===
              blueMotion.startLocation.toLowerCase() &&
            row.blueEndLocation.toLowerCase() ===
              blueMotion.endLocation.toLowerCase() &&
            (blueIgnoreRotation ||
              row.blueRotationDirection.toLowerCase() ===
                blueSearchMotion.rotationDirection.toLowerCase());

          const matchesRedMotion =
            row.redMotionType.toLowerCase() === redType.toLowerCase() &&
            row.redStartLocation.toLowerCase() ===
              redMotion.startLocation.toLowerCase() &&
            row.redEndLocation.toLowerCase() ===
              redMotion.endLocation.toLowerCase() &&
            (redIgnoreRotation ||
              row.redRotationDirection.toLowerCase() ===
                redSearchMotion.rotationDirection.toLowerCase());

          if (matchesBlueMotion && matchesRedMotion) {
            return row.letter || null;
          }
        }
      }
    }

    // No match found
    const blueDesc = blueMotion.prefloatMotionType
      ? `${blueMotion.motionType}(was ${blueMotion.prefloatMotionType}) ${blueMotion.startLocation}->${blueMotion.endLocation} ${blueSearchMotion.rotationDirection}`
      : `${blueMotion.motionType} ${blueMotion.startLocation}->${blueMotion.endLocation} ${blueSearchMotion.rotationDirection}`;
    const redDesc = redMotion.prefloatMotionType
      ? `${redMotion.motionType}(was ${redMotion.prefloatMotionType}) ${redMotion.startLocation}->${redMotion.endLocation} ${redSearchMotion.rotationDirection}`
      : `${redMotion.motionType} ${redMotion.startLocation}->${redMotion.endLocation} ${redSearchMotion.rotationDirection}`;
    console.warn(
      `⚠️ No letter found for motion configuration: Blue(${blueDesc}), Red(${redDesc})`
    );
    return null;
  }
}

// Direct singleton export for HMR-friendly imports
import { csvLoader } from "../../../../foundation/services/implementations/data/CsvLoader";
import { csvParser } from "../../../../foundation/services/implementations/data/CsvParser";
import { csvPictographParser } from "./CSVPictographParser";
import { orientationCalculator } from "../../../prop/services/implementations/OrientationCalculator";

export const motionQueryHandler = new MotionQueryHandler(
  csvLoader,
  csvParser,
  csvPictographParser,
  orientationCalculator
);
