/**
 * CSV Parser Service Interface
 *
 * Interface for CSV parsing utilities.
 * Handles parsing, validation, and structure analysis of CSV data.
 */

import type {
  CSVParseResult,
  ParsedCsvRow,
} from "../../../../../features/create/generate/shared/domain/csv-handling/CsvModels";

export interface ICSVParser {
  parseCSV(csvText: string): CSVParseResult;
  parseCSVToRows(csvText: string): ParsedCsvRow[];
  validateCSVStructure(csvText: string): { isValid: boolean; errors: string[] };
  createRowFromValues(headers: string[], values: string[]): ParsedCsvRow;
}
