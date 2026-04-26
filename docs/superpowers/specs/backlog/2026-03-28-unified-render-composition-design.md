---
status: backlog
value: 3
effort: L
remaining: Full build — unified render composition pipeline
depends_on: ""
plan_path: plans/backlog/2026-03-28-unified-render-composition.md
tags: []
last_triaged: 2026-04-26
---
# Unified Render Composition Design

**Date:** 2026-03-28
**Status:** Draft
**Goal:** Single source of truth for choreo card composition — app and MCP produce pixel-identical output.

---

## Problem

The app (`ImageComposer` + `TextRenderer`) and MCP server (`sequence-renderer.ts` + `text-renderer.ts`) have completely separate rendering pipelines for choreo card composition. Both target Canvas 2D API but duplicate every visual decision: difficulty badge colors, LOOP icons, layout tables, header/footer sizing, text fonts, border drawing. Drift between them causes visible differences:

- Level 1 difficulty badge: baby blue in app, pure white in MCP
- LOOP icons: Font Awesome glyphs in app, hand-drawn geometric shapes in MCP
- Header/footer sizing: dynamic formulas in app, fixed ratios in MCP
- QR code: present in app, absent in MCP
- Fonts: Cambria in app badges, Georgia in MCP badges

## Solution

New workspace package `packages/render-composition/` containing pure Canvas 2D drawing functions. Both the app and MCP import from it and pass their respective `CanvasRenderingContext2D`. Since browser Canvas 2D and node-canvas share the same API, the drawing code is identical in both environments.

---

## Package: `@tka/render-composition`

### Location

`packages/render-composition/`

### Exports

```
@tka/render-composition
├── difficulty-config     # Gradient stops, fonts, colors for levels 1-5
├── loop-icons            # SVG path-based LOOP component icon renderer
├── layout-tables         # Step count → [cols, rows] lookup tables
├── dimensions            # Header/footer height calculations
├── header-renderer       # Word text + difficulty badge + LOOP icons
├── footer-renderer       # Three-column user info
├── step-number-renderer  # Beat number overlays
├── border-renderer       # Smart cell borders between occupied cells
└── svg-path-painter      # SVG path d-string → Canvas 2D drawing
```

### Key Constraint

**No browser-specific APIs.** Functions receive `CanvasRenderingContext2D` + explicit dimensions (width, height) as parameters. Never `HTMLCanvasElement`, never `document.createElement()`, never DOM APIs.

---

## Module Details

### 1. `difficulty-config.ts`

Source of truth for all 5 difficulty levels. Extracted from app's `src/lib/shared/config/difficulty-styles.ts`.

```typescript
export const DIFFICULTY_FONT_FAMILY = "Cambria, serif";

export interface DifficultyLevel {
  /** CSS background string for Svelte UI components */
  cssBg: string;
  /** Canvas gradient stops for canvas rendering */
  stops: Array<{ offset: number; color: string }>;
  border: string;
  text: string;
}

export const DIFFICULTY_LEVELS: Record<number, DifficultyLevel> = {
  1: {
    cssBg: "radial-gradient(ellipse at top left, rgb(224,242,254) 0%, rgb(198,232,253) 30%, rgb(164,218,250) 70%, rgb(130,202,245) 100%)",
    stops: [
      { offset: 0, color: "rgb(224, 242, 254)" },
      { offset: 0.3, color: "rgb(198, 232, 253)" },
      { offset: 0.7, color: "rgb(164, 218, 250)" },
      { offset: 1, color: "rgb(130, 202, 245)" },
    ],
    border: "#000",
    text: "#000",
  },
  // ... levels 2-5 (same pattern)
};

/** Helper to apply gradient stops to a CanvasGradient */
export function applyGradientStops(
  gradient: CanvasGradient,
  stops: Array<{ offset: number; color: string }>
): CanvasGradient;
```

### 2. `svg-path-painter.ts`

Parses SVG path `d` attribute strings and replays them as Canvas 2D calls. Supports all standard SVG path commands: `M m L l H h V v C c S s Q q T t A a Z z`.

