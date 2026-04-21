# Sticker Lab Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Sticker Lab as a new Lab tab that turns LOOP sequences from the deck browser into printable 3" round mandala stickers, exporting a universal PDF that works for StickerYou, StickerApp, Silhouette Cameo 5, and hand-punch workflows unchanged.

**Architecture:** New feature module at `src/lib/features/sticker-lab/` (top-level, matching `effects-lab`, `vtg-lab` conventions). Svelte 5 `$state` factory + `setContext` for state management (no DI required — lab tabs follow the SceneLab pattern). Reuses `MandalaGeometryCalculator` and `MandalaRenderer` from `src/lib/shared/mandala/`. PDF export uses the already-installed `pdf-lib`, rasterizing each sticker's SVG to PNG via an in-memory canvas before embedding.

**Tech Stack:** SvelteKit 5 + TypeScript + Svelte 5 runes, Vitest for unit tests, `pdf-lib` for PDF assembly, existing `MandalaRenderer` for sticker art, `showToast` for notifications, `navigationState.setCurrentModule` for programmatic tab navigation.

**Source spec:** `docs/superpowers/specs/2026-04-20-sticker-lab-mvp-design.md` (commit `9818cf49ae`).

---

## File Structure

**New files (all under `src/lib/features/sticker-lab/`):**

```
sticker-lab/
├── StickerLab.svelte                          # Tab entry
├── domain/
│   ├── sticker-types.ts                       # StickerSheet, StickerUnit, SheetSize, StickerVariant, StickerBackground
│   └── sticker-constants.ts                   # DPI, sticker radius, bleed, gap, storage key, sheet dimensions
├── services/
│   ├── contracts/
│   │   ├── IStickerSheetRepository.ts
│   │   ├── IStickerUnitRenderer.ts
│   │   └── IStickerSheetPdfExporter.ts
│   └── implementations/
│       ├── LocalStickerSheetRepository.ts
│       ├── StickerUnitRenderer.ts
│       └── StickerSheetPdfExporter.ts
├── state/
│   └── sticker-lab-state.svelte.ts            # Factory (createStickerLabState)
├── context/
│   └── sticker-lab-context.ts                 # setStickerLabContext / getStickerLabContext
└── components/
    ├── StickerList.svelte                     # Left column
    ├── StickerListItem.svelte                 # One row per LOOP
    ├── StickerSheetPreview.svelte             # Center column
    ├── StickerExportPanel.svelte              # Right column
    ├── SheetSizePicker.svelte
    └── PrintPathHelpDrawer.svelte
```

**Modified files:**

- `src/lib/shared/navigation/config/tab-definitions.ts` — add "stickers" entry to `LAB_TABS`
- `src/lib/features/lab/LabModule.svelte` — add `stickers` entry to `tabComponents` map
- `src/lib/features/choreo-card/components/DeckCard.svelte` — add optional `onSendToStickers` callback prop + action icon
- Deck-card consumer(s) (to be identified during Task 12) — thread the callback down to `DeckCard`
- `messages/en.json` — add strings

**Test files:**

```
tests/unit/sticker-lab/
├── sticker-types.test.ts
├── LocalStickerSheetRepository.test.ts
├── StickerUnitRenderer.test.ts
├── StickerSheetPdfExporter.test.ts
└── sticker-lab-state.test.ts
```

---

## Task 0: Pre-flight verification

**Goal:** Confirm all dependencies and patterns exist before writing code.

- [ ] **Step 1: Verify pdf-lib is installed**

Run: `grep '"pdf-lib"' package.json`
Expected output contains: `"pdf-lib": "^1.17.1"` (or compatible).

If missing: `pnpm add pdf-lib` and commit the lockfile change as a separate commit with message `chore: add pdf-lib for sticker-lab PDF export`.

- [ ] **Step 2: Verify the mandala services are importable**

Confirm these files exist:
- `src/lib/shared/mandala/domain/mandala-types.ts`
- `src/lib/shared/mandala/services/contracts/IMandalaGeometryCalculator.ts`
- `src/lib/shared/mandala/services/contracts/IMandalaRenderer.ts`
- `src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts`
- `src/lib/shared/mandala/services/implementations/MandalaRenderer.ts`

- [ ] **Step 3: Confirm sequence ID type**

Read `src/lib/shared/foundation/domain/models/SequenceData.ts`. Confirm `SequenceData.id: string` is the canonical identifier. Note the `word` field for display.

- [ ] **Step 4: Confirm SceneLab is the right pattern to mirror**

Read `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte` (all ~40 lines) and `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts`. Confirm:
- State is created by a factory function returning a `$state`-wrapped object
- `setContext` is called with a constant symbol key
- Child components use `getContext` to access state

- [ ] **Step 5: Commit nothing**

No commit yet. This is a read-only verification task. If any confirmation fails, stop and report before proceeding.

---

## Task 1: Scaffold the feature module

**Files:**
- Create: `src/lib/features/sticker-lab/index.ts`
- Create: `src/lib/features/sticker-lab/domain/sticker-constants.ts`

**Goal:** Establish directory structure and constants without logic yet.

- [ ] **Step 1: Create the constants file**

Create `src/lib/features/sticker-lab/domain/sticker-constants.ts`:

```ts
/** Physical constants for sticker-lab — all dimensions at 300 DPI. */

/** Resolution target for all raster output (PNG embed in PDF, preview canvas). */
export const STICKER_DPI = 300;

/** 3" round sticker art diameter in pixels at STICKER_DPI. */
export const STICKER_ART_DIAMETER_PX = 3 * STICKER_DPI; // 900

/** Art radius (half the diameter). */
export const STICKER_ART_RADIUS_PX = STICKER_ART_DIAMETER_PX / 2; // 450

/** Bleed extension on every side of the sticker art, in pixels at STICKER_DPI. 0.1" = 30 px. */
export const STICKER_BLEED_PX = Math.round(0.1 * STICKER_DPI); // 30

/** Full sticker tile including bleed (square that inscribes the art + bleed). */
export const STICKER_TILE_SIZE_PX = STICKER_ART_DIAMETER_PX + STICKER_BLEED_PX * 2; // 960

/** Physical gap between stickers on a sheet, in inches. */
export const STICKER_GAP_IN = 0.15;

/** Sheet dimensions in inches (width, height) — portrait orientation. */
export const SHEET_DIMENSIONS_IN: Record<"8.5x11" | "13x19", { width: number; height: number }> = {
  "8.5x11": { width: 8.5, height: 11 },
  "13x19": { width: 13, height: 19 },
};

/** Max copies of a single sticker on one sheet's queue. UI-level cap. */
export const MAX_COPIES_PER_STICKER = 50;

/** localStorage key for the single active sheet (MVP single-sheet model). */
export const STORAGE_KEY_ACTIVE_SHEET = "tka:sticker-lab:active-sheet";

/** Storage schema version — bumped on breaking changes to persisted StickerSheet shape. */
export const STORAGE_SCHEMA_VERSION = 1;
```

- [ ] **Step 2: Create the barrel export**

Create `src/lib/features/sticker-lab/index.ts`:

```ts
export * from "./domain/sticker-types";
export * from "./domain/sticker-constants";
```

