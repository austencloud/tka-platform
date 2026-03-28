# Unified Render Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@tka/render-composition` package so app and MCP produce pixel-identical choreo card composition (headers, footers, badges, LOOP icons, layout, borders).

**Architecture:** Pure Canvas 2D drawing functions in a shared workspace package. Both browser canvas and node-canvas implement the same `CanvasRenderingContext2D` API, so drawing code is identical in both environments. The package defines its own types (no Svelte imports) and embeds Font Awesome icon SVG path data as constants.

**Tech Stack:** TypeScript, Canvas 2D API, Vitest, pnpm workspace

**Spec:** `docs/superpowers/specs/2026-03-28-unified-render-composition-design.md`

---

## File Structure

### New Package: `packages/render-composition/`

```
packages/render-composition/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Package entry — re-exports all public API
│   ├── types.ts                    # LOOPComponentId, DifficultyLevel, StartPositionLayout
│   ├── difficulty-config.ts        # DIFFICULTY_LEVELS, DIFFICULTY_FONT_FAMILY, applyGradientStops
│   ├── svg-path-painter.ts         # drawSvgPath() — moved from app's svg-path-parser.ts
│   ├── loop-icons.ts               # LOOP_ICON_PATHS, LOOP_ICON_COLORS, renderLoopIconStrip()
│   ├── layout-tables.ts            # Layout lookup tables, getLayout(), calculateImageDimensions()
│   ├── dimensions.ts               # calculateHeaderHeight(), calculateFooterHeight()
│   ├── header-renderer.ts          # renderHeader()
│   ├── footer-renderer.ts          # renderFooter()
│   ├── step-number-renderer.ts     # renderStepNumber()
│   └── border-renderer.ts          # renderSmartBorders()
└── tests/
    ├── svg-path-painter.test.ts
    ├── layout-tables.test.ts
    ├── dimensions.test.ts
    └── loop-icons.test.ts
```

### Modified Files

**MCP Server (Phase 2):**
- Modify: `mcp-server/package.json` — add `@tka/render-composition` dependency
- Modify: `mcp-server/src/core/text-renderer.ts` — replace header/footer/badge/LOOP rendering with package calls
- Modify: `mcp-server/src/core/sequence-renderer.ts` — replace layout calc and step numbers with package calls

**App (Phase 3):**
- Modify: `src/lib/shared/render/services/implementations/TextRenderer.ts` — delegate to package
- Modify: `src/lib/shared/render/services/implementations/LOOPIconStripRenderer.ts` — switch from FA font glyphs to SVG path rendering via package
- Modify: `src/lib/shared/config/difficulty-styles.ts` — re-export from package
- Modify: `src/lib/shared/render/services/implementations/LayoutCalculator.ts` — delegate to package
- Modify: `src/lib/shared/render/services/implementations/StepNumberRenderer.ts` — delegate to package
- Delete: `src/lib/shared/render/services/implementations/LOOPGlyphRenderer.ts` (pie chart — replaced)
- Move: `src/lib/shared/render/utils/svg-path-parser.ts` → package (with re-export shim)

---

## Task 1: Package Scaffold

**Files:**
- Create: `packages/render-composition/package.json`
- Create: `packages/render-composition/tsconfig.json`
- Create: `packages/render-composition/vitest.config.ts`
- Create: `packages/render-composition/src/index.ts`
- Create: `packages/render-composition/src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@tka/render-composition",
  "version": "0.1.0",
  "description": "Shared choreo card composition — headers, footers, badges, LOOP icons, layout. Used by both app and MCP.",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create types.ts with shared type definitions**

```typescript
/** LOOP component identifiers — shared between app and MCP */
export type LOOPComponentId =
  | "rotated"
  | "mirrored"
  | "flipped"
  | "swapped"
  | "inverted"
  | "rewound";

/** Gradient stop for canvas rendering */
export interface GradientStop {
  offset: number;
  color: string;
}

/** Difficulty level visual config */
export interface DifficultyLevel {
  /** CSS background string for Svelte UI components */
  cssBg: string;
  /** Canvas gradient stops */
  stops: GradientStop[];
  /** Border color */
  border: string;
  /** Text color */
  text: string;
}

/** Start position layout mode */
export type StartPositionLayout = "sidebar" | "top" | "column" | "row" | "none";

