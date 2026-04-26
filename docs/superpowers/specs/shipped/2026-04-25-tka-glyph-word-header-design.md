# TKA Glyph Word Header — Design Spec

**Date:** 2026-04-25
**Status:** Approved — implementation pending

## Problem

The word header on Choreo Cards and the word identity on card backs render using `Georgia, serif` text. The TKA letter glyph SVGs already exist for every letter and are used on each pictograph cell. Using them to spell the word in the header would make the card a visually coherent TKA artifact: the same glyphs you see labeling each beat, assembled into the word above.

## Scope

Two surfaces:

| Surface | Renderer | Change |
|---|---|---|
| Card front header | Canvas 2D via `renderHeader()` in `packages/render-composition` | Draw glyph images instead of text |
| Card back `{word}` identity line | Svelte `<span>` in `CardBack.svelte` | Replace with `TKAWordGlyph.svelte` |

Exports (PNG/print) use the same canvas pipeline as live display — no separate export path needed.

## Architecture

### 1. New type: `GlyphImageData`

Added to `packages/render-composition/src/types.ts`:

```ts
export interface GlyphImageData {
  image: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
  isDash: boolean; // true for Type3/5 letters (W-, Σ-, Φ-, etc.)
}
```

`CanvasImageSource` is already the environment-agnostic type used throughout render-composition. `naturalWidth/naturalHeight` are passed in (not read from `HTMLImageElement`) so the interface stays Node-compatible for future MCP use.

### 2. Extended `HeaderOptions`

`packages/render-composition/src/header-renderer.ts`:

```ts
export interface HeaderOptions {
  // ... existing fields ...
  /** When present, word slot renders glyphs instead of Georgia text */
  glyphImages?: Map<string, GlyphImageData>;
}
```

When `glyphImages` is absent, `renderHeader` behaves exactly as today — zero risk to existing callers (MCP server, any other renderer).

### 3. Glyph word rendering in `renderHeader`

Replaces the text block (lines 74–92 of current `header-renderer.ts`) when `glyphImages` is provided.

**Layout algorithm:**

```
availableHeight = headerHeight * 0.65   (35% total vertical padding)
verticalCenter  = headerHeight / 2

For each letter char in word:
  data = glyphImages.get(char) or glyphImages.get(baseLetter(char))
  if missing: skip (letter has no glyph in cache)
  
  scale = availableHeight / data.naturalHeight
  glyphW = data.naturalWidth * scale

  drawImage(data.image, cursorX, verticalCenter - availableHeight/2, glyphW, availableHeight)

  if data.isDash:
    dashScale = scale
    dashW     = 70 * dashScale
    dashH     = 20 * dashScale
    dashGap   = 10 * dashScale
    dashX     = cursorX + glyphW + dashGap
    dashY     = verticalCenter - dashH / 2
    ctx.beginPath()
    ctx.roundRect(dashX, dashY, dashW, dashH, 9.5 * dashScale)
    ctx.fillStyle = darkMode ? "#ffffff" : "#231f20"
    ctx.fill()
    cursorX += glyphW + dashGap + dashW + LETTER_GAP
  else:
    cursorX += glyphW + LETTER_GAP

Total row is measured in a first pass, then startX = canvasWidth/2 - totalWidth/2
```

`LETTER_GAP = headerHeight * 0.04` (4% of header height — scales with size).

Dash constants (`70`, `20`, `10`, `9.5`) are in SVG coordinate units; they are scaled by `scale = availableHeight / naturalHeight` so they match the glyph.

**Empty word:** `glyphImages` present but `word` is empty or null → nothing drawn in the center slot. Badge and LOOP icons still render normally.

### 4. `TextRenderer` — preload and pass glyphs

`src/lib/shared/render/services/implementations/TextRenderer.ts` gains:

**`preloadGlyphImages(): Promise<void>`** — called once at app startup:
1. Calls `getGlyphCache().initialize()` to ensure all data URLs are warm
2. For each value in the `Letter` enum (imported from `$lib/shared/foundation/domain/models/Letter`), creates `new Image()`, sets `src` from `getGlyphCache().getGlyphDataUrl(letter)`, awaits the `load` event
3. Reads `naturalWidth` / `naturalHeight` from the loaded image
4. Detects `isDash` via `letter.endsWith('-')`
5. Stores in `private glyphImageCache: Map<string, GlyphImageData>`

**`renderWordHeader()` update** — builds the map and passes it:
```ts
const glyphImages = this.buildGlyphMap(word);
renderHeader(ctx, { ..., glyphImages });
```

`buildGlyphMap(word)` iterates `word` characters, resolves base letter for dash letters, returns `Map<string, GlyphImageData>` containing only the letters needed for this word (subset of full cache).

### 5. New component: `TKAWordGlyph.svelte`

`src/lib/features/choreo-card/components/TKAWordGlyph.svelte`

