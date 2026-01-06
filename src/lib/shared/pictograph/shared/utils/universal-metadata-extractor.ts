/**
 * Universal Metadata Extractor for TKA Sequences
 *
 * Bulletproof metadata extraction with automatic fallback strategy:
 * 1. Try WebP EXIF extraction first (optimal performance)
 * 2. Fallback to PNG tEXt extraction (backward compatibility)
 * 3. Report extraction source for optimization tracking
 * 4. Guarantee 100% metadata extraction success for valid files
 *
 * This extractor ensures no metadata is ever lost during the WebP transition
 * and provides a seamless upgrade path from PNG to WebP storage.
 */

import { PngMetadataExtractor } from "./png-metadata-extractor";
import { WebpMetadataExtractor } from "./webp-metadata-extractor";

export interface MetadataExtractionResult {
  sequenceName: string;
  beats: Record<string, unknown>[];
  sequenceLength: number;
  extractionSource: "webp" | "png";
  extractionTime: number; // milliseconds
  [key: string]: unknown;
}

export class UniversalMetadataExtractor {
  /**
   * Extract sequence metadata with bulletproof fallback strategy
   * @param sequenceName - Name of the sequence
   * @param basePath - Base path without extension (e.g., '/static/Explore/ABC/ABC_ver1')
   * @returns Promise<MetadataExtractionResult> - Complete metadata with extraction info
   */
  static async extractMetadata(
    sequenceName: string,
    basePath: string
  ): Promise<MetadataExtractionResult> {
    const startTime = Date.now();

    // Construct file paths
    const webpPath = `${basePath}.webp`;
    const pngPath = `${basePath}.png`;

    // Strategy 1: Try WebP extraction first (optimal)
    try {
      const webpMetadata = await WebpMetadataExtractor.extractCompleteMetadata(
        sequenceName,
        webpPath
      );

      const extractionTime = Date.now() - startTime;

      return {
        ...webpMetadata,
        extractionSource: "webp",
        extractionTime,
      };
    } catch (webpError) {
      console.log(
        `📝 WebP extraction failed for ${sequenceName}, trying PNG fallback...`
      );

      // Strategy 2: Fallback to PNG extraction
      try {
        const pngMetadata = await PngMetadataExtractor.extractCompleteMetadata(
          sequenceName,
          pngPath
        );

        const extractionTime = Date.now() - startTime;

        // Log fallback usage for optimization tracking
        console.warn(
          `⚠️  Using PNG fallback for ${sequenceName} - consider WebP migration`
        );

        // PNG metadata has different structure - extract what we need
        const sequence =
          (pngMetadata.sequence as Record<string, unknown>[]) || [];
        const beats = sequence.filter(
          (step: Record<string, unknown>) =>
            step["letter"] && !step["sequence_start_position"]
        );

        return {
          sequenceName,
          beats,
          sequenceLength: beats.length,
          extractionSource: "png",
          extractionTime,
          ...pngMetadata, // Include all other metadata fields
        };
      } catch (pngError) {
        // Both extraction methods failed
        const webpErrorMsg =
          webpError instanceof Error ? webpError.message : String(webpError);
        const pngErrorMsg =
          pngError instanceof Error ? pngError.message : String(pngError);

        console.error(
          `❌ Complete metadata extraction failure for ${sequenceName}:`
        );
        console.error(`   WebP error: ${webpErrorMsg}`);
        console.error(`   PNG error: ${pngErrorMsg}`);

        throw new Error(
          `Failed to extract metadata from both WebP and PNG files for ${sequenceName}. ` +
            `WebP: ${webpErrorMsg}. PNG: ${pngErrorMsg}`
        );
      }
    }
  }

