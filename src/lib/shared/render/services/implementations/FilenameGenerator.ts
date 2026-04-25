/**
 * Filename Generator Service
 *
 * Generates appropriate filenames for exported sequences.
 */

import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { SequenceExportOptions } from "../../domain/models/SequenceExportOptions";

import { getFilenameGenerator } from "$lib/shared/render/getFilenameGenerator";

export interface FilenameOptions {
  includeDate?: boolean;
  includeTime?: boolean;
  includeFormat?: boolean;
  prefix?: string;
  suffix?: string;
  sanitize?: boolean;
}

export interface IFilenameGenerator {
  generateFilename(
    sequence: SequenceData,
    options: SequenceExportOptions,
    filenameOptions?: FilenameOptions
  ): string;
  sanitizeFilename(filename: string): string;
  generateUniqueFilename(
    baseFilename: string,
    existingFilenames: string[]
  ): string;
  validateFilename(filename: string): boolean;
}

export class FilenameGenerator implements IFilenameGenerator {
  generateFilename(
    sequence: SequenceData,
    options: SequenceExportOptions,
    filenameOptions: FilenameOptions = {}
  ): string {
    const {
      includeDate = true,
      includeTime = false,
      includeFormat = true,
      prefix = "",
      suffix = "",
      sanitize = true,
    } = filenameOptions;

    let filename = "";

    // Add prefix
    if (prefix) {
      filename += prefix + "_";
    }

    // Add sequence name or default
    const sequenceName = sequence.name || sequence.word || "sequence";
    filename += sequenceName;

    // Add date if requested
    if (includeDate) {
      const date = new Date();
      const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
      filename += "_" + dateStr;
    }

    // Add time if requested
    if (includeTime) {
      const date = new Date();
      const timeStr = (date.toTimeString().split(" ")[0] || "").replace(
        /:/g,
        "-"
      ); // HH-MM-SS
      filename += "_" + timeStr;
    }

    // Add suffix
    if (suffix) {
      filename += "_" + suffix;
    }

    // Add format extension
    if (includeFormat) {
      const extension = options.format.toLowerCase();
      filename += "." + extension;
    }

    // Sanitize if requested
    if (sanitize) {
      filename = this.sanitizeFilename(filename);
    }

    return filename;
  }

  sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters
    return filename
      .replace(/[<>:"/\\|?*]/g, "_") // Replace invalid characters with underscore
      .replace(/\s+/g, "_") // Replace spaces with underscore
      .replace(/_+/g, "_") // Replace multiple underscores with single
      .replace(/^_|_$/g, "") // Remove leading/trailing underscores
      .toLowerCase(); // Convert to lowercase for consistency
  }

  generateUniqueFilename(
    baseFilename: string,
    existingFilenames: string[]
  ): string {
    if (!existingFilenames.includes(baseFilename)) {
      return baseFilename;
    }

    const extension = baseFilename.includes(".")
      ? "." + (baseFilename.split(".").pop() || "")
      : "";
    const nameWithoutExtension = baseFilename.replace(extension, "");

    let counter = 1;
    let uniqueFilename: string;

    do {
      uniqueFilename = `${nameWithoutExtension}_${counter}${extension}`;
      counter++;
    } while (existingFilenames.includes(uniqueFilename));

    return uniqueFilename;
  }

  validateFilename(filename: string): boolean {
    if (!filename || filename.trim().length === 0) {
      return false;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(filename)) {
      return false;
    }

    // Check length (most filesystems support up to 255 characters)
    if (filename.length > 255) {
      return false;
    }

    // Check for reserved names (Windows)
    const reservedNames = [
      "CON",
      "PRN",
      "AUX",
      "NUL",
      "COM1",
      "COM2",
      "COM3",
      "COM4",
      "COM5",
      "COM6",
      "COM7",
      "COM8",
      "COM9",
      "LPT1",
      "LPT2",
      "LPT3",
      "LPT4",
      "LPT5",
      "LPT6",
      "LPT7",
      "LPT8",
      "LPT9",
    ];
    const nameWithoutExtension = filename.split(".")[0]?.toUpperCase() || "";
    if (reservedNames.includes(nameWithoutExtension)) {
      return false;
    }

    return true;
  }
}

// DIRECT EXPORT - Use this instead of getFilenameGenerator()
// This avoids DI container rebuilds when this file changes
export const filenameGenerator = new FilenameGenerator();
