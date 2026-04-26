# TIKA Inline SVG Rendering — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TiKA's rasterized PNG pictograph rendering with inline SVG that progressively reveals element-by-element (grid, then props, then arrows, then glyphs), creating the "building itself before your eyes" experience.

**Architecture:** The existing `StandalonePictographRenderer.renderToSvg()` in `mcp-server/src/core/standalone-renderer.ts` already generates complete SVG strings but currently only uses them as an intermediate step before rasterizing to PNG. We modify the renderer to annotate SVG element groups with CSS classes and optional CSS custom property theming, expose SVG output through the existing pictograph API endpoint, and modify the client's `InlinePictograph.svelte` to request SVG format, sanitize it with DOMPurify, and render it with staggered CSS entrance animations.

**Tech Stack:** SvelteKit, TypeScript, DOMPurify (already installed v3.3.1), CSS animations, existing `@tka/render-core` calculation library

---

## Out of Scope

These are follow-on features that build on this foundation but are NOT part of this plan:

- **Concept diagrams** (grid explanation, position comparison, motion taxonomy SVGs) — separate feature
- **Sequence strip rendering** (multi-beat horizontal SVG strips) — separate feature
- **Interactive hover states** (highlighting hands/arrows on hover) — separate feature
- **Static SVG pre-generation** (build-time SVG files in `/static/pictographs/`) — separate optimization
- **InlineGallery/InlineStepGrid SVG support** — adopt after InlinePictograph proves the pattern

---

## Canonical Color Reference

Any SVG rendering MUST use these exact color values. They are defined in the codebase and must not be invented or approximated.

### Hand/Motion Colors

| Context | Blue | Red | Source |
|---------|------|-----|--------|
| Dark mode | `#3575E2` | `#ED1C24` | `@tka/render-core` constants `BLUE_COLOR_DARK`, `RED_COLOR_DARK` |
| Light mode | `#3D44B8` | `#DC2626` | `@tka/render-core` constants `BLUE_COLOR_LIGHT`, `RED_COLOR_LIGHT` |
| CSS variable | `--dm-motion-blue` | `--dm-motion-red` | `src/app.css` |

### Letter Type Colors

Defined in `src/lib/shared/pictograph/shared/domain/constants/pictograph-constants.ts`:

| Type | Description | Color 1 | Color 2 |
|------|-------------|---------|---------|
| 1 | Dual-Shift | `#36c3ff` (cyan) | `#6F2DA8` (purple) |
| 2 | Shift | `#6F2DA8` (purple) | `#6F2DA8` (purple) |
| 3 | Cross-Shift | `#26e600` (green) | `#6F2DA8` (purple) |
| 4 | Dash | `#26e600` (green) | `#26e600` (green) |
| 5 | Dual-Dash | `#00b3ff` (blue) | `#26e600` (green) |
| 6 | Static | `#eb7d00` (orange) | `#eb7d00` (orange) |

### Component Word Colors

Defined in `src/lib/features/create/construct/option-picker/services/LetterTypeTextPainter.ts`:

| Word | Color |
|------|-------|
| Shift | `#6F2DA8` (purple) |
| Dual | `#00b3ff` (blue) |
| Dash / Cross | `#26e600` (green) |
| Static | `#eb7d00` (orange) |

### Grid & Glyph Colors

| Element | Dark mode | Light mode | CSS variable |
|---------|-----------|------------|-------------|
| Grid points | `#d0d0d0` | `#000000` | — |
| Background | `#0a0a0f` | `#ffffff` | `--dm-bg` |
| Glyphs/text | `#e6e6e6` / `#ffffff` | `#231F20` / `#000000` | `--dm-glyph-fill` |

---

## File Map

### Modified files

| File | Responsibility | Changes |
|------|---------------|---------|
| `mcp-server/src/core/standalone-renderer.ts` | SVG generation | Add CSS class groups to element sections; add `themeable` and `inline` options; use CSS custom properties when themeable; guard `renderToPng` against themeable |
| `src/routes/api/tika/pictograph/+server.ts` | Pictograph API | Accept `format: 'svg'` option; return `{ svgMarkup }` when requested |
| `src/lib/features/tika/components/InlinePictograph.svelte` | Pictograph display | Request SVG format; render via `{@html}` with sanitization; progressive reveal animation |

### New files

| File | Responsibility |
|------|---------------|
| `src/lib/features/tika/services/implementations/SvgSanitizer.ts` | DOMPurify config for SVG; reusable sanitization function |
| `src/lib/features/tika/services/contracts/ISvgSanitizer.ts` | Interface for SVG sanitizer |
| `tests/unit/tika/svg-sanitizer.test.ts` | Security boundary test: ensures script injection is blocked while SVG elements are preserved |

---

## Chunk 0: Prerequisites

### Task 0: Upgrade DOMPurify to fix CVE-2026-0540

**Files:**
- Modify: `package.json`

**CVE-2026-0540**: DOMPurify 3.1.3 through 3.3.1 has an XSS bypass via rawtext element exploitation. Attackers can include payloads like `</noscript><img src=x onerror=alert(1)>` in attribute values to execute JavaScript when sanitized output is placed inside unprotected rawtext contexts. This project uses `^3.3.1` — vulnerable. Fixed in 3.3.2.

Since we're building a pipeline that renders server-generated SVG via `{@html}`, using a vulnerable sanitizer is unacceptable.

- [ ] **Step 1: Upgrade DOMPurify**

