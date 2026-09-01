/**
 * TikaPictographLoader - Loads and caches TKA pictograph data
 *
 * Handles CSV parsing for diamond/box mode pictographs,
 * JSON loading for glossary and letter types,
 * and builds position mapping indexes for sequence validation.
 */

import fs from "fs";
import path from "path";

export interface MotionData {
  color: string;
  startLocation: string;
  endLocation: string;
  motionType: string;
  rotationDirection: string;
}
export interface PictographData {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  leftMotion: MotionData;
  rightMotion: MotionData;
}
export interface PictographDataWithMode extends PictographData {
  gridMode: "diamond" | "box";
}
export interface GlossaryEntry {
  definition: string;
  examples: string[];
  relatedTerms: string[];
  category: string;
}
export interface LetterTypeInfo {
  name: string;
  description: string;
  characteristics: string[];
  letters: string[];
  motionPattern: {
    leftMotion: string;
    rightMotion: string;
    note?: string;
  };
}
export interface LetterPositionMapping {
  startPosition: string;
  endPosition: string;
  startGroup: string;
  endGroup: string;
}

export class TikaPictographLoader {
  private allPictographs: PictographData[] = [];
  private diamondPictographs: PictographDataWithMode[] = [];
  private boxPictographs: PictographDataWithMode[] = [];
  private glossary: Record<string, GlossaryEntry> = {};
  private letterTypes: Record<string, LetterTypeInfo> = {};
  private letterPositionMappings: Record<string, LetterPositionMapping> = {};
  private bridgeLettersByTransition: Record<string, string[]> = {};

  private dataLoaded = false;
  private positionMappingsLoaded = false;

  ensureLoaded(): void {
    if (!this.dataLoaded) {
      this.loadDataframe();
      this.loadKnowledgeBase();
      this.dataLoaded = true;
    }
    if (!this.positionMappingsLoaded) {
      this.loadLetterPositionMappings();
      this.positionMappingsLoaded = true;
    }
  }

  getAllPictographs(): PictographData[] {
    this.ensureLoaded();
    return this.allPictographs;
  }

  getDiamondPictographs(): PictographDataWithMode[] {
    this.ensureLoaded();
    return this.diamondPictographs;
  }

  getBoxPictographs(): PictographDataWithMode[] {
    this.ensureLoaded();
    return this.boxPictographs;
  }

  getGlossary(): Record<string, GlossaryEntry> {
    this.ensureLoaded();
    return this.glossary;
  }

  getLetterTypes(): Record<string, LetterTypeInfo> {
    this.ensureLoaded();
    return this.letterTypes;
  }

  getLetterPositionMappings(): Record<string, LetterPositionMapping> {
    this.ensureLoaded();
    return this.letterPositionMappings;
  }

  getBridgeLettersByTransition(): Record<string, string[]> {
    this.ensureLoaded();
    return this.bridgeLettersByTransition;
  }

  getLetterVariations(letter: string): PictographData[] {
    this.ensureLoaded();
    return this.allPictographs.filter((p) => p.letter === letter);
  }

  getLetterVariationsByMode(
    letter: string,
    gridMode: "diamond" | "box"
  ): PictographDataWithMode[] {
    this.ensureLoaded();
    const source =
      gridMode === "diamond" ? this.diamondPictographs : this.boxPictographs;
    return source.filter((p) => p.letter === letter);
  }

  private loadDataframe(): void {
    try {
      const diamondPath = path.join(
        process.cwd(),
        "static",
        "data",
        "pictographs",
        "DiamondPictographDataframe.csv"
      );
      this.diamondPictographs = this.loadCsvFile(diamondPath, "diamond");

      const boxPath = path.join(
        process.cwd(),
        "static",
        "data",
        "pictographs",
        "BoxPictographDataframe.csv"
      );
      this.boxPictographs = this.loadCsvFile(boxPath, "box");

      this.allPictographs = [
        ...this.diamondPictographs,
        ...this.boxPictographs,
      ];
    } catch (error) {
      console.error("[TikaPictographLoader] Failed to load dataframe:", error);
    }
  }

