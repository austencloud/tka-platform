/**
 * CSV Loader Service Interface
 *
 * Interface for CSV loading utilities.
 * Handles loading CSV files from various sources with caching support.
 */

import type { GridMode } from "../../../../pictograph/grid/domain/enums/grid-enums";

export interface ICSVLoader {
  loadCSVFile(filename: string): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    source: "fetch" | "window" | "cache";
  }>;
  loadCSVDataSet(): Promise<{
    success: boolean;
    data?: { diamondData: string; boxData: string; skewedData?: string };
    error?: string;
    sources: {
      diamond: "fetch" | "window" | "cache";
      box: "fetch" | "window" | "cache";
    };
  }>;
  loadCSVForGridMode(gridMode: GridMode): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    source: "fetch" | "window" | "cache";
  }>;
  clearCache(): void;
  isDataCached(): boolean;
}