```bash
npm install dompurify@^3.3.2
```

- [ ] **Step 2: Verify existing sanitization still works**

The existing `TikaMarkdownParser.ts` uses DOMPurify. Verify it still compiles:

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
security: upgrade DOMPurify to ^3.3.2 (CVE-2026-0540)

Versions 3.1.3-3.3.1 have an XSS bypass via rawtext element
exploitation. Critical fix before adding SVG inline rendering
pipeline that uses {@html} with DOMPurify sanitization.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 1: Server-Side SVG Pipeline

### Task 1: Add CSS class groups to `renderToSvg()` in standalone-renderer.ts

**Files:**
- Modify: `mcp-server/src/core/standalone-renderer.ts` — the `renderToSvg()` method (line 262)

The `renderToSvg()` method pushes SVG fragments to a `svgParts` array. Each fragment represents a visual layer (background, grid, props, arrows, glyphs). We wrap each fragment in a `<g>` group with a semantic CSS class so the client can target them for staggered animation.

- [ ] **Step 1: Wrap background in group**

At line 285, change the background rect push:

```typescript
// Before:
svgParts.push(`<rect width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}" fill="${bgColor}"/>`);

// After:
svgParts.push(`<g class="svg-bg"><rect width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}" fill="${bgColor}"/></g>`);
```

- [ ] **Step 2: Wrap grid in group**

At lines 288-291:

```typescript
// Before:
if (showGrid) {
  const gridSvg = this.renderGrid(gridMode, darkMode);
  if (gridSvg) svgParts.push(gridSvg);
}

// After:
if (showGrid) {
  const gridSvg = this.renderGrid(gridMode, darkMode);
  if (gridSvg) svgParts.push(`<g class="svg-grid">${gridSvg}</g>`);
}
```

- [ ] **Step 3: Wrap props in groups**

At lines 295-302:

```typescript
if (showBlueMotion) {
  const blueProp = this.renderProp(input, input.blueMotion, gridMode, darkMode, bluePropType, redPropType);
  if (blueProp) svgParts.push(`<g class="svg-prop svg-prop-blue">${blueProp}</g>`);
}
if (showRedMotion) {
  const redProp = this.renderProp(input, input.redMotion, gridMode, darkMode, bluePropType, redPropType);
  if (redProp) svgParts.push(`<g class="svg-prop svg-prop-red">${redProp}</g>`);
}
```

- [ ] **Step 4: Wrap arrows in groups**

At lines 305-312:

```typescript
if (showBlueMotion) {
  const blueArrow = this.renderArrow(input, input.blueMotion, gridMode, darkMode);
  if (blueArrow) svgParts.push(`<g class="svg-arrow svg-arrow-blue">${blueArrow}</g>`);
}
if (showRedMotion) {
  const redArrow = this.renderArrow(input, input.redMotion, gridMode, darkMode);
  if (redArrow) svgParts.push(`<g class="svg-arrow svg-arrow-red">${redArrow}</g>`);
}
```

- [ ] **Step 5: Wrap glyphs in groups**

Wrap each glyph section in `<g class="svg-glyph">`:

```typescript
// Position glyph:
if (positionSvg) svgParts.push(`<g class="svg-glyph svg-glyph-position">${positionSvg}</g>`);

// Elemental glyph:
if (elementalSvg) svgParts.push(`<g class="svg-glyph svg-glyph-elemental">${elementalSvg}</g>`);

// TKA letter + turns:
if (letterSvg) svgParts.push(`<g class="svg-glyph svg-glyph-letter">${letterSvg}</g>`);

// VTG glyph:
if (vtgSvg) svgParts.push(`<g class="svg-glyph svg-glyph-vtg">${vtgSvg}</g>`);

// Reversal indicators:
if (reversalSvg) svgParts.push(`<g class="svg-glyph svg-glyph-reversal">${reversalSvg}</g>`);
```

- [ ] **Step 6: Verify renderer still produces valid SVG**

```bash
cd mcp-server && npm run build
```

The added `<g>` wrappers are standard SVG and should not affect rendering.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/core/standalone-renderer.ts
git commit -m "$(cat <<'EOF'
feat(renderer): add CSS class groups to SVG element layers

Wraps background, grid, props, arrows, and glyphs in <g> elements
with semantic class names (svg-bg, svg-grid, svg-prop-blue, etc.)
for client-side progressive reveal animation targeting.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `themeable` and `inline` options to `renderToSvg()`

**Files:**
- Modify: `mcp-server/src/core/standalone-renderer.ts`

When `themeable: true`, colors are emitted as CSS custom properties with hardcoded fallbacks. This lets the SVG adapt to the host page's theme (dark/light mode) via CSS variables already defined in `src/app.css`.

When `inline: true`, the XML declaration is omitted (not needed for `{@html}` embedding).

- [ ] **Step 1: Add new options to RenderVisibilityOptions**

At line 190, before the closing `}` of the interface:

```typescript
  /** When true, use CSS custom properties for colors (var(--dm-motion-blue, #3575E2)) */
  themeable?: boolean;
  /** When true, omit XML declaration for inline HTML embedding */
  inline?: boolean;
```

- [ ] **Step 2: Destructure new options in renderToSvg**

Add after `redPropType = null` in the destructuring block (line 278):

```typescript
  themeable = false,
  inline = false,