  private loadCsvFile(
    csvPath: string,
    gridMode: "diamond" | "box"
  ): PictographDataWithMode[] {
    try {
      const csvContent = fs.readFileSync(csvPath, "utf-8");
      const lines = csvContent.trim().split("\n");
      if (lines.length < 2) return [];

      const headerLine = lines[0];
      if (!headerLine) return [];
      const headers = headerLine.split(",").map((h) => h.trim());
      const pictographs: PictographDataWithMode[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const values = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ?? "";
        });

        pictographs.push({
          letter: row["letter"] ?? "",
          startPosition: row["startPosition"] ?? "",
          endPosition: row["endPosition"] ?? "",
          timing: row["timing"] ?? "",
          direction: row["direction"] ?? "",
          gridMode,
          leftMotion: {
            hand: "left",
            startLocation: row["blueStartLocation"] ?? "",
            endLocation: row["blueEndLocation"] ?? "",
            motionType: row["blueMotionType"] ?? "",
            rotationDirection: row["blueRotationDirection"] ?? "",
          },
          rightMotion: {
            hand: "right",
            startLocation: row["redStartLocation"] ?? "",
            endLocation: row["redEndLocation"] ?? "",
            motionType: row["redMotionType"] ?? "",
            rotationDirection: row["redRotationDirection"] ?? "",
          },
        });
      }

      return pictographs;
    } catch (error) {
      console.error(
        `[TikaPictographLoader] Failed to load ${gridMode} dataframe:`,
        error
      );
      return [];
    }
  }

  private loadKnowledgeBase(): void {
    try {
      const glossaryPath = path.join(
        process.cwd(),
        "mcp-server",
        "data",
        "tka-glossary.json"
      );
      const typesPath = path.join(
        process.cwd(),
        "mcp-server",
        "data",
        "letter-types.json"
      );

      if (fs.existsSync(glossaryPath)) {
        this.glossary = JSON.parse(fs.readFileSync(glossaryPath, "utf-8"));
      }
      if (fs.existsSync(typesPath)) {
        this.letterTypes = JSON.parse(fs.readFileSync(typesPath, "utf-8"));
      }
    } catch (error) {
      console.error(
        "[TikaPictographLoader] Failed to load knowledge base:",
        error
      );
    }
  }

  private loadLetterPositionMappings(): void {
    try {
      const mappingsPath = path.join(
        process.cwd(),
        "static",
        "data",
        "learn",
        "letter-mappings.json"
      );
      if (!fs.existsSync(mappingsPath)) {
        console.warn(
          "[TikaPictographLoader] letter-mappings.json not found, validation will use fallback"
        );
        return;
      }

      const data = JSON.parse(fs.readFileSync(mappingsPath, "utf-8"));

      for (const [letter, mapping] of Object.entries(data.letters)) {
        const m = mapping as { startPosition: string; endPosition: string };
        this.letterPositionMappings[letter] = {
          startPosition: m.startPosition,
          endPosition: m.endPosition,
          startGroup: this.extractPositionGroup(m.startPosition),
          endGroup: this.extractPositionGroup(m.endPosition),
        };
      }

      const lettersByTransition: Record<string, string[]> = {};
      for (const [letter, mapping] of Object.entries(
        this.letterPositionMappings
      )) {
        const transition = `${mapping.startGroup}->${mapping.endGroup}`;
        if (!lettersByTransition[transition]) {
          lettersByTransition[transition] = [];
        }
        lettersByTransition[transition].push(letter);
      }
      this.bridgeLettersByTransition = lettersByTransition;
    } catch (error) {
      console.error(
        "[TikaPictographLoader] Failed to load letter-mappings.json:",
        error
      );
    }
  }

  private extractPositionGroup(position: string): string {
    if (position.startsWith("alpha")) return "alpha";
    if (position.startsWith("beta")) return "beta";
    if (position.startsWith("gamma")) return "gamma";
    if (position.startsWith("zeta")) return "zeta";
    if (position.startsWith("eta")) return "eta";
    return "unknown";
  }
}
