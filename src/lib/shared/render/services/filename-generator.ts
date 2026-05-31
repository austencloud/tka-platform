/**
 * Filename Generator
 *
 * Generates appropriate filenames for exported sequences.
 */

import type { SequenceData } from "../../foundation/domain/models/sequence-data";
import type { SequenceExportOptions } from "../domain/models/sequence-export-options";

export interface FilenameOptions {
  includeDate?: boolean;
  includeTime?: boolean;
  includeFormat?: boolean;
  prefix?: string;
  suffix?: string;
  sanitize?: boolean;
}

export function generateFilename(
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

  if (prefix) {
    filename += prefix + "_";
  }

  const sequenceName = sequence.name || sequence.word || "sequence";
  filename += sequenceName;

  if (includeDate) {
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];
    filename += "_" + dateStr;
  }

  if (includeTime) {
    const date = new Date();
    const timeStr = (date.toTimeString().split(" ")[0] || "").replace(/:/g, "-");
    filename += "_" + timeStr;
  }

  if (suffix) {
    filename += "_" + suffix;
  }

  if (includeFormat) {
    const extension = options.format.toLowerCase();
    filename += "." + extension;
  }

  if (sanitize) {
    filename = sanitizeFilename(filename);
  }

  return filename;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

export function generateUniqueFilename(
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

export function validateFilename(filename: string): boolean {
  if (!filename || filename.trim().length === 0) {
    return false;
  }

  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(filename)) {
    return false;
  }

  if (filename.length > 255) {
    return false;
  }

  const reservedNames = [
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
  ];
  const nameWithoutExtension = filename.split(".")[0]?.toUpperCase() || "";
  if (reservedNames.includes(nameWithoutExtension)) {
    return false;
  }

  return true;
}