/** Letter styling for header (bridge/derived letters) */
export interface LetterStyle {
  letter: string;
  dimmed: boolean;
}
```

- [ ] **Step 5: Create empty index.ts**

```typescript
// @tka/render-composition — shared choreo card composition
export * from "./types.js";
```

- [ ] **Step 6: Install dependencies and verify**

Run: `cd packages/render-composition && pnpm install`
Expected: Dependencies installed, no errors

- [ ] **Step 7: Commit**

```
git add packages/render-composition/
git commit -m "feat(render-composition): scaffold shared package"
```

---

## Task 2: Difficulty Config

**Files:**
- Create: `packages/render-composition/src/difficulty-config.ts`
- Modify: `packages/render-composition/src/index.ts`

Source of truth: `src/lib/shared/config/difficulty-styles.ts`

- [ ] **Step 1: Create difficulty-config.ts**

Copy exact gradient stops from the app's `difficulty-styles.ts`. All 5 levels with their `cssBg`, `stops`, `border`, `text` values. Include `DIFFICULTY_FONT_FAMILY` constant and `applyGradientStops` helper.

```typescript
import type { DifficultyLevel, GradientStop } from "./types.js";

export const DIFFICULTY_FONT_FAMILY = "Cambria, serif";

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
  // Copy levels 2-5 exactly from src/lib/shared/config/difficulty-styles.ts
};

export const DEFAULT_DIFFICULTY_STYLE: DifficultyLevel = DIFFICULTY_LEVELS[1]!;