```svelte
<script lang="ts">
  import { getGlyphCache } from "$lib/shared/render/getGlyphCache";
  import { isDashLetter, getBaseLetter } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";

  let { word, height = 32 }: { word: string; height?: number } = $props();

  const cache = getGlyphCache();

  const letters = $derived(word ? [...word] : []);
</script>

<div class="tka-word-glyph" style="height: {height}px">
  {#each letters as char}
    {@const baseLetter = isDashLetter(char) ? getBaseLetter(char) : char}
    {@const dataUrl = cache.getGlyphDataUrl(baseLetter)}
    {#if dataUrl}
      <span class="glyph" class:dash-letter={isDashLetter(char)}>
        <img src={dataUrl} alt={char} style="height: {height}px; width: auto;" draggable="false" />
        {#if isDashLetter(char)}
          <span class="dash-bar" style="height: {height * 0.31}px; width: {height * 1.08}px;"></span>
        {/if}
      </span>
    {/if}
  {/each}
</div>

<style>
  .tka-word-glyph {
    display: flex;
    align-items: center;
    gap: 0.15em;
  }

  .glyph {
    display: flex;
    align-items: center;
    gap: 0.1em;
    flex-shrink: 0;
  }

  .dash-bar {
    display: inline-block;
    background: currentColor;
    border-radius: 9999px;
    flex-shrink: 0;
  }
</style>
```

The dash bar dimensions mirror `Dash.svelte` constants scaled to `height`:
- `DASH_HEIGHT / letterNaturalHeight ≈ 0.31` (approximated from SVG viewBox)
- `DASH_WIDTH / letterNaturalHeight ≈ 1.08`

**Note:** These ratios are derived from the SVG coordinate system. Exact ratios should be verified once the SVGs are loaded and `naturalHeight` values are confirmed. If ratios need adjustment, they live in one place in this component.

### 6. `CardBack.svelte` update

Replace:
```svelte
<span class="word">{word}</span>
```
With:
```svelte
<TKAWordGlyph {word} height={24} />
```

The `height` prop sizes the glyphs to match the surrounding card back typography. Adjust if needed after visual review.

### 7. Startup preload hook

`src/routes/+layout.svelte` — inside `initAppMode()`, after the DI container is ready, fire-and-forget (non-blocking):

```ts
import { textRenderer } from "$lib/shared/render/services/implementations/TextRenderer";
textRenderer.preloadGlyphImages().catch(() => {
  // Non-critical — falls back to text rendering if preload fails
});
```

Preload is non-blocking. If it hasn't resolved when a card first renders, `buildGlyphMap` returns an empty map and `renderHeader` falls back to text for that render. Once warm, all subsequent renders use glyphs. In practice the preload completes in <200ms on fast connections, and cards are behind user navigation anyway.

## Data Flow

```
App startup
  └─ initAppMode()
       └─ textRenderer.preloadGlyphImages()
            └─ getGlyphCache().initialize()       // fetches all SVG data URLs
            └─ for each letter: new Image() + load event → glyphImageCache

Card render (canvas)
  └─ TextRenderer.renderWordHeader()
       └─ buildGlyphMap(word)                      // subset of glyphImageCache
       └─ renderHeader(ctx, { ..., glyphImages })  // draws images, not text

Card back (Svelte)
  └─ TKAWordGlyph.svelte
       └─ getGlyphCache().getGlyphDataUrl(letter)  // synchronous cache hit
       └─ <img src={dataUrl}>                      // browser renders SVG
```

## Files Changed

| File | Change |
|---|---|
| `packages/render-composition/src/types.ts` | Add `GlyphImageData` interface |
| `packages/render-composition/src/header-renderer.ts` | Add `glyphImages` to `HeaderOptions`; add glyph rendering branch |
| `src/lib/shared/render/services/implementations/TextRenderer.ts` | Add `preloadGlyphImages()`, `buildGlyphMap()`, `glyphImageCache` |
| `src/lib/features/choreo-card/components/TKAWordGlyph.svelte` | New component |
| `src/lib/features/choreo-card/components/CardBack.svelte` | Use `TKAWordGlyph` |
| `src/routes/+layout.svelte` | Call `preloadGlyphImages()` in `initAppMode` |

## Non-Goals

- MCP server glyph rendering (no `glyphImages` passed → text unchanged)
- Other word-display surfaces outside Choreo Cards (quiz, learn, browse gallery headers)
- Animation or hover effects on the glyph word

## Verification

After implementation, verify:
1. Card front header shows glyph row for named words; badge and LOOP icons still render
2. Dash letters (W-, Σ-, Φ-, etc.) show base letter + dash bar
3. Card back identity shows glyph row matching card front style
4. Nameless sequences (empty word) — header renders with empty center, no crash
5. Export PNG/print matches live display
6. No regression on sequences that previously worked (run `npm run check`)
