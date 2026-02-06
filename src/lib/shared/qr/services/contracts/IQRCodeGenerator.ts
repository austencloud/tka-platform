/**
 * QR Code Generator Interface
 *
 * Generates styled QR codes for sequence playback URLs.
 * Uses qr-code-styling for modern, branded QR codes with
 * rounded dots, custom eyes, and TKA branding.
 *
 * Domain: QR - Code Generation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * QR code dot/module styling options
 */
export type QRDotsType =
  | "square"
  | "dots"
  | "rounded"
  | "extra-rounded"
  | "classy"
  | "classy-rounded";

/**
 * QR code corner square styling options
 */
export type QRCornerSquareType = "square" | "extra-rounded" | "dot";

/**
 * QR code corner dot styling options
 */
export type QRCornerDotType = "square" | "dot";

/**
 * Error correction level
 * L: 7% recovery, M: 15% recovery, Q: 25% recovery, H: 30% recovery
 */
export type QRErrorCorrectionLevel = "L" | "M" | "Q" | "H";

/**
 * Styling options for QR code generation
 */
export interface QRCodeStyle {
  /** Dot/module shape style */
  dotsType?: QRDotsType;
  /** Corner square shape style */
  cornersSquareType?: QRCornerSquareType;
  /** Corner dot shape style */
  cornersDotType?: QRCornerDotType;
  /** Foreground color (modules) */
  color?: string;
  /** Background color */
  backgroundColor?: string;
  /** Error correction level */
  errorCorrectionLevel?: QRErrorCorrectionLevel;
}

/**
 * Preset styles for quick styling
 */
export type QRStylePreset = "modern" | "classic" | "minimal";

/**
 * Options for QR code generation
 */
export interface QRCodeOptions {
  /** Size in pixels */
  size?: number;
  /** Margin/quiet zone in modules */
  margin?: number;
  /** Style configuration or preset name */
  style?: QRCodeStyle | QRStylePreset;
  /**
   * Generate an offline-capable QR code that embeds sequence data directly.
   * When true, the QR code works without internet (no Firebase lookup needed).
   * Default: false (uses Firebase short codes for smaller QR codes)
   */
  offline?: boolean;
  /**
   * Blue prop type to include in the URL.
   * When set, the scanned viewer will use this prop type instead of user's default.
   */
  bluePropType?: string;
  /**
   * Red prop type to include in the URL.
   * When set, the scanned viewer will use this prop type instead of user's default.
   */
  redPropType?: string;
}

/**
 * Result of QR code generation
 */
export interface QRCodeResult {
  /** SVG string of the QR code */
  svg: string;
  /** Data URL for use in img src */
  dataUrl: string;
  /** The URL encoded in the QR code */
  encodedUrl: string;
  /** Short code if URL shortening was used */
  shortCode?: string;
}

/**
 * Default TKA-branded style
 */
export const DEFAULT_QR_STYLE: QRCodeStyle = {
  dotsType: "rounded",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
  color: "#1a1a2e",
  backgroundColor: "#ffffff",
  errorCorrectionLevel: "M",
};

export interface IQRCodeGenerator {
  /**
   * Generate a QR code for a sequence.
   * Uses short code system for compact URLs.
   *
   * @param sequence - The sequence to create a QR code for
   * @param options - Generation options (size, margin, style)
   * @returns QR code result with SVG and data URL
   */
  generateForSequence(
    sequence: SequenceData,
    options?: QRCodeOptions
  ): Promise<QRCodeResult>;

  /**
   * Generate a QR code for a raw URL.
   *
   * @param url - The URL to encode
   * @param options - Generation options
   * @returns QR code result
   */
  generateForUrl(url: string, options?: QRCodeOptions): Promise<QRCodeResult>;

  /**
   * Generate a QR code as an HTMLImageElement for direct canvas rendering.
   * Useful for baking QR codes into exported images.
   *
   * @param sequence - The sequence to create a QR code for
   * @param size - Size in pixels for the QR code
   * @param options - Generation options (margin, style)
   * @returns HTMLImageElement ready for canvas drawing
   */
  generateAsImage(
    sequence: SequenceData,
    size: number,
    options?: QRCodeOptions
  ): Promise<HTMLImageElement>;

  /**
   * Get the preset style configuration
   *
   * @param preset - The preset name
   * @returns Full style configuration
   */
  getPresetStyle(preset: QRStylePreset): QRCodeStyle;
}
