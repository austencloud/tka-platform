/**
 * Unified PNG Metadata Extractor for TKA Sequences
 *
 * This class extracts ALL sequence metadata from the unified JSON structure
 * stored in the "metadata" tEXt chunk of PNG files. This includes:
 * - Sequence information (author, level, start position, etc.)
 * - Beat data (letters, motion types, attributes)
 * - All other metadata fields
 *
 * We use ONE consistent system - JSON metadata only.
 * No separate tEXt chunks for individual fields.
 */

export class PngMetadataExtractor {
  /**
   * Extract complete JSON metadata from a PNG file
   * @param filePath - Path to the PNG file (relative to static directory)
   * @returns Promise<Record<string, unknown>[]> - The complete sequence metadata as JSON array
   */
  static async extractMetadata(
    filePath: string
  ): Promise<Record<string, unknown>[]> {
    try {
      // Fetch the PNG file
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch PNG file: ${response.status} ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Extract the unified JSON metadata from the "metadata" tEXt chunk
      const metadataJson = this.findTextChunk(uint8Array, "metadata");

      if (!metadataJson) {
        throw new Error("No unified JSON metadata found in PNG file");
      }

      // Parse and return the complete metadata structure
      const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
      const sequence = parsed["sequence"] as
        | Record<string, unknown>[]
        | undefined;
      return sequence ?? [parsed];
    } catch (error) {
      console.error("Error extracting PNG metadata:", error);
      throw error;
    }
  }

  /**
   * Find the unified JSON metadata tEXt chunk in PNG data
   *
   * We only look for the "metadata" keyword which contains the complete
   * JSON structure with all sequence information. This is our single
   * source of truth for all metadata fields.
   *
   * @param data - PNG file data as Uint8Array
   * @param keyword - Should always be "metadata" for TKA sequences
   * @returns string | null - The JSON metadata string or null if not found
   */
  private static findTextChunk(
    data: Uint8Array,
    keyword: string
  ): string | null {
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

      // If this is a tEXt chunk, check if it contains our keyword
      if (type === "tEXt") {
        const chunkData = data.slice(offset, offset + length);
        const text = new TextDecoder("latin1").decode(chunkData);

        // Find the null separator between keyword and text
        const nullIndex = text.indexOf("\0");
        if (nullIndex !== -1) {
          const chunkKeyword = text.substring(0, nullIndex);
          if (chunkKeyword === keyword) {
            return text.substring(nullIndex + 1);
          }
        }
      }

      // Skip chunk data and CRC (4 bytes)
      offset += length + 4;
    }

