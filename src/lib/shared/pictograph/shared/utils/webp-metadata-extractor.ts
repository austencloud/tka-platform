/**
 * WebP Metadata Extractor for TKA Sequences
 *
 * Extracts sequence metadata from WebP EXIF chunks.
 * WebP files store metadata in EXIF format (like JPEG) instead of tEXt chunks (like PNG).
 *
 * This class reads the JSON sequence metadata that was migrated from PNG tEXt chunks
 * to WebP EXIF UserComment field for optimal file size and compatibility.
 */

export class WebpMetadataExtractor {
  /**
   * Extract complete JSON metadata from a WebP file's EXIF data
   * @param filePath - Path to the WebP file (relative to static directory)
   * @returns Promise<Record<string, unknown>[]> - The complete sequence metadata as JSON array
   */
  static async extractMetadata(
    filePath: string
  ): Promise<Record<string, unknown>[]> {
    try {
      // Fetch the WebP file
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch WebP file: ${response.status} ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Extract EXIF data from WebP
      const exifData = this.extractExifFromWebP(uint8Array);
      if (!exifData) {
        throw new Error("No EXIF data found in WebP file");
      }

      // Find UserComment field containing JSON metadata
      const metadataJson = this.extractUserComment(exifData);
      if (!metadataJson) {
        throw new Error("No sequence metadata found in WebP EXIF UserComment");
      }

      // Parse and return the complete metadata structure
      const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
      const sequence = parsed["sequence"] as
        | Record<string, unknown>[]
        | undefined;
      return sequence ?? [parsed];
    } catch (error) {
      console.error("Error extracting WebP metadata:", error);
      throw error;
    }
  }

  /**
   * Extract EXIF chunk from WebP file
   * WebP structure: RIFF header + WEBP + VP8/VP8L/VP8X chunks + optional EXIF chunk
   */
  private static extractExifFromWebP(data: Uint8Array): Uint8Array | null {
    let offset = 0;

    // Check WebP signature
    if (this.readString(data, offset, 4) !== "RIFF") return null;
    offset += 4;

    // Skip file size
    offset += 4;

    // Check WebP format
    if (this.readString(data, offset, 4) !== "WEBP") return null;
    offset += 4;

    // Search for EXIF chunk
    while (offset < data.length - 8) {
      const chunkType = this.readString(data, offset, 4);
      offset += 4;

      const chunkSize = this.readUint32LE(data, offset);
      offset += 4;

      if (chunkType === "EXIF") {
        // Found EXIF chunk - return the data
        return data.slice(offset, offset + chunkSize);
      }

      // Skip to next chunk (with padding)
      offset += chunkSize;
      if (chunkSize % 2 === 1) offset++; // WebP chunks are word-aligned
    }

    return null;
  }

