import { getLetterImagePath } from "../../pictograph/tka-glyph/utils/letter-image-getter";
import { Letter } from "../../foundation/domain/models/Letter";
import { getElementImagePath } from "../../pictograph/shared/domain/enums/pictograph-enums";
import { sanitizeSvgForBitmap } from "./svg-bitmap-sanitize";

// Bumped 4→5: glyph SVGs are now sanitized before base64 encoding, so any
// data URLs cached under v4 (built from the raw, malformed letter markup that
// strict parsers reject) must be discarded.
const GLYPH_CACHE_VERSION = 5;

const hmrGlyphCache: Map<string, string> =
  (import.meta.hot?.data?.glyphCacheVersion === GLYPH_CACHE_VERSION
    ? import.meta.hot?.data?.glyphCache
    : null) ?? new Map();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.glyphCache = hmrGlyphCache;
    data.glyphCacheVersion = GLYPH_CACHE_VERSION;
  });
}

type TurnNumberValue = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | "float";

type ElementType = "air" | "earth" | "fire" | "water" | "moon" | "sun";

type TnDType = "QO" | "QS" | "SO" | "SS" | "TO" | "TS";

type AdditionalImageType = "arrow" | "blank" | "dash" | "same_opp_dot";

export class GlyphCache {
  private cache = hmrGlyphCache;
  private ready = false;
  private loadedCount = 0;
  private failedCount = 0;

  private readonly LETTERS_TO_CACHE: Letter[] = [
    Letter.A, Letter.B, Letter.C, Letter.D, Letter.E, Letter.F, Letter.G,
    Letter.H, Letter.I, Letter.J, Letter.K, Letter.L, Letter.M, Letter.N,
    Letter.O, Letter.P, Letter.Q, Letter.R, Letter.S, Letter.T, Letter.U,
    Letter.V, Letter.W, Letter.X, Letter.Y, Letter.Z,
    Letter.SIGMA, Letter.DELTA, Letter.THETA, Letter.OMEGA, Letter.MU, Letter.NU,
    Letter.W_DASH, Letter.X_DASH, Letter.Y_DASH, Letter.Z_DASH,
    Letter.SIGMA_DASH, Letter.DELTA_DASH, Letter.THETA_DASH, Letter.OMEGA_DASH,
    Letter.PHI, Letter.PSI, Letter.LAMBDA,
    Letter.PHI_DASH, Letter.PSI_DASH, Letter.LAMBDA_DASH,
    Letter.ALPHA, Letter.BETA, Letter.GAMMA, Letter.ZETA, Letter.ETA, Letter.TAU, Letter.TERRA,
  ];

  private readonly TURN_NUMBERS_TO_CACHE: TurnNumberValue[] = [0.5, 1, 1.5, 2, 2.5, 3, "float"];
  private readonly ELEMENTS_TO_CACHE: ElementType[] = ["air", "earth", "fire", "water", "moon", "sun"];
  private readonly TND_GLYPHS_TO_CACHE: TnDType[] = ["QO", "QS", "SO", "SS", "TO", "TS"];
  private readonly ADDITIONAL_IMAGES_TO_CACHE: AdditionalImageType[] = ["arrow", "blank", "dash", "same_opp_dot"];

  async initialize(): Promise<void> {
    if (this.ready) return;

    const BATCH_SIZE = 10;

    for (let i = 0; i < this.LETTERS_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.LETTERS_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((l) => this.loadGlyph(l)));
    }

