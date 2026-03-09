/**
 * Glyph Cache Service
 *
 * Pre-loads and caches all letter SVG glyphs AND turn number SVGs to eliminate
 * network requests during sequence preview rendering. This dramatically improves
 * performance by converting external <image> references to inline data URLs.
 *
 * HMR-aware: Cache persists across hot module reloads to prevent mass network
 * requests during development (1000+ requests would otherwise occur on each save).
 */

import { getLetterImagePath } from "../../../pictograph/tka-glyph/utils/letter-image-getter";
import { Letter } from "../../../foundation/domain/models/Letter";

// ============================================================================
// HMR-AWARE MODULE-LEVEL CACHE STORAGE
// ============================================================================
// Persist cache across HMR to prevent mass network requests during development.
// Without this, every code change would trigger 1000+ SVG fetches.
// ============================================================================

const hmrGlyphCache: Map<string, string> =
  import.meta.hot?.data?.glyphCache ?? new Map();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.glyphCache = hmrGlyphCache;
  });
}

// Turn number values that need to be cached
type TurnNumberValue = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | "float";

// Element types that need to be cached
type ElementType = "air" | "earth" | "fire" | "water" | "moon" | "sun";

// VTG (Variation/Turn/Grid) glyph types
type VTGType = "QO" | "QS" | "SO" | "SS" | "TO" | "TS";

// Additional image assets
type AdditionalImageType = "arrow" | "blank" | "dash" | "same_opp_dot";

export interface IGlyphCache {
  /**
   * Initialize the cache by preloading all glyphs
   * @deprecated Use lazy loading via getOrLoadSvg() instead for better performance
   */
  initialize(): Promise<void>;

  /**
   * Get a cached glyph as a data URL (synchronous - returns null if not cached)
   * @param letter The letter to get
   * @returns Base64 data URL or null if not cached
   */
  getGlyphDataUrl(letter: string): string | null;

  /**
   * Lazy-load and cache a single SVG by path (on-demand)
   * This is the preferred method - only fetches when actually needed
   * @param path The path to the SVG file
   * @returns Promise<string> - Base64 data URL or null if failed
   */
  getOrLoadSvg(path: string): Promise<string | null>;

  /**
   * Check if the cache is ready (always true with lazy loading)
   */
  isReady(): boolean;

  /**
   * Get cache statistics
   */
  getStats(): { total: number; loaded: number; failed: number };
}

export class GlyphCache implements IGlyphCache {
  // Use HMR-aware module-level cache
  private cache = hmrGlyphCache;
  private ready = false;
  private loadedCount = 0;
  private failedCount = 0;

  // All possible TKA letters across all types
  private readonly LETTERS_TO_CACHE: Letter[] = [
    // Type1: Latin letters A-V
    Letter.A,
    Letter.B,
    Letter.C,
    Letter.D,
    Letter.E,
    Letter.F,
    Letter.G,
    Letter.H,
    Letter.I,
    Letter.J,
    Letter.K,
    Letter.L,
    Letter.M,
    Letter.N,
    Letter.O,
    Letter.P,
    Letter.Q,
    Letter.R,
    Letter.S,
    Letter.T,
    Letter.U,
    Letter.V,
    // Type2: W-Z + Greek uppercase + Mu, Nu
    Letter.W,
    Letter.X,
    Letter.Y,
    Letter.Z,
    Letter.SIGMA,
    Letter.DELTA,
    Letter.THETA,
    Letter.OMEGA,
    Letter.MU,
    Letter.NU,
    // Type3: Cross-Shift variants
    Letter.W_DASH,
    Letter.X_DASH,
    Letter.Y_DASH,
    Letter.Z_DASH,
    Letter.SIGMA_DASH,
    Letter.DELTA_DASH,
    Letter.THETA_DASH,
    Letter.OMEGA_DASH,
    // Type4: Dash Greek letters
    Letter.PHI,
    Letter.PSI,
    Letter.LAMBDA,
    // Type5: Dual-Dash variants
    Letter.PHI_DASH,
    Letter.PSI_DASH,
    Letter.LAMBDA_DASH,
    // Type6: Static Greek letters (α, β, γ, ζ, η, τ, ⊕)
    Letter.ALPHA,
    Letter.BETA,
    Letter.GAMMA,
    Letter.ZETA,
    Letter.ETA,
    Letter.TAU,
    Letter.TERRA,
  ];

  // All turn number values that need to be cached
  private readonly TURN_NUMBERS_TO_CACHE: TurnNumberValue[] = [
    0.5,
    1,
    1.5,
    2,
    2.5,
    3,
    "float",
  ];

  // All element types that need to be cached
  private readonly ELEMENTS_TO_CACHE: ElementType[] = [
    "air",
    "earth",
    "fire",
    "water",
    "moon",
    "sun",
  ];

  // All VTG glyph types that need to be cached
  private readonly VTG_GLYPHS_TO_CACHE: VTGType[] = [
    "QO",
    "QS",
    "SO",
    "SS",
    "TO",
    "TS",
  ];