```

- [ ] **Step 3: Create a color resolver helper**

Add a private method to the `StandalonePictographRenderer` class:

```typescript
/**
 * Returns either a CSS custom property with fallback, or a hardcoded hex color.
 * When themeable=true, the SVG adapts to the host page's CSS variables.
 */
private resolveColor(
  cssVar: string,
  darkValue: string,
  lightValue: string,
  darkMode: boolean,
  themeable: boolean
): string {
  if (themeable) {
    return `var(${cssVar}, ${darkValue})`;
  }
  return darkMode ? darkValue : lightValue;
}
```

- [ ] **Step 4: Use color resolver for background**

Line 284:

```typescript
// Before:
const bgColor = darkMode ? "#0a0a0f" : "#ffffff";

// After:
const bgColor = this.resolveColor("--dm-bg", "#0a0a0f", "#ffffff", darkMode, themeable);
```

- [ ] **Step 5: Pass `themeable` to ALL render method call sites**

Update every render method call in `renderToSvg()` AND every method signature. Add `themeable: boolean = false` as the last parameter to each.

Call sites in `renderToSvg()`:

```typescript
// Grid:
const gridSvg = this.renderGrid(gridMode, darkMode, themeable);

// Props:
const blueProp = this.renderProp(input, input.blueMotion, gridMode, darkMode, bluePropType, redPropType, themeable);
const redProp = this.renderProp(input, input.redMotion, gridMode, darkMode, bluePropType, redPropType, themeable);

// Arrows:
const blueArrow = this.renderArrow(input, input.blueMotion, gridMode, darkMode, themeable);
const redArrow = this.renderArrow(input, input.redMotion, gridMode, darkMode, themeable);

// Position glyph:
const positionSvg = this.renderPositionGlyph(input.startPosition, input.endPosition, darkMode, themeable);

// Elemental glyph:
const elementalSvg = this.renderElementalGlyph(input.letter, input.startPosition, darkMode, themeable);

// TKA letter + turns:
const letterSvg = this.renderLetterWithTurns(input.letter, input.blueMotion?.turns, input.redMotion?.turns, darkMode, themeable);

// VTG glyph:
const vtgSvg = this.renderVTGGlyph(input.letter, input.startPosition, darkMode, themeable);

// Reversal indicators:
const reversalSvg = this.renderReversalIndicators(input.blueReversal ?? false, input.redReversal ?? false, darkMode, themeable);
```

- [ ] **Step 6: Update `renderGrid` (line 363)**

Signature: `private renderGrid(gridMode: GridMode, darkMode: boolean, themeable: boolean = false): string`

Color change at line 385:
```typescript
// Before:
const gridColor = darkMode ? "#d0d0d0" : "#000000";

// After:
const gridColor = this.resolveColor("--dm-grid-point", "#d0d0d0", "#000000", darkMode, themeable);
```

- [ ] **Step 7: Update `renderProp` (line ~469)**

Signature: add `themeable: boolean = false` as last parameter.

Color change at lines 525-527:
```typescript
// Before:
const color = motion.color === "blue"
  ? (darkMode ? BLUE_COLOR : BLUE_COLOR_LIGHT)
  : (darkMode ? RED_COLOR : RED_COLOR_LIGHT);

// After:
const color = motion.color === "blue"
  ? this.resolveColor("--dm-motion-blue", BLUE_COLOR_DARK, BLUE_COLOR_LIGHT, darkMode, themeable)
  : this.resolveColor("--dm-motion-red", RED_COLOR_DARK, RED_COLOR_LIGHT, darkMode, themeable);
```

Note: The local alias `BLUE_COLOR` (line 55) equals `BLUE_COLOR_DARK`. Use the explicit `BLUE_COLOR_DARK` import for the `resolveColor` call.

- [ ] **Step 8: Update `renderArrow` (line ~555)**

Signature: add `themeable: boolean = false` as last parameter.

Color change at lines 698-700 — same pattern as `renderProp`:
```typescript
const color = motion.color === "blue"
  ? this.resolveColor("--dm-motion-blue", BLUE_COLOR_DARK, BLUE_COLOR_LIGHT, darkMode, themeable)
  : this.resolveColor("--dm-motion-red", RED_COLOR_DARK, RED_COLOR_LIGHT, darkMode, themeable);