    for (let i = 0; i < this.TURN_NUMBERS_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.TURN_NUMBERS_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((tn) => this.loadTurnNumber(tn)));
    }

    for (let i = 0; i < this.ELEMENTS_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.ELEMENTS_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((e) => this.loadElement(e)));
    }

    for (let i = 0; i < this.TND_GLYPHS_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.TND_GLYPHS_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((v) => this.loadTnDGlyph(v)));
    }

    for (let i = 0; i < this.ADDITIONAL_IMAGES_TO_CACHE.length; i += BATCH_SIZE) {
      const batch = this.ADDITIONAL_IMAGES_TO_CACHE.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((img) => this.loadAdditionalImage(img)));
    }

    this.ready = true;
  }

  /**
   * Eagerly load glyphs for a specific set of base letters, skipping any
   * already cached. Lets a caller paint a word's glyphs before the full
   * initialize() batch completes — used by the QR scan loader so the scanned
   * word appears near-instantly on slow devices.
   */
  async loadGlyphsByLetter(letters: readonly string[]): Promise<void> {
    const pending = letters.filter((l) => l && !this.cache.has(l));
    if (pending.length === 0) return;
    await Promise.all(pending.map((l) => this.loadGlyph(l as Letter)));
  }

  private async loadGlyph(letter: Letter): Promise<void> {
    try {
      const path = getLetterImagePath(letter);
      const response = await fetch(path);
      if (!response.ok) { this.failedCount++; return; }

      const svgContent = await response.text();
      const trimmed = svgContent.trimStart();
      if (!trimmed.startsWith("<svg") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<!DOCTYPE svg")) {
        this.failedCount++;
        return;
      }

      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(sanitizeSvgForBitmap(svgContent))}`;
      this.cache.set(letter, dataUrl);
      this.cache.set(path, dataUrl);

      try {
        const encodedPath = path.split("/").map((s, i, a) => i === a.length - 1 ? encodeURIComponent(s) : s).join("/");
        if (encodedPath !== path) this.cache.set(encodedPath, dataUrl);
      } catch { /* ignore */ }

      this.loadedCount++;
    } catch {
      this.failedCount++;
    }
  }

  private async loadTurnNumber(value: TurnNumberValue): Promise<void> {
    try {
      const filename = value === "float" ? "float" : value.toString();
      const path = `/images/numbers/${filename}.svg`;
      const response = await fetch(path);
      if (!response.ok) { this.failedCount++; return; }

      const svgContent = await response.text();
      const trimmed = svgContent.trimStart();
      if (!trimmed.startsWith("<svg") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<!DOCTYPE svg")) {
        this.failedCount++;
        return;
      }

      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(sanitizeSvgForBitmap(svgContent))}`;
      this.cache.set(path, dataUrl);
      this.loadedCount++;
    } catch {
      this.failedCount++;
    }
  }

  private async loadElement(element: ElementType): Promise<void> {
    try {
      const path = getElementImagePath(element);
      const response = await fetch(path);
      if (!response.ok) { this.failedCount++; return; }

      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      this.cache.set(path, dataUrl);
      this.loadedCount++;
    } catch {
      this.failedCount++;
    }
  }

  private async loadTnDGlyph(tndCode: TnDType): Promise<void> {
    try {
      const path = `/images/vtg_glyphs/${tndCode}.svg`;
      const response = await fetch(path);
      if (!response.ok) { this.failedCount++; return; }

      const svgContent = await response.text();
      const trimmed = svgContent.trimStart();
      if (!trimmed.startsWith("<svg") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<!DOCTYPE svg")) {
        this.failedCount++;
        return;
      }

      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(sanitizeSvgForBitmap(svgContent))}`;
      this.cache.set(path, dataUrl);
      this.loadedCount++;
    } catch {
      this.failedCount++;
    }
  }

  private async loadAdditionalImage(image: AdditionalImageType): Promise<void> {
    try {
      const path = `/images/${image}.svg`;
      const response = await fetch(path);
      if (!response.ok) { this.failedCount++; return; }

      const svgContent = await response.text();
      const trimmed = svgContent.trimStart();
      if (!trimmed.startsWith("<svg") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<!DOCTYPE svg")) {
        this.failedCount++;
        return;
      }

      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(sanitizeSvgForBitmap(svgContent))}`;
      this.cache.set(path, dataUrl);
      this.loadedCount++;
    } catch {
      this.failedCount++;
    }
  }

  getGlyphDataUrl(letter: string): string | null {
    let result = this.cache.get(letter);
    if (result) return result;

    try {
      const decoded = decodeURIComponent(letter);
      result = this.cache.get(decoded);
      if (result) return result;
    } catch { /* ignore */ }

    try {
      const encoded = encodeURIComponent(letter);
      result = this.cache.get(encoded);
      if (result) return result;
    } catch { /* ignore */ }

    return null;
  }

  async getOrLoadSvg(path: string): Promise<string | null> {
    const cached = this.cache.get(path);
    if (cached) return cached;

    try {
      const encodedPath = path.split("/").map((s, i, a) => i === a.length - 1 ? encodeURIComponent(s) : s).join("/");
      const encodedCached = this.cache.get(encodedPath);
      if (encodedCached) return encodedCached;
    } catch { /* ignore */ }

    try {
      const response = await fetch(path);
      if (!response.ok) return null;

      const svgContent = await response.text();
      const trimmed = svgContent.trimStart();
      if (!trimmed.startsWith("<svg") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<!DOCTYPE svg")) {
        return null;
      }

      const dataUrl = `data:image/svg+xml;base64,${this.utf8ToBase64(sanitizeSvgForBitmap(svgContent))}`;
      this.cache.set(path, dataUrl);

      try {
        const encodedPath = path.split("/").map((s, i, a) => i === a.length - 1 ? encodeURIComponent(s) : s).join("/");
        if (encodedPath !== path) this.cache.set(encodedPath, dataUrl);
      } catch { /* ignore */ }

      this.loadedCount++;
      return dataUrl;
    } catch {
      this.failedCount++;
      return null;
    }
  }

  private utf8ToBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binary);
  }

  isReady(): boolean {
    return true;
  }

  getStats() {
    return {
      total:
        this.LETTERS_TO_CACHE.length +
        this.TURN_NUMBERS_TO_CACHE.length +
        this.ELEMENTS_TO_CACHE.length +
        this.TND_GLYPHS_TO_CACHE.length +
        this.ADDITIONAL_IMAGES_TO_CACHE.length,
      loaded: this.loadedCount,
      failed: this.failedCount,
    };
  }
}