    return null;
  }

  /**
   * Extract metadata for a specific sequence by name
   * @param sequenceName - Name of the sequence (e.g., "DKIIEJII")
   * @returns Promise<Record<string, unknown>[]> - The extracted metadata
   */
  static async extractSequenceMetadata(
    sequenceName: string
  ): Promise<Record<string, unknown>[]> {
    // URL-encode the sequence name for proper file path construction
    const encodedSequenceName = encodeURIComponent(sequenceName);

    // Try .meta.json sidecar files first (new system)
    const versionsToTry = [2, 1, 3];
    for (const version of versionsToTry) {
      const jsonPath = `/gallery/${encodedSequenceName}/${encodedSequenceName}_ver${version}.meta.json`;
      try {
        const response = await fetch(jsonPath);
        if (response.ok) {
          const jsonData = (await response.json()) as Record<string, unknown>;
          // Extract sequence array from the sidecar JSON structure
          const metadata = jsonData["metadata"] as
            | Record<string, unknown>
            | undefined;
          const metadataSequence = metadata?.["sequence"] as
            | Record<string, unknown>[]
            | undefined;
          const directSequence = jsonData["sequence"] as
            | Record<string, unknown>[]
            | undefined;
          return metadataSequence ?? directSequence ?? [];
        }
      } catch {
        // Continue to next version
        continue;
      }
    }

    // Fallback to PNG extraction (legacy system)
    const filePathV1 = `/gallery/${encodedSequenceName}/${encodedSequenceName}_ver1.png`;
    const filePathV2 = `/gallery/${encodedSequenceName}/${encodedSequenceName}_ver2.png`;

    try {
      return await this.extractMetadata(filePathV1);
    } catch {
      // Try version 2 if version 1 doesn't exist
      return this.extractMetadata(filePathV2);
    }
  }

  /**
   * Extract complete metadata structure for a specific sequence by name
   * @param sequenceName - Name of the sequence (e.g., "DKIIEJII")
   * @param thumbnailPath - Optional thumbnail path from sequence index to determine version
   * @returns Promise<{sequence: Record<string, unknown>[], date_added?: string, is_favorite?: boolean}> - The complete metadata structure
   */
  static async extractCompleteMetadata(
    sequenceName: string,
    thumbnailPath?: string
  ): Promise<{
    sequence: Record<string, unknown>[];
    date_added?: string;
    is_favorite?: boolean;
  }> {
    // URL-encode the sequence name for proper file path construction
    const encodedSequenceName = encodeURIComponent(sequenceName);

    // Try .meta.json sidecar files first (new system)
    // If we have thumbnail path, extract the version from it
    if (thumbnailPath) {
      const versionMatch = thumbnailPath.match(/_ver(\d+)\.webp$/);
      if (versionMatch) {
        const version = versionMatch[1];
        const jsonPath = `/gallery/${encodedSequenceName}/${encodedSequenceName}_ver${version}.meta.json`;
        try {
          const response = await fetch(jsonPath);
          if (response.ok) {
            const jsonData = (await response.json()) as Record<string, unknown>;
            const metadata = jsonData["metadata"] as
              | {
                  sequence: Record<string, unknown>[];
                  date_added?: string;
                  is_favorite?: boolean;
                }
              | undefined;
            return (
              metadata ??
              (jsonData as {
                sequence: Record<string, unknown>[];
                date_added?: string;
                is_favorite?: boolean;
              })
            );
          }
        } catch {
          // Fall back to version guessing if the specific version fails
        }
      }
    }

    // Try common versions for .meta.json files
    const versionsToTry = [2, 1, 3]; // Most sequences are ver2, some are ver1, rarely ver3+
    for (const version of versionsToTry) {
      const jsonPath = `/gallery/${encodedSequenceName}/${encodedSequenceName}_ver${version}.meta.json`;
      try {
        const response = await fetch(jsonPath);
        if (response.ok) {
          const jsonData = (await response.json()) as Record<string, unknown>;
          const metadata = jsonData["metadata"] as
            | {
                sequence: Record<string, unknown>[];
                date_added?: string;
                is_favorite?: boolean;
              }
            | undefined;
          return (
            metadata ??
            (jsonData as {
              sequence: Record<string, unknown>[];
              date_added?: string;
              is_favorite?: boolean;
            })
          );
        }
      } catch {
        // Continue to next version silently
        continue;
      }
    }

    // Fallback to PNG extraction (legacy system)
    let response: Response | null = null;

    // Try PNG files if .meta.json not found
    if (thumbnailPath) {
      const versionMatch = thumbnailPath.match(/_ver(\d+)\.webp$/);
      if (versionMatch) {
        const version = versionMatch[1];
        const filePath = `/gallery/${encodedSequenceName}/${encodedSequenceName}_ver${version}.png`;
        try {
          response = await fetch(filePath);
          if (!response.ok) response = null;
        } catch {
          // Continue to try other versions
        }
      }
    }

    // If we still don't have a response, try common versions for PNG
    if (!response?.ok) {
      for (const version of versionsToTry) {
        const filePath = `/gallery/${encodedSequenceName}/${encodedSequenceName}_ver${version}.png`;
        try {
          response = await fetch(filePath);
          if (response.ok) {
            break;
          }
        } catch {
          // Continue to next version silently
          continue;
        }
      }
    }

    if (!response?.ok) {
      throw new Error(
        `Failed to fetch metadata for ${sequenceName}: No valid version found (tried both .meta.json and .png)`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Extract the unified JSON metadata from the "metadata" tEXt chunk
    const metadataJson = this.findTextChunk(uint8Array, "metadata");

    if (!metadataJson) {
      throw new Error(
        `PNG file exists but contains no metadata tEXt chunk. File may have been created without sequence data.`
      );
    }

    // Parse and return the COMPLETE metadata structure (including top-level fields)
    return JSON.parse(metadataJson) as {
      sequence: Record<string, unknown>[];
      date_added?: string;
      is_favorite?: boolean;
    };
  }

  /**
   * Debug method to display complete unified metadata for a sequence
   *
   * This shows the entire JSON metadata structure including:
   * - Author, level, start position (from first entry)
   * - All beat data with motion types and attributes
   * - Any other fields in the unified metadata
   *
   * @param sequenceName - Name of the sequence to analyze
   */
  static async debugSequenceMetadata(sequenceName: string): Promise<void> {
    try {
      console.log(
        `🔍 [UNIFIED METADATA] Extracting complete metadata for ${sequenceName}...`
      );
      const metadata = await this.extractSequenceMetadata(sequenceName);

      console.log(
        `📋 [UNIFIED METADATA] Complete JSON structure for ${sequenceName}:`
      );
      console.log(JSON.stringify(metadata, null, 2));

      // Show author and start position from the unified structure
      const firstEntry = metadata[0] ?? {};
      const startPositionEntries = metadata.filter(
        (step: Record<string, unknown>) => step["sequence_start_position"]
      );

      const author = String(firstEntry["author"] ?? "MISSING");
      const startPosition = String(
        startPositionEntries[0]?.["sequence_start_position"] ?? "MISSING"
      );
      const level = String(firstEntry["level"] ?? "MISSING");

      console.log(`👤 [UNIFIED METADATA] Author: ${author}`);
      console.log(`📍 [UNIFIED METADATA] Start Position: ${startPosition}`);
      console.log(`📊 [UNIFIED METADATA] Level: ${level}`);

      // Extract motion types for each beat
      console.log(`🎯 [UNIFIED METADATA] Motion types for ${sequenceName}:`);
      const realBeats = metadata
        .slice(1)
        .filter(
          (step: Record<string, unknown>) =>
            step["letter"] && !step["sequence_start_position"]
        );
      realBeats.forEach((step: Record<string, unknown>, index: number) => {
        const blueAttrs = step["blueAttributes"] as
          | Record<string, unknown>
          | undefined;
        const redAttrs = step["redAttributes"] as
          | Record<string, unknown>
          | undefined;
        const blueMotion = String(blueAttrs?.["motionType"] ?? "unknown");
        const redMotion = String(redAttrs?.["motionType"] ?? "unknown");
        const letter = String(step["letter"] ?? "?");
        console.log(
          `  Beat ${index + 1} (${letter}): blue=${blueMotion}, red=${redMotion}`
        );
      });
    } catch (error) {
      console.error(
        `❌ [UNIFIED METADATA] Failed to extract metadata for ${sequenceName}:`,
        error
      );
    }
  }
}

// Extend Window interface for debug function
declare global {
  interface Window {
    extractPngMetadata?: typeof PngMetadataExtractor.debugSequenceMetadata;
  }
}

// Global utility function for easy debugging of unified metadata (browser only)
if (typeof window !== "undefined") {
  window.extractPngMetadata = (sequenceName: string) =>
    PngMetadataExtractor.debugSequenceMetadata(sequenceName);
}