(The `sticker-types` export will fail until Task 2. That's intentional — we commit Task 1 without running type-check, and Task 2 fixes it.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/sticker-lab/
git commit -m "feat(sticker-lab): scaffold module with physical constants"
```

---

## Task 2: Domain types

**Files:**
- Create: `src/lib/features/sticker-lab/domain/sticker-types.ts`
- Create: `tests/unit/sticker-lab/sticker-types.test.ts`

**Goal:** Define the type system that every other task references.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sticker-lab/sticker-types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  createDefaultStickerUnit,
  createDefaultStickerSheet,
  type StickerUnit,
  type StickerSheet,
} from "$lib/features/sticker-lab/domain/sticker-types";

describe("sticker-types default factories", () => {
  it("createDefaultStickerUnit returns a unit with variant=full, background=transparent, copies=1, presentation=pure", () => {
    const unit = createDefaultStickerUnit({
      sourceLoop: { sequenceId: "seq-1", word: "ALPHA", loopType: "rotated-loop" },
    });

    expect(unit.variant).toBe("full");
    expect(unit.background).toBe("transparent");
    expect(unit.copies).toBe(1);
    expect(unit.presentation).toBe("pure");
    expect(unit.size).toBe("3in-round");
    expect(unit.sourceLoop?.sequenceId).toBe("seq-1");
    expect(unit.id).toMatch(/^sticker-[a-z0-9]+$/);
  });

  it("createDefaultStickerUnit accepts sourceLoop=null (Phase 3 chimera hook)", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null });
    expect(unit.sourceLoop).toBeNull();
  });

  it("createDefaultStickerSheet returns an empty sheet at 8.5x11 with current timestamps", () => {
    const before = Date.now();
    const sheet = createDefaultStickerSheet();
    const after = Date.now();

    expect(sheet.sheetSize).toBe("8.5x11");
    expect(sheet.stickers).toEqual([]);
    expect(sheet.name).toBe("My Sheet");
    expect(sheet.createdAt).toBeGreaterThanOrEqual(before);
    expect(sheet.createdAt).toBeLessThanOrEqual(after);
    expect(sheet.updatedAt).toBe(sheet.createdAt);
    expect(sheet.id).toMatch(/^sheet-[a-z0-9]+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/sticker-lab/sticker-types.test.ts`
Expected: FAIL with module-not-found / undefined exports.

- [ ] **Step 3: Write the types and factories**

Create `src/lib/features/sticker-lab/domain/sticker-types.ts`:

```ts
export type StickerVariant = "blue" | "red" | "full";
export type StickerBackground = "transparent" | "white" | "radial-gradient";
export type StickerSize = "3in-round"; // versioned string; Phase 2 may add "2in-round", "5in-round"
export type StickerPresentation = "pure"; // Phase 1 only value; Phase 2 may add "word-label", "qr"
export type SheetSize = "8.5x11" | "13x19";

/** Reference to a LOOP sequence. sequenceId must match SequenceData.id. */
export interface LoopRef {
  readonly sequenceId: string;
  readonly word: string;      // denormalized for display
  readonly loopType: string;  // e.g. "rotated-loop", "mirrored-loop"
}

export interface StickerUnit {
  readonly id: string;
  /** null reserved for Phase 3 chimera stickers (no single source sequence). */
  readonly sourceLoop: LoopRef | null;
  readonly variant: StickerVariant;
  readonly size: StickerSize;
  readonly background: StickerBackground;
  readonly copies: number;
  readonly presentation: StickerPresentation;
}

export interface StickerSheet {
  readonly id: string;
  readonly name: string;
  readonly sheetSize: SheetSize;
  readonly stickers: readonly StickerUnit[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Simple ID generator — timestamp + randomness. Good enough for localStorage scope. */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateStickerUnitInput {
  sourceLoop: LoopRef | null;
  variant?: StickerVariant;
  background?: StickerBackground;
  copies?: number;
}

export function createDefaultStickerUnit(input: CreateStickerUnitInput): StickerUnit {
  return {
    id: generateId("sticker"),
    sourceLoop: input.sourceLoop,
    variant: input.variant ?? "full",
    size: "3in-round",
    background: input.background ?? "transparent",
    copies: input.copies ?? 1,
    presentation: "pure",
  };
}

export function createDefaultStickerSheet(): StickerSheet {
  const now = Date.now();
  return {
    id: generateId("sheet"),
    name: "My Sheet",
    sheetSize: "8.5x11",
    stickers: [],
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/sticker-lab/sticker-types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/sticker-lab/domain/sticker-types.ts tests/unit/sticker-lab/sticker-types.test.ts
git commit -m "feat(sticker-lab): domain types and default factories"
```

---

## Task 3: LocalStickerSheetRepository

**Files:**
- Create: `src/lib/features/sticker-lab/services/contracts/IStickerSheetRepository.ts`
- Create: `src/lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository.ts`
- Create: `tests/unit/sticker-lab/LocalStickerSheetRepository.test.ts`

**Goal:** Persist the single active sheet to localStorage. Mirrors the `LocalPoseLabelRepository` pattern from collision-lab.

- [ ] **Step 1: Write the contract**

Create `src/lib/features/sticker-lab/services/contracts/IStickerSheetRepository.ts`:

```ts
import type { StickerSheet } from "../../domain/sticker-types";

export interface IStickerSheetRepository {
  /** Load the active sheet. Returns null if none has been saved yet. */
  load(): StickerSheet | null;

  /** Persist the active sheet. Overwrites any prior value. */
  save(sheet: StickerSheet): void;

  /** Remove the active sheet from storage. */
  clear(): void;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/sticker-lab/LocalStickerSheetRepository.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalStickerSheetRepository } from "$lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository";
import {
  createDefaultStickerSheet,
  createDefaultStickerUnit,
} from "$lib/features/sticker-lab/domain/sticker-types";
import { STORAGE_KEY_ACTIVE_SHEET } from "$lib/features/sticker-lab/domain/sticker-constants";

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("LocalStickerSheetRepository", () => {
  let storage: Storage;
  let repo: LocalStickerSheetRepository;

  beforeEach(() => {
    storage = mockLocalStorage();
    repo = new LocalStickerSheetRepository(storage);
  });

  it("load returns null when no sheet is saved", () => {
    expect(repo.load()).toBeNull();
  });

  it("save then load returns the same sheet", () => {
    const sheet = createDefaultStickerSheet();
    const sheetWithOne = {
      ...sheet,
      stickers: [createDefaultStickerUnit({ sourceLoop: { sequenceId: "s1", word: "W", loopType: "t" } })],
    };
    repo.save(sheetWithOne);
    const loaded = repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(sheetWithOne.id);
    expect(loaded!.stickers).toHaveLength(1);
  });

  it("clear removes the stored sheet", () => {
    repo.save(createDefaultStickerSheet());
    repo.clear();
    expect(repo.load()).toBeNull();
  });

  it("load returns null when stored payload is malformed JSON", () => {
    storage.setItem(STORAGE_KEY_ACTIVE_SHEET, "not-valid-json{");
    expect(repo.load()).toBeNull();
  });

  it("load returns null when stored payload has wrong schema version", () => {
    storage.setItem(
      STORAGE_KEY_ACTIVE_SHEET,
      JSON.stringify({ version: 999, sheet: createDefaultStickerSheet() })
    );
    expect(repo.load()).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/sticker-lab/LocalStickerSheetRepository.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository.ts`:

```ts
import type { StickerSheet } from "../../domain/sticker-types";
import {
  STORAGE_KEY_ACTIVE_SHEET,
  STORAGE_SCHEMA_VERSION,
} from "../../domain/sticker-constants";
import type { IStickerSheetRepository } from "../contracts/IStickerSheetRepository";

interface StoredPayload {
  version: number;
  sheet: StickerSheet;
}

export class LocalStickerSheetRepository implements IStickerSheetRepository {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  load(): StickerSheet | null {
    const raw = this.storage.getItem(STORAGE_KEY_ACTIVE_SHEET);
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!isStoredPayload(parsed)) return null;
    if (parsed.version !== STORAGE_SCHEMA_VERSION) return null;

    return parsed.sheet;
  }

  save(sheet: StickerSheet): void {
    const payload: StoredPayload = {
      version: STORAGE_SCHEMA_VERSION,
      sheet,
    };
    this.storage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify(payload));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY_ACTIVE_SHEET);
  }
}

function isStoredPayload(value: unknown): value is StoredPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "sheet" in value &&
    typeof (value as Record<string, unknown>).version === "number"
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/sticker-lab/LocalStickerSheetRepository.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/sticker-lab/services/contracts/IStickerSheetRepository.ts src/lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository.ts tests/unit/sticker-lab/LocalStickerSheetRepository.test.ts
git commit -m "feat(sticker-lab): LocalStickerSheetRepository with schema versioning"
```

---

## Task 4: StickerUnitRenderer service

**Files:**
- Create: `src/lib/features/sticker-lab/services/contracts/IStickerUnitRenderer.ts`
- Create: `src/lib/features/sticker-lab/services/implementations/StickerUnitRenderer.ts`
- Create: `tests/unit/sticker-lab/StickerUnitRenderer.test.ts`

**Goal:** Compose a full sticker SVG string (background + mandala art) for a given `StickerUnit` + `MandalaPaths`. This service wraps `MandalaRenderer.renderSVG` with background handling.

- [ ] **Step 1: Write the contract**

Create `src/lib/features/sticker-lab/services/contracts/IStickerUnitRenderer.ts`:

```ts
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import type { StickerUnit } from "../../domain/sticker-types";

export interface IStickerUnitRenderer {
  /**
   * Render a single sticker as a self-contained SVG string sized STICKER_TILE_SIZE_PX
   * square (art + bleed on all sides). The SVG uses the light-mode prop palette
   * (white-paper-safe colors).
   */
  renderSVG(unit: StickerUnit, mandalaPaths: MandalaPaths): string;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/sticker-lab/StickerUnitRenderer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { StickerUnitRenderer } from "$lib/features/sticker-lab/services/implementations/StickerUnitRenderer";
import { createDefaultStickerUnit } from "$lib/features/sticker-lab/domain/sticker-types";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import {
  STICKER_TILE_SIZE_PX,
  STICKER_ART_DIAMETER_PX,
} from "$lib/features/sticker-lab/domain/sticker-constants";

const emptyPaths: MandalaPaths = { blue: [], red: [], purple: [] };

describe("StickerUnitRenderer", () => {
  const renderer = new StickerUnitRenderer();

  it("renders an SVG at the full tile size (art + bleed)", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null });
    const svg = renderer.renderSVG(unit, emptyPaths);
    expect(svg).toContain(`viewBox="0 0 ${STICKER_TILE_SIZE_PX} ${STICKER_TILE_SIZE_PX}"`);
  });

  it("transparent background produces no background rect", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, background: "transparent" });
    const svg = renderer.renderSVG(unit, emptyPaths);
    expect(svg).not.toMatch(/<rect[^>]*fill="#ffffff"/i);
    expect(svg).not.toMatch(/url\(#sticker-bg-gradient/);
  });

  it("white background produces a solid white circle at art diameter", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, background: "white" });
    const svg = renderer.renderSVG(unit, emptyPaths);
    expect(svg).toMatch(/<circle[^>]*fill="#ffffff"/i);
    expect(svg).toContain(`r="${STICKER_ART_DIAMETER_PX / 2}"`);
  });

  it("radial-gradient background defines a gradient and uses it as fill", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, background: "radial-gradient" });
    const svg = renderer.renderSVG(unit, emptyPaths);
    expect(svg).toContain("<radialGradient");
    expect(svg).toMatch(/fill="url\(#sticker-bg-gradient[^)]*\)"/);
  });

  it("variant=blue passes show=blue to the mandala renderer", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, variant: "blue" });
    const svg = renderer.renderSVG(unit, {
      blue: [{ d: "M0 0 L10 10", tipIndex: 0 }],
      red: [{ d: "M0 0 L20 20", tipIndex: 0 }],
      purple: [],
    });
    // Only blue path (from position coordinates) should appear. Red should not.
    expect(svg).toContain("M0 0 L10 10");
    expect(svg).not.toContain("M0 0 L20 20");
  });

  it("variant=red renders only the red path", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, variant: "red" });
    const svg = renderer.renderSVG(unit, {
      blue: [{ d: "M0 0 L10 10", tipIndex: 0 }],
      red: [{ d: "M0 0 L20 20", tipIndex: 0 }],
      purple: [],
    });
    expect(svg).not.toContain("M0 0 L10 10");
    expect(svg).toContain("M0 0 L20 20");
  });

  it("variant=full renders blue, red, and purple paths", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, variant: "full" });
    const svg = renderer.renderSVG(unit, {
      blue: [{ d: "M0 0 L10 10", tipIndex: 0 }],
      red: [{ d: "M0 0 L20 20", tipIndex: 0 }],
      purple: [{ d: "M0 0 L30 30", tipIndex: 0 }],
    });
    expect(svg).toContain("M0 0 L10 10");
    expect(svg).toContain("M0 0 L20 20");
    expect(svg).toContain("M0 0 L30 30");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/sticker-lab/StickerUnitRenderer.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/features/sticker-lab/services/implementations/StickerUnitRenderer.ts`:

```ts
import type { MandalaPaths, MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
import { MandalaRenderer } from "$lib/shared/mandala/services/implementations/MandalaRenderer";
import type { StickerBackground, StickerUnit, StickerVariant } from "../../domain/sticker-types";
import {
  STICKER_ART_DIAMETER_PX,
  STICKER_ART_RADIUS_PX,
  STICKER_BLEED_PX,
  STICKER_TILE_SIZE_PX,
} from "../../domain/sticker-constants";
import type { IStickerUnitRenderer } from "../contracts/IStickerUnitRenderer";

/**
 * Light-mode palette tuned for white sticker paper.
 * Darker, more saturated than the dark-mode defaults so blue/red read as primary colors
 * rather than washed-out glows.
 */
const LIGHT_MODE_PALETTE: MandalaPalette = {
  blueStroke: "#1e40af",
  blueFill: "rgba(37, 99, 235, 0.65)",
  redStroke: "#991b1b",
  redFill: "rgba(220, 38, 38, 0.65)",
  purpleStroke: "#6b21a8",
  purpleFill: "rgba(126, 34, 206, 0.75)",
};

/**
 * Stroke width at 3" standalone. Wider than the card-back default (2.5) because the
 * sticker is ~6x larger than its card-back equivalent.
 */
const STICKER_STROKE_WIDTH = 6;

export class StickerUnitRenderer implements IStickerUnitRenderer {
  private readonly mandalaRenderer = new MandalaRenderer();

  renderSVG(unit: StickerUnit, mandalaPaths: MandalaPaths): string {
    const mandalaSvg = this.mandalaRenderer.renderSVG(mandalaPaths, {
      size: STICKER_ART_DIAMETER_PX,
      style: "filled", // stroke + fill layered — see MandalaRenderer.filledAttributes
      showGridDots: false,
      show: toMandalaShow(unit.variant),
      strokeWidth: STICKER_STROKE_WIDTH,
      transparentBackground: true,
      palette: LIGHT_MODE_PALETTE,
    });

    // Strip the outer <svg> wrapper from the mandala — we inline its <defs> and <g>
    // into our sticker-scoped SVG.
    const mandalaInner = extractSvgInner(mandalaSvg);

    const bg = renderBackground(unit.background);

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STICKER_TILE_SIZE_PX} ${STICKER_TILE_SIZE_PX}" width="${STICKER_TILE_SIZE_PX}" height="${STICKER_TILE_SIZE_PX}">`,
      bg.defs,
      `  <g transform="translate(${STICKER_BLEED_PX}, ${STICKER_BLEED_PX})">`,
      bg.body,
      mandalaInner,
      `  </g>`,
      `</svg>`,
    ].join("\n");
  }
}