  /**
   * Extract UserComment field from EXIF data containing JSON metadata
   */
  private static extractUserComment(exifData: Uint8Array): string | null {
    try {
      let offset = 0;

      // Skip EXIF header if present ("Exif\0\0")
      if (this.readString(exifData, offset, 4) === "Exif") {
        offset += 6; // Skip "Exif\0\0"
      }

      // Check TIFF header (II or MM for little/big endian)
      const endian = this.readString(exifData, offset, 2);
      const isLittleEndian = endian === "II";
      offset += 2;

      // Check TIFF magic number (42)
      const magic = isLittleEndian
        ? this.readUint16LE(exifData, offset)
        : this.readUint16BE(exifData, offset);
      if (magic !== 42) return null;
      offset += 2;

      // Get IFD0 offset
      const ifd0Offset = isLittleEndian
        ? this.readUint32LE(exifData, offset)
        : this.readUint32BE(exifData, offset);

      // Try parsing IFD0 for UserComment (tag 0x9286)
      const ifdResult = this.parseIFDForUserComment(
        exifData,
        offset + 4 + ifd0Offset,
        isLittleEndian
      );
      if (ifdResult) {
        return ifdResult;
      }

      // Fallback: Some EXIF data has JSON directly embedded, search for it
      const jsonSearch = new TextDecoder("utf-8").decode(exifData);
      const jsonIndex = jsonSearch.indexOf("{");
      if (jsonIndex >= 0) {
        const jsonEnd = jsonSearch.lastIndexOf("}") + 1;
        if (jsonEnd > jsonIndex) {
          const jsonString = jsonSearch.substring(jsonIndex, jsonEnd);
          // Validate it's actually JSON
          try {
            JSON.parse(jsonString);
            return jsonString;
          } catch {
            // Not valid JSON, continue
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error parsing EXIF data:", error);
      return null;
    }
  }

  /**
   * Parse Image File Directory (IFD) looking for UserComment tag
   */
  private static parseIFDForUserComment(
    data: Uint8Array,
    ifdOffset: number,
    isLittleEndian: boolean
  ): string | null {
    if (ifdOffset >= data.length - 2) return null;

    // Number of directory entries
    const entryCount = isLittleEndian
      ? this.readUint16LE(data, ifdOffset)
      : this.readUint16BE(data, ifdOffset);

    let offset = ifdOffset + 2;

    // Search through IFD entries
    for (let i = 0; i < entryCount; i++) {
      if (offset + 12 > data.length) break;

      const tag = isLittleEndian
        ? this.readUint16LE(data, offset)
        : this.readUint16BE(data, offset);

      const type = isLittleEndian
        ? this.readUint16LE(data, offset + 2)
        : this.readUint16BE(data, offset + 2);

      const count = isLittleEndian
        ? this.readUint32LE(data, offset + 4)
        : this.readUint32BE(data, offset + 4);

      const valueOffset = isLittleEndian
        ? this.readUint32LE(data, offset + 8)
        : this.readUint32BE(data, offset + 8);

      // UserComment tag (0x9286)
      if (tag === 0x9286) {
        // Type should be UNDEFINED (7)
        if (type === 7) {
          let dataOffset = valueOffset;

          // If data fits in 4 bytes, it's stored in the value field
          if (count <= 4) {
            dataOffset = offset + 8;
          }

          if (dataOffset + count <= data.length) {
            // Get the raw UserComment data
            const commentData = data.slice(dataOffset, dataOffset + count);

            // UserComment format: 8-byte character code + actual comment
            // Look for JSON start marker '{' to handle any character code format
            let jsonStart = -1;
            for (let i = 0; i < commentData.length; i++) {
              if (commentData[i] === 0x7b) {
                // '{' character
                jsonStart = i;
                break;
              }
            }

            if (jsonStart >= 0) {
              const jsonData = commentData.slice(jsonStart);
              return new TextDecoder("utf-8").decode(jsonData);
            }

            // Fallback: try skipping standard 8-byte character code
            if (count > 8) {
              const commentStart = 8;
              const fallbackData = commentData.slice(commentStart);
              return new TextDecoder("utf-8").decode(fallbackData);
            }
          }
        }
      }

      offset += 12; // Each IFD entry is 12 bytes
    }

    // Check for EXIF sub-IFD (tag 0x8769)
    offset = ifdOffset + 2;
    for (let i = 0; i < entryCount; i++) {
      if (offset + 12 > data.length) break;

      const tag = isLittleEndian
        ? this.readUint16LE(data, offset)
        : this.readUint16BE(data, offset);

      if (tag === 0x8769) {
        // EXIF IFD
        const exifIfdOffset = isLittleEndian
          ? this.readUint32LE(data, offset + 8)
          : this.readUint32BE(data, offset + 8);

        return this.parseIFDForUserComment(data, exifIfdOffset, isLittleEndian);
      }

      offset += 12;
    }

    return null;
  }

  /**
   * Utility methods for reading binary data
   */
  private static readString(
    data: Uint8Array,
    offset: number,
    length: number
  ): string {
    return new TextDecoder("ascii").decode(data.slice(offset, offset + length));
  }

  private static readUint16LE(data: Uint8Array, offset: number): number {
    return data[offset]! | (data[offset + 1]! << 8);
  }

  private static readUint16BE(data: Uint8Array, offset: number): number {
    return (data[offset]! << 8) | data[offset + 1]!;
  }

  private static readUint32LE(data: Uint8Array, offset: number): number {
    return (
      data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)
    );
  }

  private static readUint32BE(data: Uint8Array, offset: number): number {
    return (
      (data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!
    );
  }

  /**
   * Quick method to extract metadata with complete sequence information
   * Includes the same interface as PngMetadataExtractor for drop-in replacement
   */
  static async extractCompleteMetadata(
    sequenceName: string,
    webpPath: string
  ): Promise<{
    sequenceName: string;
    steps: Record<string, unknown>[];
    sequenceLength: number;
    [key: string]: unknown;
  }> {
    try {
      const metadata = await this.extractMetadata(webpPath);
      const firstMetadata = metadata[0];

      if (!firstMetadata) {
        return {
          sequenceName,
          steps: [],
          sequenceLength: 0,
        };
      }

      const steps = firstMetadata["steps"] as
        | Record<string, unknown>[]
        | undefined;
      const sequenceLength = firstMetadata["sequenceLength"] as
        | number
        | undefined;

      return {
        sequenceName,
        steps: steps ?? [],
        sequenceLength: sequenceLength ?? 0,
        ...firstMetadata, // Include all other metadata fields
      };
    } catch (error) {
      console.error(
        `Failed to extract WebP metadata for ${sequenceName}:`,
        error
      );
      throw error;
    }
  }
}
