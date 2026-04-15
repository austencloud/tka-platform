/**
 * Short Code Manager Interface
 *
 * Manages short codes for QR code URLs. Short codes are 6-character
 * alphanumeric strings that map to encoded sequence data, stored in Firebase.
 *
 * URL pattern: /p/{code} -> Full animation playback
 *
 * Domain: QR - URL Shortening
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Metadata stored with each short code
 */
export interface ShortCodeRecord {
  /** The encoded sequence data (using SequenceEncoder format) */
  sequence: string;
  /** When the short code was created */
  createdAt: Date;
  /** User ID who created it, or "system" for auto-generated */
  createdBy: string;
  /** Number of times this QR code has been scanned */
  scanCount: number;
  /** Optional: Original sequence name for debugging */
  sequenceName?: string;
}

/**
 * Result of creating a short code
 */
export interface CreateShortCodeResult {
  /** The generated 6-character short code */
  code: string;
  /** Full URL for the animation spotlight */
  url: string;
  /** Whether this was a new code or existing one was reused */
  isNew: boolean;
}

/**
 * Options for short code URL generation
 */
export interface ShortCodeURLOptions {
  /** Blue prop type to append to URL (encoded as single char) */
  bluePropType?: string;
  /** Red prop type to append to URL (encoded as single char) */
  redPropType?: string;
  /** Force-embed the full sequenceData in the shortcode record even when
   *  ownerId is set. Use this for URL-sync flows where the sequence may
   *  never be persisted (e.g., playing a generated-but-unsaved sequence);
   *  without it the resolver would fail because users/{uid}/sequences/{id}
   *  doesn't exist yet. */
  embedSequenceData?: boolean;
}

export interface IShortCodeManager {
  /**
   * Create or retrieve a short code for a sequence.
   * If an identical sequence already has a code, returns the existing code.
   *
   * @param sequence - The sequence to create a short code for
   * @param options - Optional URL options (e.g., prop types to embed)
   * @returns The short code and full URL
   */
  createShortCode(sequence: SequenceData, options?: ShortCodeURLOptions): Promise<CreateShortCodeResult>;

  /**
   * Create an offline-capable code for a sequence.
   * Returns a URL that embeds all sequence data, working without Firebase.
   *
   * @param sequence - The sequence to encode
   * @param options - Optional URL options (e.g., prop types to embed)
   * @returns The offline code (s~...) and full URL
   */
  createOfflineCode(sequence: SequenceData, options?: ShortCodeURLOptions): Promise<CreateShortCodeResult>;

  /**
   * Resolve a short code to its sequence data.
   * Returns null if the code doesn't exist.
   *
   * @param code - The 6-character short code
   * @returns Decoded sequence data or null
   */
  resolveShortCode(code: string): Promise<SequenceData | null>;

  /**
   * Increment the scan count for analytics.
   * Called when a QR code is scanned.
   *
   * @param code - The short code that was scanned
   */
  incrementScanCount(code: string): Promise<void>;

  /**
   * Get analytics for a short code.
   *
   * @param code - The short code to get analytics for
   * @returns The short code record with scan count, or null
   */
  getAnalytics(code: string): Promise<ShortCodeRecord | null>;

  /**
   * Log a detailed scan event to the scanEvents subcollection.
   * Append-only log for per-card analytics queries.
   *
   * @param code - The short code that was scanned
   * @param event - Scan event metadata (geo, device, referrer, etc.)
   */
  logScanEvent(
    code: string,
    event: {
      printId: string | null;
      country: string | null;
      city: string | null;
      userAgent: string;
      screenWidth: number;
      screenHeight: number;
      referrer: string | null;
      userId: string | null;
    }
  ): Promise<void>;
}