```

- [ ] **Step 9: Update `renderLetterWithTurns` (line 875)**

Signature: `private renderLetterWithTurns(letter: string, blueTurns: number | "fl" | undefined, redTurns: number | "fl" | undefined, darkMode: boolean, themeable: boolean = false): string`

This method has multiple color sites:

**9a.** Fallback text color (line 886):
```typescript
const textColor = this.resolveColor("--dm-glyph-fill", "#e6e6e6", "#000000", darkMode, themeable);
```

**9b.** Letter glyph fill (lines 910-915). The current code only replaces colors when `darkMode` is true. With `themeable`, we also need to replace in light mode (CSS var handles the actual color):
```typescript
// Before:
if (darkMode) {
  innerContent = innerContent.replace(/#000000/gi, "#e6e6e6");
  innerContent = innerContent.replace(/black/gi, "#e6e6e6");
  innerContent = innerContent.replace(/<path(?![^>]*fill=)/gi, '<path fill="#e6e6e6" ');
}

// After:
const glyphFill = this.resolveColor("--dm-glyph-fill", "#e6e6e6", "#000000", darkMode, themeable);
if (darkMode || themeable) {
  innerContent = innerContent.replace(/#000000/gi, glyphFill);
  innerContent = innerContent.replace(/black/gi, glyphFill);
  innerContent = innerContent.replace(/<path(?![^>]*fill=)/gi, `<path fill="${glyphFill}" `);
}
```

**9c.** Turn numbers — pass `themeable` through the chain. Update `renderTurnNumbers` (called at line 918) and `renderTurnNumber` (called by `renderTurnNumbers`):

`renderTurnNumbers` signature: add `themeable: boolean = false` as last param.
`renderTurnNumber` signature: add `themeable: boolean = false` as last param.

In `renderTurnNumber` color assignment (lines 844-846):
```typescript
// Before:
const fillColor = color === "blue"
  ? (darkMode ? BLUE_COLOR : BLUE_COLOR_LIGHT)
  : (darkMode ? RED_COLOR : RED_COLOR_LIGHT);

// After:
const fillColor = color === "blue"
  ? this.resolveColor("--dm-motion-blue", BLUE_COLOR_DARK, BLUE_COLOR_LIGHT, darkMode, themeable)
  : this.resolveColor("--dm-motion-red", RED_COLOR_DARK, RED_COLOR_LIGHT, darkMode, themeable);
```

**9d.** Error fallback text (line 929):
```typescript
const textColor = this.resolveColor("--dm-glyph-fill", "#e6e6e6", "#000000", darkMode, themeable);
```

- [ ] **Step 10: Update `renderPositionGlyph` (line 1083)**

Signature: add `themeable: boolean = false` as last parameter.

The `loadAndProcess` closure (line 1111) uses `darkMode` for color. Since it's a closure, `themeable` is captured from scope automatically.

Color change at line 1125:
```typescript
// Before:
const fillColor = darkMode ? "#e6e6e6" : "#231F20";

// After:
const fillColor = this.resolveColor("--dm-glyph-fill", "#e6e6e6", "#231F20", darkMode, themeable);
```

Also update the dark-mode replacements (lines 1137-1139):
```typescript
// Before:
if (darkMode) {
  content = content.replace(/#231F20/gi, "#e6e6e6");
  content = content.replace(/#000000/gi, "#e6e6e6");
}

// After:
if (darkMode || themeable) {
  content = content.replace(/#231F20/gi, fillColor);
  content = content.replace(/#000000/gi, fillColor);
}
```

- [ ] **Step 11: Update `renderVTGGlyph` (line 934)**

Signature: add `themeable: boolean = false` as last parameter.

Color replacements (lines 953-958):
```typescript
// Before:
if (darkMode) {
  innerContent = innerContent.replace(/#000000/gi, "#e6e6e6");
  innerContent = innerContent.replace(/black/gi, "#e6e6e6");
  innerContent = innerContent.replace(/<path(?![^>]*fill=)/gi, '<path fill="#e6e6e6" ');
}

// After:
const glyphFill = this.resolveColor("--dm-glyph-fill", "#e6e6e6", "#000000", darkMode, themeable);
if (darkMode || themeable) {
  innerContent = innerContent.replace(/#000000/gi, glyphFill);
  innerContent = innerContent.replace(/black/gi, glyphFill);
  innerContent = innerContent.replace(/<path(?![^>]*fill=)/gi, `<path fill="${glyphFill}" `);
}
```

- [ ] **Step 12: Update `renderElementalGlyph` (line 981)**

Signature: add `themeable: boolean = false` as last parameter.

The elemental glyph uses gradient fills from the SVG file itself (earth, fire, water, etc.) — NO color replacement needed. The gradients are self-contained. No `resolveColor` calls needed here.

- [ ] **Step 13: Update `renderReversalIndicators` (line 1204)**

Signature: add `themeable: boolean = false` as last parameter.

Reversal dots get colors from `calculateReversalPositions()` (line 1210), which returns hardcoded hex. Override when themeable:

```typescript
// Before:
const circles = dots.map(
  dot => `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${dot.color}"/>`
);

// After:
const circles = dots.map(dot => {
  const fill = themeable
    ? (dot.color === BLUE_COLOR_DARK || dot.color === BLUE_COLOR_LIGHT
      ? this.resolveColor("--dm-motion-blue", BLUE_COLOR_DARK, BLUE_COLOR_LIGHT, darkMode, themeable)
      : this.resolveColor("--dm-motion-red", RED_COLOR_DARK, RED_COLOR_LIGHT, darkMode, themeable))
    : dot.color;
  return `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${fill}"/>`;
});
```

- [ ] **Step 14: Guard `renderToPng` against themeable**

resvg cannot resolve CSS custom properties. Force `themeable` and `inline` off for PNG rendering. At line 246:

```typescript
// Before:
async renderToPng(input: PictographInput, options: RenderVisibilityOptions = {}): Promise<Buffer> {
  const svg = await this.renderToSvg(input, options);
  return this.svgToPng(svg, options.size || 400);
}

// After:
async renderToPng(input: PictographInput, options: RenderVisibilityOptions = {}): Promise<Buffer> {
  const svg = await this.renderToSvg(input, { ...options, themeable: false, inline: false });
  return this.svgToPng(svg, options.size || 400);
}
```

- [ ] **Step 15: Update SVG wrapper for inline mode**

At lines 353-356:

```typescript
// Before:
return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}">
${svgParts.join("\n")}
</svg>`;

// After:
const xmlDecl = inline ? "" : `<?xml version="1.0" encoding="UTF-8"?>\n`;
return `${xmlDecl}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}" role="img" aria-label="Pictograph${input.letter ? ` for letter ${input.letter}` : ''}">
${svgParts.join("\n")}
</svg>`;
```

- [ ] **Step 16: Verify renderer builds**

```bash
cd mcp-server && npm run build
```

Default `themeable: false` preserves exact existing behavior.

- [ ] **Step 17: Commit**

```bash
git add mcp-server/src/core/standalone-renderer.ts
git commit -m "$(cat <<'EOF'
feat(renderer): add themeable CSS custom properties and inline mode

When themeable=true, SVG colors use var(--dm-motion-blue, #3575E2) etc.
so inline SVGs adapt to the host page's light/dark theme automatically.
When inline=true, omits XML declaration for {@html} embedding.
Guard renderToPng against themeable (resvg can't resolve CSS vars).
Adds role='img' and aria-label for accessibility.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add SVG format to pictograph API endpoint

**Files:**
- Modify: `src/routes/api/tika/pictograph/+server.ts`

- [ ] **Step 1: Add `format` to request body destructuring**

The existing destructuring at line 124:
```typescript
// Before:
const { letter, variation = 0, gridMode = 'diamond', options = {} } = await request.json()

// After:
const { letter, variation = 0, gridMode = 'diamond', options = {}, format = 'png' } = await request.json()
```

- [ ] **Step 2: Extract motionData construction**

Before the rendering block (line ~205), extract motionData to a local variable so both branches can use it:

```typescript
const motionData = {
  letter: csvRow.letter,
  startPosition: csvRow.startPosition,
  endPosition: csvRow.endPosition,
  blueMotion: {
    motionType: csvRow.blueMotion.motionType,
    startLocation: csvRow.blueMotion.startLocation,
    endLocation: csvRow.blueMotion.endLocation,
    rotationDirection: csvRow.blueMotion.rotationDirection
  },
  redMotion: {
    motionType: csvRow.redMotion.motionType,
    startLocation: csvRow.redMotion.startLocation,
    endLocation: csvRow.redMotion.endLocation,
    rotationDirection: csvRow.redMotion.rotationDirection
  }
};
```

- [ ] **Step 3: Branch rendering on format**

Replace lines 206-231:

```typescript
const renderer = getStandaloneRenderer()

if (format === 'svg') {
  const svgMarkup = await renderer.renderToSvg(pictographInput, {
    ...visibilityOptions,
    themeable: true,
    inline: true,
  })
  return json({
    svgMarkup,
    motionData,
    variationCount: variations.length,
    variationIndex: variation,
  })
} else {
  const base64 = await renderer.renderToBase64(pictographInput, visibilityOptions)
  return json({
    imageBase64: base64,
    motionData,
    variationCount: variations.length,
    variationIndex: variation,
  })
}
```

- [ ] **Step 4: Verify endpoint works**

With the user's dev server running on 5173:

```bash
curl -s -X POST http://localhost:5173/api/tika/pictograph \
  -H "Content-Type: application/json" \
  -d '{"letter":"A","variation":0,"gridMode":"diamond","format":"svg","options":{"darkMode":true,"showTKA":true,"showGrid":true}}' \
  | head -c 200
```

Should return JSON containing `svgMarkup` starting with `<svg xmlns=`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/tika/pictograph/+server.ts
git commit -m "$(cat <<'EOF'
feat(api): add SVG format option to pictograph endpoint

POST /api/tika/pictograph now accepts format: 'svg' | 'png' (default: 'png').
SVG responses include themeable CSS custom properties and omit XML declaration
for direct inline embedding.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Client-Side SVG Rendering

### Task 4: Create SVG sanitizer service

**Files:**
- Create: `src/lib/features/tika/services/contracts/ISvgSanitizer.ts`
- Create: `src/lib/features/tika/services/implementations/SvgSanitizer.ts`
- Create: `tests/unit/tika/svg-sanitizer.test.ts`

This is a security boundary — SVG markup from the server is rendered via `{@html}`, which means any script injection in the SVG would execute. DOMPurify with an SVG-specific profile prevents this.

The `SvgSanitizer` is intentionally NOT registered in the DI container. It is stateless, has zero dependencies, and is only used by `InlinePictograph.svelte`. DI registration is for services that need testability via mocking or have dependencies to inject. A pure function wrapped in a class for interface compliance doesn't benefit from DI.

- [ ] **Step 1: Write the interface**

```typescript
// src/lib/features/tika/services/contracts/ISvgSanitizer.ts

/**
 * Sanitizes SVG markup for safe inline rendering via {@html}.
 * Allows SVG elements and attributes but blocks script injection.
 */
export interface ISvgSanitizer {
  sanitize(svgMarkup: string): string;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/unit/tika/svg-sanitizer.test.ts
import { describe, it, expect } from "vitest";
import { SvgSanitizer } from "$lib/features/tika/services/implementations/SvgSanitizer";

describe("SvgSanitizer", () => {
  const sanitizer = new SvgSanitizer();

  it("preserves valid SVG elements", () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><g class="svg-grid"><circle cx="475" cy="325" r="12" fill="#3575E2"/></g></svg>';
    const result = sanitizer.sanitize(input);
    expect(result).toContain("<circle");
    expect(result).toContain('class="svg-grid"');
    expect(result).toContain('fill="#3575E2"');
  });

  it("strips script tags", () => {
    const input = '<svg><script>alert("xss")</script><circle cx="10" cy="10" r="5"/></svg>';
    const result = sanitizer.sanitize(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<circle");
  });

  it("strips event handler attributes", () => {
    const input = '<svg><circle onclick="alert(1)" cx="10" cy="10" r="5"/></svg>';
    const result = sanitizer.sanitize(input);
    expect(result).not.toContain("onclick");
    expect(result).toContain("<circle");
  });

  it("strips foreignObject", () => {
    const input = '<svg><foreignObject><body><script>alert(1)</script></body></foreignObject></svg>';
    const result = sanitizer.sanitize(input);
    expect(result).not.toContain("foreignObject");
    expect(result).not.toContain("<script");
  });

  it("preserves CSS custom properties in fill attributes", () => {
    const input = '<svg><circle fill="var(--dm-motion-blue, #3575E2)" cx="475" cy="325" r="12"/></svg>';
    const result = sanitizer.sanitize(input);
    expect(result).toContain("var(--dm-motion-blue, #3575E2)");
  });

  it("preserves transform attributes", () => {
    const input = '<svg><g transform="translate(475, 325) rotate(45)"><rect width="10" height="10"/></g></svg>';
    const result = sanitizer.sanitize(input);
    expect(result).toContain("translate(475, 325) rotate(45)");
  });

  it("preserves path d attributes", () => {
    const input = '<svg><path d="M 10 10 L 20 20 Z" fill="#ED1C24"/></svg>';
    const result = sanitizer.sanitize(input);
    expect(result).toContain('d="M 10 10 L 20 20 Z"');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- tests/unit/tika/svg-sanitizer.test.ts
```

Expected: FAIL — `SvgSanitizer` module not found.

- [ ] **Step 4: Implement the sanitizer**

```typescript
// src/lib/features/tika/services/implementations/SvgSanitizer.ts
import DOMPurify from "dompurify";
import type { ISvgSanitizer } from "../contracts/ISvgSanitizer";

/**
 * Sanitizes SVG markup for safe inline rendering.
 *
 * The pictograph API returns SVG strings that we render via Svelte's {@html}
 * directive. Without sanitization, any script injection in the SVG would
 * execute in the user's browser. This service strips dangerous elements
 * (script, foreignObject) and attributes (onclick, onload) while preserving
 * all valid SVG rendering elements and CSS custom properties.
 */
export class SvgSanitizer implements ISvgSanitizer {
  sanitize(svgMarkup: string): string {
    return DOMPurify.sanitize(svgMarkup, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ["use"],
      ADD_ATTR: [
        "viewBox", "xmlns", "xmlns:xlink",
        "d", "cx", "cy", "r", "x", "y", "x1", "y1", "x2", "y2",
        "width", "height", "rx", "ry",
        "fill", "stroke", "stroke-width", "opacity",
        "fill-opacity", "stroke-opacity", "fill-rule",
        "stroke-dasharray", "stroke-linecap", "stroke-linejoin",
        "stroke-miterlimit",
        "text-anchor", "dominant-baseline",
        "font-size", "font-weight", "font-family",
        "transform", "preserveAspectRatio",
        "marker-end", "refX", "refY",
        "markerWidth", "markerHeight", "orient",
        "role", "aria-label", "aria-hidden",
        "class",
      ],
      FORBID_TAGS: ["script", "foreignObject"],
      FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "onfocus", "style"],
    });
  }
}
```

Note: `style` attribute is forbidden because inline styles can contain `expression()` (IE) or `url()` pointing to external resources. `fill-rule` and `stroke-miterlimit` are included because the elemental and position glyph SVGs use them. `preserveAspectRatio` is used by nested `<svg>` elements in the renderer output.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/unit/tika/svg-sanitizer.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/tika/services/contracts/ISvgSanitizer.ts src/lib/features/tika/services/implementations/SvgSanitizer.ts tests/unit/tika/svg-sanitizer.test.ts
git commit -m "$(cat <<'EOF'
feat(tika): add SVG sanitizer for safe inline rendering

DOMPurify with SVG profile strips script injection and event handlers
while preserving all valid SVG elements, CSS custom properties, and
transform attributes. Security boundary test covers XSS vectors.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Modify InlinePictograph.svelte to support SVG rendering

**Files:**
- Modify: `src/lib/features/tika/components/InlinePictograph.svelte`

The component currently renders pictographs as `<img src="data:image/png;base64,...">`. We add an SVG rendering path: request SVG format from the API, sanitize it, and render via `{@html}` with progressive reveal animation. Falls back to PNG if SVG fails.

**Caching strategy:** Themeable SVGs (with CSS custom properties) work in both light and dark mode — one cached string serves all themes, unlike PNG which would need separate dark/light versions. We use an in-memory `Map` for session-lifetime caching. This matches the existing PNG path's IndexedDB cache in purpose (avoid redundant API calls) but is simpler because SVG strings are theme-independent.

- [ ] **Step 1: Import the sanitizer**

Add at the top of the `<script>` block:

```typescript
import { SvgSanitizer } from "../services/implementations/SvgSanitizer";

const svgSanitizer = new SvgSanitizer();
```

- [ ] **Step 2: Create the SVG cache**

Add a module-level cache (outside the component, shared across all instances). This lives at the top of the `<script>` block, before the component's props/state:

```typescript
/**
 * Module-level SVG cache shared across all InlinePictograph instances.
 * Keyed by "letter-variation-gridMode[-propType]" — same key pattern as PNG cache.
 * Themeable SVGs work in both light/dark mode, so one cache entry serves all themes.
 * Persists for the browser session lifetime (cleared on page reload).
 */
const svgCache = new Map<string, string>();

function buildSvgCacheKey(pictograph: InlinePictograph): string {
  const parts = [
    pictograph.letter,
    String(pictograph.variation ?? 0),
    pictograph.gridMode ?? "diamond",
  ];
  if (pictograph.propType) parts.push(pictograph.propType);
  return parts.join("-");
}
```

- [ ] **Step 3: Add SVG state variables**

Alongside the existing `imageUrl`, `loading`, `error` state:

```typescript
let svgMarkup = $state<string | null>(null);
let useSvg = $state(true);
```

- [ ] **Step 4: Add SVG fetch function with cache**

```typescript
async function fetchSvgPictograph(): Promise<boolean> {
  const cacheKey = buildSvgCacheKey(pictograph);

  // Check cache first — avoids API call on re-render, scroll, or duplicate pictographs
  const cached = svgCache.get(cacheKey);
  if (cached) {
    svgMarkup = cached;
    return true;
  }

  try {
    const response = await fetch("/api/tika/pictograph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        letter: pictograph.letter,
        variation: pictograph.variation ?? 0,
        gridMode: pictograph.gridMode ?? "diamond",
        format: "svg",
        options: {
          darkMode: true,
          size: apiSize,
          showTKA: true,
          showGrid: true,
          ...(pictograph.propType
            ? { bluePropType: pictograph.propType, redPropType: pictograph.propType }
            : {}),
        },
      }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (!data.svgMarkup) return false;

    const sanitized = svgSanitizer.sanitize(data.svgMarkup);
    svgCache.set(cacheKey, sanitized);
    svgMarkup = sanitized;
    return true;
  } catch {
    return false;
  }
}
```

Note: Sanitization happens once at fetch time. The cached string is already sanitized — subsequent reads from cache skip DOMPurify entirely.

- [ ] **Step 5: Modify the fetch effect**

The existing `$effect` (line 79) calls `fetchPictograph()`. Modify it to try SVG first, falling back to the existing PNG path:

```typescript
$effect(() => {
  const letter = pictograph.letter;
  if (!letter) return;

  loading = true;
  error = false;
  svgMarkup = null;

  (async () => {
    if (useSvg) {
      const svgSuccess = await fetchSvgPictograph();
      if (svgSuccess) {
        loading = false;
        return;
      }
      useSvg = false;
    }
    await fetchPictograph();
  })();
});
```

The existing `fetchPictograph()` function handles its own loading/error states, so no changes needed there.

Note on animation replay: When SVG is served from cache (scroll up to old messages), the `svgMarkup` state is set synchronously and the component renders immediately. The CSS animation plays on mount — this means cached pictographs get the reveal animation on first view, which is correct. If the component is unmounted and remounted (e.g., virtual list), the animation replays. This is acceptable since the reveal is fast (810ms) and only occurs when the pictograph enters the viewport.

- [ ] **Step 5: Add reduced motion detection**

```typescript
const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
```

- [ ] **Step 6: Add SVG rendering to the template**

In the template section, add SVG rendering before the existing `<img>` in the conditional chain:

```svelte
{#if loading}
  <!-- existing loading spinner (unchanged) -->
{:else if error}
  <!-- existing error state (unchanged) -->
{:else if svgMarkup}
  <div
    class="svg-pictograph"
    class:animate={!prefersReducedMotion}
  >
    {@html svgMarkup}
  </div>
{:else if imageUrl}
  <!-- existing <img> tag (unchanged) -->
{/if}
```

- [ ] **Step 7: Add progressive reveal CSS**

In the `<style>` block:

```css
.svg-pictograph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.svg-pictograph :global(svg) {
  width: 100%;
  height: auto;
  max-width: var(--size, clamp(180px, 50vw, 320px));
}

/* Promote animated groups to compositor layer for GPU acceleration */
.svg-pictograph.animate :global(.svg-bg),
.svg-pictograph.animate :global(.svg-grid),
.svg-pictograph.animate :global(.svg-prop),
.svg-pictograph.animate :global(.svg-arrow),
.svg-pictograph.animate :global(.svg-glyph) {
  will-change: transform, opacity;
}

.svg-pictograph.animate :global(.svg-bg) {
  animation: svgReveal 0.3s ease-out both;
  animation-delay: 0ms;
}

.svg-pictograph.animate :global(.svg-grid) {
  animation: svgReveal 0.3s ease-out both;
  animation-delay: 80ms;
}

.svg-pictograph.animate :global(.svg-prop) {
  animation: svgReveal 0.35s ease-out both;
  animation-delay: 200ms;
}

.svg-pictograph.animate :global(.svg-arrow) {
  animation: svgReveal 0.35s ease-out both;
  animation-delay: 350ms;
}

.svg-pictograph.animate :global(.svg-glyph) {
  animation: svgReveal 0.3s ease-out both;
  animation-delay: 480ms;
}

@keyframes svgReveal {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .svg-pictograph :global(.svg-bg),
  .svg-pictograph :global(.svg-grid),
  .svg-pictograph :global(.svg-prop),
  .svg-pictograph :global(.svg-arrow),
  .svg-pictograph :global(.svg-glyph) {
    animation: none !important;
    opacity: 1 !important;
  }
}
```

Animation timing: Background (0ms) → Grid (80ms) → Props (200ms) → Arrows (350ms) → Glyphs (480ms). Total ~810ms.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npm run check
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/features/tika/components/InlinePictograph.svelte
git commit -m "$(cat <<'EOF'
feat(tika): render inline pictographs as SVG with progressive reveal

InlinePictograph now requests SVG format from the API and renders via
{@html} with DOMPurify sanitization. Element groups (grid, props,
arrows, glyphs) animate in with staggered timing, creating a 'building
itself' visual effect. Falls back to PNG if SVG request fails.
Respects prefers-reduced-motion.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Integration verification

**Files:** None modified — this is a verification task.

- [ ] **Step 1: Run TypeScript check**

```bash
npm run check
```

Expected: Zero errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All tests pass, including the new SVG sanitizer tests.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Manual verification (ask user)**

Tell the user:

> "The inline SVG pipeline is wired up. To verify the progressive reveal:
> 1. Open TiKA chat in your dev server
> 2. Ask about any letter (e.g., 'Explain letter A')
> 3. The pictograph should build itself: grid appears first, then the staves place, then arrows draw in, then the letter label fades in
> 4. Check browser DevTools: the SVG should contain `<g class='svg-grid'>`, `<g class='svg-prop-blue'>`, etc.
>
> If the pictograph still appears as a PNG image, check the Network tab for the `/api/tika/pictograph` request — it should include `format: 'svg'` in the request body."

- [ ] **Step 5: Commit verification notes (if any fixes needed)**

---

## Design Decisions Log

### Why NOT extract SVG building to render-core

`render-core` is a pure math package — zero I/O, zero side effects. SVG building requires loading asset files (grid SVGs, prop SVGs, arrow SVGs from disk). Moving file-loading SVG assembly into render-core would either pollute it with I/O or require a bloated asset-loader interface for a hypothetical client-side rendering use case that doesn't exist. The renderer stays in mcp-server where it belongs.

### Why modify InlinePictograph instead of creating a new component

The component's job is "render a pictograph inline." How it does that (PNG vs SVG) is an implementation detail. The same tool result (`inlinePictograph: { letter, variation, gridMode }`) drives both paths. Two components doing the same logical thing would mean the assistant message component needs to decide which to use, and InlineGallery/InlineStepGrid would need separate SVG versions too. One component with two rendering modes is cleaner.

### Why SVG fetch is a separate API call (not embedded in tool result)

Tool results flow through the AI SDK to the LLM. SVG strings are 10-50KB each. Embedding them in tool results would burn thousands of tokens per pictograph. The current architecture (tool result has lightweight metadata, client fetches the rendering) is correct. The SVG fetch adds one HTTP request per pictograph — same as the current PNG fetch.

### Why in-memory Map for SVG caching (not IndexedDB)

The PNG path uses IndexedDB for cross-session persistence. SVG caching uses a simpler in-memory `Map` because:

1. **Themeable SVGs are theme-independent** — one cached string works in both light and dark mode (CSS variables resolve at render time). PNG needs separate cached versions per theme.
2. **SVG strings are larger than base64 PNGs** — storing 50KB SVG strings in IndexedDB per letter+variation+gridMode would bloat browser storage.
3. **Session-lifetime is sufficient** — pictographs in a chat conversation are viewed during the session. Cross-session persistence (IndexedDB) matters for the PNG path because it avoids regeneration on app reload, but SVG generation is fast enough that a reload-triggered re-fetch is acceptable.
4. **Sanitization happens once** — the cached string is already DOMPurify-sanitized. Cache reads skip sanitization entirely.

If profiling later shows the API calls on page reload are a bottleneck, IndexedDB can be added as a second tier (same pattern as PNG). But start simple.

### Why `style` attribute is forbidden in sanitization

The `style` attribute can contain `expression()` (IE vector), `url()` (external resource loading), and `-moz-binding` (Firefox XBL). The renderer uses presentation attributes (`fill`, `stroke`, `transform`) instead of inline styles, so forbidding `style` loses nothing while closing injection vectors.

### Why animation uses CSS classes, not inline styles

CSS classes are declarative, cacheable, and respect `prefers-reduced-motion` via media queries. Inline styles would require JavaScript manipulation and wouldn't respect system accessibility settings without additional code.

### Why SvgSanitizer is not in the DI container

It's stateless, has zero dependencies, and is only used in one component. DI is for services that benefit from dependency injection (mockable dependencies, shared lifecycle). A pure function wrapped in a class for interface compliance doesn't benefit from container registration.

### DOM weight tradeoff

Inline SVG adds DOM nodes for every shape in the pictograph (potentially 50-100 nodes per pictograph vs 1 `<img>` node for PNG). For a chat interface with 5-10 visible pictographs, this is negligible. If SVG rendering is later adopted for InlineGallery (which can show 20+ pictographs), consider virtualizing or switching off-screen pictographs back to `<img>` to keep the DOM lean. Not a concern for this initial scope.

### DOMPurify version requirement

CVE-2026-0540 (fixed in 3.3.2) demonstrates that DOMPurify's SVG handling has been a target for bypass research. The project MUST stay on the latest patch version. The `^3.3.2` semver range will pick up future patches automatically. Source: [GitHub Advisory GHSA-v2wj-7wpq-c8vv](https://github.com/advisories/GHSA-v2wj-7wpq-c8vv).
