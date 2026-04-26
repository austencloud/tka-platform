# TKA Glyph Word Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Georgia text in Choreo Card word headers with the actual TKA letter glyph SVGs, on both the canvas card-front header and the Svelte card-back identity line.

**Architecture:** Extend `packages/render-composition`'s `renderHeader` with an optional `glyphImages` map; when populated, glyph images are drawn instead of text. `TextRenderer` pre-loads all letter SVGs into `HTMLImageElement` objects at startup and passes them per-render. A new `TKAWordGlyph.svelte` handles the card-back Svelte surface.

**Tech Stack:** Canvas 2D API (`drawImage`, `roundRect`), Svelte 5, TypeScript, Vitest (jsdom + render-composition's own vitest)

---

## File Map

| Action | File |
|---|---|
| Modify | `packages/render-composition/src/types.ts` |
| Modify | `packages/render-composition/src/header-renderer.ts` |
| Modify | `packages/render-composition/tests/header-renderer.test.ts` |
| Create | `src/lib/shared/pictograph/tka-glyph/utils/word-tokenizer.ts` |
| Create | `tests/unit/render/WordTokenizer.test.ts` |
| Modify | `src/lib/shared/render/services/implementations/TextRenderer.ts` |
| Create | `tests/unit/render/TextRendererGlyphs.test.ts` |
| Create | `src/lib/features/choreo-card/components/TKAWordGlyph.svelte` |
| Modify | `src/lib/features/choreo-card/components/CardBack.svelte` |
| Modify | `src/routes/+layout.svelte` |

---

## Task 1: Add `GlyphImageData` type and extend `HeaderOptions`

**Files:**
- Modify: `packages/render-composition/src/types.ts`
- Modify: `packages/render-composition/src/header-renderer.ts` (interface only)

- [ ] **Step 1: Add `GlyphImageData` to types**

In `packages/render-composition/src/types.ts`, append after the last interface:

```ts
/** Per-letter image data for glyph word rendering in renderHeader */
export interface GlyphImageData {
  /** Canvas-drawable image (HTMLImageElement in browser, node-canvas Image in Node) */
  image: CanvasImageSource;
  /** Intrinsic width of the SVG in pixels */
  naturalWidth: number;
  /** Intrinsic height of the SVG in pixels */
  naturalHeight: number;
  /** True for Type3/5 letters (W-, Σ-, Φ-, τ-, etc.) — triggers dash bar rendering */
  isDash: boolean;
}
```

- [ ] **Step 2: Add `glyphImages` to `HeaderOptions` in `header-renderer.ts`**

In `packages/render-composition/src/header-renderer.ts`, add the field to `HeaderOptions` after `borderColor`:

```ts
export interface HeaderOptions {
  canvasWidth: number;
  headerHeight: number;
  word: string;
  difficultyLevel?: number;
  showDifficultyBadge?: boolean;
  loopComponents?: Set<LOOPComponentId>;
  rotationSliceSize?: LoopRotationSliceSize;
  darkMode?: boolean;
  letterStyles?: LetterStyle[];
  backgroundColor?: string;
  borderColor?: string;
  /** When present, word slot renders glyph images instead of Georgia text */
  glyphImages?: Map<string, GlyphImageData>;
}
```

Also add the import at the top of `header-renderer.ts`:

```ts
import type { LOOPComponentId, LetterStyle, GlyphImageData } from "./types.js";
```

(Replace the existing import line that imports from `"./types.js"` — just add `GlyphImageData` to it.)

- [ ] **Step 3: Commit types**

```bash
git add packages/render-composition/src/types.ts packages/render-composition/src/header-renderer.ts
git commit -m "feat(render-composition): add GlyphImageData type and HeaderOptions.glyphImages field"
```

---

## Task 2: Write failing tests for glyph rendering in `renderHeader`

**Files:**
- Modify: `packages/render-composition/tests/header-renderer.test.ts`

- [ ] **Step 1: Extend the mock context with `drawImage` and `roundRect`**

In `packages/render-composition/tests/header-renderer.test.ts`, update `createMockCtx` to include:

```ts
function createMockCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
    textAlign: "", textBaseline: "", shadowColor: "", shadowBlur: 0, shadowOffsetY: 0,
    fillRect: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(),
    save: vi.fn(), restore: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    roundRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}
```

- [ ] **Step 2: Add failing glyph tests**

Append inside the `describe("renderHeader", ...)` block:

```ts
describe("glyph word rendering", () => {
  function makeGlyphImage(w = 80, h = 100, isDash = false): GlyphImageData {
    return {
      image: {} as CanvasImageSource,
      naturalWidth: w,
      naturalHeight: h,
      isDash,
    };
  }

  it("calls drawImage for each letter when glyphImages is provided", () => {
    const ctx = createMockCtx();
    const glyphImages = new Map<string, GlyphImageData>([
      ["A", makeGlyphImage()],
      ["B", makeGlyphImage()],
    ]);
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "AB", darkMode: true, glyphImages });
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });

  it("does not call fillText for the word when glyphImages is provided", () => {
    const ctx = createMockCtx();
    const glyphImages = new Map<string, GlyphImageData>([["A", makeGlyphImage()]]);
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "A", darkMode: true, glyphImages });
    // fillText still fires for difficulty badge number — but NOT for the word "A"
    const wordCall = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.find(
      (args) => args[0] === "A"
    );
    expect(wordCall).toBeUndefined();
  });

  it("calls roundRect for dash letters", () => {
    const ctx = createMockCtx();
    const glyphImages = new Map<string, GlyphImageData>([
      ["W-", makeGlyphImage(80, 100, true)],
    ]);
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "W-", darkMode: true, glyphImages });
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("does not call drawImage when glyphImages is absent", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "AB", darkMode: true });
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("renders nothing in word slot when word is empty and glyphImages provided", () => {
    const ctx = createMockCtx();
    const glyphImages = new Map<string, GlyphImageData>();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "", darkMode: true, glyphImages });
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("skips missing letters silently", () => {
    const ctx = createMockCtx();
    // Only "A" in map, word has "AB" — "B" silently skipped
    const glyphImages = new Map<string, GlyphImageData>([["A", makeGlyphImage()]]);
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "AB", darkMode: true, glyphImages });
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });
});
```

Also add the import at top of the test file:

```ts
import type { GlyphImageData } from "../src/types.js";
```

- [ ] **Step 3: Run tests — confirm new tests fail**

```bash
cd packages/render-composition && npx vitest run tests/header-renderer.test.ts
```

Expected: existing tests PASS, new `glyph word rendering` tests FAIL ("drawImage is not a function" or assertion errors).

---

## Task 3: Implement glyph rendering in `renderHeader`

**Files:**
- Modify: `packages/render-composition/src/header-renderer.ts`

- [ ] **Step 1: Add the glyph word rendering helper**

In `packages/render-composition/src/header-renderer.ts`, add this function before `renderHeader`:

```ts
const LETTER_GAP_RATIO = 0.04; // gap between letters as fraction of headerHeight
const GLYPH_HEIGHT_RATIO = 0.65; // glyph height as fraction of headerHeight
// Dash constants in SVG coordinate units (from Dash.svelte)
const DASH_W_SVG = 70;
const DASH_H_SVG = 20;
const DASH_GAP_SVG = 10;
const DASH_RADIUS_SVG = 9.5;

function renderGlyphWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  glyphImages: Map<string, GlyphImageData>,
  canvasWidth: number,
  headerHeight: number,
  darkMode: boolean,
): void {
  if (!word?.trim()) return;

  const availableH = headerHeight * GLYPH_HEIGHT_RATIO;
  const letterGap = headerHeight * LETTER_GAP_RATIO;
  const verticalCenter = headerHeight / 2;

  // Tokenize: group letter + optional trailing dash (e.g. "W-" is one token)
  const tokens: string[] = [];
  const chars = [...word];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (chars[i + 1] === "-") {
      tokens.push(ch + "-");
      i += 2;
    } else {
      tokens.push(ch);
      i += 1;
    }
  }

  // First pass: compute total row width for centering
  let totalWidth = 0;
  for (const token of tokens) {
    const data = glyphImages.get(token);
    if (!data) continue;
    const scale = availableH / data.naturalHeight;
    const glyphW = data.naturalWidth * scale;
    totalWidth += glyphW;
    if (data.isDash) {
      const dashScale = scale;
      totalWidth += DASH_GAP_SVG * dashScale + DASH_W_SVG * dashScale;
    }
    totalWidth += letterGap;
  }
  // Remove trailing gap
  if (tokens.length > 0) totalWidth -= letterGap;

  // Second pass: draw
  let cursorX = canvasWidth / 2 - totalWidth / 2;
  const dashColor = darkMode ? "#ffffff" : "#231f20";

  for (const token of tokens) {
    const data = glyphImages.get(token);
    if (!data) continue;
    const scale = availableH / data.naturalHeight;
    const glyphW = data.naturalWidth * scale;
    const glyphY = verticalCenter - availableH / 2;

    ctx.drawImage(data.image, cursorX, glyphY, glyphW, availableH);

    if (data.isDash) {
      const dashScale = scale;
      const dashW = DASH_W_SVG * dashScale;
      const dashH = DASH_H_SVG * dashScale;
      const dashGap = DASH_GAP_SVG * dashScale;
      const dashX = cursorX + glyphW + dashGap;
      const dashY = verticalCenter - dashH / 2;
      ctx.beginPath();
      ctx.roundRect(dashX, dashY, dashW, dashH, DASH_RADIUS_SVG * dashScale);
      ctx.fillStyle = dashColor;
      ctx.fill();
      cursorX += glyphW + dashGap + dashW + letterGap;
    } else {
      cursorX += glyphW + letterGap;
    }
  }
}
```

- [ ] **Step 2: Call `renderGlyphWord` from `renderHeader`**

Inside `renderHeader`, replace the existing word text block (the `if (word?.trim()) { ... }` section near the bottom) with:

```ts
  // Word: glyphs if map provided, text otherwise
  if (word?.trim()) {
    if (options.glyphImages && options.glyphImages.size > 0) {
      renderGlyphWord(ctx, word, options.glyphImages, canvasWidth, headerHeight, darkMode);
    } else if (letterStyles && letterStyles.length > 0) {
      // Per-letter with dimming for bridge/derived letters
      const totalWidth = ctx.measureText(word).width;
      let cursorX = canvasWidth / 2 - totalWidth / 2;
      ctx.textAlign = "left";
      for (let i = 0; i < word.length; i++) {
        const char = word[i]!;
        const style = letterStyles[i];
        ctx.fillStyle = style?.dimmed ? dimmedColor : textColor;
        ctx.fillText(char, cursorX, headerHeight / 2);
        cursorX += ctx.measureText(char).width;
      }
    } else {
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.fillText(word, canvasWidth / 2, headerHeight / 2);
    }
  }
```

Destructure `glyphImages` at the top of `renderHeader` alongside existing destructuring:

```ts
  const {
    canvasWidth, headerHeight, word,
    difficultyLevel = 1, showDifficultyBadge = true,
    loopComponents, rotationSliceSize, darkMode = true, letterStyles,
    backgroundColor, borderColor, glyphImages,
  } = options;
```

- [ ] **Step 3: Run tests — confirm all pass**

```bash
cd packages/render-composition && npx vitest run tests/header-renderer.test.ts
```

Expected: ALL tests PASS including the new `glyph word rendering` suite.

- [ ] **Step 4: Commit**

```bash
git add packages/render-composition/src/header-renderer.ts packages/render-composition/tests/header-renderer.test.ts
git commit -m "feat(render-composition): render TKA glyph images in header word slot"
```

---

## Task 4: Create word tokenizer utility

**Files:**
- Create: `src/lib/shared/pictograph/tka-glyph/utils/word-tokenizer.ts`
- Create: `tests/unit/render/WordTokenizer.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/render/WordTokenizer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";

describe("tokenizeWord", () => {
  it("splits ASCII word into individual letters", () => {
    expect(tokenizeWord("CAKE")).toEqual(["C", "A", "K", "E"]);
  });

  it("handles Greek letters as single tokens", () => {
    expect(tokenizeWord("ΣΔ")).toEqual(["Σ", "Δ"]);
  });

  it("groups dash letters as single tokens", () => {
    expect(tokenizeWord("W-")).toEqual(["W-"]);
  });

  it("handles mixed dash and non-dash letters", () => {
    expect(tokenizeWord("AW-B")).toEqual(["A", "W-", "B"]);
  });

  it("handles multiple dash letters", () => {
    expect(tokenizeWord("W-X-")).toEqual(["W-", "X-"]);
  });

  it("handles Greek dash letters", () => {
    expect(tokenizeWord("Σ-")).toEqual(["Σ-"]);
  });

  it("returns empty array for empty string", () => {
    expect(tokenizeWord("")).toEqual([]);
  });

  it("returns empty array for null/undefined-like empty", () => {
    expect(tokenizeWord("  ")).toEqual([" ", " "]);
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
cd "E:/tka-platform" && npx vitest run tests/unit/render/WordTokenizer.test.ts --config tests/config/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/shared/pictograph/tka-glyph/utils/word-tokenizer.ts`:

```ts
/**
 * Split a TKA sequence word string into individual letter tokens.
 *
 * Handles: ASCII (A-Z), Greek (Σ, Δ, Θ, Ω, μ, ν, α, β, γ, ζ, η, τ, ⊕, Φ, Ψ, Λ),
 * and dash letters (W-, Σ-, Φ-, τ-, etc.).
 *
 * A dash immediately following any character is treated as part of that
 * character's token (Type 3/5 letter notation).
 */
export function tokenizeWord(word: string): string[] {
  const tokens: string[] = [];
  const chars = [...word]; // Unicode-aware split
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (chars[i + 1] === "-") {
      tokens.push(ch + "-");
      i += 2;
    } else {
      tokens.push(ch);
      i += 1;
    }
  }
  return tokens;
}
```

- [ ] **Step 4: Run — confirm PASS**

```bash
npx vitest run tests/unit/render/WordTokenizer.test.ts --config tests/config/vitest.config.ts
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/tka-glyph/utils/word-tokenizer.ts tests/unit/render/WordTokenizer.test.ts
git commit -m "feat(glyph): add tokenizeWord utility for TKA letter tokens"
```

---

## Task 5: Add `preloadGlyphImages` and `buildGlyphMap` to `TextRenderer`

**Files:**
- Modify: `src/lib/shared/render/services/implementations/TextRenderer.ts`
- Create: `tests/unit/render/TextRendererGlyphs.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/render/TextRendererGlyphs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GlyphImageData } from "@tka/render-composition";

// Mock getGlyphCache before importing TextRenderer
vi.mock("$lib/shared/render/getGlyphCache", () => ({
  getGlyphCache: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getGlyphDataUrl: (letter: string) => {
      // Return a minimal SVG data URL for known letters
      const known = ["A", "B", "W", "W-", "Σ"];
      return known.includes(letter)
        ? `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMTAwIi8+`
        : null;
    },
    isReady: () => true,
  }),
}));

// Mock Image constructor to auto-fire onload with fixed dimensions
class MockImage {
  naturalWidth = 80;
  naturalHeight = 100;
  onload: (() => void) | null = null;
  set src(_: string) {
    // Fire load asynchronously (microtask)
    Promise.resolve().then(() => this.onload?.());
  }
}

vi.stubGlobal("Image", MockImage);

// Import AFTER mocks are set up
const { TextRenderer } = await import(
  "$lib/shared/render/services/implementations/TextRenderer"
);

describe("TextRenderer glyph methods", () => {
  let renderer: InstanceType<typeof TextRenderer>;

  beforeEach(async () => {
    const { dimensionCalculator } = await import(
      "$lib/shared/render/services/implementations/DimensionCalculator"
    );
    renderer = new TextRenderer(dimensionCalculator);
    await renderer.preloadGlyphImages();
  });

  it("preloadGlyphImages populates glyphImageCache for known letters", () => {
    const map = renderer.buildGlyphMap("AB");
    expect(map.size).toBe(2);
    expect(map.has("A")).toBe(true);
    expect(map.has("B")).toBe(true);
  });

  it("buildGlyphMap returns GlyphImageData with correct isDash=false for plain letters", () => {
    const map = renderer.buildGlyphMap("A");
    const entry = map.get("A")!;
    expect(entry.isDash).toBe(false);
    expect(entry.naturalWidth).toBe(80);
    expect(entry.naturalHeight).toBe(100);
  });

  it("buildGlyphMap sets isDash=true for dash letters", () => {
    const map = renderer.buildGlyphMap("W-");
    const entry = map.get("W-")!;
    expect(entry).toBeDefined();
    expect(entry.isDash).toBe(true);
  });

  it("buildGlyphMap silently omits letters not in cache", () => {
    // "Z" not in mock cache
    const map = renderer.buildGlyphMap("AZ");
    expect(map.has("A")).toBe(true);
    expect(map.has("Z")).toBe(false);
  });

  it("buildGlyphMap handles empty word", () => {
    const map = renderer.buildGlyphMap("");
    expect(map.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx vitest run tests/unit/render/TextRendererGlyphs.test.ts --config tests/config/vitest.config.ts
```

Expected: FAIL — `preloadGlyphImages` and `buildGlyphMap` do not exist yet.

- [ ] **Step 3: Add private cache field and new methods to `TextRenderer`**

In `src/lib/shared/render/services/implementations/TextRenderer.ts`:

Add import at top:

```ts
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { getGlyphCache } from "$lib/shared/render/getGlyphCache";
import type { GlyphImageData } from "@tka/render-composition";
import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";
```

Add private field inside the class after the constructor fields:

```ts
private glyphImageCache = new Map<string, GlyphImageData>();
```

Add these two public methods inside the class (after the constructor):

```ts
/**
 * Eagerly load all TKA letter SVGs as HTMLImageElement objects.
 * Call once at app startup (fire-and-forget from +layout.svelte).
 * Until this resolves, renderWordHeader falls back to text.
 * Idempotent — safe to call multiple times.
 */
async preloadGlyphImages(): Promise<void> {
  if (this.glyphImageCache.size > 0) return; // already preloaded
  const cache = getGlyphCache();
  await cache.initialize();

  const letters = Object.values(Letter);
  await Promise.all(
    letters.map((letter) => {
      const dataUrl = cache.getGlyphDataUrl(letter);
      if (!dataUrl) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.glyphImageCache.set(letter, {
            image: img,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            isDash: letter.endsWith("-"),
          });
          resolve();
        };
        img.onerror = () => resolve(); // silently skip failures
        img.src = dataUrl;
      });
    })
  );
}

/**
 * Build a Map<token, GlyphImageData> for the letters in `word`.
 * Returns an empty map if preloadGlyphImages hasn't been called yet.
 */
buildGlyphMap(word: string): Map<string, GlyphImageData> {
  if (!word || this.glyphImageCache.size === 0) return new Map();
  const tokens = tokenizeWord(word);
  const result = new Map<string, GlyphImageData>();
  for (const token of tokens) {
    const data = this.glyphImageCache.get(token);
    if (data) result.set(token, data);
  }
  return result;
}
```

- [ ] **Step 4: Update `renderWordHeader` to pass glyph map**

In `TextRenderer.renderWordHeader()`, before calling `renderHeader(ctx, {...})`, build and pass the map:

```ts
renderWordHeader(
  canvas: HTMLCanvasElement,
  word: string,
  _options: TextRenderOptions,
  headerHeight: number,
  difficultyLevel: number = 1,
  showDifficultyBadge: boolean = true,
  darkMode: boolean = false,
  loopComponents?: Set<LOOPComponent>,
  backgroundColor?: string,
  borderColor?: string,
  rotationSliceSize?: LoopRotationSliceSize
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let packageComponents: Set<LOOPComponentId> | undefined;
  if (loopComponents && loopComponents.size > 0) {
    packageComponents = new Set<LOOPComponentId>();
    for (const c of loopComponents) {
      packageComponents.add(c as unknown as LOOPComponentId);
    }
  }

  const glyphImages = this.buildGlyphMap(word ?? "");

  renderHeader(ctx, {
    canvasWidth: canvas.width,
    headerHeight,
    word: word ?? "",
    difficultyLevel,
    showDifficultyBadge,
    loopComponents: packageComponents,
    rotationSliceSize,
    darkMode,
    backgroundColor,
    borderColor,
    glyphImages: glyphImages.size > 0 ? glyphImages : undefined,
  });
}
```

- [ ] **Step 5: Run tests — confirm PASS**

```bash
npx vitest run tests/unit/render/TextRendererGlyphs.test.ts --config tests/config/vitest.config.ts
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/render/services/implementations/TextRenderer.ts tests/unit/render/TextRendererGlyphs.test.ts
git commit -m "feat(render): preloadGlyphImages and buildGlyphMap in TextRenderer"
```

---

## Task 6: Create `TKAWordGlyph.svelte`

**Files:**
- Create: `src/lib/features/choreo-card/components/TKAWordGlyph.svelte`

This component renders the card-back identity line using `<img>` tags sourced from `GlyphCache`.

- [ ] **Step 1: Confirm `isDashLetter` and `getBaseLetter` exist**

```bash
grep -n "export function isDashLetter\|export function getBaseLetter" "src/lib/shared/pictograph/tka-glyph/utils/letter-image-getter.ts"
```

Expected: both functions found.

- [ ] **Step 2: Confirm `getGlyphCache` singleton export**

```bash
grep -n "export function getGlyphCache" "src/lib/shared/render/getGlyphCache.ts"
```

Expected: function found.

- [ ] **Step 3: Create the component**

Create `src/lib/features/choreo-card/components/TKAWordGlyph.svelte`:

```svelte
<!--
  TKAWordGlyph.svelte - Renders a word as a row of TKA letter glyphs.

  Uses the same SVG assets that appear in the bottom-left corner of each
  pictograph cell, assembled horizontally to spell the sequence word.
  The GlyphCache must be pre-warmed (via TextRenderer.preloadGlyphImages at
  app startup) for images to appear synchronously.
-->
<script lang="ts">
  import { getGlyphCache } from "$lib/shared/render/getGlyphCache";
  import { isDashLetter, getBaseLetter } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";

  interface Props {
    word: string;
    /** Height of each glyph in px. Dash bar scales proportionally. */
    height?: number;
  }

  let { word, height = 32 }: Props = $props();

  const cache = getGlyphCache();

  // Dash bar dimensions as fractions of glyph height.
  // Derived from Dash.svelte constants (DASH_H=20, DASH_W=70) relative to
  // a typical letter natural height of ~65px in the trimmed SVG viewBox.
  const DASH_HEIGHT_RATIO = 0.31;
  const DASH_WIDTH_RATIO = 1.08;

  const tokens = $derived(word ? tokenizeWord(word) : []);
</script>

{#if tokens.length > 0}
  <div class="tka-word-glyph" style="height: {height}px">
    {#each tokens as token}
      {@const baseLetter = isDashLetter(token) ? getBaseLetter(token) : token}
      {@const dataUrl = cache.getGlyphDataUrl(baseLetter)}
      {#if dataUrl}
        <span class="glyph">
          <img
            src={dataUrl}
            alt={token}
            height={height}
            draggable="false"
          />
          {#if isDashLetter(token)}
            <span
              class="dash-bar"
              style="height: {height * DASH_HEIGHT_RATIO}px; width: {height * DASH_WIDTH_RATIO}px;"
            ></span>
          {/if}
        </span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .tka-word-glyph {
    display: flex;
    align-items: center;
    gap: 0.15em;
    overflow: hidden;
  }

  .glyph {
    display: flex;
    align-items: center;
    gap: 0.1em;
    flex-shrink: 0;
  }

  .glyph img {
    display: block;
    width: auto;
  }

  .dash-bar {
    display: inline-block;
    background: currentColor;
    border-radius: 9999px;
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 4: Typecheck**

```bash
npm run check 2>&1 | grep -i "TKAWordGlyph\|word-tokenizer\|letter-image-getter"
```

Expected: no errors referencing these files.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/TKAWordGlyph.svelte
git commit -m "feat(choreo-card): TKAWordGlyph component for glyph word display"
```

---

## Task 7: Wire `TKAWordGlyph` into `CardBack.svelte`

**Files:**
- Modify: `src/lib/features/choreo-card/components/CardBack.svelte`

- [ ] **Step 1: Find the word span**

```bash
grep -n "class=\"word\"\|span.*word" "src/lib/features/choreo-card/components/CardBack.svelte"
```

Expected: line number for `<span class="word">{word}</span>`.

- [ ] **Step 2: Add import and replace the span**

Add import in the `<script>` block of `CardBack.svelte`:

```ts
import TKAWordGlyph from "./TKAWordGlyph.svelte";
```

Replace `<span class="word">{word}</span>` with:

```svelte
<TKAWordGlyph {word} height={24} />
```

Keep the `.word` CSS class styles in `<style>` — they may be used for layout (verify with `grep -n "\.word" CardBack.svelte`). If the `.word` class is only on the span (not referenced elsewhere), you can remove it. If it controls layout of the parent identity div, keep it and apply it to a wrapper instead.

- [ ] **Step 3: Typecheck**

```bash
npm run check 2>&1 | grep -A2 "CardBack"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/CardBack.svelte
git commit -m "feat(choreo-card): use TKA glyphs for word identity on card back"
```

---

## Task 8: Hook startup preload into `+layout.svelte`

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Find the right hook point in `initAppMode`**

```bash
grep -n "initAppMode\|containerReady\|bootProfiler" "src/routes/+layout.svelte" | head -20
```

Find where `containerReady = true` is set inside `initAppMode` — the preload fires after that point.

- [ ] **Step 2: Add the fire-and-forget preload call**

Inside `initAppMode()` in `src/routes/+layout.svelte`, after `containerReady = true`:

```ts
// Eager-load TKA letter glyph images for Choreo Card headers (non-blocking)
import("$lib/shared/render/services/implementations/TextRenderer").then(
  ({ textRenderer }) => {
    textRenderer.preloadGlyphImages().catch(() => {
      // Non-critical — card headers fall back to text on failure
    });
  }
);
```

This is a dynamic import to avoid adding `TextRenderer` to the initial bundle. Since `textRenderer` is a singleton, subsequent calls to `textRenderer.preloadGlyphImages()` are idempotent (glyphs already in `glyphImageCache`).

The idempotency guard (`if (this.glyphImageCache.size > 0) return`) is already included in the `preloadGlyphImages` implementation from Task 5.

- [ ] **Step 3: Typecheck**

```bash
npm run check 2>&1 | grep -i "layout\|textRenderer" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.svelte src/lib/shared/render/services/implementations/TextRenderer.ts
git commit -m "feat: eager-preload TKA glyph images at app startup"
```

---

## Task 9: Full check + run all affected tests

- [ ] **Step 1: Run render-composition tests**

```bash
cd packages/render-composition && npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 2: Run main app unit tests**

```bash
cd "E:/tka-platform" && npx vitest run tests/unit/render/ --config tests/config/vitest.config.ts
```

Expected: `WordTokenizer.test.ts` and `TextRendererGlyphs.test.ts` PASS, existing `DimensionCalculationService.test.ts` unaffected.

- [ ] **Step 3: Full typecheck**

```bash
npm run check
```

Expected: zero errors.

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Step 5: Verify in browser (canvas header)**

Open the Choreo Card tab at `localhost:5173`. Open any named sequence card. Confirm:
- Card front header shows TKA glyph symbols instead of Georgia text
- Level badge (left) and LOOP icons (right) still appear
- Dash letters show base glyph + rounded dash bar
- Nameless LOOP sequences show an empty center (no crash)

- [ ] **Step 6: Verify card back**

Flip/inspect the card back. Confirm the word identity line shows glyphs at ~24px height matching the card front glyphs.
