import { MotionColor } from "../domain/enums/pictograph-enums";
import { GridMode } from "../../grid/domain/enums/grid-enums";
import type { MotionData } from "../domain/models/motion-data";
import { createMotionData } from "../domain/models/motion-data";
import type { PictographData } from "../domain/models/pictograph-data";
import type { CSVPictographParser, CSVRow } from "./csv-pictograph-parser";
import type { ParsedCsvRow } from "$lib/shared/foundation/domain/models/csv-models";
import type { CsvLoader } from "../../../foundation/services/data/csv-loader";
import type { IMotionQueryHandler } from "../../../foundation/services/data/data-contracts";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
import type { Orientation } from "../domain/enums/pictograph-enums";

interface ICSVParser {
  parseCSV(csvText: string): { rows: ParsedCsvRow[] };
}

export class MotionQueryHandler implements IMotionQueryHandler {
  private parsedData: Record<GridMode, ParsedCsvRow[]> | null = null;
  private isInitialized = false;

  constructor(
    private csvLoader: CsvLoader,
    private CSVParser: ICSVParser,
    private csvPictographParser: CSVPictographParser
  ) {}

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const csvData = await this.csvLoader.loadCSVDataSet();

      const diamondParseResult = this.CSVParser.parseCSV(
        csvData.data?.diamondData || ""
      );
      const boxParseResult = this.CSVParser.parseCSV(
        csvData.data?.boxData || ""
      );

      const skewedParseResult = csvData.data?.skewedData
        ? this.CSVParser.parseCSV(csvData.data.skewedData)
        : { rows: [] };

      this.parsedData = {
        [GridMode.DIAMOND]: diamondParseResult.rows,
        [GridMode.BOX]: boxParseResult.rows,
        [GridMode.SKEWED]: skewedParseResult.rows,
        [GridMode.CENTRIC]: [],
        [GridMode.TRIGRID]: [],
        [GridMode.EIGHT_POINT]: [],
      };