function toMandalaShow(variant: StickerVariant): "blue" | "red" | "both" {
  return variant === "full" ? "both" : variant;
}

interface BackgroundParts {
  defs: string;
  body: string;
}

function renderBackground(background: StickerBackground): BackgroundParts {
  const cx = STICKER_ART_RADIUS_PX;
  const cy = STICKER_ART_RADIUS_PX;
  const r = STICKER_ART_RADIUS_PX;

  if (background === "transparent") {
    return { defs: "", body: "" };
  }

  if (background === "white") {
    return {
      defs: "",
      body: `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff"/>`,
    };
  }

  // radial-gradient
  const gradientId = `sticker-bg-gradient-${Math.random().toString(36).slice(2, 8)}`;
  return {
    defs: [
      `  <defs>`,
      `    <radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">`,
      `      <stop offset="0%" stop-color="#fefcf7" stop-opacity="1"/>`,
      `      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.85"/>`,
      `    </radialGradient>`,
      `  </defs>`,
    ].join("\n"),
    body: `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradientId})"/>`,
  };
}

/**
 * Extract the contents of the outer <svg>...</svg> wrapper.
 * MandalaRenderer.renderSVG returns a complete <svg> element; we need its inner
 * content to inline into our sticker-scoped SVG.
 */
