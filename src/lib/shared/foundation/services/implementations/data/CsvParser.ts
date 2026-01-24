/**
 * CSV Parser Service Implementation
 *
 * Provides consistent CSV parsing functionality used across all data services.
 * Handles line splitting, header extraction, and row parsing with error handling.
 */

import type {
  CSVParseResult as CsvParseResult,
  ParsedCsvRow,
} from "$lib/features/create/generate/shared/domain/csv-handling/CsvModels";
// import type { ICSVParser } from "../../contracts";

// Temporary interface definition
interface ICSVParser {
  parse(csvContent: string): Record<string, unknown>[];
  parseRow(row: string): string[];
}

interface CsvParseError {
  error: string;
  rowIndex?: number;
  rawRow: string;
  lineNumber: number;
}

export class CSVParser implements ICSVParser {
  // Interface methods (delegates to existing methods)
  parse(csvContent: string): Record<string, unknown>[] {
    const result = this.parseCSV(csvContent);
    return result.rows;
  }

  parseRow(row: string): string[] {
    // Simple row parsing - split by comma and trim
    return row.split(",").map((cell) => cell.trim());
  }

  /**
   * Parse CSV text into structured result with detailed error reporting
   */
  parseCSV(csvText: string): CsvParseResult {
    const result: CsvParseResult = {
      headers: [],
      rows: [],
      totalRows: 0,
      successfulRows: 0,
      errors: [],
      isValid: true,
    };

    try {
      const lines = csvText.trim().split("\n");

      if (lines.length < 2) {
        result.errors.push({
          rowIndex: 0,
          lineNumber: 0,
          error: "CSV must have at least header and one data row",
          rawRow: csvText,
        });
        return result;
      }

      // Parse headers
      const headerLine = lines[0];
      if (!headerLine) {
        result.errors.push({
          rowIndex: 0,
          lineNumber: 0,
          error: "Missing header line",
          rawRow: "",
        });
        return result;
      }
      result.headers = headerLine.split(",").map((h) => h.trim());
      result.totalRows = lines.length - 1; // Exclude header

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        try {
          const line = lines[i]?.trim();
          if (!line) {
            continue;
          }

          // Skip completely empty lines
          if (!line || line === "") {
            continue;
          }

          const values = line.split(",").map((v) => v.trim());

          // Skip rows that are just commas (empty CSV cells)
          if (values.every((v) => v === "")) {
            continue;
          }

          const row = this.createRowFromValues(result.headers, values);

          if (this.isValidRow(row)) {
            result.rows.push(row);
            result.successfulRows++;
          } else {
            result.errors.push({
              rowIndex: i,
              lineNumber: i,
              error: "Row validation failed - missing required fields",
              rawRow: lines[i] ?? "",
            });
          }
        } catch (error) {
          result.errors.push({
            rowIndex: i,
            lineNumber: i,
            error:
              error instanceof Error ? error.message : "Unknown parsing error",
            rawRow: lines[i] ?? "",
          });
        }
      }

      return result;
    } catch (error) {
      result.errors.push({
        rowIndex: 0,
        lineNumber: 0,
        error: `CSV parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        rawRow: csvText.substring(0, 100) + "...",
      });
      return result;
    }
  }

  /**
   * Simple CSV parsing that returns only successful rows (legacy compatibility)
   */
  parseCSVToRows(csvText: string): ParsedCsvRow[] {
    const result = this.parseCSV(csvText);

    if (result.errors.length > 0) {
      console.warn(
        `⚠️ CSV parsing had ${result.errors.length} errors out of ${result.totalRows} rows`
      );
      result.errors.forEach((error: CsvParseError) => {
        console.warn(`⚠️ Row ${error.rowIndex}: ${error.error}`);
      });
    }

    return result.rows;
  }

  /**
   * Validate CSV structure before parsing
   */
  validateCSVStructure(csvText: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!csvText || csvText.trim().length === 0) {
      errors.push("CSV text is empty");
      return { isValid: false, errors };
    }

    const lines = csvText.trim().split("\n");

    if (lines.length < 2) {
      errors.push("CSV must have at least a header row and one data row");
      return { isValid: false, errors };
    }

    // Check header structure
    const headerLine = lines[0];
    if (!headerLine) {
      errors.push("Missing header line");
      return { isValid: false, errors };
    }
    const headers = headerLine.split(",").map((h) => h.trim());
    const requiredHeaders = ["letter", "startPosition", "endPosition"];

    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        errors.push(`Missing required header: ${required}`);
      }
    }

    // Check for consistent column count
    const headerCount = headers.length;
    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      // Check first 10 rows
      const line = lines[i];
      if (!line) continue;
      const columnCount = line.split(",").length;
      if (columnCount !== headerCount) {
        errors.push(
          `Row ${i} has ${columnCount} columns, expected ${headerCount}`
        );
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Create a ParsedCsvRow from headers and values
   */
  createRowFromValues(headers: string[], values: string[]): ParsedCsvRow {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    // Ensure required fields exist with defaults
    return {
      letter: row["letter"] || "",
      startPosition: row["startPosition"] || "",
      endPosition: row["endPosition"] || "",
      timing: row["timing"] || "",
      direction: row["direction"] || "",
      blueMotionType: row["blueMotionType"] || "",
      blueRotationDirection: row["blueRotationDirection"] || "",
      blueStartLocation: row["blueStartLocation"] || row["blueStartLoc"] || "", // Handle variations
      blueEndLocation: row["blueEndLocation"] || row["blueEndLocation"] || "", // Handle variations
      redMotionType: row["redMotionType"] || "",
      redRotationDirection: row["redRotationDirection"] || "",
      redStartLocation: row["redStartLocation"] || row["redStartLoc"] || "", // Handle variations
      redEndLocation: row["redEndLocation"] || row["redEndLocation"] || "", // Handle variations
      ...row, // Include all other fields
    } as ParsedCsvRow;
  }

  /**
   * Validate that a row has required fields
   */
  private isValidRow(row: ParsedCsvRow): boolean {
    // Check that required fields exist and are not empty strings
    const hasLetter = !!(row["letter"] && row["letter"].trim() !== "");
    const hasStartPosition = !!(
      row["startPosition"] && row["startPosition"].trim() !== ""
    );
    const hasEndPosition = !!(
      row["endPosition"] && row["endPosition"].trim() !== ""
    );

    return hasLetter && hasStartPosition && hasEndPosition;
  }

  /**
   * Get column mapping for different CSV formats (if needed)
   */
  getColumnMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    // Handle common variations in column names
    const variations: Record<string, string[]> = {
      blueStartLocation: [
        "blueStartLocation",
        "blueStartLoc",
        "blue_start_location",
      ],
      blueEndLocation: [
        "blueEndLocation",
        "blueEndLocation",
        "blue_end_location",
      ],
      redStartLocation: [
        "redStartLocation",
        "redStartLoc",
        "red_start_location",
      ],
      redEndLocation: ["redEndLocation", "redEndLocation", "red_end_location"],
    };

    for (const [standardName, variants] of Object.entries(variations)) {
      for (const variant of variants) {
        if (headers.includes(variant)) {
          mapping[standardName] = variant;
          break;
        }
      }
    }

    return mapping;
  }
}

// Direct singleton export for HMR-friendly imports
export const csvParser = new CSVParser();
