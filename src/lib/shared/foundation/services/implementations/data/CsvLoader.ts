/**
 * CSV Loader Service Implementation
 *
 * Handles loading and caching of CSV data from static files or preloaded window data.
 * Provides a single source of truth for raw CSV content without parsing logic.
 */

import type { CsvDataSet } from "$lib/features/create/generate/shared/domain/csv-handling/CsvModels";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { ICSVLoader } from "../../contracts/data/ICSVLoader";

// Module-level cache shared across all instances (defense against non-singleton usage)
let sharedCsvCache: CsvDataSet | null = null;
let sharedIsLoaded = false;

export class CsvLoader implements ICSVLoader {
  async loadCSVFile(filename: string): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    source: "fetch" | "window" | "cache";
  }> {
    try {
      const csvData = await this.loadCsvData();

      // Determine which file was requested and return appropriate data
      if (filename.includes("Diamond") || filename.includes("diamond")) {
        return {
          success: true,
          data: csvData.diamondData,
          source: this.isWindowDataAvailable() ? "window" : "fetch",
        };
      } else if (filename.includes("Box") || filename.includes("box")) {
        return {
          success: true,
          data: csvData.boxData,
          source: this.isWindowDataAvailable() ? "window" : "fetch",
        };
      } else if (filename.includes("Skewed") || filename.includes("skewed")) {
        return {
          success: true,
          data: csvData.skewedData || "",
          source: this.isWindowDataAvailable() ? "window" : "fetch",
        };
      } else if (filename.includes("Trigrid") || filename.includes("trigrid")) {
        return {
          success: true,
          data: csvData.trigridData || "",
          source: this.isWindowDataAvailable() ? "window" : "fetch",
        };
      } else {
        return {
          success: false,
          error: `Unknown file: ${filename}`,
          source: "fetch",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        source: "fetch",
      };
    }
  }
  async loadCSVDataSet(): Promise<{
    success: boolean;
    data?: { diamondData: string; boxData: string };
    error?: string;
    sources: {
      diamond: "fetch" | "window" | "cache";
      box: "fetch" | "window" | "cache";
    };
  }> {
    try {
      const csvData = await this.loadCsvData();
      return {
        success: true,
        data: csvData,
        sources: {
          diamond: this.isWindowDataAvailable() ? "window" : "fetch",
          box: this.isWindowDataAvailable() ? "window" : "fetch",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sources: {
          diamond: "fetch",
          box: "fetch",
        },
      };
    }
  }
  async loadCSVForGridMode(gridMode: GridMode): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    source: "fetch" | "window" | "cache";
  }> {
    try {
      const csvData = await this.loadCsvData();

      // Return appropriate data based on grid mode
      let data: string;
      if (gridMode === GridMode.DIAMOND) {
        data = csvData.diamondData;
      } else if (gridMode === GridMode.BOX) {
        data = csvData.boxData;
      } else if (gridMode === GridMode.SKEWED) {
        // Use skewed data if available, fall back to diamond for compatibility
        data = csvData.skewedData || csvData.diamondData;
      } else if (gridMode === GridMode.TRIGRID) {
        data = csvData.trigridData || "";
      } else {
        return {
          success: false,
          error: `Unknown grid mode: ${gridMode}`,
          source: "fetch",
        };
      }

      return {
        success: true,
        data,
        source: this.isWindowDataAvailable() ? "window" : "fetch",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        source: "fetch",
      };
    }
  }

  isDataCached(): boolean {
    // Check both module-level and instance cache
    return (
      (sharedIsLoaded && sharedCsvCache !== null) ||
      (this.isLoaded && this.csvData !== null)
    );
  }
  private static readonly CSV_FILES = {
    DIAMOND: "/data/pictographs/DiamondPictographDataframe.csv",
    BOX: "/data/pictographs/BoxPictographDataframe.csv",
    SKEWED: "/data/pictographs/SkewedPictographDataframe.csv",
    TRIGRID: "/data/pictographs/TrigridPictographDataframe.csv",
  } as const;

  private csvData: CsvDataSet | null = null;
  private isLoaded = false;

  /**
   * Loads CSV data with caching. Returns cached data on subsequent calls.
   * Attempts to load from window.csvData first, then falls back to static files.
   * Uses module-level cache to prevent duplicate fetches even across multiple instances.
   */
  async loadCsvData(): Promise<CsvDataSet> {
    // Check module-level cache first (shared across all instances)
    if (sharedIsLoaded && sharedCsvCache) {
      this.csvData = sharedCsvCache;
      this.isLoaded = true;
      return sharedCsvCache;
    }

    // Check instance cache (for singleton usage)
    if (this.isLoaded && this.csvData) {
      return this.csvData;
    }

    try {
      const data = await this.loadFromWindowOrFiles();

      // Update both module-level and instance caches
      sharedCsvCache = data;
      sharedIsLoaded = true;
      this.csvData = data;
      this.isLoaded = true;

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to load CSV data:", message);
      throw new Error(`CSV loading failed: ${message}`);
    }
  }

  /**
   * Returns cached CSV data or null if not yet loaded.
   */
  getCsvData(): CsvDataSet | null {
    // Return module-level cache if available (shared across instances)
    return sharedCsvCache || this.csvData;
  }

  /**
   * Clears cached data and loading state (both instance and module-level).
   */
  clearCache(): void {
    this.csvData = null;
    this.isLoaded = false;
    sharedCsvCache = null;
    sharedIsLoaded = false;
  }

  private async loadFromWindowOrFiles(): Promise<CsvDataSet> {
    if (this.isWindowDataAvailable()) {
      return window.csvData as CsvDataSet;
    }

    return this.loadFromStaticFiles();
  }

  private isWindowDataAvailable(): boolean {
    return window.csvData !== undefined && window.csvData !== null;
  }

  private async loadFromStaticFiles(): Promise<CsvDataSet> {
    const [diamondResponse, boxResponse, skewedResponse, trigridResponse] =
      await Promise.all([
        fetch(CsvLoader.CSV_FILES.DIAMOND),
        fetch(CsvLoader.CSV_FILES.BOX),
        fetch(CsvLoader.CSV_FILES.SKEWED).catch(() => null), // Optional - may not exist yet
        fetch(CsvLoader.CSV_FILES.TRIGRID).catch(() => null), // Optional - may not exist yet
      ]);

    this.validateResponses(diamondResponse, boxResponse);

    const [diamondData, boxData] = await Promise.all([
      diamondResponse.text(),
      boxResponse.text(),
    ]);

    // Load skewed data if available
    let skewedData: string | undefined;
    if (skewedResponse?.ok) {
      skewedData = await skewedResponse.text();
    }

    // Load trigrid data if available
    let trigridData: string | undefined;
    if (trigridResponse?.ok) {
      trigridData = await trigridResponse.text();
    }

    return {
      diamondData,
      boxData,
      skewedData,
      trigridData,
    };
  }

  private validateResponses(
    diamondResponse: Response,
    boxResponse: Response
  ): void {
    if (!diamondResponse.ok || !boxResponse.ok) {
      throw new Error(
        `HTTP error - Diamond: ${diamondResponse.status}, Box: ${boxResponse.status}`
      );
    }
  }
}

// Direct singleton export for HMR-friendly imports
export const csvLoader = new CsvLoader();