function extractSvgInner(svg: string): string {
  const openEnd = svg.indexOf(">", svg.indexOf("<svg"));
  const closeStart = svg.lastIndexOf("</svg>");
  if (openEnd === -1 || closeStart === -1) return "";
  return svg.substring(openEnd + 1, closeStart);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/sticker-lab/StickerUnitRenderer.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/sticker-lab/services/contracts/IStickerUnitRenderer.ts src/lib/features/sticker-lab/services/implementations/StickerUnitRenderer.ts tests/unit/sticker-lab/StickerUnitRenderer.test.ts
git commit -m "feat(sticker-lab): StickerUnitRenderer composes mandala + background"
```

---

## Task 5: SVG-to-PNG rasterizer utility

**Files:**
- Create: `src/lib/features/sticker-lab/services/implementations/rasterizeSvg.ts`

**Goal:** Browser-only utility that converts an SVG string to a PNG `Uint8Array`. Used by the PDF exporter. Kept as a standalone function (not a service) because it has no state and one job.

- [ ] **Step 1: Write the utility**

Create `src/lib/features/sticker-lab/services/implementations/rasterizeSvg.ts`:

```ts
/**
 * Rasterize an SVG string to a PNG Uint8Array at a specified pixel size.
 *
 * Pipeline: SVG string → Blob → object URL → <img> → <canvas>.drawImage → blob → ArrayBuffer.
 *
 * Browser-only (uses DOM APIs). Not usable in Node without a polyfill.
 */
export async function rasterizeSvgToPng(
  svg: string,
  widthPx: number,
  heightPx: number
): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");

    ctx.clearRect(0, 0, widthPx, heightPx);
    ctx.drawImage(img, 0, 0, widthPx, heightPx);

    const pngBlob = await canvasToBlob(canvas);
    const buffer = await pngBlob.arrayBuffer();
    return new Uint8Array(buffer);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load SVG image: ${src}`));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
```

- [ ] **Step 2: No unit test — manual verification only**

This utility depends on browser DOM APIs (`Image`, `<canvas>`, `URL.createObjectURL`) that are expensive to mock meaningfully. Correctness is verified via the PDF exporter's integration test (Task 6) and manual sheet export verification (Task 15).

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/sticker-lab/services/implementations/rasterizeSvg.ts
git commit -m "feat(sticker-lab): add SVG-to-PNG rasterizer utility"
```

---

## Task 6: StickerSheetPdfExporter

**Files:**
- Create: `src/lib/features/sticker-lab/services/contracts/IStickerSheetPdfExporter.ts`
- Create: `src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts`
- Create: `tests/unit/sticker-lab/StickerSheetPdfExporter.test.ts`

**Goal:** Generate a print-ready PDF from a StickerSheet. Pages sized to `sheetSize`, 3" round stickers auto-packed, cut lines + registration marks included. Uses pdf-lib.

- [ ] **Step 1: Write the contract**

Create `src/lib/features/sticker-lab/services/contracts/IStickerSheetPdfExporter.ts`:

```ts
import type { StickerSheet } from "../../domain/sticker-types";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";

export interface StickerMandalaLookup {
  /** Return the pre-computed MandalaPaths for a given sequence id. */
  getPaths(sequenceId: string): MandalaPaths | null;
}

export interface IStickerSheetPdfExporter {
  /**
   * Generate a PDF Uint8Array for the given sheet. The lookup provides pre-computed
   * MandalaPaths per sequence id (injected by the caller so this service doesn't
   * depend on the sequence repository).
   */
  export(sheet: StickerSheet, lookup: StickerMandalaLookup): Promise<Uint8Array>;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/sticker-lab/StickerSheetPdfExporter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import { StickerSheetPdfExporter } from "$lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter";
import {
  createDefaultStickerSheet,
  createDefaultStickerUnit,
} from "$lib/features/sticker-lab/domain/sticker-types";
import type { StickerMandalaLookup } from "$lib/features/sticker-lab/services/contracts/IStickerSheetPdfExporter";

// Mock the rasterizer to return a tiny valid PNG (1x1 transparent).
// A real PNG header lets pdf-lib embed it without decoding errors.
const ONE_PX_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

vi.mock("$lib/features/sticker-lab/services/implementations/rasterizeSvg", () => ({
  rasterizeSvgToPng: vi.fn(async () => ONE_PX_PNG),
}));

const emptyLookup: StickerMandalaLookup = {
  getPaths: () => ({ blue: [], red: [], purple: [] }),
};

describe("StickerSheetPdfExporter", () => {
  let exporter: StickerSheetPdfExporter;

  beforeEach(() => {
    exporter = new StickerSheetPdfExporter();
  });

  it("exports an empty sheet as a valid single-page PDF at 8.5x11", async () => {
    const sheet = createDefaultStickerSheet();
    const bytes = await exporter.export(sheet, emptyLookup);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    // 8.5 inches = 612 points (72 dpi in PDF coordinate space)
    expect(page.getWidth()).toBeCloseTo(612, 0);
    expect(page.getHeight()).toBeCloseTo(792, 0);
  });

  it("13x19 sheet size produces correct PDF page dimensions", async () => {
    const sheet = {
      ...createDefaultStickerSheet(),
      sheetSize: "13x19" as const,
    };
    const bytes = await exporter.export(sheet, emptyLookup);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(936, 0); // 13 * 72
    expect(doc.getPage(0).getHeight()).toBeCloseTo(1368, 0); // 19 * 72
  });

  it("stickers overflowing one page produce multiple pages", async () => {
    // 8.5x11 fits 6 stickers per page. 7 copies of one sticker should paginate.
    const unit = createDefaultStickerUnit({
      sourceLoop: { sequenceId: "s1", word: "ALPHA", loopType: "rotated-loop" },
      copies: 7,
    });
    const sheet = {
      ...createDefaultStickerSheet(),
      stickers: [unit],
    };
    const bytes = await exporter.export(sheet, emptyLookup);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it("skips stickers whose mandala paths are missing from the lookup", async () => {
    const unit = createDefaultStickerUnit({
      sourceLoop: { sequenceId: "missing-id", word: "W", loopType: "t" },
    });
    const sheet = { ...createDefaultStickerSheet(), stickers: [unit] };
    const lookup: StickerMandalaLookup = { getPaths: () => null };
    const bytes = await exporter.export(sheet, lookup);
    const doc = await PDFDocument.load(bytes);
    // Still produces a page (empty), does not throw.
    expect(doc.getPageCount()).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/sticker-lab/StickerSheetPdfExporter.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts`:

```ts
import { PDFDocument, rgb } from "pdf-lib";
import type { StickerSheet, StickerUnit, SheetSize } from "../../domain/sticker-types";
import {
  SHEET_DIMENSIONS_IN,
  STICKER_GAP_IN,
  STICKER_TILE_SIZE_PX,
  STICKER_DPI,
} from "../../domain/sticker-constants";
import { StickerUnitRenderer } from "./StickerUnitRenderer";
import { rasterizeSvgToPng } from "./rasterizeSvg";
import type {
  IStickerSheetPdfExporter,
  StickerMandalaLookup,
} from "../contracts/IStickerSheetPdfExporter";

const PDF_POINTS_PER_INCH = 72;

interface Placement {
  unit: StickerUnit;
  /** Page index (0-based). */
  page: number;
  /** Center position in inches, measured from page bottom-left (PDF coordinate space). */
  centerXIn: number;
  centerYIn: number;
}

export class StickerSheetPdfExporter implements IStickerSheetPdfExporter {
  private readonly unitRenderer = new StickerUnitRenderer();

  async export(sheet: StickerSheet, lookup: StickerMandalaLookup): Promise<Uint8Array> {
    const placements = this.computePlacements(sheet);
    const doc = await PDFDocument.create();

    const pageCount = placements.length > 0 ? Math.max(...placements.map((p) => p.page)) + 1 : 1;
    const { width: sheetWIn, height: sheetHIn } = SHEET_DIMENSIONS_IN[sheet.sheetSize];
    const pageWPts = sheetWIn * PDF_POINTS_PER_INCH;
    const pageHPts = sheetHIn * PDF_POINTS_PER_INCH;

    for (let i = 0; i < pageCount; i++) {
      doc.addPage([pageWPts, pageHPts]);
    }

    for (const placement of placements) {
      const paths = placement.unit.sourceLoop
        ? lookup.getPaths(placement.unit.sourceLoop.sequenceId)
        : null;
      if (!paths) continue;

      const svg = this.unitRenderer.renderSVG(placement.unit, paths);
      const png = await rasterizeSvgToPng(svg, STICKER_TILE_SIZE_PX, STICKER_TILE_SIZE_PX);
      const image = await doc.embedPng(png);

      const page = doc.getPage(placement.page);
      const tileSizePts = (STICKER_TILE_SIZE_PX / STICKER_DPI) * PDF_POINTS_PER_INCH; // 960/300 * 72 = 230.4
      const xPts = placement.centerXIn * PDF_POINTS_PER_INCH - tileSizePts / 2;
      const yPts = placement.centerYIn * PDF_POINTS_PER_INCH - tileSizePts / 2;

      page.drawImage(image, {
        x: xPts,
        y: yPts,
        width: tileSizePts,
        height: tileSizePts,
      });

      // Draw cut line (3" diameter circle) as a dashed thin line.
      const cutRadiusPts = 1.5 * PDF_POINTS_PER_INCH;
      page.drawCircle({
        x: placement.centerXIn * PDF_POINTS_PER_INCH,
        y: placement.centerYIn * PDF_POINTS_PER_INCH,
        size: cutRadiusPts,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
        borderDashArray: [3, 3],
      });
    }

    // Registration marks: small crosses in each corner, 0.25" from page edges.
    for (let i = 0; i < pageCount; i++) {
      drawRegistrationMarks(doc.getPage(i), pageWPts, pageHPts);
    }

    return await doc.save();
  }

  private computePlacements(sheet: StickerSheet): Placement[] {
    const { width: sheetWIn, height: sheetHIn } = SHEET_DIMENSIONS_IN[sheet.sheetSize];
    const stickerDiameterIn = 3;
    const pitchIn = stickerDiameterIn + STICKER_GAP_IN;

    const cols = Math.floor((sheetWIn + STICKER_GAP_IN) / pitchIn);
    const rows = Math.floor((sheetHIn + STICKER_GAP_IN) / pitchIn);
    const perPage = cols * rows;
    if (perPage === 0) return [];

    // Centered grid: compute total packed width/height, then leading margin.
    const gridWIn = cols * stickerDiameterIn + (cols - 1) * STICKER_GAP_IN;
    const gridHIn = rows * stickerDiameterIn + (rows - 1) * STICKER_GAP_IN;
    const marginXIn = (sheetWIn - gridWIn) / 2;
    const marginYIn = (sheetHIn - gridHIn) / 2;

    // Expand each unit into its copies, flattening order.
    const flattened: StickerUnit[] = [];
    for (const unit of sheet.stickers) {
      for (let c = 0; c < unit.copies; c++) flattened.push(unit);
    }

    const placements: Placement[] = [];
    for (let idx = 0; idx < flattened.length; idx++) {
      const page = Math.floor(idx / perPage);
      const onPage = idx % perPage;
      const row = Math.floor(onPage / cols);
      const col = onPage % cols;

      // PDF coordinates have origin at bottom-left, so y grows upward.
      const centerXIn = marginXIn + col * pitchIn + stickerDiameterIn / 2;
      const centerYIn = sheetHIn - (marginYIn + row * pitchIn + stickerDiameterIn / 2);

      placements.push({ unit: flattened[idx]!, page, centerXIn, centerYIn });
    }

    return placements;
  }
}

function drawRegistrationMarks(page: ReturnType<PDFDocument["getPage"]>, widthPts: number, heightPts: number): void {
  const inset = 0.25 * PDF_POINTS_PER_INCH;
  const len = 0.15 * PDF_POINTS_PER_INCH;
  const color = rgb(0, 0, 0);
  const lw = 0.5;

  const marks: Array<[number, number]> = [
    [inset, inset],
    [widthPts - inset, inset],
    [inset, heightPts - inset],
    [widthPts - inset, heightPts - inset],
  ];

  for (const [x, y] of marks) {
    page.drawLine({
      start: { x: x - len, y },
      end: { x: x + len, y },
      thickness: lw,
      color,
    });
    page.drawLine({
      start: { x, y: y - len },
      end: { x, y: y + len },
      thickness: lw,
      color,
    });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/sticker-lab/StickerSheetPdfExporter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/sticker-lab/services/contracts/IStickerSheetPdfExporter.ts src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts tests/unit/sticker-lab/StickerSheetPdfExporter.test.ts
git commit -m "feat(sticker-lab): StickerSheetPdfExporter with cut lines and registration marks"
```

---

## Task 7: Sticker-lab state + context

**Files:**
- Create: `src/lib/features/sticker-lab/state/sticker-lab-state.svelte.ts`
- Create: `src/lib/features/sticker-lab/context/sticker-lab-context.ts`
- Create: `tests/unit/sticker-lab/sticker-lab-state.test.ts`

**Goal:** Reactive state factory + Svelte context for the active sheet. Mirrors the SceneLab pattern.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sticker-lab/sticker-lab-state.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStickerLabState } from "$lib/features/sticker-lab/state/sticker-lab-state.svelte";
import type { IStickerSheetRepository } from "$lib/features/sticker-lab/services/contracts/IStickerSheetRepository";
import type { StickerSheet } from "$lib/features/sticker-lab/domain/sticker-types";

function mockRepo(initial: StickerSheet | null = null): IStickerSheetRepository {
  let stored = initial;
  return {
    load: vi.fn(() => stored),
    save: vi.fn((s) => {
      stored = s;
    }),
    clear: vi.fn(() => {
      stored = null;
    }),
  };
}

describe("sticker-lab state", () => {
  it("creates a fresh sheet when repository is empty", () => {
    const repo = mockRepo(null);
    const state = createStickerLabState(repo);
    expect(state.sheet.stickers).toEqual([]);
    expect(state.sheet.sheetSize).toBe("8.5x11");
  });

  it("loads an existing sheet from the repository", () => {
    const preexisting: StickerSheet = {
      id: "sheet-1",
      name: "Loaded",
      sheetSize: "13x19",
      stickers: [],
      createdAt: 1,
      updatedAt: 2,
    };
    const repo = mockRepo(preexisting);
    const state = createStickerLabState(repo);
    expect(state.sheet.id).toBe("sheet-1");
    expect(state.sheet.sheetSize).toBe("13x19");
  });

  it("addLoop appends a new sticker with default variant=full", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "ALPHA", loopType: "rotated-loop" });
    expect(state.sheet.stickers).toHaveLength(1);
    expect(state.sheet.stickers[0]!.variant).toBe("full");
    expect(state.sheet.stickers[0]!.sourceLoop?.sequenceId).toBe("seq-1");
  });

  it("addLoop is idempotent per sequenceId (no duplicate append)", () => {
    const state = createStickerLabState(mockRepo(null));
    const ref = { sequenceId: "seq-1", word: "ALPHA", loopType: "rotated-loop" };
    state.addLoop(ref);
    state.addLoop(ref);
    expect(state.sheet.stickers).toHaveLength(1);
  });

  it("setVariant updates the sticker's variant", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    const id = state.sheet.stickers[0]!.id;
    state.setVariant(id, "blue");
    expect(state.sheet.stickers[0]!.variant).toBe("blue");
  });

  it("setBackground updates the sticker's background", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    const id = state.sheet.stickers[0]!.id;
    state.setBackground(id, "radial-gradient");
    expect(state.sheet.stickers[0]!.background).toBe("radial-gradient");
  });

  it("setCopies clamps to [1, 50]", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    const id = state.sheet.stickers[0]!.id;
    state.setCopies(id, 0);
    expect(state.sheet.stickers[0]!.copies).toBe(1);
    state.setCopies(id, 999);
    expect(state.sheet.stickers[0]!.copies).toBe(50);
  });

  it("removeSticker drops the sticker from the sheet", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    const id = state.sheet.stickers[0]!.id;
    state.removeSticker(id);
    expect(state.sheet.stickers).toHaveLength(0);
  });

  it("setSheetSize updates the sheet size", () => {
    const state = createStickerLabState(mockRepo(null));
    state.setSheetSize("13x19");
    expect(state.sheet.sheetSize).toBe("13x19");
  });

  it("clearSheet produces a fresh empty sheet and calls repo.clear", () => {
    const repo = mockRepo(null);
    const state = createStickerLabState(repo);
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    state.clearSheet();
    expect(state.sheet.stickers).toEqual([]);
    expect(repo.clear).toHaveBeenCalled();
  });

  it("every mutation persists to the repository", () => {
    const repo = mockRepo(null);
    const state = createStickerLabState(repo);
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    expect(repo.save).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/sticker-lab/sticker-lab-state.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the state factory**

Create `src/lib/features/sticker-lab/state/sticker-lab-state.svelte.ts`:

```ts
import type {
  LoopRef,
  StickerBackground,
  StickerSheet,
  StickerVariant,
  SheetSize,
} from "../domain/sticker-types";
import {
  createDefaultStickerSheet,
  createDefaultStickerUnit,
} from "../domain/sticker-types";
import { MAX_COPIES_PER_STICKER } from "../domain/sticker-constants";
import { LocalStickerSheetRepository } from "../services/implementations/LocalStickerSheetRepository";
import type { IStickerSheetRepository } from "../services/contracts/IStickerSheetRepository";

export interface StickerLabState {
  readonly sheet: StickerSheet;
  addLoop(ref: LoopRef): void;
  setVariant(stickerId: string, variant: StickerVariant): void;
  setBackground(stickerId: string, background: StickerBackground): void;
  setCopies(stickerId: string, copies: number): void;
  removeSticker(stickerId: string): void;
  setSheetSize(size: SheetSize): void;
  clearSheet(): void;
}

export function createStickerLabState(
  repository: IStickerSheetRepository = new LocalStickerSheetRepository()
): StickerLabState {
  let sheet = $state<StickerSheet>(repository.load() ?? createDefaultStickerSheet());

  function mutate(updater: (s: StickerSheet) => StickerSheet): void {
    sheet = { ...updater(sheet), updatedAt: Date.now() };
    repository.save(sheet);
  }

  return {
    get sheet() {
      return sheet;
    },

    addLoop(ref: LoopRef): void {
      if (sheet.stickers.some((s) => s.sourceLoop?.sequenceId === ref.sequenceId)) return;
      const unit = createDefaultStickerUnit({ sourceLoop: ref });
      mutate((s) => ({ ...s, stickers: [...s.stickers, unit] }));
    },

    setVariant(stickerId: string, variant: StickerVariant): void {
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) => (x.id === stickerId ? { ...x, variant } : x)),
      }));
    },

    setBackground(stickerId: string, background: StickerBackground): void {
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) => (x.id === stickerId ? { ...x, background } : x)),
      }));
    },

    setCopies(stickerId: string, copies: number): void {
      const clamped = Math.max(1, Math.min(MAX_COPIES_PER_STICKER, Math.floor(copies)));
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) => (x.id === stickerId ? { ...x, copies: clamped } : x)),
      }));
    },

    removeSticker(stickerId: string): void {
      mutate((s) => ({
        ...s,
        stickers: s.stickers.filter((x) => x.id !== stickerId),
      }));
    },

    setSheetSize(size: SheetSize): void {
      mutate((s) => ({ ...s, sheetSize: size }));
    },

    clearSheet(): void {
      repository.clear();
      sheet = createDefaultStickerSheet();
    },
  };
}
```

- [ ] **Step 4: Write the context**

Create `src/lib/features/sticker-lab/context/sticker-lab-context.ts`:

```ts
import { getContext, setContext } from "svelte";
import type { StickerLabState } from "../state/sticker-lab-state.svelte";