  // Additional image assets that need to be cached
  private readonly ADDITIONAL_IMAGES_TO_CACHE: AdditionalImageType[] = [
    "arrow",
    "blank",
    "dash",
    "same_opp_dot",
  ];

  async initialize(): Promise<void> {
    if (this.ready) {
      return;
    }

    // Load all glyphs in parallel (max 10 at a time to avoid overwhelming the browser)
    const BATCH_SIZE = 10;

    // Load letters
    for (let i = 0; i < this.LETTERS_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.LETTERS_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((letter) => this.loadGlyph(letter)));
    }

    // Load turn numbers
    for (let i = 0; i < this.TURN_NUMBERS_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.TURN_NUMBERS_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((turnNumber) => this.loadTurnNumber(turnNumber))
      );
    }

    // Load elements
    for (let i = 0; i < this.ELEMENTS_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.ELEMENTS_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((element) => this.loadElement(element)));
    }

    // Load VTG glyphs
    for (let i = 0; i < this.VTG_GLYPHS_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.VTG_GLYPHS_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((vtg) => this.loadVTGGlyph(vtg)));
    }

    // Load additional images
    for (
      let i = 0;
      i < this.ADDITIONAL_IMAGES_TO_CACHE.length;
      i += BATCH_SIZE
    ) {
      const batch = this.ADDITIONAL_IMAGES_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((image) => this.loadAdditionalImage(image)));
    }

    this.ready = true;

    // GlyphCache initialized silently
    // Debug: ${duration.toFixed(0)}ms, ${this.loadedCount} loaded, ${this.failedCount} failed, ${this.cache.size} cache entries
  }

  private async loadGlyph(letter: Letter): Promise<void> {
    try {
      const path = getLetterImagePath(letter);
      const response = await fetch(path);

      if (!response.ok) {
        // Some letters might not exist in all types - that's OK
        this.failedCount++;
        return;
      }

      const svgContent = await response.text();

      // Validate this is actually SVG content
      const trimmed = svgContent.trimStart();
      if (
        !trimmed.startsWith("<svg") &&
        !trimmed.startsWith("<?xml") &&
        !trimmed.startsWith("<!DOCTYPE svg")
      ) {
        this.failedCount++;
        return;
      }

      // Convert to base64 data URL for inline embedding (UTF-8 safe)
      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(svgContent)}`;

      // Cache with multiple keys to handle different encoding scenarios:
      // 1. The letter enum value (e.g., "α")
      this.cache.set(letter, dataUrl);

      // 2. The raw path (e.g., "/images/letters_trimmed/Type6/α.svg")
      this.cache.set(path, dataUrl);

      // 3. URL-encoded version of the path (e.g., "/images/letters_trimmed/Type6/%CE%B1.svg")
      try {
        const encodedPath = path
          .split("/")
          .map((segment, i) =>
            i === path.split("/").length - 1
              ? encodeURIComponent(segment)
              : segment
          )
          .join("/");
        if (encodedPath !== path) {
          this.cache.set(encodedPath, dataUrl);
        }
      } catch {
        // Ignore encoding errors
      }

      this.loadedCount++;
    } catch (error) {
      console.warn(`Failed to load glyph "${letter}":`, error);
      this.failedCount++;
    }
  }

  private async loadTurnNumber(value: TurnNumberValue): Promise<void> {
    try {
      // Construct path based on turn number value
      const filename = value === "float" ? "float" : value.toString();
      const path = `/images/numbers/${filename}.svg`;

      const response = await fetch(path);

      if (!response.ok) {
        this.failedCount++;
        return;
      }

      const svgContent = await response.text();

      // Validate this is actually SVG content
      const trimmed = svgContent.trimStart();
      if (
        !trimmed.startsWith("<svg") &&
        !trimmed.startsWith("<?xml") &&
        !trimmed.startsWith("<!DOCTYPE svg")
      ) {
        this.failedCount++;
        return;
      }

      // Convert to base64 data URL for inline embedding (UTF-8 safe)
      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(svgContent)}`;

      // Cache with the path as the key
      this.cache.set(path, dataUrl);

      this.loadedCount++;
    } catch (error) {
      console.warn(`Failed to load turn number "${value}":`, error);
      this.failedCount++;
    }
  }

  private async loadElement(element: ElementType): Promise<void> {
    try {
      const path = `/images/elements/${element}.png`;

      const response = await fetch(path);

      if (!response.ok) {
        this.failedCount++;
        return;
      }

      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Cache with the path as the key
      this.cache.set(path, dataUrl);

      this.loadedCount++;
    } catch (error) {
      console.warn(`Failed to load element "${element}":`, error);
      this.failedCount++;
    }
  }

  private async loadVTGGlyph(vtg: VTGType): Promise<void> {
    try {
      const path = `/images/vtg_glyphs/${vtg}.svg`;

      const response = await fetch(path);

      if (!response.ok) {
        this.failedCount++;
        return;
      }

      const svgContent = await response.text();

      // Validate this is actually SVG content
      const trimmed = svgContent.trimStart();
      if (
        !trimmed.startsWith("<svg") &&
        !trimmed.startsWith("<?xml") &&
        !trimmed.startsWith("<!DOCTYPE svg")
      ) {
        this.failedCount++;
        return;
      }

      // Convert to base64 data URL for inline embedding (UTF-8 safe)
      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(svgContent)}`;

      // Cache with the path as the key
      this.cache.set(path, dataUrl);

      this.loadedCount++;
    } catch (error) {
      console.warn(`Failed to load VTG glyph "${vtg}":`, error);
      this.failedCount++;
    }
  }

  private async loadAdditionalImage(image: AdditionalImageType): Promise<void> {
    try {
      const path = `/images/${image}.svg`;

      const response = await fetch(path);

      if (!response.ok) {
        this.failedCount++;
        return;
      }

      const svgContent = await response.text();

      // Validate this is actually SVG content
      const trimmed = svgContent.trimStart();
      if (
        !trimmed.startsWith("<svg") &&
        !trimmed.startsWith("<?xml") &&
        !trimmed.startsWith("<!DOCTYPE svg")
      ) {
        this.failedCount++;
        return;
      }

      // Convert to base64 data URL for inline embedding (UTF-8 safe)
      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(svgContent)}`;

      // Cache with the path as the key
      this.cache.set(path, dataUrl);

      this.loadedCount++;
    } catch (error) {
      console.warn(`Failed to load additional image "${image}":`, error);
      this.failedCount++;
    }
  }

  getGlyphDataUrl(letter: string): string | null {
    // Try the direct lookup first
    let result = this.cache.get(letter);
    if (result) return result;

    // Try URL-decoded version (browser might encode Greek letters)
    try {
      const decoded = decodeURIComponent(letter);
      result = this.cache.get(decoded);
      if (result) return result;
    } catch {
      // Ignore decoding errors
    }

    // Try encoding the letter (in case cache has encoded but we got raw)
    try {
      const encoded = encodeURIComponent(letter);
      result = this.cache.get(encoded);
      if (result) return result;
    } catch {
      // Ignore encoding errors
    }

    return null;
  }

  /**
   * Lazy-load and cache a single SVG by path (on-demand)
   * @param path The path to the SVG file
   * @returns Promise<string> - Base64 data URL
   */
  async getOrLoadSvg(path: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(path);
    if (cached) return cached;

    // Also check URL-encoded version
    try {
      const encodedPath = path
        .split("/")
        .map((segment, i, arr) =>
          i === arr.length - 1 ? encodeURIComponent(segment) : segment
        )
        .join("/");
      const encodedCached = this.cache.get(encodedPath);
      if (encodedCached) return encodedCached;
    } catch {
      // Ignore encoding errors
    }

    // Not cached - fetch and cache
    try {
      const response = await fetch(path);
      if (!response.ok) {
        return null;
      }

      const svgContent = await response.text();

      // Validate this is actually SVG content, not HTML fallback
      // SPA dev servers often return index.html with 200 status for missing files
      const trimmed = svgContent.trimStart();
      if (
        !trimmed.startsWith("<svg") &&
        !trimmed.startsWith("<?xml") &&
        !trimmed.startsWith("<!DOCTYPE svg")
      ) {
        // This is likely the SPA fallback HTML, not an SVG
        return null;
      }

      // Use UTF-8 safe base64 encoding (btoa only works with Latin1)
      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(svgContent)}`;

      // Cache with multiple keys
      this.cache.set(path, dataUrl);

      // Also cache URL-encoded version
      try {
        const encodedPath = path
          .split("/")
          .map((segment, i, arr) =>
            i === arr.length - 1 ? encodeURIComponent(segment) : segment
          )
          .join("/");
        if (encodedPath !== path) {
          this.cache.set(encodedPath, dataUrl);
        }
      } catch {
        // Ignore encoding errors
      }

      this.loadedCount++;
      return dataUrl;
    } catch (error) {
      console.warn(`Failed to lazy-load SVG "${path}":`, error);
      this.failedCount++;
      return null;
    }
  }

  /**
   * UTF-8 safe base64 encoding
   * btoa() only works with Latin1, this handles full UTF-8
   */
  private utf8ToBase64(str: string): string {
    // Encode string to UTF-8 bytes, then base64
    const bytes = new TextEncoder().encode(str);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
      ""
    );
    return btoa(binary);
  }

  isReady(): boolean {
    // With lazy loading, we're always ready - SVGs are fetched on-demand
    return true;
  }

  getStats() {
    return {
      total:
        this.LETTERS_TO_CACHE.length +
        this.TURN_NUMBERS_TO_CACHE.length +
        this.ELEMENTS_TO_CACHE.length +
        this.VTG_GLYPHS_TO_CACHE.length +
        this.ADDITIONAL_IMAGES_TO_CACHE.length,
      loaded: this.loadedCount,
      failed: this.failedCount,
    };
  }
}