Based on the existing proven implementation at `src/lib/shared/render/utils/svg-path-parser.ts` (396 lines), which already handles all commands including arc-to-bezier conversion. This file moves to the shared package since it only depends on `CanvasRenderingContext2D` (available in both browser and node-canvas).

```typescript
/**
 * Draw an SVG path string onto a Canvas 2D context.
 * Scales from the source viewBox to the target rectangle.
 */
export function drawSvgPath(
  ctx: CanvasRenderingContext2D,
  pathData: string,
  viewBox: { width: number; height: number },
  target: { x: number; y: number; width: number; height: number }
): void;
```

Implementation: ~200 lines. Tokenizes the path string, tracks current point and control points, emits `ctx.moveTo()`, `ctx.lineTo()`, `ctx.bezierCurveTo()`, `ctx.quadraticCurveTo()`, `ctx.closePath()`. Arc commands (A/a) are converted to cubic bezier curves via `arcToBezier()` since Canvas 2D's `arc()` only handles circular arcs, not SVG's elliptical arc parameterization.

### 3. `loop-icons.ts`

Embeds the 7 Font Awesome icon SVG path strings as constants (extracted from `@fortawesome/fontawesome-free/svgs/solid/*.svg`). Draws them via `svg-path-painter`. The package defines its own `LOOPComponent` string union type (not importing from app's generate-models) so it has no Svelte dependencies.

```typescript
/** LOOP component identifiers — shared between app and MCP */
export type LOOPComponentId =
  | "rotated" | "mirrored" | "flipped"
  | "swapped" | "inverted" | "rewound";

// Embedded path data from FA7 solid icons
const LOOP_ICON_PATHS: Record<LOOPComponentId | "freeform", { d: string; viewBox: [number, number] }> = {
  rotated:  { d: "M480.1 192l7.9 0c13.3...", viewBox: [512, 512] },
  mirrored: { d: "M470.6 374.6l96-96...",    viewBox: [576, 512] },
  flipped:  { d: "M150.6-22.6c-12.5...",     viewBox: [256, 512] },
  swapped:  { d: "M403.8 34.4c12-5...",      viewBox: [512, 512] },
  inverted: { d: "M448 256c0-106...",         viewBox: [512, 512] },
  rewound:  { d: "M204.3 43.1C215.9...",     viewBox: [576, 512] },
  freeform: { d: "M0 256c0-88.4 71.6...",    viewBox: [640, 512] },  // fa-infinity
};

const LOOP_ICON_COLORS: Record<LOOPComponentId | "freeform", string> = {
  rotated:  "#36c3ff",
  mirrored: "#6F2DA8",
  flipped:  "#e91e63",
  swapped:  "#26e600",
  inverted: "#eb7d00",
  rewound:  "#00bcd4",
  freeform: "#9e9e9e",
};

/**
 * Render a horizontal strip of LOOP component icons.
 * When components is empty and showFreeformWhenEmpty is true, shows infinity icon.
 */
export function renderLoopIconStrip(
  ctx: CanvasRenderingContext2D,
  components: Set<LOOPComponentId>,
  centerX: number,
  centerY: number,
  iconSize: number,
  darkMode: boolean,
  showFreeformWhenEmpty?: boolean
): { totalWidth: number };
```

Drawing behavior (matches app's `LOOPIconStripRenderer`):
- Drop shadow: `shadowColor = darkMode ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)"`, `shadowBlur = 2`, `shadowOffsetY = 1`
- Fill color from `LOOP_ICON_COLORS`
- Gap between icons: `Math.max(2, Math.round(iconSize * 0.15))`
- Icons centered at `centerX`

### 4. `layout-tables.ts`

The four layout lookup tables from app's `LayoutCalculator`, plus the `BASE_BEAT_SIZE` constant.

```typescript
export const BASE_BEAT_SIZE = 144;

export type StartPositionLayout = "sidebar" | "top" | "column" | "row" | "none";

export function getLayout(
  stepCount: number,
  startPositionLayout: StartPositionLayout
): [columns: number, rows: number];

export function calculateImageDimensions(
  layout: [number, number],
  additionalHeight: number,
  stepSize: number
): [width: number, height: number];
```

### 5. `dimensions.ts`

Header/footer height calculation. The app's `ImageComposer` uses simple fractions of `stepSize` (the cell pixel size). This is the source of truth — the `DimensionCalculator` step-count table is a legacy path not used by the actual composition.

```typescript
/** Header height = 1/3 of cell size */
export function calculateHeaderHeight(stepSize: number): number {
  return Math.floor(stepSize / 3);
}

/** Footer height = 1/7 of cell size */
export function calculateFooterHeight(stepSize: number): number {
  return Math.floor(stepSize / 7);
}
```

These formulas ensure the header and footer scale proportionally with the pictograph grid, regardless of step count.

### 6. `header-renderer.ts`

Renders the header bar: background, word text, difficulty badge (left), LOOP icons (right).

```typescript
export function renderHeader(
  ctx: CanvasRenderingContext2D,
  options: {
    canvasWidth: number;
    headerHeight: number;
    word: string;
    difficultyLevel?: number;
    showDifficultyBadge?: boolean;
    loopComponents?: Set<LOOPComponentId>;
    darkMode?: boolean;
    letterStyles?: Array<{ letter: string; dimmed: boolean }>;
  }
): void;
```

Drawing behavior (from app's `TextRenderer.renderWordHeader`):
- Background: `darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)"`
- Border line: 1px at bottom edge
- Word font: `700 {66% of headerHeight}px Georgia, serif`
- Word color: `darkMode ? "#ffffff" : "#1f2937"`
- Badge size: 90% of header height
- Badge padding: 5% of header height
- Difficulty badge: linear gradient (top-left to bottom-right) using `DIFFICULTY_LEVELS` config, font from `DIFFICULTY_FONT_FAMILY`
- LOOP icons: positioned at right edge using `renderLoopIconStrip`

### 7. `footer-renderer.ts`

Renders the footer bar: background, three-column layout (username, notes, date).

```typescript
export function renderFooter(
  ctx: CanvasRenderingContext2D,
  options: {
    canvasWidth: number;
    canvasHeight: number;
    footerHeight: number;
    userName?: string;
    notes?: string;
    birthday?: Date;
    darkMode?: boolean;
    showCreatorName?: boolean;
    showNotes?: boolean;
    showBirthday?: boolean;
  }
): void;
```

Drawing behavior (from app's `TextRenderer.renderUserInfo`):
- Background and border: same as header
- Font size: `Math.max(10, Math.floor(footerHeight * 0.55))`
- Font: `Georgia, serif`
- Username: bold, left-aligned
- Notes: normal weight, centered. Default: "Created using TKA Composer"
- Date: normal weight, right-aligned. Format: manual `${month}-${day}-${year}` (no `Intl.DateTimeFormat` to avoid locale variation between browser and Node). Birthday prefix: `🎂`

### 8. `step-number-renderer.ts`

Renders beat number overlays on each pictograph cell.

```typescript
export function renderStepNumber(
  ctx: CanvasRenderingContext2D,
  stepNumber: number,
  cellX: number,
  cellY: number,
  cellSize: number,
  darkMode: boolean
): void;
```

Constants (from app's `StepNumberRenderer`):
- ViewBox scale: 950
- Position: (50, 50) in viewBox coords
- Number font size: 100 (scaled)
- Label font size: 80 (scaled) — for "Start" (stepNumber=0) and "End" (stepNumber=-2)
- Font: `bold {fontSize}px Georgia, serif`
- Color: `darkMode ? "#ffffff" : "#231f20"`

### 9. `border-renderer.ts`

Draws smart cell borders between occupied grid cells.

```typescript
export function renderSmartBorders(
  ctx: CanvasRenderingContext2D,
  options: {
    columns: number;
    rows: number;
    cellSize: number;
    offsetY: number;
    occupiedCells: Set<string>; // "col,row" format
    darkMode: boolean;
  }
): void;
```

---

## Migration Plan

### Phase 1: Create Package

1. Create `packages/render-composition/` with TypeScript config
2. Add to pnpm workspace
3. Implement all modules with app's values as source of truth
4. Unit tests for `svg-path-painter` and `layout-tables`

### Phase 2: MCP Adopts Package

1. Add `@tka/render-composition` as dependency to `mcp-server/`
2. Replace MCP's `text-renderer.ts` header/footer/badge/LOOP rendering with calls to the shared package
3. Replace MCP's layout calculation with shared layout tables
4. Replace MCP's step number rendering with shared renderer
5. Delete MCP's `drawLOOPIcon()`, `renderLevelBadge()`, `renderLOOPGlyph()` — replaced by package
6. Delete MCP's layout calculation logic — replaced by package
7. Verify: MCP output matches app output for the same sequence

### Phase 3: App Adopts Package

1. Add `@tka/render-composition` as dependency to app
2. Replace app's `LOOPIconStripRenderer` font glyph approach with SVG path approach from package (FA font remains needed for live Svelte UI; only canvas export rendering switches from font glyphs to SVG paths)
3. Replace app's `TextRenderer` header/footer drawing with package functions
4. Replace app's `LayoutCalculator` with package exports
5. Replace app's `StepNumberRenderer` with package export
6. Delete app's `LOOPGlyphRenderer` (pie chart) entirely
7. App's `difficulty-styles.ts` becomes a thin re-export from package (preserving `cssBg` for Svelte components)
8. App's `LOOPComponent` enum maps to package's `LOOPComponentId` string union at the boundary
9. Verify: app output unchanged

### Phase 4: QR Code Parity

1. Add `qr-code-styling` as dependency to `@tka/render-composition`
2. Extract QR generation into package (the library works in both browser and Node.js)
3. MCP gains QR code support using the same styled QR as the app
4. Same short-code URL, same dot style, same error correction level

---

## What Stays Where

| Concern | Location | Reason |
|---------|----------|--------|
| Pictograph rendering (Canvas2D) | App's `Canvas2DDirectRenderer` | Browser-specific caching (IndexedDB, LRU) |
| Pictograph rendering (SVG→Resvg) | MCP's `standalone-renderer.ts` | Node-specific SVG pipeline |
| Caching | App only | Browser IndexedDB + LRU memory |
| Export UI / download | App's `ChoreoCardExport.svelte` | Svelte component |
| MCP tool definitions | MCP's `sequence-tools.ts` | MCP-specific |
| Composition (header, footer, badges, icons, layout, borders, step numbers) | `@tka/render-composition` | **SHARED** |
| Difficulty config | `@tka/render-composition` | **SHARED** |
| LOOP icon rendering | `@tka/render-composition` | **SHARED** |
| QR code generation | `@tka/render-composition` | **SHARED** |

---

## LOOP Detection Fix (Bonus)

The SSSS rotated loop detection bug in the sequence viewer also needs fixing. Two separate detectors have issues:

1. **`SequenceAnalyzer.detectCompletedLoopTypes()`** — checks `endPosition → nextBeat.startPosition` pairs. In a continuous sequence these are always the same position (gamma3→gamma3), never matching QUARTERED_LOOPS. Should check `startPosition → startPosition` progression across beats instead.

2. **MCP's `checkRotatedPattern()`** in `packages/sequence-engine/` — uses `HALF_POSITION_MAP` (180°) instead of a quarter position map for quartered detection. Works for SSSS by coincidence (180° pairs happen to match), but conceptually wrong.

These are separate bugs from the rendering unification and should be fixed independently.

---

## Success Criteria

1. Generate the same SSSS sequence via MCP tool and via app export — images are pixel-identical (except for individual pictograph rendering differences between Canvas2D and SVG→Resvg)
2. Difficulty badge level 1 is baby blue in both
3. LOOP icon strip looks the same in both (same icons, same colors, same sizing)
4. QR code present and identical in both
5. Header/footer sizing, fonts, colors, spacing all match
6. Changing a value in `@tka/render-composition` automatically updates both app and MCP
