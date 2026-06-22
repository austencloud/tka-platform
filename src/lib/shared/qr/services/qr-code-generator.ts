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
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ShortCodeManager } from "./short-code-manager";
import type { QRCodeOptions, QRCodeResult, QRCodeStyle, QRStylePreset } from "./types";
import {
  getQrImageCache,
  QR_IMAGE_CACHE_SCHEMA,
  type QrImageCache,
} from "./qr-image-cache";

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

/**
 * Rough perceived-luminance test so the play triangle always contrasts the
 * badge. Accepts #rgb / #rrggbb (with optional alpha); anything else is treated
 * as dark (white triangle).
 */
function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})/i.exec(hex.trim());
  const raw = m?.[1];
  if (!raw) return false;
  const h = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Rec. 601 luma
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/**
 * Inline SVG data URL: a play triangle in a circular badge, centered in the QR.
 * Badge fill = the QR module color (dark on light cards, white on dark cards);
 * the triangle takes the contrasting color so it reads on either. The overlay
 * is purely visual — it never changes the encoded URL — and the generator bumps
 * error correction to "H" so the obscured modules stay recoverable.
 */
function playIconDataUrl(moduleColor: string): string {
  const badge = moduleColor;
  const triangle = isLightColor(badge) ? "#1a1a2e" : "#ffffff";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="50" fill="${badge}"/>` +
    `<path d="M40 30 L40 70 L72 50 Z" fill="${triangle}" ` +
    `stroke="${triangle}" stroke-width="8" stroke-linejoin="round"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export class QRCodeGenerator {
  /** Memory-only map of decoded QR images, keyed by dataUrl. The SVG render
   *  is cached persistently (`imageCache`); this avoids re-decoding the same
   *  dataURL into an `HTMLImageElement` within a session (e.g. every card in a
   *  deck that shares a payload). Bounded with insertion-order LRU eviction so a
   *  long-lived tab generating QR codes for many distinct sequences can't
   *  accumulate decoded images indefinitely. */
  private readonly decodedImages = new Map<string, HTMLImageElement>();

  /** Cap on `decodedImages` entries. Comfortably above a single deck render's
   *  distinct-payload count; evicts the oldest entry past the cap. */
  private static readonly MAX_DECODED_IMAGES = 256;

  constructor(
    private readonly shortCodeManager: ShortCodeManager,
    private readonly imageCache: QrImageCache = getQrImageCache()
  ) {}

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
      // Center play button: every QR resolves to the animated player, so the
      // triangle implicitly declares "scan to play". hideBackgroundDots clears
      // the modules behind it and the margin gives a clean ring.
      image: playIconDataUrl(style.color || "#1a1a2e"),
      imageOptions: {
        imageSize: 0.25,
        margin: 3,
        hideBackgroundDots: true,
        crossOrigin: "anonymous",
      },
      qrOptions: {
        typeNumber: 0, // Auto-detect
        mode: "Byte",
        // Force "H" (30% recovery) whenever the center image is embedded so the
        // obscured modules stay recoverable, regardless of the preset's level.
        errorCorrectionLevel: "H",
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

    // Persistent image cache: the qr-code-styling render + getRawData is the
    // expensive bit (the QR=93% bottleneck). Key on everything that changes the
    // pixels — url + size + margin + resolved style — so a repeat payload is a
    // pure cache read, no render.
    const cacheKey = `${QR_IMAGE_CACHE_SCHEMA}:${size}:${margin}:${JSON.stringify(style)}:${url}`;
    const cachedImage = await this.imageCache.get(cacheKey);
    if (cachedImage) {
      return cachedImage;
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

    const result = { svg: svgText, dataUrl };
    void this.imageCache.set(cacheKey, result);
    return result;
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

    // Every QR is the Firebase short code (tka.run/<code>). The dense "offline"
    // s~ path that baked the whole sequence into the URL is gone — those QRs
    // were unscannable and varied in module density. Callers gate guests out
    // before they ever reach here (guests get no QR at all).
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
    // Generate QR code with the specified size (SVG render is cached upstream)
    const result = await this.generateForSequence(sequence, {
      ...options,
      size,
    });

    // Reuse an already-decoded image for the same dataURL (deck cards sharing a
    // payload decode once). Re-insert on hit so the entry is treated as most
    // recently used by the insertion-order eviction below.
    const existing = this.decodedImages.get(result.dataUrl);
    if (existing) {
      this.decodedImages.delete(result.dataUrl);
      this.decodedImages.set(result.dataUrl, existing);
      return existing;
    }

    // Convert data URL to HTMLImageElement
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.decodedImages.set(result.dataUrl, img);
        // Evict the oldest entry once over the cap (Map iterates in insertion
        // order, so the first key is the least recently used).
        if (this.decodedImages.size > QRCodeGenerator.MAX_DECODED_IMAGES) {
          const oldest = this.decodedImages.keys().next().value;
          if (oldest !== undefined) this.decodedImages.delete(oldest);
        }
        resolve(img);
      };
      img.onerror = () => reject(new Error("Failed to load QR code as image"));
      img.src = result.dataUrl;
    });
  }
}
