/**
 * PNG file parsing utilities for extracting sequence metadata
 * Copied from animator module to avoid path issues
 */

import type { SequenceData } from "../../../foundation/domain/models/SequenceData";

export interface PNGParseResult {
  success: boolean;
  data?: unknown[]; // Legacy array format from PNG files
  error?: string;
}

// PNG constants
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const METADATA_KEYWORD = "metadata";

export async function extractSequenceFromPNG(
  file: File
): Promise<PNGParseResult> {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const uint8Array = new Uint8Array(arrayBuffer);

    const metadata = parsePNGMetadata(uint8Array);
    if (metadata?.sequence) {
      // Transform the raw sequence data to ensure it has the expected format
      const transformedData = transformSequenceData(metadata.sequence);
      return {
        success: true,
        data: transformedData,
      };
    } else {
      return {
        success: false,
        error: "No sequence metadata found in PNG file",
      };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown error parsing PNG",
    };
  }
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result as ArrayBuffer;
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

interface PNGMetadata {
  sequence?: SequenceData;
  [key: string]: unknown;
}

function parsePNGMetadata(data: Uint8Array): PNGMetadata | null {
  // Verify PNG signature
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Invalid PNG file");
    }
  }

  let offset = 8; // Skip PNG signature

  while (offset < data.length) {
    // Read chunk length (4 bytes, big-endian)
    const length =
      (data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!;
    offset += 4;

    // Read chunk type (4 bytes)
    const type = String.fromCharCode(
      data[offset]!,
      data[offset + 1]!,
      data[offset + 2]!,
      data[offset + 3]!
    );
    offset += 4;

    if (type === "tEXt") {
      // Parse text chunk
      const textData = data.slice(offset, offset + length);
      const textString = new TextDecoder("latin1").decode(textData);
      const nullIndex = textString.indexOf("\0");

      if (nullIndex !== -1) {
        const keyword = textString.substring(0, nullIndex);
        const text = textString.substring(nullIndex + 1);

        if (keyword === METADATA_KEYWORD) {
          try {
            return JSON.parse(text);
          } catch {
            // Failed to parse metadata JSON
          }
        }
      }
    }

    // Skip chunk data and CRC (4 bytes)
    offset += length + 4;

    // Stop at IEND chunk
    if (type === "IEND") {
      break;
    }
  }

  return null;
}

/**
 * Transform raw sequence data from PNG to ensure it has the expected format
 */
function transformSequenceData(rawData: unknown): unknown[] {
  if (!Array.isArray(rawData)) {
    throw new Error("Sequence data must be an array");
  }

  if (rawData.length < 2) {
    throw new Error("Sequence must contain at least metadata and one step");
  }

  // First element is metadata - keep as is
  const metadata = rawData[0];

  // Transform remaining elements to ensure they have beat numbers
  const transformedSteps = rawData
    .slice(1)
    .map((step: Record<string, unknown>, index: number) => {
      // If step already has a beat property, use it
      if (typeof step["beat"] === "number") {
        return step;
      }

      // If step doesn't have a beat property, assign one based on position
      // Skip the first step if it's a start position (has sequence_start_position)
      const isStartPosition = step["sequence_start_position"] !== undefined;
      const stepNumber = isStartPosition ? 0 : index;

      return {
        ...step,
        beat: stepNumber,
      };
    });

  // ✅ FIXED: Return array format for legacy compatibility
  return [metadata, ...transformedSteps] as unknown[];
}