export function applyGradientStops(
  gradient: CanvasGradient,
  stops: GradientStop[]
): CanvasGradient {
  for (const { offset, color } of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}
```

- [ ] **Step 2: Add export to index.ts**

```typescript
export * from "./difficulty-config.js";
```

- [ ] **Step 3: Commit**

```
git add packages/render-composition/src/
git commit -m "feat(render-composition): add difficulty config with all 5 levels"
```

---

## Task 3: SVG Path Painter

**Files:**
- Create: `packages/render-composition/src/svg-path-painter.ts`
- Create: `packages/render-composition/tests/svg-path-painter.test.ts`

Source: Move from `src/lib/shared/render/utils/svg-path-parser.ts` (396 lines, pure Canvas 2D — fully portable).

- [ ] **Step 1: Copy svg-path-parser.ts to package**

Copy the entire file from `src/lib/shared/render/utils/svg-path-parser.ts` to `packages/render-composition/src/svg-path-painter.ts`. Add a convenience wrapper `drawSvgPath()` that takes a raw `d` string + viewBox + target rect:

```typescript
// At the end of the copied file, add:

/**
 * Draw an SVG path string onto a Canvas 2D context, scaled from viewBox to target rect.
 */
export function drawSvgPath(
  ctx: CanvasRenderingContext2D,
  pathData: string,
  viewBox: { width: number; height: number },
  target: { x: number; y: number; width: number; height: number }
): void {
  const commands = parsePathData(pathData);
  const scaleX = target.width / viewBox.width;
  const scaleY = target.height / viewBox.height;
  const scale = Math.min(scaleX, scaleY);
  // Center within target
  const offsetX = target.x + (target.width - viewBox.width * scale) / 2;
  const offsetY = target.y + (target.height - viewBox.height * scale) / 2;
  drawPathCommands(ctx, commands, offsetX, offsetY, scale);
}
```

- [ ] **Step 2: Write test for drawSvgPath with simple path**

```typescript
// tests/svg-path-painter.test.ts
import { describe, it, expect } from "vitest";
import { parsePathData } from "../src/svg-path-painter.js";

describe("parsePathData", () => {
  it("parses M L Z commands", () => {
    const commands = parsePathData("M10 20 L30 40 Z");
    expect(commands).toHaveLength(3);
    expect(commands[0]).toEqual({ cmd: "M", args: [10, 20] });
    expect(commands[1]).toEqual({ cmd: "L", args: [30, 40] });
    expect(commands[2]).toEqual({ cmd: "Z", args: [] });
  });

  it("parses H and V commands", () => {
    const commands = parsePathData("M0 0 H50 V100");
    expect(commands).toHaveLength(3);
    expect(commands[1]).toEqual({ cmd: "H", args: [50] });
    expect(commands[2]).toEqual({ cmd: "V", args: [100] });
  });

  it("parses cubic bezier C command", () => {
    const commands = parsePathData("M0 0 C10 20 30 40 50 60");
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual({ cmd: "C", args: [10, 20, 30, 40, 50, 60] });
  });

  it("parses FA rotate icon path without error", () => {
    // First few commands of the fa-rotate SVG path
    const d = "M480.1 192l7.9 0c13.3 0 24-10.7 24-24l0-144c0-9.7-5.8-18.5-14.8-22.2";
    const commands = parsePathData(d);
    expect(commands.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd packages/render-composition && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Add export to index.ts**

```typescript
export { drawSvgPath, drawPathCommands, parsePathData } from "./svg-path-painter.js";
```

- [ ] **Step 5: Commit**

```
git add packages/render-composition/
git commit -m "feat(render-composition): add SVG path painter (moved from app)"
```

---

## Task 4: LOOP Icons

**Files:**
- Create: `packages/render-composition/src/loop-icons.ts`
- Create: `packages/render-composition/tests/loop-icons.test.ts`

- [ ] **Step 1: Create loop-icons.ts with embedded FA path data**

Extract exact SVG `d` strings from `flowtrails/node_modules/@fortawesome/fontawesome-free/svgs/solid/` for: rotate, arrows-left-right, arrows-up-down, shuffle, circle-half-stroke, backward, infinity.

```typescript
import type { LOOPComponentId } from "./types.js";
import { drawSvgPath } from "./svg-path-painter.js";

const DISPLAY_ORDER: LOOPComponentId[] = [
  "rotated", "mirrored", "flipped", "swapped", "inverted", "rewound",
];

// Full path data extracted from FA7 solid SVGs
const LOOP_ICON_PATHS: Record<LOOPComponentId | "freeform", { d: string; viewBox: [number, number] }> = {
  rotated:  { d: "M480.1 192l7.9 0c13.3 0 24-10.7 24-24l0-144c0-9.7-5.8-18.5-14.8-22.2S477.9 .2 471 7L419.3 58.8C375 22.1 318 0 256 0 127 0 20.3 95.4 2.6 219.5 .1 237 12.2 253.2 29.7 255.7s33.7-9.7 36.2-27.1C79.2 135.5 159.3 64 256 64 300.4 64 341.2 79 373.7 104.3L327 151c-6.9 6.9-8.9 17.2-5.2 26.2S334.3 192 344 192l136.1 0zm29.4 100.5c2.5-17.5-9.7-33.7-27.1-36.2s-33.7 9.7-36.2 27.1c-13.3 93-93.4 164.5-190.1 164.5-44.4 0-85.2-15-117.7-40.3L185 361c6.9-6.9 8.9-17.2 5.2-26.2S177.7 320 168 320L24 320c-13.3 0-24 10.7-24 24L0 488c0 9.7 5.8 18.5 14.8 22.2S34.1 511.8 41 505l51.8-51.8C137 489.9 194 512 256 512 385 512 491.7 416.6 509.4 292.5z", viewBox: [512, 512] },
  // ... embed all 7 paths with exact d strings and viewBox dimensions
  // mirrored: viewBox [576, 512]
  // flipped: viewBox [256, 512]
  // swapped: viewBox [512, 512]
  // inverted: viewBox [512, 512]
  // rewound: viewBox [576, 512]
  // freeform: viewBox [640, 512]
};

export const LOOP_ICON_COLORS: Record<LOOPComponentId | "freeform", string> = {
  rotated:  "#36c3ff",
  mirrored: "#6F2DA8",
  flipped:  "#e91e63",
  swapped:  "#26e600",
  inverted: "#eb7d00",
  rewound:  "#00bcd4",
  freeform: "#9e9e9e",
};

export function renderLoopIconStrip(
  ctx: CanvasRenderingContext2D,
  components: Set<LOOPComponentId>,
  centerX: number,
  centerY: number,
  iconSize: number,
  darkMode: boolean,
  showFreeformWhenEmpty: boolean = false
): { totalWidth: number } {
  const active = DISPLAY_ORDER.filter(c => components.has(c));

  if (active.length === 0) {
    if (showFreeformWhenEmpty) {
      drawLoopIcon(ctx, "freeform", centerX, centerY, iconSize, LOOP_ICON_COLORS.freeform, darkMode);
    }
    return { totalWidth: showFreeformWhenEmpty ? iconSize : 0 };
  }

  const gap = Math.max(2, Math.round(iconSize * 0.15));
  const totalWidth = active.length * iconSize + (active.length - 1) * gap;
  let currentX = centerX - totalWidth / 2 + iconSize / 2;

  for (const component of active) {
    drawLoopIcon(ctx, component, currentX, centerY, iconSize, LOOP_ICON_COLORS[component], darkMode);
    currentX += iconSize + gap;
  }

  return { totalWidth };
}

function drawLoopIcon(
  ctx: CanvasRenderingContext2D,
  component: LOOPComponentId | "freeform",
  x: number,
  y: number,
  size: number,
  color: string,
  darkMode: boolean
): void {
  const iconData = LOOP_ICON_PATHS[component];
  if (!iconData) return;

  ctx.save();

  // Drop shadow matching app's LOOPIconStripRenderer
  ctx.shadowColor = darkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = color;

  // Draw the FA icon path scaled into the icon bounding box
  const target = { x: x - size / 2, y: y - size / 2, width: size, height: size };
  drawSvgPath(ctx, iconData.d, { width: iconData.viewBox[0], height: iconData.viewBox[1] }, target);
  ctx.fill();

  ctx.restore();
}
```

- [ ] **Step 2: Write test verifying icon data is complete**

```typescript
// tests/loop-icons.test.ts
import { describe, it, expect } from "vitest";
import { LOOP_ICON_COLORS, renderLoopIconStrip } from "../src/loop-icons.js";

describe("loop-icons", () => {
  it("has colors for all 6 components plus freeform", () => {
    expect(Object.keys(LOOP_ICON_COLORS)).toHaveLength(7);
    expect(LOOP_ICON_COLORS.rotated).toBe("#36c3ff");
    expect(LOOP_ICON_COLORS.freeform).toBe("#9e9e9e");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd packages/render-composition && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Add export to index.ts**

```typescript
export { renderLoopIconStrip, LOOP_ICON_COLORS } from "./loop-icons.js";
```

- [ ] **Step 5: Commit**

```
git add packages/render-composition/
git commit -m "feat(render-composition): add LOOP icon strip with embedded FA SVG paths"
```

---

## Task 5: Layout Tables

**Files:**
- Create: `packages/render-composition/src/layout-tables.ts`
- Create: `packages/render-composition/tests/layout-tables.test.ts`

Source of truth: `src/lib/shared/render/services/implementations/LayoutCalculator.ts`

- [ ] **Step 1: Create layout-tables.ts**

Copy the 4 layout lookup tables exactly from `LayoutCalculator.ts`: `WITH_START_POSITION`, `WITHOUT_START_POSITION`, `WITH_START_COLUMN`, `WITH_START_ROW`.

```typescript
import type { StartPositionLayout } from "./types.js";

export const BASE_BEAT_SIZE = 144;

// Copy exact lookup tables from LayoutCalculator.ts
const WITH_START_POSITION: Record<number, [number, number]> = {
  0: [1, 1], 1: [2, 1], 2: [3, 1], 3: [4, 1], 4: [3, 2], /* ... all 65 entries */
};
// ... 3 more tables

export function getLayout(
  stepCount: number,
  startPositionLayout: StartPositionLayout
): [columns: number, rows: number] {
  const table = getTableForLayout(startPositionLayout);
  return table[stepCount] ?? table[64] ?? [4, 4];
}

export function calculateImageDimensions(
  layout: [number, number],
  additionalHeight: number,
  stepSize: number
): [width: number, height: number] {
  const [columns, rows] = layout;
  const width = Math.floor(columns * stepSize);
  const height = Math.floor(rows * stepSize + additionalHeight);
  return [width, height];
}
```

- [ ] **Step 2: Write test for layout lookups**

```typescript
// tests/layout-tables.test.ts
import { describe, it, expect } from "vitest";
import { getLayout, calculateImageDimensions, BASE_BEAT_SIZE } from "../src/layout-tables.js";

describe("getLayout", () => {
  it("returns correct layout for 4 steps with start position", () => {
    expect(getLayout(4, "sidebar")).toEqual([3, 2]);
  });

  it("returns correct layout for 4 steps without start", () => {
    expect(getLayout(4, "none")).toEqual([2, 2]);
  });

  it("returns correct layout for 12 steps without start", () => {
    expect(getLayout(12, "none")).toEqual([3, 4]);
  });
});

describe("calculateImageDimensions", () => {
  it("calculates width and height from layout", () => {
    const [w, h] = calculateImageDimensions([3, 2], 100, 300);
    expect(w).toBe(900);
    expect(h).toBe(700);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd packages/render-composition && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Add export to index.ts and commit**

```
git add packages/render-composition/
git commit -m "feat(render-composition): add layout tables from app's LayoutCalculator"
```

---

## Task 6: Dimensions, Step Numbers, Borders

**Files:**
- Create: `packages/render-composition/src/dimensions.ts`
- Create: `packages/render-composition/src/step-number-renderer.ts`
- Create: `packages/render-composition/src/border-renderer.ts`
- Create: `packages/render-composition/tests/dimensions.test.ts`

- [ ] **Step 1: Create dimensions.ts**

```typescript
/** Header height = 1/3 of cell size (from ImageComposer) */
export function calculateHeaderHeight(stepSize: number): number {
  return Math.floor(stepSize / 3);
}

/** Footer height = 1/7 of cell size (from ImageComposer) */
export function calculateFooterHeight(stepSize: number): number {
  return Math.floor(stepSize / 7);
}
```

- [ ] **Step 2: Create step-number-renderer.ts**

Copy exact drawing code from app's `StepNumberRenderer.ts`:

```typescript
const VIEW_BOX_SIZE = 950;
const STEP_NUMBER_X = 50;
const STEP_NUMBER_Y = 50;
const NUMBER_FONT_SIZE = 100;
const LABEL_FONT_SIZE = 80;

export function renderStepNumber(
  ctx: CanvasRenderingContext2D,
  stepNumber: number,
  cellX: number,
  cellY: number,
  cellSize: number,
  darkMode: boolean
): void {
  if (stepNumber === null || stepNumber === undefined || stepNumber === -1) return;

  const scale = cellSize / VIEW_BOX_SIZE;
  const isLabel = stepNumber === 0 || stepNumber === -2;
  const fontSize = (isLabel ? LABEL_FONT_SIZE : NUMBER_FONT_SIZE) * scale;
  const text = stepNumber === 0 ? "Start" : stepNumber === -2 ? "End" : stepNumber.toString();

  ctx.save();
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  ctx.fillStyle = darkMode ? "#ffffff" : "#231f20";
  ctx.textAlign = "start";
  ctx.textBaseline = "hanging";
  ctx.fillText(text, cellX + STEP_NUMBER_X * scale, cellY + STEP_NUMBER_Y * scale);
  ctx.restore();
}
```

- [ ] **Step 3: Create border-renderer.ts**

Copy exact drawing code from app's `ImageComposer.drawSmartCellBorders()`:

```typescript
export function renderSmartBorders(
  ctx: CanvasRenderingContext2D,
  options: {
    columns: number;
    rows: number;
    cellSize: number;
    offsetY: number;
    occupiedCells: Set<string>;
    darkMode: boolean;
  }
): void {
  const { columns, rows, cellSize, offsetY, occupiedCells, darkMode } = options;
  ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.15)" : "#e0e0e0";
  ctx.lineWidth = 1;

  const isOccupied = (col: number, row: number) => occupiedCells.has(`${col},${row}`);

  // Vertical lines between horizontally adjacent occupied cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns - 1; col++) {
      if (isOccupied(col, row) && isOccupied(col + 1, row)) {
        const x = (col + 1) * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, row * cellSize + offsetY);
        ctx.lineTo(x, (row + 1) * cellSize + offsetY);
        ctx.stroke();
      }
    }
  }

  // Horizontal lines between vertically adjacent occupied cells
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows - 1; row++) {
      if (isOccupied(col, row) && isOccupied(col, row + 1)) {
        const y = (row + 1) * cellSize + offsetY;
        ctx.beginPath();
        ctx.moveTo(col * cellSize, y);
        ctx.lineTo((col + 1) * cellSize, y);
        ctx.stroke();
      }
    }
  }

  // Outer borders for occupied edge cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (!isOccupied(col, row)) continue;
      const x = col * cellSize;
      const y = row * cellSize + offsetY;

      if (row === 0 || !isOccupied(col, row - 1)) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); ctx.stroke();
      }
      if (row === rows - 1 || !isOccupied(col, row + 1)) {
        ctx.beginPath(); ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke();
      }
      if (col === 0 || !isOccupied(col - 1, row)) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); ctx.stroke();
      }
      if (col === columns - 1 || !isOccupied(col + 1, row)) {
        ctx.beginPath(); ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke();
      }
    }
  }
}
```

- [ ] **Step 4: Write dimensions test**

```typescript
import { describe, it, expect } from "vitest";
import { calculateHeaderHeight, calculateFooterHeight } from "../src/dimensions.js";

describe("dimensions", () => {
  it("header is 1/3 of step size", () => {
    expect(calculateHeaderHeight(900)).toBe(300);
    expect(calculateHeaderHeight(300)).toBe(100);
  });

  it("footer is 1/7 of step size", () => {
    expect(calculateFooterHeight(700)).toBe(100);
    expect(calculateFooterHeight(900)).toBe(128);
  });
});
```

- [ ] **Step 5: Run tests, add exports to index.ts, commit**

Run: `cd packages/render-composition && npx vitest run`

```
git add packages/render-composition/
git commit -m "feat(render-composition): add dimensions, step numbers, border renderers"
```

---

## Task 7: Header Renderer

**Files:**
- Create: `packages/render-composition/src/header-renderer.ts`

Source of truth: App's `TextRenderer.renderWordHeader()` and `renderLevelBadge()`

- [ ] **Step 1: Create header-renderer.ts**

Combine header drawing + difficulty badge + LOOP icon strip placement into one function. Port exact drawing code from app's `TextRenderer`:

```typescript
import type { LOOPComponentId, LetterStyle } from "./types.js";
import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE, DIFFICULTY_FONT_FAMILY, applyGradientStops } from "./difficulty-config.js";
import { renderLoopIconStrip } from "./loop-icons.js";

export interface HeaderOptions {
  canvasWidth: number;
  headerHeight: number;
  word: string;
  difficultyLevel?: number;
  showDifficultyBadge?: boolean;
  loopComponents?: Set<LOOPComponentId>;
  darkMode?: boolean;
  letterStyles?: LetterStyle[];
}

export function renderHeader(ctx: CanvasRenderingContext2D, options: HeaderOptions): void {
  const {
    canvasWidth, headerHeight, word,
    difficultyLevel = 1, showDifficultyBadge = true,
    loopComponents, darkMode = true, letterStyles,
  } = options;

  // Background
  ctx.fillStyle = darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)";
  ctx.fillRect(0, 0, canvasWidth, headerHeight);

  // Bottom border
  ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight - 0.5);
  ctx.lineTo(canvasWidth, headerHeight - 0.5);
  ctx.stroke();

  const badgeSize = headerHeight * 0.9;
  const badgePadding = headerHeight * 0.05;

  // Difficulty badge (left)
  if (showDifficultyBadge) {
    renderLevelBadge(ctx, difficultyLevel, badgePadding, (headerHeight - badgeSize) / 2, badgeSize);
  }

  // LOOP icon strip (right)
  const hasLoop = loopComponents && loopComponents.size > 0;
  if (hasLoop) {
    const iconSize = badgeSize * 0.6;
    const gap = Math.max(2, Math.round(iconSize * 0.15));
    const activeCount = loopComponents.size;
    const stripWidth = activeCount * iconSize + (activeCount - 1) * gap;
    const rightEdge = canvasWidth - badgePadding;
    const stripCenterX = rightEdge - stripWidth / 2 - iconSize * 0.2;
    renderLoopIconStrip(ctx, loopComponents, stripCenterX, headerHeight / 2, iconSize, darkMode);
  }

  // Word text (center)
  const finalFontSize = Math.max(10, Math.floor(headerHeight * 0.66));
  const textColor = darkMode ? "#ffffff" : "#1f2937";
  const dimmedColor = darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  ctx.font = `700 ${finalFontSize}px Georgia, serif`;
  ctx.textBaseline = "middle";

  if (word?.trim()) {
    if (letterStyles && letterStyles.length > 0) {
      // Render per-letter with dimming for bridge/derived letters
      const totalWidth = ctx.measureText(word).width;
      let cursorX = canvasWidth / 2 - totalWidth / 2;
      ctx.textAlign = "left";
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
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
}

function renderLevelBadge(
  ctx: CanvasRenderingContext2D,
  level: number,
  x: number,
  y: number,
  size: number
): void {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2;

  // Gradient (linear, top-left to bottom-right)
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  const style = DIFFICULTY_LEVELS[level] ?? DEFAULT_DIFFICULTY_STYLE;
  applyGradientStops(gradient, style.stops);

  // Circle with gradient fill
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Border
  const borderWidth = Math.max(1, Math.floor(size / 50));
  ctx.strokeStyle = style.border;
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  // Level number
  const fontSize = Math.floor(size / 1.75);
  ctx.fillStyle = style.text;
  ctx.font = `bold ${fontSize}px ${DIFFICULTY_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(level.toString(), centerX, centerY);
}
```

- [ ] **Step 2: Write header renderer test**

Create `packages/render-composition/tests/header-renderer.test.ts` with a mock canvas context. Verify the critical drawing calls happen with correct values:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHeader } from "../src/header-renderer.js";

function createMockCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
    textAlign: "", textBaseline: "", shadowColor: "", shadowBlur: 0, shadowOffsetY: 0,
    fillRect: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(),
    save: vi.fn(), restore: vi.fn(), measureText: vi.fn(() => ({ width: 50 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

describe("renderHeader", () => {
  it("draws header background in dark mode", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "TEST", darkMode: true });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 900, 100);
  });

  it("draws word text centered", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "SSSS", darkMode: true });
    expect(ctx.fillText).toHaveBeenCalledWith("SSSS", 450, 50);
  });

  it("draws difficulty badge with linear gradient", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "TEST", difficultyLevel: 1, showDifficultyBadge: true });
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled(); // badge circle
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd packages/render-composition && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Add export to index.ts, commit**

```
git add packages/render-composition/
git commit -m "feat(render-composition): add header renderer with difficulty badge and LOOP icons"
```

---

## Task 8: Footer Renderer

**Files:**
- Create: `packages/render-composition/src/footer-renderer.ts`

Source of truth: App's `TextRenderer.renderUserInfo()`

- [ ] **Step 1: Create footer-renderer.ts**

```typescript
export interface FooterOptions {
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

export function renderFooter(ctx: CanvasRenderingContext2D, options: FooterOptions): void {
  const {
    canvasWidth, canvasHeight, footerHeight,
    userName, notes, birthday,
    darkMode = true,
    showCreatorName = true, showNotes = true, showBirthday = true,
  } = options;

  const footerTop = canvasHeight - footerHeight;

  // Background
  ctx.fillStyle = darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)";
  ctx.fillRect(0, footerTop, canvasWidth, footerHeight);

  // Top border
  ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerTop + 0.5);
  ctx.lineTo(canvasWidth, footerTop + 0.5);
  ctx.stroke();

  const fontSize = Math.max(10, Math.floor(footerHeight * 0.55));
  const margin = Math.max(8, Math.floor(footerHeight * 0.3));
  const yPosition = footerTop + footerHeight * 0.55;
  ctx.fillStyle = darkMode ? "#ffffff" : "black";
  ctx.textBaseline = "middle";

  // Left: username (bold)
  if (showCreatorName && userName?.trim()) {
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.fillText(userName, margin, yPosition);
  }

  // Right: date
  if (showBirthday) {
    const dateToUse = birthday || new Date();
    const month = dateToUse.getMonth() + 1;
    const day = dateToUse.getDate();
    const year = dateToUse.getFullYear();
    const formatted = `${month}-${day}-${year}`;
    const rightText = birthday ? `🎂 ${formatted}` : formatted;

    ctx.font = `${fontSize}px Georgia, serif`;
    ctx.textAlign = "right";
    ctx.fillText(rightText, canvasWidth - margin, yPosition);
  }

  // Center: notes
  if (showNotes) {
    const centerText = notes?.trim() || "Created using TKA Composer";
    ctx.font = `${fontSize}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(centerText, canvasWidth / 2, yPosition);
  }
}
```

- [ ] **Step 2: Write footer renderer test**

Create `packages/render-composition/tests/footer-renderer.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderFooter } from "../src/footer-renderer.js";

function createMockCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
    textAlign: "", textBaseline: "",
    fillRect: vi.fn(), fillText: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
  } as unknown as CanvasRenderingContext2D;
}

describe("renderFooter", () => {
  it("draws footer at bottom of canvas", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50 });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 950, 900, 50);
  });

  it("renders username left-aligned", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, userName: "Austen Cloud", showCreatorName: true });
    expect(ctx.fillText).toHaveBeenCalledWith("Austen Cloud", expect.any(Number), expect.any(Number));
  });

  it("renders default notes when none provided", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, showNotes: true });
    expect(ctx.fillText).toHaveBeenCalledWith("Created using TKA Composer", 450, expect.any(Number));
  });

  it("formats birthday with cake emoji", () => {
    const ctx = createMockCtx();
    const bday = new Date(2026, 2, 28); // March 28, 2026
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, birthday: bday, showBirthday: true });
    expect(ctx.fillText).toHaveBeenCalledWith("🎂 3-28-2026", expect.any(Number), expect.any(Number));
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd packages/render-composition && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Add export to index.ts, commit**

```
git add packages/render-composition/
git commit -m "feat(render-composition): add footer renderer with three-column layout"
```

---

## Task 9: Finalize Package Exports

**Files:**
- Modify: `packages/render-composition/src/index.ts`

- [ ] **Step 1: Complete index.ts with all exports**

```typescript
// @tka/render-composition — shared choreo card composition
export * from "./types.js";
export * from "./difficulty-config.js";
export { drawSvgPath, drawPathCommands, parsePathData } from "./svg-path-painter.js";
export { renderLoopIconStrip, LOOP_ICON_COLORS } from "./loop-icons.js";
export { getLayout, calculateImageDimensions, BASE_BEAT_SIZE } from "./layout-tables.js";
export { calculateHeaderHeight, calculateFooterHeight } from "./dimensions.js";
export { renderHeader, type HeaderOptions } from "./header-renderer.js";
export { renderFooter, type FooterOptions } from "./footer-renderer.js";
export { renderStepNumber } from "./step-number-renderer.js";
export { renderSmartBorders } from "./border-renderer.js";
```

- [ ] **Step 2: Run full test suite**

Run: `cd packages/render-composition && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```
git add packages/render-composition/
git commit -m "feat(render-composition): finalize package exports"
```

---

## Task 10: MCP Adopts Package

**Files:**
- Modify: `mcp-server/package.json`
- Modify: `mcp-server/src/core/text-renderer.ts`
- Modify: `mcp-server/src/core/sequence-renderer.ts`

- [ ] **Step 1: Add dependency**

Add to `mcp-server/package.json` dependencies:
```json
"@tka/render-composition": "workspace:*"
```

Run: `cd mcp-server && pnpm install`

- [ ] **Step 2: Replace MCP header rendering**

In `mcp-server/src/core/text-renderer.ts`, replace the `renderWordHeader` function body with a call to the shared `renderHeader()`. Delete `renderLevelBadge()`, `drawLOOPIcon()`, `renderLOOPGlyph()`, and all hardcoded difficulty gradient stops.

```typescript
import { renderHeader, renderFooter, renderStepNumber, renderSmartBorders } from "@tka/render-composition";

export function renderWordHeader(
  ctx: CanvasRenderingContext2D,
  word: string,
  canvasWidth: number,
  headerHeight: number,
  difficultyLevel: number = 1,
  showDifficultyBadge: boolean = true,
  darkMode: boolean = true,
  letterStyles?: LetterStyle[],
  loopComponents?: LOOPComponent[]
): void {
  ensureFontsRegistered();

  // Convert LOOPComponent enum to LOOPComponentId strings for the shared package
  const componentIds = loopComponents
    ? new Set(loopComponents.map(c => loopComponentToId(c)))
    : undefined;

  renderHeader(ctx, {
    canvasWidth,
    headerHeight,
    word,
    difficultyLevel,
    showDifficultyBadge,
    loopComponents: componentIds,
    darkMode,
    letterStyles: letterStyles?.map(ls => ({ letter: ls.letter, dimmed: ls.dimmed })),
  });
}
```

- [ ] **Step 3: Replace MCP footer rendering**

Same approach — delegate `renderUserInfo` to shared `renderFooter()`.

- [ ] **Step 4: Replace MCP step number and border rendering**

In `sequence-renderer.ts`, replace step number drawing with `renderStepNumber()` from package. Replace border drawing with `renderSmartBorders()`.

- [ ] **Step 5: Delete dead MCP code**

Remove from `text-renderer.ts`:
- `drawLOOPIcon()` function (~150 lines)
- `renderLOOPGlyph()` function (~35 lines)
- All `LOOPComponent` color constants
- All hardcoded difficulty gradient stops (levels 1-5)
- `renderLevelBadge()` internal function

- [ ] **Step 6: Verify MCP build passes**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Test MCP rendering**

Generate a sequence via MCP tool and verify:
- Level 1 badge is baby blue (not white)
- LOOP icons render correctly (not garbled geometric shapes)
- Header/footer proportions match the app

- [ ] **Step 8: Commit**

```
git add mcp-server/
git commit -m "refactor(mcp): adopt @tka/render-composition for header, footer, badges, LOOP icons"
```

---

## Task 11: App Adopts Package

**Files:**
- Modify: `src/lib/shared/config/difficulty-styles.ts`
- Modify: `src/lib/shared/render/services/implementations/LOOPIconStripRenderer.ts`
- Modify: `src/lib/shared/render/services/implementations/TextRenderer.ts`
- Modify: `src/lib/shared/render/services/implementations/LayoutCalculator.ts`
- Modify: `src/lib/shared/render/services/implementations/StepNumberRenderer.ts`
- Delete: `src/lib/shared/render/services/implementations/LOOPGlyphRenderer.ts`

- [ ] **Step 1: Add dependency to app**

In root `package.json`:
```json
"@tka/render-composition": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: Replace difficulty-styles.ts with re-export**

```typescript
// src/lib/shared/config/difficulty-styles.ts
// Re-export from shared package (single source of truth)
export {
  DIFFICULTY_LEVELS,
  DIFFICULTY_FONT_FAMILY,
  DEFAULT_DIFFICULTY_STYLE,
  applyGradientStops,
} from "@tka/render-composition";
export type { DifficultyLevel, GradientStop } from "@tka/render-composition";
```

- [ ] **Step 3: Replace LOOPIconStripRenderer to use SVG paths**

Update `LOOPIconStripRenderer.render()` to delegate to `renderLoopIconStrip()` from the package, mapping `LOOPComponent` enum values to `LOOPComponentId` strings.

- [ ] **Step 4: Delete LOOPGlyphRenderer.ts**

First, grep to confirm no other imports exist:
```bash
grep -r "LOOPGlyphRenderer" src/ --include="*.ts" --include="*.svelte" -l
```
Expected: only `TextRenderer.ts` and the render container. Then remove the pie chart glyph renderer entirely, its DI registration, and the fallback in `TextRenderer.ts` that uses it.

- [ ] **Step 5: Delegate TextRenderer to package**

Update `TextRenderer.renderWordHeader()` and `renderUserInfo()` to call the shared `renderHeader()` and `renderFooter()` from the package. The `TextRenderer` class becomes a thin adapter that converts app types to package types.

- [ ] **Step 6: Delegate LayoutCalculator to package**

Update `LayoutCalculator` methods to delegate to `getLayout()` and `calculateImageDimensions()` from the package.

- [ ] **Step 7: Delegate StepNumberRenderer to package**

Update `StepNumberRenderer.drawStepNumber()` to call `renderStepNumber()` from the package.

- [ ] **Step 8: Verify app builds**

Run: `npm run build`
Expected: Build succeeds with no errors

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 9: Verify app output unchanged**

Export a sequence as PNG from the app. Compare header, footer, difficulty badge, LOOP icons to the pre-change output. Visual output should be identical.

- [ ] **Step 10: Commit**

```
git add src/ package.json pnpm-lock.yaml
git commit -m "refactor(app): adopt @tka/render-composition, delete pie chart glyph"
```

---

## Task 12: Verify Parity

- [ ] **Step 1: Generate identical sequence via both paths**

Generate SSSS (or any sequence) via MCP tool and export same sequence from app. Compare the two images side by side:
- Difficulty badge colors match
- LOOP icons identical
- Header/footer sizing proportional
- Step numbers same font/position
- Border style matches

- [ ] **Step 2: Commit any final adjustments**

---

## Notes

- **QR code parity** (Phase 4 in spec) is deferred to a follow-up task. It requires `qr-code-styling` integration and short-code URL generation in the MCP, which is a separate concern.
- **LOOP detection fix** (SSSS rotated loop not detected) is a separate bug fix, not part of the rendering unification.
- The `svg-path-parser.ts` original in `src/lib/shared/render/utils/` should be replaced with a re-export from the package after the app adopts it, to avoid duplication.