      this.isInitialized = true;
    } catch (error) {
      console.error("❌ MotionQueryHandler: Error loading CSV data:", error);
      throw new Error(
        `Failed to load CSV data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async queryMotions(
    criteria: Record<string, unknown>
  ): Promise<PictographData[]> {
    await this.ensureInitialized();

    if (!this.parsedData) {
      console.error("❌ No parsed CSV data available");
      return [];
    }

    const gridMode = (criteria["gridMode"] as GridMode) || GridMode.DIAMOND;
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

  async getMotionById(motionId: string): Promise<PictographData | null> {
    await this.ensureInitialized();

    if (!this.parsedData) {
      console.error("❌ No parsed CSV data available");
      return null;
    }

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

  async searchMotions(pattern: string): Promise<PictographData[]> {
    await this.ensureInitialized();

    if (!this.parsedData) {
      console.error("❌ No parsed CSV data available");
      return [];
    }

    const pictographs: PictographData[] = [];
    const lowerPattern = pattern.toLowerCase();

    for (const gridMode of [GridMode.DIAMOND, GridMode.BOX]) {
      const csvRows =
        this.parsedData[gridMode as keyof typeof this.parsedData] || [];
      for (const row of csvRows.slice(0, 100)) {
        const data = row;
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

      let csvRows = this.parsedData[gridMode] || [];
      if (gridMode === GridMode.SKEWED && csvRows.length === 0) {
        csvRows = this.parsedData[GridMode.DIAMOND] || [];
      }
      const effectiveMode = gridMode;

      const allPictographs: PictographData[] = [];
      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        try {
          const pictograph = this.csvPictographParser.parseCSVRowToPictograph(
            row as unknown as CSVRow,
            effectiveMode 
          );
          if (pictograph) {
            allPictographs.push(pictograph);
          }
        } catch (parseError) {
          console.warn(
            "⚠️ MotionQueryHandler: Failed to parse row:",
            parseError
          );
        }

      }

      if (!sequence || sequence.length === 0) {
        return allPictographs.slice(0, 20);
      }

      const lastStep = sequence[sequence.length - 1] as PictographData;
      if (!lastStep.motions.blue || !lastStep.motions.red) {
        console.warn(
          "⚠️ MotionQueryHandler: Last beat has no motion data, returning all options"
        );
        return allPictographs;
      }

      const endBlueOrientation = lastStep.motions.blue.endOrientation;
      const endRedOrientation = lastStep.motions.red.endOrientation;
      const endBlueLocation = lastStep.motions.blue.endLocation;
      const endRedLocation = lastStep.motions.red.endLocation;

      const transformedPictographs: PictographData[] = [];

      for (let i = 0; i < allPictographs.length; i++) {
        const pictograph = allPictographs[i];
        if (!pictograph?.motions.blue || !pictograph.motions.red) {
          continue;
        }

        const startBlueLocation = pictograph.motions.blue.startLocation;
        const startRedLocation = pictograph.motions.red.startLocation;

        const canConnect =
          startBlueLocation === endBlueLocation &&
          startRedLocation === endRedLocation;

        if (canConnect) {
          const transformedPictograph =
            this.transformPictographStartOrientation(
              pictograph,
              endBlueOrientation,
              endRedOrientation
            );

          transformedPictographs.push(transformedPictograph);
        }

      }

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
      throw error; 
    }
  }

  private transformPictographStartOrientation(
    pictograph: PictographData,
    targetBlueStartOrientation: Orientation,
    targetRedStartOrientation: Orientation
  ): PictographData {
    if (!pictograph.motions.blue || !pictograph.motions.red) {
      return pictograph;
    }

    const transformedPictograph: PictographData = {
      ...pictograph,
      motions: {
        blue: { ...pictograph.motions.blue },
        red: { ...pictograph.motions.red },
      },
    };

    if (transformedPictograph.motions.blue) {
      transformedPictograph.motions.blue = {
        ...transformedPictograph.motions.blue,
        startOrientation: targetBlueStartOrientation,
        endOrientation: this.calculateTransformedEndOrientation(
          transformedPictograph.motions.blue,
          targetBlueStartOrientation,
          MotionColor.BLUE
        ),
      };
    }

    if (transformedPictograph.motions.red) {
      transformedPictograph.motions.red = {
        ...transformedPictograph.motions.red,
        startOrientation: targetRedStartOrientation,
        endOrientation: this.calculateTransformedEndOrientation(
          transformedPictograph.motions.red,
          targetRedStartOrientation,
          MotionColor.RED
        ),
      };
    }

    return transformedPictograph;
  }

  private calculateTransformedEndOrientation(
    originalMotion: MotionData,
    newStartOrientation: Orientation,
    color: MotionColor
  ): Orientation {
    const transformedMotionData: MotionData = createMotionData({
      motionType: originalMotion.motionType,
      rotationDirection: originalMotion.rotationDirection,
      startLocation: originalMotion.startLocation,
      endLocation: originalMotion.endLocation,
      turns: originalMotion.turns,
      startOrientation: newStartOrientation, 
      endOrientation: originalMotion.endOrientation, 
      isVisible: originalMotion.isVisible,
      color: color,
      propType: originalMotion.propType,
      arrowLocation: originalMotion.arrowLocation,
    });

    return calculateEndOrientation(
      transformedMotionData,
      color
    );
  }

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

    let csvRows = this.parsedData[gridMode] || [];
    if (gridMode === GridMode.SKEWED && csvRows.length === 0) {
      csvRows = this.parsedData[GridMode.DIAMOND] || [];
    }

    // A float carrying a prefloat TYPE next to a "noRotation" prefloat
    // ROTATION is the legacy blob decoder's FABRICATED pair — the old wire
    // format carried no prefloat data, and the decoder manufactured a type
    // from the empty rotation slot (parity-repair spec, root-caused
    // 2026-07-27 against embedded mint-time witnesses: the manufactured
    // types flip pro↔anti arbitrarily). Matching CSV rows against that pair
    // produces confident same-family WRONG letters. Treat the whole pair as
    // absent; the decoder no longer emits it, but persisted copies of old
    // decodes can still carry it.
    const isFabricatedPrefloat = (motion: MotionData): boolean =>
      !!motion.prefloatMotionType &&
      String(motion.prefloatRotationDirection ?? "").toLowerCase() ===
        "norotation";

    const getSearchMotionType = (motion: MotionData): string => {
      if (motion.prefloatMotionType && !isFabricatedPrefloat(motion)) {
        return motion.prefloatMotionType;
      }
      if (motion.motionType.toLowerCase() === "float") {
        if (motion.startLocation !== motion.endLocation) {
          return "pro";
        }
      }
      return motion.motionType;
    };

    const blueSearchMotion = {
      ...blueMotion,
      motionType: getSearchMotionType(blueMotion),
      rotationDirection: isFabricatedPrefloat(blueMotion)
        ? blueMotion.rotationDirection
        : blueMotion.prefloatRotationDirection || blueMotion.rotationDirection,
    };
    const redSearchMotion = {
      ...redMotion,
      motionType: getSearchMotionType(redMotion),
      rotationDirection: isFabricatedPrefloat(redMotion)
        ? redMotion.rotationDirection
        : redMotion.prefloatRotationDirection || redMotion.rotationDirection,
    };

    const blueIsFloatWithoutPrefloat =
      blueMotion.motionType.toLowerCase() === "float" &&
      (!blueMotion.prefloatMotionType || isFabricatedPrefloat(blueMotion));
    const redIsFloatWithoutPrefloat =
      redMotion.motionType.toLowerCase() === "float" &&
      (!redMotion.prefloatMotionType || isFabricatedPrefloat(redMotion));
    const blueAlternativeTypes =
      blueIsFloatWithoutPrefloat && blueSearchMotion.motionType === "pro"
        ? ["pro", "anti"]
        : [blueSearchMotion.motionType];
    const redAlternativeTypes =
      redIsFloatWithoutPrefloat && redSearchMotion.motionType === "pro"
        ? ["pro", "anti"]
        : [redSearchMotion.motionType];

    for (const blueType of blueAlternativeTypes) {
      for (const redType of redAlternativeTypes) {
        for (const row of csvRows) {
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

import { csvLoader } from "../../../foundation/services/data/csv-loader";
import { csvParser } from "../../../foundation/services/implementations/data/csv-parser";
import { csvPictographParser } from "./csv-pictograph-parser";

export const motionQueryHandler = new MotionQueryHandler(
  csvLoader,
  csvParser,
  csvPictographParser
);