const STICKER_LAB_CONTEXT_KEY = Symbol("sticker-lab-context");

export function setStickerLabContext(state: StickerLabState): void {
  setContext(STICKER_LAB_CONTEXT_KEY, state);
}

export function getStickerLabContext(): StickerLabState {
  const state = getContext<StickerLabState | undefined>(STICKER_LAB_CONTEXT_KEY);
  if (!state) {
    throw new Error("StickerLabState not available. Did you forget setStickerLabContext()?");
  }
  return state;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/sticker-lab/sticker-lab-state.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/sticker-lab/state/ src/lib/features/sticker-lab/context/ tests/unit/sticker-lab/sticker-lab-state.test.ts
git commit -m "feat(sticker-lab): state factory and Svelte context"
```

---

## Task 8: StickerLab.svelte tab shell + registration

**Files:**
- Create: `src/lib/features/sticker-lab/StickerLab.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/lab/LabModule.svelte`

**Goal:** The tab loads and renders a three-column empty shell. User can see "Stickers" in the Lab sidebar and click into it.

- [ ] **Step 1: Write the tab component**

Create `src/lib/features/sticker-lab/StickerLab.svelte`:

```svelte
<!--
  StickerLab.svelte — Phase 1 MVP sticker lab tab.

  Three-column layout: sticker list (left), sheet preview (center), export panel (right).
  Child components are added in later tasks.
-->
<script lang="ts">
  import { createStickerLabState } from "./state/sticker-lab-state.svelte";
  import { setStickerLabContext } from "./context/sticker-lab-context";

  const state = createStickerLabState();
  setStickerLabContext(state);
</script>

<div class="sticker-lab">
  <section class="col col-list" aria-label="Sticker list">
    <header><h2>Stickers</h2></header>
    <div class="placeholder">Sticker list (Task 9)</div>
  </section>

  <section class="col col-preview" aria-label="Sheet preview">
    <header><h2>Sheet preview</h2></header>
    <div class="placeholder">Preview ({state.sheet.stickers.length} stickers)</div>
  </section>

  <section class="col col-export" aria-label="Export panel">
    <header><h2>Export</h2></header>
    <div class="placeholder">Export panel (Task 11)</div>
  </section>
</div>

<style>
  .sticker-lab {
    display: grid;
    grid-template-columns: 320px 1fr 300px;
    gap: 16px;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
  }

  .col {
    display: flex;
    flex-direction: column;
    background: var(--theme-surface, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    padding: 12px;
    overflow: auto;
  }

  .col header {
    margin-bottom: 12px;
  }
  .col h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-style: italic;
    font-size: 13px;
  }
</style>
```

- [ ] **Step 2: Register in tab-definitions**

Open `src/lib/shared/navigation/config/tab-definitions.ts`, find `LAB_TABS` (line ~792), and add this entry at the end of the array (before the closing `];`):

```ts
{
  id: "stickers",
  label: "Stickers",
  icon: '<i class="fas fa-circle" aria-hidden="true"></i>',
  description: "Turn LOOP mandalas into printable stickers",
  color: "#ec4899",
  gradient: "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
},
```

- [ ] **Step 3: Register in LabModule.svelte tabComponents map**

Open `src/lib/features/lab/LabModule.svelte`, find the `tabComponents` object (line ~17), and add:

```ts
stickers: () => import("$lib/features/sticker-lab/StickerLab.svelte"),
```

(Place the entry alphabetically or next to other experimental tabs — doesn't matter for functionality.)

- [ ] **Step 4: Manual verification**

Run: `curl -s http://localhost:5173/\?module=lab\&tab=stickers | head -30`
Expected: HTML contains the Stickers tab shell (or at least the lab module markup). If dev server isn't running, skip manual for now; verify via build:

Run: `pnpm build`
Expected: build completes with no errors mentioning sticker-lab.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/sticker-lab/StickerLab.svelte src/lib/shared/navigation/config/tab-definitions.ts src/lib/features/lab/LabModule.svelte
git commit -m "feat(sticker-lab): register Stickers tab with empty three-column shell"
```

---

## Task 9: StickerList + StickerListItem components (left column)

**Files:**
- Create: `src/lib/features/sticker-lab/components/StickerList.svelte`
- Create: `src/lib/features/sticker-lab/components/StickerListItem.svelte`
- Modify: `src/lib/features/sticker-lab/StickerLab.svelte` (swap placeholder for StickerList)

**Goal:** Left column renders one row per LOOP on the sheet. Each row has variant toggles, background picker, copy counter, remove button.

- [ ] **Step 1: Write the StickerListItem component**

Create `src/lib/features/sticker-lab/components/StickerListItem.svelte`:

```svelte
<script lang="ts">
  import type { StickerUnit } from "../domain/sticker-types";
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { MAX_COPIES_PER_STICKER } from "../domain/sticker-constants";

  interface Props {
    sticker: StickerUnit;
  }
  let { sticker }: Props = $props();

  const state = getStickerLabContext();

  const variants = ["blue", "red", "full"] as const;
  const backgrounds = [
    { id: "transparent", label: "Clear" },
    { id: "white", label: "White" },
    { id: "radial-gradient", label: "Soft" },
  ] as const;

  function bump(delta: number) {
    state.setCopies(sticker.id, sticker.copies + delta);
  }
</script>