  /**
   * Batch extract metadata for multiple sequences with progress tracking
   * @param sequences - Array of {sequenceName, basePath} objects
   * @param onProgress - Optional progress callback
   * @returns Promise<MetadataExtractionResult[]> - Array of extraction results
   */
  static async extractBatchMetadata(
    sequences: Array<{ sequenceName: string; basePath: string }>,
    onProgress?: (completed: number, total: number, current: string) => void
  ): Promise<MetadataExtractionResult[]> {
    const results: MetadataExtractionResult[] = [];
    const errors: Array<{ sequenceName: string; error: string }> = [];

    for (let i = 0; i < sequences.length; i++) {
      const { sequenceName, basePath } = sequences[i]!;

      try {
        onProgress?.(i, sequences.length, sequenceName);

        const result = await this.extractMetadata(sequenceName, basePath);
        results.push(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push({ sequenceName, error: errorMessage });
        console.error(
          `❌ Batch extraction failed for ${sequenceName}:`,
          errorMessage
        );
      }
    }

    onProgress?.(sequences.length, sequences.length, "Complete");

    if (errors.length > 0) {
      console.warn(
        `⚠️  Batch extraction completed with ${errors.length} errors out of ${sequences.length} sequences`
      );
      errors.forEach(({ sequenceName, error }) => {
        console.warn(`   ${sequenceName}: ${error}`);
      });
    }

    return results;
  }

  /**
   * Check which file format is available for a sequence
   * @param basePath - Base path without extension
   * @returns Promise<{webp: boolean, png: boolean}> - File availability
   */
  static async checkFileAvailability(basePath: string): Promise<{
    webp: boolean;
    png: boolean;
    preferredPath: string;
    preferredFormat: "webp" | "png" | "none";
  }> {
    const webpPath = `${basePath}.webp`;
    const pngPath = `${basePath}.png`;

    const [webpExists, pngExists] = await Promise.all([
      this.fileExists(webpPath),
      this.fileExists(pngPath),
    ]);

    // Determine preferred format (WebP if available, otherwise PNG)
    let preferredFormat: "webp" | "png" | "none";
    let preferredPath: string;

    if (webpExists) {
      preferredFormat = "webp";
      preferredPath = webpPath;
    } else if (pngExists) {
      preferredFormat = "png";
      preferredPath = pngPath;
    } else {
      preferredFormat = "none";
      preferredPath = "";
    }

    return {
      webp: webpExists,
      png: pngExists,
      preferredPath,
      preferredFormat,
    };
  }

  /**
   * Get extraction statistics for optimization tracking
   * @param results - Array of extraction results
   * @returns Extraction statistics
   */
  static getExtractionStats(results: MetadataExtractionResult[]): {
    totalExtractions: number;
    webpExtractions: number;
    pngExtractions: number;
    webpPercentage: number;
    averageWebpTime: number;
    averagePngTime: number;
    optimizationOpportunities: number;
  } {
    const webpResults = results.filter((r) => r.extractionSource === "webp");
    const pngResults = results.filter((r) => r.extractionSource === "png");

    const averageWebpTime =
      webpResults.length > 0
        ? webpResults.reduce((sum, r) => sum + r.extractionTime, 0) /
          webpResults.length
        : 0;

    const averagePngTime =
      pngResults.length > 0
        ? pngResults.reduce((sum, r) => sum + r.extractionTime, 0) /
          pngResults.length
        : 0;

    return {
      totalExtractions: results.length,
      webpExtractions: webpResults.length,
      pngExtractions: pngResults.length,
      webpPercentage:
        results.length > 0 ? (webpResults.length / results.length) * 100 : 0,
      averageWebpTime,
      averagePngTime,
      optimizationOpportunities: pngResults.length, // PNG fallbacks = optimization opportunities
    };
  }

  /**
   * Utility method to check if a file exists and is accessible
   */
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      const response = await fetch(filePath, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Simple interface matching the original extractors for drop-in replacement
   * @param sequenceName - Name of the sequence
   * @param preferredPath - Preferred file path (WebP or PNG)
   * @returns Promise with original interface format
   */
  static async extractCompleteMetadata(
    sequenceName: string,
    preferredPath: string
  ): Promise<{
    sequenceName: string;
    beats: Record<string, unknown>[];
    sequenceLength: number;
    [key: string]: unknown;
  }> {
    // Determine base path from preferred path
    const basePath = preferredPath.replace(/\.(webp|png)$/i, "");

    const result = await this.extractMetadata(sequenceName, basePath);

    // Return in original format (without extraction metadata)
     
    const {
      extractionSource: _extractionSource,
      extractionTime: _extractionTime,
      ...originalFormat
    } = result;
    return originalFormat;
  }

  /**
   * Validate metadata integrity between WebP and PNG versions
   * @param sequenceName - Name of the sequence
   * @param basePath - Base path without extension
   * @returns Promise<boolean> - True if metadata matches between formats
   */
  static async validateMetadataIntegrity(
    sequenceName: string,
    basePath: string
  ): Promise<{
    isValid: boolean;
    webpExists: boolean;
    pngExists: boolean;
    metadataMatches: boolean;
    differences?: string[];
  }> {
    const webpPath = `${basePath}.webp`;
    const pngPath = `${basePath}.png`;

    try {
      // Check file availability
      const availability = await this.checkFileAvailability(basePath);

      if (!availability.webp || !availability.png) {
        return {
          isValid: true, // No comparison needed if only one format exists
          webpExists: availability.webp,
          pngExists: availability.png,
          metadataMatches: true,
        };
      }

      // Extract from both formats
      const [webpMetadata, pngMetadata] = await Promise.all([
        WebpMetadataExtractor.extractCompleteMetadata(sequenceName, webpPath),
        PngMetadataExtractor.extractCompleteMetadata(sequenceName, pngPath),
      ]);

      // Compare critical fields - handle different structures
      const differences: string[] = [];

      // Extract PNG beats from sequence structure
      const pngSequence =
        (pngMetadata.sequence as Record<string, unknown>[]) || [];
      const pngBeats = pngSequence.filter(
        (step: Record<string, unknown>) =>
          step["letter"] && !step["sequence_start_position"]
      );

      if (webpMetadata.sequenceLength !== pngBeats.length) {
        differences.push(
          `sequenceLength: WebP=${webpMetadata.sequenceLength}, PNG=${pngBeats.length}`
        );
      }

      if (webpMetadata.beats.length !== pngBeats.length) {
        differences.push(
          `beats.length: WebP=${webpMetadata.beats.length}, PNG=${pngBeats.length}`
        );
      }

      // Deep comparison of beats array
      const webpBeatsJson = JSON.stringify(webpMetadata.beats);
      const pngBeatsJson = JSON.stringify(pngBeats);

      if (webpBeatsJson !== pngBeatsJson) {
        differences.push("beats content differs");
      }

      return {
        isValid: differences.length === 0,
        webpExists: true,
        pngExists: true,
        metadataMatches: differences.length === 0,
        ...(differences.length > 0 ? { differences } : {}),
      };
    } catch (error) {
      return {
        isValid: false,
        webpExists: await this.fileExists(webpPath),
        pngExists: await this.fileExists(pngPath),
        metadataMatches: false,
        differences: [
          `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }
}
