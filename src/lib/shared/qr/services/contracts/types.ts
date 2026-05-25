// --- From CompositionalEncoder ---
export const LOOP_TYPE_TAGS: Record<string, string> = {
  rotated: "sr",
  mirrored: "sm",
  flipped: "sf",
  swapped: "ss",
  inverted: "si",
  // Audit fix #2: the enum value is "strict_rewound", not "rewound"
  strict_rewound: "rw",
} as const;

/** Reverse lookup: tag -> loopType string */
export const TAG_TO_LOOP_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(LOOP_TYPE_TAGS).map(([k, v]) => [v, k])
);

/** Recipe prefix that signals compositional encoding (after the s~ inline prefix) */
export const RECIPE_PREFIX = "r1:";


export interface ICompositionalDecoder {
  /**
   * Decode a recipe-encoded string back to flat encoded format.
   * Verifies hash after reconstruction.
   * Throws if hash verification fails.
   */
  decode(recipeEncoded: string): Promise<string>;

  /** Check if a string uses recipe encoding. */
  isRecipeEncoded(encoded: string): boolean;
}


// --- From QRCodeGenerator ---
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
   * When true, generates white modules on transparent background
   * for use on dark backgrounds. Default: false (dark modules on white).
   */
  darkMode?: boolean;
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
  /** Encoded BrowseViewMode string (e.g., "hsb" = hands-solo-blue). */
  viewMode?: string;
  /** Deck ID for attribution tracking */
  deckId?: string;
  /** Deck name for attribution tracking */
  deckName?: string;
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



// --- From ShortCodeManager ---
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
  /** View mode to encode in URL (e.g., "hsb" = hands-solo-blue) */
  viewMode?: string;
  /** Force-embed the full sequenceData in the shortcode record even when
   *  ownerId is set. Use this for URL-sync flows where the sequence may
   *  never be persisted (e.g., playing a generated-but-unsaved sequence);
   *  without it the resolver would fail because users/{uid}/sequences/{id}
   *  doesn't exist yet. */
  embedSequenceData?: boolean;
  /** Deck ID this card belongs to (stamped at deck composition time) */
  deckId?: string;
  /** Human-readable deck name for analytics */
  deckName?: string;
}
