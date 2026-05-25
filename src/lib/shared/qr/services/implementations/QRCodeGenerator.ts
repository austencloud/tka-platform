/**
 * QR Code Generator Implementation
 *
 * Generates styled QR codes using qr-code-styling library.
 * Features modern styling options including rounded dots,
 * custom corner styles, and TKA branding.
 *
 * Domain: QR - Code Generation
 */

import QRCodeStyling from "qr-code-styling";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ShortCodeManager } from "../implementations/ShortCodeManager";
import type { QRCodeOptions, QRCodeResult, QRCodeStyle, QRStylePreset } from "../contracts/types";

/**
 * Style presets for quick styling
 */
const STYLE_PRESETS: Record<QRStylePreset, QRCodeStyle> = {
  modern: {
    dotsType: "rounded",
    cornersSquareType: "extra-rounded",
    cornersDotType: "dot",
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
    errorCorrectionLevel: "M",
  },
  classic: {
    dotsType: "square",
    cornersSquareType: "square",
    cornersDotType: "square",
    color: "#000000",
    backgroundColor: "#ffffff",
    errorCorrectionLevel: "M",
  },
  minimal: {
    dotsType: "dots",
    cornersSquareType: "dot",
    cornersDotType: "dot",
    color: "#333333",
    backgroundColor: "#ffffff",
    errorCorrectionLevel: "L",
  },
};

export class QRCodeGenerator {
  constructor(private readonly shortCodeManager: ShortCodeManager) {}

  /**
   * Resolve style from preset name or object
   */
  private resolveStyle(
    styleInput?: QRCodeStyle | QRStylePreset
  ): QRCodeStyle {
    if (!styleInput) {
      return STYLE_PRESETS.modern;
    }

    if (typeof styleInput === "string") {
      return STYLE_PRESETS[styleInput] || STYLE_PRESETS.modern;
    }

    // Merge with defaults
    return {
      ...STYLE_PRESETS.modern,
      ...styleInput,
    };
  }

  /**
   * Create QRCodeStyling options from our style interface
   */
  private createQROptions(
    url: string,
    size: number,
    margin: number,
    style: QRCodeStyle
  ): ConstructorParameters<typeof QRCodeStyling>[0] {
    return {
      width: size,
      height: size,
      type: "svg",
      data: url,
      margin: margin,
      qrOptions: {
        typeNumber: 0, // Auto-detect
        mode: "Byte",
        errorCorrectionLevel: style.errorCorrectionLevel || "M",
      },
      dotsOptions: {
        color: style.color || "#1a1a2e",
        type: style.dotsType || "rounded",
      },
      cornersSquareOptions: {
        color: style.color || "#1a1a2e",
        type: style.cornersSquareType || "extra-rounded",
      },
      cornersDotOptions: {
        color: style.color || "#1a1a2e",
        type: style.cornersDotType || "dot",
      },
      backgroundOptions: {
        color: style.backgroundColor || "#ffffff",
      },
    };
  }

  /**
   * Generate QR code and return SVG + data URL
   */
  private async generateQR(
    url: string,
    options?: QRCodeOptions
  ): Promise<{ svg: string; dataUrl: string }> {
    const size = options?.size || 200;
    const margin = options?.margin || 1;
    let style = this.resolveStyle(options?.style);

    // Dark mode: white modules on transparent background
    if (options?.darkMode) {
      style = {
        ...style,
        color: "#ffffff",
        backgroundColor: "#00000000",
      };
    }

    const qrCode = new QRCodeStyling(
      this.createQROptions(url, size, margin, style)
    );

    // Get SVG blob
    const svgBlob = await qrCode.getRawData("svg");
    if (!svgBlob) {
      throw new Error("Failed to generate QR code SVG");
    }

    // Convert blob/buffer to text for SVG string
    let svgText: string;
    if (svgBlob instanceof Blob) {
      svgText = await svgBlob.text();
    } else {
      // Node.js Buffer case
      svgText = svgBlob.toString("utf-8");
    }

    // Create data URL
    const dataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;

    return { svg: svgText, dataUrl };
  }

  async generateForSequence(
    sequence: SequenceData,
    options?: QRCodeOptions
  ): Promise<QRCodeResult> {
    const propOptions = {
      bluePropType: options?.bluePropType,
      redPropType: options?.redPropType,
      viewMode: options?.viewMode,
      deckId: options?.deckId,
      deckName: options?.deckName,
    };

    // Check if offline mode is requested
    if (options?.offline) {
      // Create offline code with embedded sequence data
      const { code, url: offlineUrl } =
        await this.shortCodeManager.createOfflineCode(sequence, propOptions);

      // Generate QR code
      const { svg, dataUrl } = await this.generateQR(offlineUrl, options);

      return {
        svg,
        dataUrl,
        encodedUrl: offlineUrl,
        shortCode: code, // This will be the s~... code
      };
    }

    // Default: Create Firebase-backed short code for smaller QR codes
    const { code, url: shortUrl } =
      await this.shortCodeManager.createShortCode(sequence, propOptions);

    // Generate QR code
    const { svg, dataUrl } = await this.generateQR(shortUrl, options);

    return {
      svg,
      dataUrl,
      encodedUrl: shortUrl,
      shortCode: code,
    };
  }

  async generateForUrl(
    url: string,
    options?: QRCodeOptions
  ): Promise<QRCodeResult> {
    const { svg, dataUrl } = await this.generateQR(url, options);

    return {
      svg,
      dataUrl,
      encodedUrl: url,
    };
  }

  getPresetStyle(preset: QRStylePreset): QRCodeStyle {
    return { ...STYLE_PRESETS[preset] };
  }

  async generateAsImage(
    sequence: SequenceData,
    size: number,
    options?: QRCodeOptions
  ): Promise<HTMLImageElement> {
    // Generate QR code with the specified size
    const result = await this.generateForSequence(sequence, {
      ...options,
      size,
    });

    // Convert data URL to HTMLImageElement
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load QR code as image"));
      img.src = result.dataUrl;
    });
  }
}
