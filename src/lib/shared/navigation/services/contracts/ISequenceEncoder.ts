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
 * Optional metadata to encode in share URL searchParams.
 * These are human-readable and don't affect the motion encoding.
 */
export interface ShareURLMetadata {
  /** Creator display name */
  creator?: string;
  /** Notes/tagline text */
  notes?: string;
  /** The intended word */
  word?: string;
  /** Dark mode preference (true/false) */
  darkMode?: boolean;
  /** Difficulty level string */
  difficulty?: string;
  /** Creation date as compact YYYYMMDD string */
  birthday?: string;
  /** BPM value */
  bpm?: number;
  /** Blue prop type (encoded as short string) */
  bluePropType?: string;
  /** Red prop type (encoded as short string) */
  redPropType?: string;
}

/**
 * Prop types parsed from URL params
 */
export interface URLPropOptions {
  bluePropType?: string;
  redPropType?: string;
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
   * @param module - Target module: 'construct', 'animate', 'browse'
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
   * Optional metadata is appended as URL searchParams
   */
  generateViewerURL(
    sequence: SequenceData,
    options?: { compress?: boolean; metadata?: ShareURLMetadata }
  ): ShareURLResult;

  /**
   * Generate just the path portion for navigating to /sequence/{encoded}.
   * Returns e.g. "/sequence/z:CoCkBEjA2oBh..."
   * Used by in-app navigation (goto calls).
   */
  generateSequenceRoutePath(sequence: SequenceData): string;

  /**
   * Parse a sequence route [id] param to determine its type.
   * Distinguishes self-contained encoded sequences from legacy IDs.
   *
   * Returns:
   * - encoded: non-null if the ID is a self-contained encoded sequence (z: prefix or pipe-delimited)
   * - legacyId: non-null if the ID is a legacy session/Firebase ID or plain word
   */
  parseSequenceRouteId(id: string): SequenceRouteIdParseResult;

  /**
   * Encode a sequence for QR code offline use.
   * Returns a string prefixed with "s~" that contains all sequence data
   * compressed and URL-safe, allowing the sequence to load without Firebase.
   *
   * Uses LZString compression (60-70% savings). A typical 16-beat sequence
   * compresses to ~100-150 chars, fitting in a QR-5 (224 char capacity).
   *
   * @param sequence - The sequence to encode
   * @returns URL-safe encoded string with "s~" prefix
   *
   * @example
   * ```typescript
   * // Generate offline QR code
   * const offlineCode = sequenceEncoder.encodeForQR(mySequence);
   * const url = `https://tkaflowarts.com/p/${offlineCode}`;
   *
   * // Or use via QRCodeGenerator (recommended)
   * const qr = await qrCodeGenerator.generateForSequence(sequence, { offline: true });
   * ```
   */
  encodeForQR(sequence: SequenceData): Promise<string>;

  /**
   * Check if a code is an inline-encoded offline QR code (starts with "s~")
   *
   * @param code - The code to check
   * @returns True if this is an inline-encoded offline code
   */
  isInlineEncoded(code: string): boolean;

  /**
   * Decode an inline-encoded QR code string back to SequenceData.
   * Strips the "s~" prefix, decompresses, and parses.
   *
   * @param encoded - The encoded string (with or without "s~" prefix)
   * @returns Decoded sequence data
   * @throws Error if decoding fails
   */
  decodeFromQR(encoded: string): Promise<SequenceData>;

  /**
   * Estimate the QR code size needed for offline encoding of a sequence.
   * Useful for warning users when a sequence may produce a dense QR code.
   *
   * @param sequence - The sequence to estimate
   * @returns Estimation with encoded length and recommended QR version
   */
  estimateOfflineQRSize(sequence: SequenceData): Promise<QRSizeEstimate>;

  /**
   * Parse prop type params from URL search params.
   * @param searchParams - URLSearchParams to parse
   * @returns Prop options with decoded prop types (or undefined if not present)
   */
  parsePropsFromURL(searchParams: URLSearchParams): URLPropOptions;

  /**
   * Verify that an encoded string round-trips through decode → re-encode
   * without data loss. Returns the decoded sequence on success, or a reason
   * string describing the first mismatch found on failure.
   */
  verifyRoundTrip(
    encoded: string
  ): { ok: true; decoded: SequenceData } | { ok: false; reason: string };
}

/**
 * Result of parsing a sequence route ID
 */
export interface SequenceRouteIdParseResult {
  /** Non-null if the ID is a self-contained encoded sequence */
  encoded: string | null;
  /** Non-null if the ID is a legacy session/Firebase ID or plain word */
  legacyId: string | null;
}

/**
 * QR code size estimation result
 */
export interface QRSizeEstimate {
  /** Length of the encoded string (including s~ prefix) */
  encodedLength: number;
  /** Recommended QR version (1-40, higher = denser) */
  recommendedVersion: number;
  /** Whether offline mode is recommended for this sequence */
  offlineRecommended: boolean;
  /** Warning message if sequence is too large for comfortable scanning */
  warning?: string;
}