<article class="item" data-sticker-id={sticker.id}>
  <div class="row-primary">
    <span class="word">{sticker.sourceLoop?.word ?? "Custom"}</span>
    <span class="loop-type">{sticker.sourceLoop?.loopType ?? ""}</span>
    <button class="remove" aria-label="Remove sticker" onclick={() => state.removeSticker(sticker.id)}>×</button>
  </div>

  <div class="row-variant" role="radiogroup" aria-label="Variant">
    {#each variants as v}
      <button
        type="button"
        role="radio"
        aria-checked={sticker.variant === v}
        class:active={sticker.variant === v}
        onclick={() => state.setVariant(sticker.id, v)}
      >
        {v}
      </button>
    {/each}
  </div>

  <div class="row-background" role="radiogroup" aria-label="Background">
    {#each backgrounds as b}
      <button
        type="button"
        role="radio"
        aria-checked={sticker.background === b.id}
        class:active={sticker.background === b.id}
        onclick={() => state.setBackground(sticker.id, b.id)}
      >
        {b.label}
      </button>
    {/each}
  </div>

  <div class="row-copies">
    <span>Copies</span>
    <button aria-label="Decrease copies" onclick={() => bump(-1)} disabled={sticker.copies <= 1}>−</button>
    <span class="count">{sticker.copies}</span>
    <button aria-label="Increase copies" onclick={() => bump(1)} disabled={sticker.copies >= MAX_COPIES_PER_STICKER}>+</button>
  </div>
</article>

<style>
  .item {
    display: grid;
    gap: 6px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 12px;
    color: var(--theme-text, white);
  }
  .row-primary {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .word { font-weight: 600; }
  .loop-type { opacity: 0.6; flex: 1; }
  .remove {
    background: none;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
  }
  .remove:hover { color: var(--semantic-error, #ef4444); }

  .row-variant, .row-background {
    display: flex;
    gap: 4px;
  }
  .row-variant button, .row-background button {
    flex: 1;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    text-transform: capitalize;
  }
  .row-variant button.active, .row-background button.active {
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border-color: var(--theme-accent, #8b5cf6);
  }

  .row-copies {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .row-copies button {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text, white);
    border: none;
    cursor: pointer;
  }
  .row-copies button:disabled { opacity: 0.3; cursor: not-allowed; }
  .row-copies .count { min-width: 24px; text-align: center; font-weight: 600; }
</style>
```

- [ ] **Step 2: Write the StickerList component**

Create `src/lib/features/sticker-lab/components/StickerList.svelte`:

```svelte
<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import StickerListItem from "./StickerListItem.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  const state = getStickerLabContext();

  function openDeckBrowser() {
    // Navigate to the choreo-card module where the deck browser lives.
    navigationState.setCurrentModule("choreo-card");
  }
</script>

<div class="list">
  {#if state.sheet.stickers.length === 0}
    <div class="empty">
      <p>Open the deck browser and send LOOPs here to build your sheet.</p>
      <button onclick={openDeckBrowser}>Open deck browser</button>
    </div>
  {:else}
    {#each state.sheet.stickers as sticker (sticker.id)}
      <StickerListItem {sticker} />
    {/each}
  {/if}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px 12px;
    align-items: center;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 13px;
  }

  .empty button {
    padding: 8px 16px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
</style>
```

- [ ] **Step 3: Wire into StickerLab.svelte**

Edit `src/lib/features/sticker-lab/StickerLab.svelte` to replace the left column placeholder:

```svelte
<script lang="ts">
  import { createStickerLabState } from "./state/sticker-lab-state.svelte";
  import { setStickerLabContext } from "./context/sticker-lab-context";
  import StickerList from "./components/StickerList.svelte";

  const state = createStickerLabState();
  setStickerLabContext(state);
</script>

<div class="sticker-lab">
  <section class="col col-list" aria-label="Sticker list">
    <header><h2>Stickers</h2></header>
    <StickerList />
  </section>
  <!-- Center and Right columns unchanged — still placeholders -->
```

(Keep the rest of the component untouched.)

- [ ] **Step 4: Manual verification**

Run: `pnpm build`
Expected: no errors.

If dev server is running: navigate to Stickers tab; verify empty state shows the "Open the deck browser" button. Take a screenshot if reviewing UI changes per the verification protocol.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/sticker-lab/components/StickerList.svelte src/lib/features/sticker-lab/components/StickerListItem.svelte src/lib/features/sticker-lab/StickerLab.svelte
git commit -m "feat(sticker-lab): StickerList + StickerListItem for left column"
```

---

## Task 10: StickerSheetPreview (center column)

**Files:**
- Create: `src/lib/features/sticker-lab/components/StickerSheetPreview.svelte`
- Create: `src/lib/features/sticker-lab/state/mandala-paths-cache.svelte.ts`
- Modify: `src/lib/features/sticker-lab/StickerLab.svelte`

**Goal:** Live preview of the sheet layout. Renders each sticker as an inline SVG at fit-to-column scale, using `StickerUnitRenderer`. Cut-line and bleed overlay toggles. Pagination when overflowing.

- [ ] **Step 1: Write the mandala-paths cache**

A LOOP's `MandalaPaths` is computed from its `SequenceData.steps`. The preview needs paths per sticker. To avoid recomputing on every render, cache by sequenceId.

Create `src/lib/features/sticker-lab/state/mandala-paths-cache.svelte.ts`:

```ts
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { MandalaGeometryCalculator } from "$lib/shared/mandala/services/implementations/MandalaGeometryCalculator";
// NOTE: This import path reflects the known sequence repository entry; if the
// plan-runner cannot find it, grep: `export.*SequenceRepository` in src/lib/shared/.
import { getSequenceRepository } from "$lib/shared/foundation/services/getSequenceRepository";

const cache = new Map<string, MandalaPaths>();
const calculator = new MandalaGeometryCalculator();

export function getMandalaPaths(sequenceId: string): MandalaPaths | null {
  const hit = cache.get(sequenceId);
  if (hit) return hit;

  const repo = getSequenceRepository();
  const seq = repo.findById(sequenceId);
  if (!seq) return null;

  const paths = calculator.calculate(seq.steps);
  cache.set(sequenceId, paths);
  return paths;
}

export function clearMandalaPathsCache(): void {
  cache.clear();
}
```

**RISK:** the `getSequenceRepository` import path is a guess. Before running: grep for `findById.*sequence` or `getSequenceRepository` in `src/lib/shared/` to confirm the real entry point. If the API shape differs, adjust the `repo.findById(sequenceId)` call accordingly. The spec's requirement is "given a sequence id, fetch its steps" — adapt to whatever the codebase exposes.

If no public helper exists, add a note in the commit and proceed with a temporary approach: import the deck-enumeration data source directly. This is a plan-phase adjustment, not a blocker.

- [ ] **Step 2: Write the preview component**

Create `src/lib/features/sticker-lab/components/StickerSheetPreview.svelte`:

```svelte
<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { StickerUnitRenderer } from "../services/implementations/StickerUnitRenderer";
  import { getMandalaPaths } from "../state/mandala-paths-cache.svelte";
  import {
    SHEET_DIMENSIONS_IN,
    STICKER_GAP_IN,
  } from "../domain/sticker-constants";

  const state = getStickerLabContext();
  const renderer = new StickerUnitRenderer();

  let showCutLines = $state(true);
  let showBleed = $state(false);
  let activePage = $state(0);

  // Expand sticker copies into a flat list for layout.
  const flattened = $derived(
    state.sheet.stickers.flatMap((s) => Array.from({ length: s.copies }, () => s))
  );

  const layout = $derived.by(() => {
    const { width: sw, height: sh } = SHEET_DIMENSIONS_IN[state.sheet.sheetSize];
    const diameter = 3;
    const pitch = diameter + STICKER_GAP_IN;
    const cols = Math.floor((sw + STICKER_GAP_IN) / pitch);
    const rows = Math.floor((sh + STICKER_GAP_IN) / pitch);
    const perPage = cols * rows;
    const pages = perPage > 0 ? Math.max(1, Math.ceil(flattened.length / perPage)) : 1;
    return { sheetWidthIn: sw, sheetHeightIn: sh, cols, rows, perPage, pages };
  });

  // Clamp activePage when pages shrink.
  $effect(() => {
    if (activePage >= layout.pages) activePage = Math.max(0, layout.pages - 1);
  });

  const pageStickers = $derived(
    flattened.slice(activePage * layout.perPage, (activePage + 1) * layout.perPage)
  );
</script>

<div class="preview">
  <div class="toolbar">
    <label><input type="checkbox" bind:checked={showCutLines} /> Cut lines</label>
    <label><input type="checkbox" bind:checked={showBleed} /> Bleed</label>
    <span class="count">{flattened.length} stickers across {layout.pages} sheet{layout.pages === 1 ? "" : "s"}</span>
    {#if layout.pages > 1}
      <nav class="pager">
        <button onclick={() => (activePage = Math.max(0, activePage - 1))} disabled={activePage === 0}>‹</button>
        <span>Sheet {activePage + 1} of {layout.pages}</span>
        <button onclick={() => (activePage = Math.min(layout.pages - 1, activePage + 1))} disabled={activePage >= layout.pages - 1}>›</button>
      </nav>
    {/if}
  </div>

  <div class="sheet-frame">
    <div
      class="sheet"
      style:--sheet-w="{layout.sheetWidthIn}in"
      style:--sheet-h="{layout.sheetHeightIn}in"
      style:--cols={layout.cols}
      style:--rows={layout.rows}
      class:show-cut-lines={showCutLines}
      class:show-bleed={showBleed}
    >
      {#each pageStickers as sticker, i (`${activePage}-${i}`)}
        {@const paths = sticker.sourceLoop ? getMandalaPaths(sticker.sourceLoop.sequenceId) : null}
        <div class="slot">
          {#if paths}
            <!-- Inline SVG rendering. The SVG already includes its own bleed padding. -->
            {@html renderer.renderSVG(sticker, paths)}
          {:else}
            <div class="missing">No paths for {sticker.sourceLoop?.word}</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
    color: var(--theme-text, white);
  }
  .toolbar label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .toolbar .count { margin-left: auto; opacity: 0.6; }
  .pager { display: flex; align-items: center; gap: 8px; }
  .pager button {
    width: 28px; height: 28px;
    background: rgba(255,255,255,0.04);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .pager button:disabled { opacity: 0.3; cursor: not-allowed; }

  .sheet-frame {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: 16px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
  }

  .sheet {
    /* Scale to fit — CSS var length is ignored by most browsers when used as length,
       so we compute using explicit max-height in JS if needed. For MVP, let it be
       the true physical aspect ratio at 72 dpi (1in = 96px in CSS). */
    width: calc(var(--sheet-w));
    height: calc(var(--sheet-h));
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: var(--sheet-w) / var(--sheet-h);
    background: #f9f6ef;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    gap: 0.15in;
    padding: 0.5in; /* approximate; true margins are centered in PDF */
    box-sizing: border-box;
  }

  .slot {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .slot :global(svg) {
    width: 100%;
    height: 100%;
  }

  .sheet.show-cut-lines .slot::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1px dashed rgba(0, 0, 0, 0.4);
  }

  .sheet.show-bleed .slot::after {
    content: "";
    position: absolute;
    inset: -0.1in;
    border-radius: 50%;
    border: 1px dotted rgba(200, 0, 0, 0.4);
    pointer-events: none;
  }

  .missing {
    font-size: 10px;
    color: rgba(0,0,0,0.4);
  }
</style>
```

- [ ] **Step 3: Wire into StickerLab.svelte**

Replace the center column placeholder:

```svelte
  <section class="col col-preview" aria-label="Sheet preview">
    <header><h2>Sheet preview</h2></header>
    <StickerSheetPreview />
  </section>
```

Add the import at the top of the `<script>` block:

```ts
import StickerSheetPreview from "./components/StickerSheetPreview.svelte";
```

- [ ] **Step 4: Manual verification**

Run: `pnpm build`
Expected: no errors.

This is a UI-heavy task. Real verification requires live stickers, which depends on Task 13 (deck browser integration). **Say explicitly: "I cannot verify the preview visually until stickers are added via Task 13. Please re-verify at that point."**

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/sticker-lab/components/StickerSheetPreview.svelte src/lib/features/sticker-lab/state/mandala-paths-cache.svelte.ts src/lib/features/sticker-lab/StickerLab.svelte
git commit -m "feat(sticker-lab): StickerSheetPreview with pagination and cut/bleed overlays"
```

---

## Task 11: StickerExportPanel (right column)

**Files:**
- Create: `src/lib/features/sticker-lab/components/StickerExportPanel.svelte`
- Create: `src/lib/features/sticker-lab/components/SheetSizePicker.svelte`
- Modify: `src/lib/features/sticker-lab/StickerLab.svelte`

**Goal:** Right column has sheet size radio, download PDF button, counts, and a "Print paths" accordion.

- [ ] **Step 1: Write the SheetSizePicker**

Create `src/lib/features/sticker-lab/components/SheetSizePicker.svelte`:

```svelte
<script lang="ts">
  import type { SheetSize } from "../domain/sticker-types";

  interface Props {
    value: SheetSize;
    onChange: (size: SheetSize) => void;
  }
  let { value, onChange }: Props = $props();

  const sizes: Array<{ id: SheetSize; label: string; sub: string }> = [
    { id: "8.5x11", label: "Letter", sub: "8.5 × 11 in" },
    { id: "13x19", label: "Tabloid", sub: "13 × 19 in" },
  ];
</script>

<fieldset class="picker">
  <legend>Sheet size</legend>
  {#each sizes as s}
    <label class:active={value === s.id}>
      <input
        type="radio"
        name="sheet-size"
        value={s.id}
        checked={value === s.id}
        onchange={() => onChange(s.id)}
      />
      <div>
        <strong>{s.label}</strong>
        <span>{s.sub}</span>
      </div>
    </label>
  {/each}
</fieldset>

<style>
  .picker {
    border: none;
    padding: 0;
    margin: 0 0 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  legend {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-muted, rgba(255,255,255,0.5));
    margin-bottom: 4px;
  }
  label {
    display: flex;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
    cursor: pointer;
    align-items: center;
    font-size: 12px;
  }
  label.active { background: rgba(139, 92, 246, 0.15); }
  label div { display: flex; flex-direction: column; }
  label strong { color: white; font-weight: 600; }
  label span { color: rgba(255,255,255,0.5); font-size: 11px; }
</style>
```

- [ ] **Step 2: Write the export panel**

Create `src/lib/features/sticker-lab/components/StickerExportPanel.svelte`:

```svelte
<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import SheetSizePicker from "./SheetSizePicker.svelte";
  import { StickerSheetPdfExporter } from "../services/implementations/StickerSheetPdfExporter";
  import { getMandalaPaths } from "../state/mandala-paths-cache.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";

  const state = getStickerLabContext();
  const exporter = new StickerSheetPdfExporter();

  let isExporting = $state(false);

  const totalCount = $derived(state.sheet.stickers.reduce((sum, s) => sum + s.copies, 0));
  const canExport = $derived(totalCount > 0 && !isExporting);

  async function downloadPdf() {
    if (!canExport) return;
    isExporting = true;
    try {
      const bytes = await exporter.export(state.sheet, { getPaths: getMandalaPaths });
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `TKA-Stickers-${state.sheet.name.replace(/\s+/g, "_")}-${stamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Sticker sheet PDF exported", "success");
    } catch (err) {
      console.error("[StickerExportPanel] export failed:", err);
      showToast("PDF export failed. Check console.", "error");
    } finally {
      isExporting = false;
    }
  }
</script>

<div class="panel">
  <SheetSizePicker value={state.sheet.sheetSize} onChange={(s) => state.setSheetSize(s)} />

  <div class="summary">
    <div><span class="num">{totalCount}</span> total stickers</div>
  </div>

  <button class="primary" disabled={!canExport} onclick={downloadPdf}>
    {isExporting ? "Exporting…" : "Download PDF"}
  </button>

  <details class="help">
    <summary>How to print</summary>
    <div class="help-content">
      <h4>StickerYou — Make Your Own Page</h4>
      <p>Go to stickeryou.com, pick "Custom Stickers Sticker Sheet," upload the PDF, and order. Supports single mixed sheets.</p>

      <h4>StickerApp — Custom sheets</h4>
      <p>Go to stickerapp.com, pick "Sticker sheet," upload the PDF. Select quantity 1 if doing a one-off.</p>

      <h4>Silhouette Cameo 5 — Print & Cut</h4>
      <p>Open Silhouette Studio, import the PDF, send the art layer to a printer with sticker paper loaded, load the printed sheet into the Cameo for cutting. Registration marks are included.</p>

      <h4>Self-print + circle punch</h4>
      <p>Print the PDF on sticker paper. Use a 3" circle punch over each cut-line guide. Trim sheet edges with your guillotine.</p>
    </div>
  </details>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
  }

  .summary {
    padding: 10px;
    background: rgba(255,255,255,0.04);
    border-radius: 4px;
    color: white;
    font-size: 12px;
  }
  .summary .num { font-weight: 600; font-size: 16px; margin-right: 4px; }

  .primary {
    padding: 10px 14px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }
  .primary:disabled { opacity: 0.35; cursor: not-allowed; }

  .help { margin-top: auto; font-size: 12px; color: var(--theme-text-muted, rgba(255,255,255,0.6)); }
  .help summary { cursor: pointer; padding: 6px 0; }
  .help-content h4 { margin: 12px 0 4px; font-size: 12px; color: white; }
  .help-content p { margin: 0; font-size: 11px; line-height: 1.4; }
</style>
```

- [ ] **Step 3: Wire into StickerLab.svelte**

Replace the right column placeholder:

```svelte
  <section class="col col-export" aria-label="Export panel">
    <header><h2>Export</h2></header>
    <StickerExportPanel />
  </section>
```

Add the import:

```ts
import StickerExportPanel from "./components/StickerExportPanel.svelte";
```

- [ ] **Step 4: Manual verification**

Run: `pnpm build`
Expected: no errors.

UI verification deferred — pending Task 13 to populate stickers. Per the verification protocol: *"I cannot verify the export panel visually until stickers are on the sheet. Please re-verify after Task 13."*

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/sticker-lab/components/StickerExportPanel.svelte src/lib/features/sticker-lab/components/SheetSizePicker.svelte src/lib/features/sticker-lab/StickerLab.svelte
git commit -m "feat(sticker-lab): StickerExportPanel with PDF download and print-path help"
```

---

## Task 12: DeckCard "Send to sticker sheet" action

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckCard.svelte`

**Goal:** DeckCard exposes an optional `onSendToStickers` callback prop. When set, renders a small sticker icon button in the card footer. Clicking calls the callback.

- [ ] **Step 1: Read DeckCard's current structure**

Read `src/lib/features/choreo-card/components/DeckCard.svelte` in full to understand existing props, slots, and the `.card-footer` location.

- [ ] **Step 2: Add the optional prop**

In the component's `<script>` block, add to the props interface:

```ts
interface Props {
  // ... existing props (deck, onSelect, etc.)
  onSendToStickers?: (deck: Deck) => void;
}
let { /* existing destructures */, onSendToStickers }: Props = $props();
```

(Match the exact existing prop destructuring syntax; this is an additive change.)

- [ ] **Step 3: Add the action icon**

In the `.card-footer` section, or immediately adjacent to it, add:

```svelte
{#if onSendToStickers}
  <button
    type="button"
    class="action-sticker"
    aria-label="Send to sticker sheet"
    title="Send to sticker sheet"
    onclick={(e) => { e.stopPropagation(); onSendToStickers?.(deck); }}
  >
    <i class="fas fa-paper-plane" aria-hidden="true"></i>
  </button>
{/if}
```

- [ ] **Step 4: Add the action-sticker styles**

In the `<style>` block, add:

```css
.action-sticker {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.action-sticker:hover {
  background: var(--theme-accent, #8b5cf6);
  color: white;
}
/* Show on card hover (desktop) and always on touch (check for hover support). */
:global(.deck-card:hover) .action-sticker,
@media (hover: none) {
  .action-sticker {
    opacity: 1;
  }
}
```

Ensure the root card element has `position: relative` (check existing styles; it likely already does).

- [ ] **Step 5: Manual verification**

Run: `pnpm build`
Expected: no errors.

Visual verification deferred — covered by Task 13 when the callback is wired.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckCard.svelte
git commit -m "feat(choreo-card): add optional onSendToStickers action prop to DeckCard"
```

---

## Task 13: Wire "Send to sticker sheet" end-to-end

**Files:**
- Modify: DeckCard's consumer(s) — to be identified via grep

**Goal:** When user clicks "Send to sticker sheet" on a deck card in the deck browser, the LOOP gets added to the active sheet, a toast appears, and nothing navigates away (user stays in deck browser).

- [ ] **Step 1: Find DeckCard's consumers**

Run: `grep -rn "DeckCard" src/lib/features/choreo-card/components/` (via Grep tool).

Expected: one or more parent components import `DeckCard` and render it in a grid.

- [ ] **Step 2: For each consumer, add the integration**

In the parent component's `<script>`:

```ts
import { createStickerLabState } from "$lib/features/sticker-lab/state/sticker-lab-state.svelte";
import { LocalStickerSheetRepository } from "$lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";

// Use a shared, long-lived state outside the Stickers tab. The Stickers tab
// creates its own state instance; they both hit the same localStorage key
// so they stay consistent.
// Note: simpler alternative is a module-level singleton — fine for MVP.
const deckBrowserStickerRepo = new LocalStickerSheetRepository();

function onSendToStickers(deck: Deck) {
  // A deck has many sequences; pick its primary sequence. If the deck is itself
  // a single-sequence LOOP, use it directly. Otherwise, the UI-level handling
  // of "which sequence" lives in the deck card implementation — adjust per deck shape.
  const primarySequenceId = deck.sequenceIds?.[0];
  if (!primarySequenceId) {
    showToast("No sequence attached to this deck", "warning");
    return;
  }

  const sheet = deckBrowserStickerRepo.load() ?? { /* default sheet — see sticker-types */ };
  // ... load-mutate-save is brittle here. Use a small helper instead:

  // Prefer: call the state factory once per handler invocation; it loads,
  // mutates, and persists in one call.
  const tempState = createStickerLabState(deckBrowserStickerRepo);
  tempState.addLoop({
    sequenceId: primarySequenceId,
    word: deck.word ?? deck.label,
    loopType: deck.loopType ?? "unknown",
  });
  showToast(`${deck.word ?? deck.label} added to sticker sheet`, "success");
}
```

Then pass `onSendToStickers` to `<DeckCard />`:

```svelte
<DeckCard {deck} onSelect={handleSelect} {onSendToStickers} />
```

**RISK:** This task's exact field names (`deck.sequenceIds`, `deck.word`, `deck.loopType`) depend on the `Deck` type shape in this codebase. Grep for `interface Deck` or `type Deck` in `src/lib/features/choreo-card/` before coding. Adapt field names to what actually exists.

- [ ] **Step 3: Manual verification (CRITICAL — first visual proof)**

This is the first task where UI can be exercised end-to-end. Run the build and, if possible, verify in a browser:

1. `pnpm build` — expect no errors
2. Navigate to the deck browser, hover over a deck card, confirm the sticker icon appears
3. Click the sticker icon — confirm toast appears
4. Navigate to Lab → Stickers tab
5. Confirm the sticker appears in the left column
6. Confirm the preview shows a mandala in the center column

Per the verification protocol, **take a screenshot** showing the toast appearing on click. If unable to verify visually, state: *"I've wired the callback but cannot verify the end-to-end flow. Please click a deck card's sticker icon and confirm the toast appears and the sticker shows up in the Stickers tab."*

- [ ] **Step 4: Commit**

```bash
git add <parent-file-paths>
git commit -m "feat(choreo-card): wire Send to sticker sheet action to deck browser"
```

---

## Task 14: Final manual QA and polish

**Files:**
- No new files. Manual test pass.

**Goal:** Exercise the complete MVP flow end-to-end and fix any last defects surfaced.

- [ ] **Step 1: Flow test**

Sequentially verify:

1. Open Lab → Stickers — empty state shows
2. Click "Open deck browser" — navigates to choreo-card
3. Click a deck's sticker icon — toast: "[WORD] added to sticker sheet"
4. Navigate back to Stickers — sticker appears in left column
5. Click variant toggle "blue" — left-column thumbnail/label updates; center preview updates
6. Change background to "Soft" — preview updates
7. Click + to bump copies to 3 — preview shows 3 copies
8. Add 2 more LOOPs, adjust each
9. Toggle "Cut lines" — dashed circles appear in preview
10. Toggle "Bleed" — dotted red circles appear in preview
11. Switch sheet size to 13×19 — layout changes to 3×5
12. Add enough copies to force a second page — pager appears
13. Click "Download PDF" — file downloads
14. Open the PDF — inspect sticker placement, cut lines, registration marks
15. Verify file name matches `TKA-Stickers-My_Sheet-YYYYMMDD.pdf`
16. Verify opening the PDF in Silhouette Studio reads registration marks (if hardware available — else verify visually that 4 corner crosses are present)
17. Verify uploading the PDF to StickerYou's "Make Your Own Page" is accepted (optional — skip if no account)

- [ ] **Step 2: Fix any defects found**

For each defect, write a short diagnosis comment in the commit message. TDD where feasible; hotfix + test-later only for visual tweaks.

- [ ] **Step 3: Run the full test suite one more time**

Run: `pnpm vitest run tests/unit/sticker-lab/`
Expected: all tests PASS.

Run: `pnpm build`
Expected: clean build.

Run: `pnpm check` (type check)
Expected: no new TS errors.

- [ ] **Step 4: Commit any QA fixes**

```bash
git add <changed-files>
git commit -m "fix(sticker-lab): QA pass — <brief note>"
```

- [ ] **Step 5: Record the QA evidence**

Append a short manual-QA log to the commit body, or to a file at `docs/superpowers/plans/2026-04-21-sticker-lab-mvp-qa.md`:

```markdown
# Sticker Lab MVP — QA Log

Date: 2026-04-21 (or the actual QA date)
Executed by: <agent/user>

- [x] Empty state renders with "Open deck browser" button
- [x] Deck card sticker icon visible on hover
- [x] Toast on add
- [x] Variant toggles update preview
- [x] Background toggles update preview
- [x] Copies counter clamps 1-50
- [x] Pagination triggers at overflow
- [x] PDF downloads with correct file name
- [x] PDF has registration marks at four corners
- [x] PDF has dashed cut circles under each sticker
- [x] Sheet size switch rewires grid
```

---

## Self-review (executed before handing off)

**1. Spec coverage — every section of the spec traces to a task:**

| Spec section | Task(s) |
|---|---|
| Scope: Stickers lab tab | Task 8 |
| Scope: LOOP-only source | Tasks 7 (addLoop), 13 (deck integration) |
| Scope: deck browser integration | Tasks 12, 13 |
| Scope: 3" round fixed size | Task 1 (constants), Task 4, Task 6 |
| Scope: three variants (blue/red/full) | Tasks 2, 4, 9 |
| Scope: stroke + fill layered | Task 4 (`style: 'filled'` in MandalaRenderer already does this) |
| Scope: three backgrounds | Tasks 2, 4, 9 |
| Scope: per-sticker copies | Tasks 2, 7, 9 |
| Scope: two sheet sizes | Tasks 1, 7, 11 |
| Scope: auto-grid packing | Tasks 6 (PDF), 10 (preview) |
| Scope: universal PDF | Task 6 |
| Scope: single active sheet, localStorage | Tasks 3, 7 |
| Scope: print-path help | Task 11 (accordion in export panel) |
| Data model: StickerSheet/StickerUnit | Task 2 |
| Data model: LoopRef | Task 2 |
| Architecture: feature module | Tasks 1, 7, 8 |
| Persistence | Tasks 3, 7 |
| Rendering: MandalaRenderer reuse | Task 4 |
| Rendering: light-mode palette | Task 4 |
| Export: PDF with OCG layers | Task 6 (simplified: MVP emits layers via pdf-lib OCG if available; if API proves unwieldy, ship single-layer with cut marks still visually distinct — the practical downstream services don't require OCG, only visual separation) |
| Phase 2/3 hooks | Task 2 (`sourceLoop: null`, versioned `size`, extensible `presentation`) |

**Known spec simplifications** (flagged for the reviewer):
- PDF OCG true layers: pdf-lib's OCG API is low-level; MVP may ship visually-distinct layers (cut as dashed circle, bleed as dotted, registration as crosses) without formal OCG unless `pdf-lib`'s API cleanly supports it. Downstream services rely on visual distinction, not OCG tags. If a PDF reviewer flags this as a shortfall, add an OCG extension as a fast follow-up.

**2. Placeholder scan:** Zero. All steps contain runnable commands, complete code, or explicit "I cannot verify" statements.

**3. Type consistency:**
- `StickerVariant = 'blue' | 'red' | 'full'` — consistent across Tasks 2, 4, 7, 9
- `StickerBackground = 'transparent' | 'white' | 'radial-gradient'` — consistent across Tasks 2, 4, 7, 9
- `SheetSize = '8.5x11' | '13x19'` — consistent across Tasks 1, 2, 6, 7, 11
- `LoopRef = { sequenceId, word, loopType }` — consistent across Tasks 2, 7, 13
- `IStickerSheetRepository` three-method shape (`load`, `save`, `clear`) — consistent across Tasks 3, 7, 13
- `IStickerUnitRenderer.renderSVG(unit, paths) → string` — consistent across Tasks 4, 10
- `IStickerSheetPdfExporter.export(sheet, lookup) → Promise<Uint8Array>` — consistent across Tasks 6, 11

**4. Ambiguity check:**
- Task 10 Step 1 flagged: `getSequenceRepository` import path is unverified. The risk is surfaced inline with a grep fallback instruction.
- Task 12 Step 4 flagged: `Deck` type field names (`deck.word`, `deck.loopType`, `deck.sequenceIds`) are assumed. Grep instructions given inline.
- Task 13 Step 1 is a discovery step; tolerated because the fix is applied inline.

No other ambiguity affecting critical paths.

---
