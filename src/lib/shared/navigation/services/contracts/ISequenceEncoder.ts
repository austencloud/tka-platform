/**
 * Sequence Encoder Service Contract
 *
 * Handles encoding and decoding of sequences for URL sharing.
 * Compresses sequence data into ultra-compact URL-safe strings.
 *
 * Domain: Navigation - Sequence URL Encoding
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Result of encoding a sequence with compression
 */
export interface CompressionResult {
  encoded: string;
  compressed: boolean;
  originalLength: number;
  finalLength: number;
}

/**
 * Result of generating a share URL
 */
export interface ShareURLResult {
  url: string;
  length: number;
  compressed: boolean;
  savings: number;
}

/**
 * Result of parsing a deep link
 */
export interface DeepLinkParseResult {
  module: string;
  sequence: SequenceData;
}

/**
 * Service for encoding/decoding sequences for URL sharing
 */
export interface ISequenceEncoder {
  /**
   * Encode a sequence into compact URL string format
   * Format: "startPosition|step1|step2|step3..."
   */
  encode(sequence: SequenceData): string;

  /**
   * Decode a compact URL string into SequenceData
   * Handles both legacy and current formats
   */
  decode(encoded: string): SequenceData;

  /**
   * Encode sequence with optional LZString compression
   * Uses compression only if it results in shorter output
   */
  encodeWithCompression(sequence: SequenceData): CompressionResult;

  /**
   * Decode sequence, handling both compressed and uncompressed formats
   */
  decodeWithCompression(encoded: string): SequenceData;

  /**
   * Generate a shareable URL for a sequence in a specific module
   * @param sequence - The sequence data to encode
   * @param module - Target module: 'construct', 'animate', 'explore'
   * @param options - Encoding options (compress: boolean)
   */
  generateShareURL(
    sequence: SequenceData,
    module: string,
    options?: { compress?: boolean }
  ): ShareURLResult;

  /**
   * Parse a deep link URL and extract module + sequence data
   * Handles both compressed and uncompressed formats
   */
  parseDeepLink(url: string): DeepLinkParseResult | null;

  /**
   * Estimate URL length for a sequence
   * Useful for warning users about long URLs
   */
  estimateURLLength(
    sequence: SequenceData,
    module: string,
    compress?: boolean
  ): number;

  /**
   * Generate a standalone viewer URL for a sequence
   * Uses /sequence/{encodedSequence} format
   */
  generateViewerURL(
    sequence: SequenceData,
    options?: { compress?: boolean }
  ): ShareURLResult;
}
