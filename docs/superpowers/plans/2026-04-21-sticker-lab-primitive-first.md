# Sticker Lab — Primitive-First Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-04-21
**Supersedes:** `docs/superpowers/plans/2026-04-21-sticker-lab-mvp.md`
**Specs:**
- `docs/superpowers/specs/2026-04-21-sticker-lab-primitive-first.md` — UX pivot, data model, migration strategy
- `docs/superpowers/specs/2026-04-21-mandala-three-tier-equivalence.md` — canonical form algorithm, hashing, registry schema

---

## Preamble

### What this plan delivers

This plan migrates the Sticker Lab from its current sequence-first scaffold (12 commits, on main) to a primitive-first architecture where the unit of interest is a mandala shape, not a LOOP sequence. The shipped result is Stage A: a static primitive catalog (JSON, generated from enumerated LOOP data), an in-tab primitive picker backed by that catalog, and all existing components rewired to key on `shapeHash` instead of `sequenceId`. Stage B (live registry with full three-tier canonicalization) and Stage C (cross-user catalog) are deferred and called out explicitly where the Stage A code leaves seams for them.

### Current state (12 commits, already on main)

The following files exist and are functional:

| File | Status |
|---|---|
| `src/lib/features/sticker-lab/StickerLab.svelte` | Keep unchanged |
| `src/lib/features/sticker-lab/domain/sticker-types.ts` | Modify — add `MandalaPrimitiveRef`, update `StickerUnit` |
| `src/lib/features/sticker-lab/domain/sticker-constants.ts` | Modify — bump `STORAGE_SCHEMA_VERSION` to `2` |
| `src/lib/features/sticker-lab/state/sticker-lab-state.svelte.ts` | Modify — replace `addLoop` with `addPrimitive` |
| `src/lib/features/sticker-lab/state/mandala-paths-cache.svelte.ts` | Rewrite — key on `shapeHash`, load from catalog |
| `src/lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository.ts` | Modify — add v1→v2 migration chain |
| `src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts` | Modify — swap `sequenceId` for `shapeHash` in lookup |
| `src/lib/features/sticker-lab/services/contracts/IStickerSheetPdfExporter.ts` | Modify — rename parameter in `StickerMandalaLookup` |
| `src/lib/features/sticker-lab/components/StickerList.svelte` | Modify — remove `openDeckBrowser`, add `[+]` picker trigger, update empty state |
| `src/lib/features/sticker-lab/components/StickerListItem.svelte` | Modify — replace `sourceLoop.word` with `primitiveRef.displayName` |
| `src/lib/features/sticker-lab/components/StickerSheetPreview.svelte` | Modify — two-line key swap |
| `src/lib/features/sticker-lab/components/StickerExportPanel.svelte` | Modify — two-line key swap |
| `src/lib/features/sticker-lab/components/PrimitivePicker.svelte` | New — in-tab overlay picker |

These files are untouched by this plan:

`StickerUnitRenderer.ts`, `rasterizeSvg.ts`, `IStickerSheetRepository.ts`, `IStickerUnitRenderer.ts`, `sticker-lab-context.ts`, `SheetSizePicker.svelte`, `StickerLab.svelte`, `LabModule.svelte`, `tab-definitions.ts`.

### Target state

**Stage A (this plan):**
- `StickerUnit.primitiveRef: MandalaPrimitiveRef` is the primary identity; `sourceLoop` is a deprecated annotation.
- A build script generates `src/lib/features/sticker-lab/data/primitive-catalog.json` from the enumerated LOOP catalog. At Stage A the `shapeHash` is the `sequenceId` of the canonical representative — no geometric canonicalization yet.
- `PrimitivePicker.svelte` loads the catalog, displays shape tiles, and calls `state.addPrimitive(ref)`.
- `StickerList.svelte` empty state: "Add a primitive to start your sheet." / "Browse primitives" button.
- `StickerListItem.svelte` shows `primitiveRef.displayName`.
- v1→v2 localStorage migration preserves existing user sheets.
- Full PDF export flow works end-to-end.

**Stage B (deferred, seams left):**
- Full three-tier geometric canonicalization replaces sequenceId proxies as `shapeHash` values.
- `MandalaPrimitiveRegistry` replaces the static catalog as the picker data source.

**Stage C (deferred):**
- Cross-user Firestore catalog. No seams needed yet.

### How this plan differs from the superseded plan

The superseded `2026-04-21-sticker-lab-mvp.md` plan was built around the same 12 commits but assumed the Phase 1 spec (deck browser cross-tab entry, `sourceLoop` as primary identity). This plan:

1. Replaces Task 12 (deck-browser "Send to sticker sheet") entirely — that feature is eliminated.
2. Introduces a data model migration in place of a simple schema bump.
3. Adds Phase B (catalog build script) and Phase C (PrimitivePicker UI) which the MVP plan did not include.
4. Rewires mandala-paths-cache to load from the static catalog instead of the sequence repository.

Tasks 0–9 from the MVP plan (module scaffolding, DI wiring, state, repository, renderer, PDF exporter, StickerList, StickerListItem, preview, export panel) are already done. This plan starts from the existing 12-commit state.

---

## Task 0 — Preflight

**Goal:** Confirm the codebase is in a clean, passing state before any changes.

- [ ] **Step 1:** Run `npm run check`. Expect zero errors. If errors exist, record them — they pre-exist and must not be introduced by this plan's changes.

- [ ] **Step 2:** Run `npm run build`. Confirm it completes. Record any pre-existing warnings.

- [ ] **Step 3:** Run `npm test -- --reporter=verbose 2>&1 | head -80`. Confirm the MandalaGeometryCalculator tests pass (they are the closest existing tests to the domain touched here).

- [ ] **Step 4:** Confirm the current state of the sticker-lab files matches what this plan describes.

  ```bash
  # Should print all 19 sticker-lab files
  find src/lib/features/sticker-lab -type f | sort
  ```

  Expected count: 19 files (12 `.ts`/`.svelte`, plus `index.ts`).

- [ ] **Step 5:** Confirm `static/data/` exists.

  ```bash
  ls static/data/
  ```

  Expected: directory exists with at least `pictographs/` and `beat_frame_layout_options.json`. No `primitive-catalog.json` yet.

- [ ] **Step 6:** Commit nothing.

**Verification:** `npm run check` exits 0 and `npm run build` exits 0.

---

## Phase A: Data Model Migration (v1 → v2)

### Task 1 — Add `MandalaPrimitiveRef` and update `StickerUnit`

**Goal:** Introduce the `MandalaPrimitiveRef` type and update `StickerUnit` so `primitiveRef` is the primary identity field; `sourceLoop` becomes a deprecated annotation.

**Dependencies:** Task 0 complete.

> **AUDIT-FLAGGED CO-COMMIT (RED-1):** This task MUST also patch `StickerSheetPdfExporter.ts` line 44 in the same commit. Change `lookup.getPaths(placement.unit.sourceLoop.sequenceId)` to `lookup.getPaths(placement.unit.primitiveRef.shapeHash)`. `StickerUnit.sourceLoop` becomes optional here; leaving the exporter reading `sourceLoop` will type-check but produce silent blank PDFs on all post-migration stickers. See Task 8 for the full exporter patch; the line-44 change must land with Task 1.

**Files:**
- Modify: `src/lib/features/sticker-lab/domain/sticker-types.ts`
- Modify (same commit, RED-1 co-commit): `src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts` line 44

**Implementation:**

Replace the current `sticker-types.ts` contents with:

```ts
export type StickerVariant = "blue" | "red" | "full";
export type StickerBackground = "transparent" | "white" | "radial-gradient";
export type StickerSize = "3in-round";
export type StickerPresentation = "pure";
export type SheetSize = "8.5x11" | "13x19";

/** Reference to a LOOP sequence — used as a back-link annotation only. */
export interface LoopRef {
  readonly sequenceId: string;
  readonly word: string;
  readonly loopType: string;
}

/**
 * Stable content-addressed reference to a mandala primitive shape.
 *
 * Stage A: shapeHash and ultraHash are set to the canonical representative's
 * sequenceId (a proxy hash). Stage B will replace these with geometric SHA-256
 * hashes derived from MandalaCanonicalizer.
 */
export interface MandalaPrimitiveRef {
  /** Hash identifying the shape tier. Stage A: sequenceId proxy. Stage B: geometric SHA-256. */
  readonly shapeHash: string;
  /** Hash identifying the ultra-equivalence class. Stage A: same as shapeHash. */
  readonly ultraHash: string;
  /**
   * Optional back-link to the canonical source LOOP.
   * Present in Stage A catalog; null for future chimera / synthetic primitives.
   */
  readonly sourceLoop?: LoopRef | null;
  /** Human-readable label shown in the picker and list items. */
  readonly displayName?: string;
}

export interface StickerUnit {
  readonly id: string;
  /** Primary identity in v2. References a primitive, not a specific sequence. */
  readonly primitiveRef: MandalaPrimitiveRef;
  /**
   * @deprecated v1 compat field retained only for migration reads.
   * Always null after migration. Callers must not rely on it being populated.
   */
  readonly sourceLoop?: LoopRef | null;
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

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateStickerUnitInput {
  primitiveRef: MandalaPrimitiveRef;
  variant?: StickerVariant;
  background?: StickerBackground;
  copies?: number;
}

export function createDefaultStickerUnit(input: CreateStickerUnitInput): StickerUnit {
  return {
    id: generateId("sticker"),
    primitiveRef: input.primitiveRef,
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

**TDD test spec:**

File: `tests/unit/sticker-lab/sticker-types.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  createDefaultStickerUnit,
  createDefaultStickerSheet,
} from "$lib/features/sticker-lab/domain/sticker-types";

describe("createDefaultStickerUnit", () => {
  it("sets primitiveRef from input", () => {
    const ref = { shapeHash: "abc", ultraHash: "abc", displayName: "Test" };
    const unit = createDefaultStickerUnit({ primitiveRef: ref });
    expect(unit.primitiveRef).toEqual(ref);
  });

  it("defaults variant to full", () => {
    const unit = createDefaultStickerUnit({
      primitiveRef: { shapeHash: "x", ultraHash: "x" },
    });
    expect(unit.variant).toBe("full");
  });

  it("defaults background to transparent", () => {
    const unit = createDefaultStickerUnit({
      primitiveRef: { shapeHash: "x", ultraHash: "x" },
    });
    expect(unit.background).toBe("transparent");
  });

  it("defaults copies to 1", () => {
    const unit = createDefaultStickerUnit({
      primitiveRef: { shapeHash: "x", ultraHash: "x" },
    });
    expect(unit.copies).toBe(1);
  });

  it("does not set deprecated sourceLoop field", () => {
    const unit = createDefaultStickerUnit({
      primitiveRef: { shapeHash: "x", ultraHash: "x" },
    });
    expect(unit.sourceLoop).toBeUndefined();
  });
});

describe("createDefaultStickerSheet", () => {
  it("creates a sheet with an empty sticker array", () => {
    const sheet = createDefaultStickerSheet();
    expect(sheet.stickers).toHaveLength(0);
  });
});
```

**Verification:** `npm test -- sticker-types` exits 0.

**Commit:** `feat(sticker-lab): introduce MandalaPrimitiveRef and update StickerUnit to v2 identity`

---

### Task 2 — Bump schema version and add v1→v2 migration

**Goal:** `STORAGE_SCHEMA_VERSION` becomes `2`; `LocalStickerSheetRepository.load()` runs a migration chain that converts v1 stickers to v2 instead of discarding them.

**Dependencies:** Task 1 complete.

**Files:**
- Modify: `src/lib/features/sticker-lab/domain/sticker-constants.ts`
- Modify: `src/lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository.ts`

**Implementation — `sticker-constants.ts`:**

Change line 34:
```ts
// Before
export const STORAGE_SCHEMA_VERSION = 1;

// After
export const STORAGE_SCHEMA_VERSION = 2;
```

**Implementation — `LocalStickerSheetRepository.ts`:**

Replace entirely:

```ts
import type { StickerSheet, StickerUnit } from "../../domain/sticker-types";
import {
  STORAGE_KEY_ACTIVE_SHEET,
  STORAGE_SCHEMA_VERSION,
} from "../../domain/sticker-constants";
import type { IStickerSheetRepository } from "../contracts/IStickerSheetRepository";

/** v1 stored payload shape (before MandalaPrimitiveRef). */
interface StoredPayloadV1 {
  version: 1;
  sheet: {
    id: string;
    name: string;
    sheetSize: string;
    stickers: Array<{
      id: string;
      sourceLoop?: { sequenceId: string; word: string; loopType: string } | null;
      variant: string;
      size: string;
      background: string;
      copies: number;
      presentation: string;
    }>;
    createdAt: number;
    updatedAt: number;
  };
}

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

    // Migration chain.
    if (parsed.version === 1) {
      parsed = migrateV1toV2(parsed as StoredPayloadV1);
    }

    // Reject unknown future versions.
    if (parsed.version !== STORAGE_SCHEMA_VERSION) return null;

    return (parsed as StoredPayload).sheet;
  }

  save(sheet: StickerSheet): void {
    const payload: StoredPayload = { version: STORAGE_SCHEMA_VERSION, sheet };
    this.storage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify(payload));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY_ACTIVE_SHEET);
  }
}

function migrateV1toV2(payload: StoredPayloadV1): StoredPayload {
  const migrated: StickerUnit[] = payload.sheet.stickers.map((raw) => {
    // Already v2 (shouldn't happen in a v1 payload, but guard anyway).
    if ("primitiveRef" in raw && raw.primitiveRef) return raw as unknown as StickerUnit;

    const sourceLoop = raw.sourceLoop ?? null;
    return {
      id: raw.id,
      primitiveRef: {
        // Stage A proxy: sequenceId becomes the shapeHash placeholder.
        // When Stage B registry lands, these will be recalculated from geometry.
        shapeHash: sourceLoop?.sequenceId ?? `legacy-${raw.id}`,
        ultraHash: sourceLoop?.sequenceId ?? `legacy-${raw.id}`,
        sourceLoop,
        displayName: sourceLoop?.word ?? "Imported sticker",
      },
      sourceLoop,          // deprecated annotation retained for audit trail
      variant: raw.variant as StickerUnit["variant"],
      size: raw.size as StickerUnit["size"],
      background: raw.background as StickerUnit["background"],
      copies: raw.copies,
      presentation: raw.presentation as StickerUnit["presentation"],
    };
  });

  return {
    version: 2,
    sheet: {
      ...payload.sheet,
      sheetSize: payload.sheet.sheetSize as StickerSheet["sheetSize"],
      stickers: migrated,
    },
  };
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

**TDD test spec:**

File: `tests/unit/sticker-lab/LocalStickerSheetRepository.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { LocalStickerSheetRepository } from "$lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository";
import { STORAGE_KEY_ACTIVE_SHEET } from "$lib/features/sticker-lab/domain/sticker-constants";

// Minimal in-memory Storage mock.
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

describe("LocalStickerSheetRepository", () => {
  let storage: Storage;
  let repo: LocalStickerSheetRepository;

  beforeEach(() => {
    storage = makeStorage();
    repo = new LocalStickerSheetRepository(storage);
  });

  it("returns null when storage is empty", () => {
    expect(repo.load()).toBeNull();
  });

  it("returns null for a corrupt JSON payload", () => {
    storage.setItem(STORAGE_KEY_ACTIVE_SHEET, "{{{bad json");
    expect(repo.load()).toBeNull();
  });

  it("returns null for an unknown future version (v99)", () => {
    storage.setItem(
      STORAGE_KEY_ACTIVE_SHEET,
      JSON.stringify({ version: 99, sheet: {} })
    );
    expect(repo.load()).toBeNull();
  });

  it("returns a v2 sheet unchanged", () => {
    const sheet = {
      id: "s1",
      name: "Test",
      sheetSize: "8.5x11",
      stickers: [
        {
          id: "st1",
          primitiveRef: { shapeHash: "abc", ultraHash: "abc", displayName: "Alpha" },
          variant: "full",
          size: "3in-round",
          background: "transparent",
          copies: 1,
          presentation: "pure",
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    };
    storage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify({ version: 2, sheet }));
    const loaded = repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.stickers[0]!.primitiveRef.shapeHash).toBe("abc");
  });

  it("migrates a v1 sheet to v2 — sticker gets primitiveRef with sequenceId proxy", () => {
    const v1Sheet = {
      id: "s1",
      name: "Old",
      sheetSize: "8.5x11",
      stickers: [
        {
          id: "st1",
          sourceLoop: { sequenceId: "seq-xyz", word: "ALPHA", loopType: "rotated-loop" },
          variant: "full",
          size: "3in-round",
          background: "transparent",
          copies: 2,
          presentation: "pure",
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    };
    storage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify({ version: 1, sheet: v1Sheet }));

    const loaded = repo.load();
    expect(loaded).not.toBeNull();

    const sticker = loaded!.stickers[0]!;
    expect(sticker.primitiveRef.shapeHash).toBe("seq-xyz");
    expect(sticker.primitiveRef.ultraHash).toBe("seq-xyz");
    expect(sticker.primitiveRef.displayName).toBe("ALPHA");
    expect(sticker.copies).toBe(2);
    // deprecated back-link preserved
    expect(sticker.sourceLoop?.sequenceId).toBe("seq-xyz");
  });

  it("migrates a v1 sticker with null sourceLoop using a legacy- prefix", () => {
    const v1Sheet = {
      id: "s1",
      name: "Old",
      sheetSize: "8.5x11",
      stickers: [
        {
          id: "st42",
          sourceLoop: null,
          variant: "blue",
          size: "3in-round",
          background: "white",
          copies: 1,
          presentation: "pure",
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    };
    storage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify({ version: 1, sheet: v1Sheet }));

    const loaded = repo.load();
    expect(loaded!.stickers[0]!.primitiveRef.shapeHash).toBe("legacy-st42");
  });

  it("saves a v2 sheet and reloads it correctly", () => {
    const sheet = {
      id: "s2",
      name: "My Sheet",
      sheetSize: "13x19",
      stickers: [],
      createdAt: 2000,
      updatedAt: 2000,
    } as any;
    repo.save(sheet);
    const loaded = repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.sheetSize).toBe("13x19");
  });

  it("clear() makes subsequent load() return null", () => {
    repo.save({ id: "s3", name: "X", sheetSize: "8.5x11", stickers: [], createdAt: 0, updatedAt: 0 } as any);
    repo.clear();
    expect(repo.load()).toBeNull();
  });
});
```

**Verification:** `npm test -- LocalStickerSheetRepository` exits 0 with all 7 cases passing.

**Commit:** `feat(sticker-lab): bump schema to v2 and add v1→v2 migration in LocalStickerSheetRepository`

---

### Task 3 — Update `StickerLabState` — replace `addLoop` with `addPrimitive`

**Goal:** State interface reflects v2 types; `addLoop` is gone; `addPrimitive` deduplicates by `shapeHash`.

**Dependencies:** Task 1 complete.

**Files:**
- Modify: `src/lib/features/sticker-lab/state/sticker-lab-state.svelte.ts`

**Implementation:**

```ts
import type {
  MandalaPrimitiveRef,
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
  addPrimitive(ref: MandalaPrimitiveRef): void;
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

    addPrimitive(ref: MandalaPrimitiveRef): void {
      // Deduplicate by shapeHash — one shape tile per sheet entry.
      const existing = sheet.stickers.find(
        (s) => s.primitiveRef.shapeHash === ref.shapeHash
      );
      if (existing) {
        // Increment copies on existing entry rather than adding a duplicate unit.
        const clamped = Math.min(MAX_COPIES_PER_STICKER, existing.copies + 1);
        mutate((s) => ({
          ...s,
          stickers: s.stickers.map((x) =>
            x.id === existing.id ? { ...x, copies: clamped } : x
          ),
        }));
        return;
      }
      const unit = createDefaultStickerUnit({ primitiveRef: ref });
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

**TDD test spec:**

File: `tests/unit/sticker-lab/sticker-lab-state.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { IStickerSheetRepository } from "$lib/features/sticker-lab/services/contracts/IStickerSheetRepository";
import type { StickerSheet } from "$lib/features/sticker-lab/domain/sticker-types";
import { createStickerLabState } from "$lib/features/sticker-lab/state/sticker-lab-state.svelte";

function makeNullRepo(): IStickerSheetRepository {
  let saved: StickerSheet | null = null;
  return {
    load: () => saved,
    save: (s: StickerSheet) => { saved = s; },
    clear: () => { saved = null; },
  };
}

const refA = { shapeHash: "shape-a", ultraHash: "shape-a", displayName: "Shape A" };
const refB = { shapeHash: "shape-b", ultraHash: "shape-b", displayName: "Shape B" };

describe("StickerLabState.addPrimitive", () => {
  it("adds a new sticker for a new shapeHash", () => {
    const state = createStickerLabState(makeNullRepo());
    state.addPrimitive(refA);
    expect(state.sheet.stickers).toHaveLength(1);
    expect(state.sheet.stickers[0]!.primitiveRef.shapeHash).toBe("shape-a");
  });

  it("does not add a duplicate when shapeHash already exists on the sheet", () => {
    const state = createStickerLabState(makeNullRepo());
    state.addPrimitive(refA);
    state.addPrimitive(refA);
    expect(state.sheet.stickers).toHaveLength(1);
  });

  it("increments copies on an existing sticker instead of adding a duplicate", () => {
    const state = createStickerLabState(makeNullRepo());
    state.addPrimitive(refA);
    state.addPrimitive(refA); // second call — should increment copies
    expect(state.sheet.stickers[0]!.copies).toBe(2);
  });

  it("adds a second sticker for a different shapeHash", () => {
    const state = createStickerLabState(makeNullRepo());
    state.addPrimitive(refA);
    state.addPrimitive(refB);
    expect(state.sheet.stickers).toHaveLength(2);
  });
});

describe("StickerLabState.removeSticker", () => {
  it("removes the sticker with the given id", () => {
    const state = createStickerLabState(makeNullRepo());
    state.addPrimitive(refA);
    const id = state.sheet.stickers[0]!.id;
    state.removeSticker(id);
    expect(state.sheet.stickers).toHaveLength(0);
  });
});
```

**Verification:** `npm test -- sticker-lab-state` exits 0.

**Commit:** `feat(sticker-lab): replace addLoop with addPrimitive in StickerLabState`

---

## Phase B: Stage A Catalog — Build Script and Registry Reader

### Task 4 — Define primitive catalog types

**Goal:** A single TypeScript file defines all types used by the catalog JSON format and the catalog reader service.

**Dependencies:** Task 1 complete (uses `MandalaPrimitiveRef` from sticker-types).

**Files:**
- Create: `src/lib/features/sticker-lab/domain/primitive-catalog-types.ts`

**Implementation:**

```ts
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import type { MandalaPrimitiveRef } from "./sticker-types";

/**
 * One entry in the Stage A primitive catalog.
 *
 * Stage A: shapeHash and ultraHash are sequenceId proxies.
 * Stage B: replaced by geometric SHA-256 hashes from MandalaCanonicalizer.
 *
 * `paths` is pre-computed MandalaPaths JSON, eliminating the sequence-fetch
 * round trip at render time. The picker renders directly from this field.
 */
export interface PrimitiveCatalogEntry {
  /** Stage A: sequenceId of the canonical representative. Stage B: geometric SHA-256. */
  shapeHash: string;
  ultraHash: string;
  displayName: string;
  /**
   * Pre-baked MandalaPaths for the canonical representative.
   * Nullable because Stage A may ship entries without baked paths — the
   * `mandala-paths-cache` falls back to resolving via sequence repository.
   */
  paths: MandalaPaths | null;
  /** Source LOOP back-link, for the stage A sequenceId proxy. */
  sourceLoop: {
    sequenceId: string;
    word: string;
    loopType: string;
  };
  /** Symmetry order derived from the geometry (Stage A: always 1 — not yet computed). */
  symmetryOrder: number;
  /** Number of distinct ultra-equivalent variants within this shape class (Stage A: always 1). */
  ultraCount: number;
}

/**
 * Top-level structure of `src/lib/features/sticker-lab/data/primitive-catalog.json`.
 */
export interface PrimitiveCatalog {
  /** Catalog format version. Bump when the entry shape changes incompatibly. */
  version: 1;
  generatedAt: number;
  totalEntries: number;
  entries: PrimitiveCatalogEntry[];
}

/**
 * Runtime in-memory catalog produced by `loadPrimitiveCatalog()`.
 * Provides fast lookups for the picker and the paths cache.
 */
export interface LoadedPrimitiveCatalog {
  entries: PrimitiveCatalogEntry[];
  /** Map from shapeHash → entry, for O(1) lookup. */
  byShapeHash: Map<string, PrimitiveCatalogEntry>;
}

/** Extract a MandalaPrimitiveRef from a catalog entry. */
export function entryToRef(entry: PrimitiveCatalogEntry): MandalaPrimitiveRef {
  return {
    shapeHash: entry.shapeHash,
    ultraHash: entry.ultraHash,
    sourceLoop: entry.sourceLoop,
    displayName: entry.displayName,
  };
}
```

**Verification:** `npm run check` passes on the new file.

**Commit:** `feat(sticker-lab): add PrimitiveCatalogEntry and LoadedPrimitiveCatalog types`

---

### Task 5 — Build script: generate `primitive-catalog.json`

**Goal:** A Node.js CJS script at `scripts/build-primitive-catalog.cjs` reads the existing deck enumeration JSONs, calls `MandalaGeometryCalculator` for each LOOP, deduplicates by sequenceId, and writes `src/lib/features/sticker-lab/data/primitive-catalog.json`.

**Dependencies:** Task 4 complete.

**Files:**
- Create: `scripts/build-primitive-catalog.cjs`
- Create (output, committed): `src/lib/features/sticker-lab/data/primitive-catalog.json` (generated by running the script)

**Design decisions:**

*Why CJS, not ESM tsx?*
The existing build scripts (`add-humor-pair.cjs`, `auto-label-loops.cjs`) are all `.cjs`. MandalaGeometryCalculator imports from `$lib/...` aliases which are SvelteKit-specific. To avoid needing tsx + tsconfig-paths at runtime, the script extracts only the computation logic it needs (the Catmull-Rom interpolation math) rather than importing `MandalaGeometryCalculator` directly. Stage B will introduce a proper `tsx`-based enumeration script with full alias support once the three-tier canonicalization requires it.

*Stage A shortcut:* Rather than re-implementing the full `MandalaGeometryCalculator` in the script, Stage A uses the sequence data's pre-computed mandala paths if they exist in the deck enumeration JSON. If paths are not pre-baked, the script calls `MandalaGeometryCalculator` via a dynamically-resolved import through Node's `require` with appropriate path mapping — but the Stage A build needs only the static deck catalog that already exists.

**Revised approach for Stage A:** The script reads the deck enumeration JSON (produced by the deck enumerator project at `static/data/` or local equivalents), selects one canonical representative per unique word (filtering for LOOP type and choosing `rotated-loop` if available), serializes the mandala paths from the existing pre-baked data, and writes the catalog. If pre-baked path data doesn't exist in the deck JSON, the entry is skipped with a warning.

*Why `src/lib/features/sticker-lab/data/` not `static/data/`?*
The catalog is a product-specific runtime asset consumed only by the sticker lab. Placing it in `static/data/` alongside global metadata like `pictographs/` would pollute that directory. The sticker lab imports it as a static JSON import at bundle time, so it doesn't need to be in `static/` (which is for runtime-fetched assets). Decision: use `src/lib/features/sticker-lab/data/primitive-catalog.json` and import it with `import catalog from '../data/primitive-catalog.json'` — Vite handles JSON imports natively.

**Implementation — `scripts/build-primitive-catalog.cjs`:**

```js
// scripts/build-primitive-catalog.cjs
// Stage A primitive catalog builder.
//
// Usage: node scripts/build-primitive-catalog.cjs [--deck-dir <path>]
//   --deck-dir  Directory containing deck JSON files. Default: ./static/data/
//
// Output: src/lib/features/sticker-lab/data/primitive-catalog.json
//
// The script selects one representative LOOP per unique word from the deck data
// and writes a minimal catalog entry for each. Mandala paths are not computed
// here — Stage A uses placeholder path data. The actual MandalaPaths computation
// happens when the picker loads each entry via the mandala-paths cache.
//
// Stage B NOTE: This script will be replaced by scripts/enumerate-mandala-registry.cjs
// which runs the full MandalaCanonicalizer and writes two registry files
// (diamond + box). At that point, primitive-catalog.json becomes a derived
// slice of the registry.

'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.resolve(
  __dirname,
  '../src/lib/features/sticker-lab/data/primitive-catalog.json'
);

// Ensure output directory exists.
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Hard-coded seed entries for Stage A.
// Each entry is a manually curated LOOP word + sequenceId that represents
// a visually distinct mandala shape. The primitive picker uses the sequenceId
// to load MandalaPaths from the existing sequence repository at runtime.
//
// To expand Stage A catalog: run the full deck enumeration, select diverse shapes
// by visual inspection, add their sequenceIds here.
//
// Minimum viable catalog: 20+ entries covering a range of beat counts, loop types,
// and visual complexity (sparse ↔ dense, symmetric ↔ asymmetric).
//
// NOTE: `paths` is null here. The picker loads paths at runtime via
// loadPrimitivePaths(shapeHash) which falls back to the sequence repository
// for Stage A entries. Stage B will pre-bake paths into the catalog.

const SEED_ENTRIES = [
  // Format: { word, loopType, sequenceId }
  // These must be populated from the actual enumerated deck data.
  // The plan executor runs the deck enumeration query, picks 20+ diverse
  // representatives, and fills this array before running the script.
  //
  // Example (replace with real sequenceIds from deck enumeration):
  // { word: "ALPHA", loopType: "rotated-loop",   sequenceId: "abc123" },
  // { word: "BETA",  loopType: "rotated-loop",   sequenceId: "def456" },
];

if (SEED_ENTRIES.length < 20) {
  console.warn(
    `[build-primitive-catalog] WARNING: Only ${SEED_ENTRIES.length} seed entries. ` +
    `Stage A requires at least 20 distinct shape-tier entries. ` +
    `Populate SEED_ENTRIES from the deck enumeration before deploying.`
  );
}

const entries = SEED_ENTRIES.map((seed, i) => ({
  shapeHash: seed.sequenceId,
  ultraHash: seed.sequenceId,
  displayName: seed.word,
  paths: null,   // loaded at runtime via sequence repository
  sourceLoop: {
    sequenceId: seed.sequenceId,
    word: seed.word,
    loopType: seed.loopType,
  },
  symmetryOrder: 1,  // Stage A: not computed
  ultraCount: 1,     // Stage A: not computed
}));

const catalog = {
  version: 1,
  generatedAt: Date.now(),
  totalEntries: entries.length,
  entries,
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2));
console.log(`[build-primitive-catalog] Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
```

**Add npm script to `package.json`:**

In the `"scripts"` section, add:

```json
"build:primitive-catalog": "node scripts/build-primitive-catalog.cjs"
```

**Verification:**
1. `node scripts/build-primitive-catalog.cjs` runs without error (it will warn about < 20 entries — that's expected until the executor populates seed data).
2. `src/lib/features/sticker-lab/data/primitive-catalog.json` is written.
3. `npm run check` passes (no TypeScript breakage from adding the data directory).

**Stage A seeding workflow (for the executor):**

Before deploying Stage A, populate `SEED_ENTRIES` in the script:

1. Query the deck enumeration Firestore collection for LOOPs (filter `loopType: "rotated-loop"`, distinct `word`, first 50 results).
2. For each, record `{ word, loopType, sequenceId }`.
3. Run `npm run build:primitive-catalog` — writes the catalog JSON.
4. Commit the generated JSON: `chore(sticker-lab): generate Stage A primitive catalog (N entries)`.

**Commit:** `feat(sticker-lab): add build-primitive-catalog.cjs script and npm script`

---

### Task 6 — Primitive catalog reader service

**Goal:** A runtime service loads `primitive-catalog.json` once, builds the `byShapeHash` Map, and provides typed access. The sticker-lab components use this instead of querying the sequence repository.

**Dependencies:** Task 4 complete.

**Files:**
- Create: `src/lib/features/sticker-lab/services/implementations/PrimitiveCatalogReader.ts`

**Implementation:**

```ts
import type {
  PrimitiveCatalog,
  PrimitiveCatalogEntry,
  LoadedPrimitiveCatalog,
} from "../../domain/primitive-catalog-types";

let _loaded: LoadedPrimitiveCatalog | null = null;
let _loading: Promise<LoadedPrimitiveCatalog> | null = null;

/**
 * Load and cache the Stage A primitive catalog.
 *
 * Safe to call concurrently — concurrent calls share a single in-flight promise.
 * The loaded catalog is module-scoped (singleton for the session lifetime).
 *
 * Stage B: Replace this function body to load from MandalaPrimitiveRegistry
 * instead of the static JSON. The return type stays the same.
 */
export async function loadPrimitiveCatalog(): Promise<LoadedPrimitiveCatalog> {
  if (_loaded) return _loaded;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      // Vite handles JSON imports. Dynamic import avoids requiring the file at
      // bundle time when the sticker lab hasn't been opened yet.
      // NOTE (audit RED-3): the `import ... assert { type: "json" }` syntax is
      // deprecated TC39 and breaks in modern Vite; use plain default import.
      // This matches HannonsCampDestination.svelte:15 and other JSON imports
      // in this codebase.
      const { default: catalog } = (await import(
        "../data/primitive-catalog.json"
      )) as { default: PrimitiveCatalog };
      const byShapeHash = new Map<string, PrimitiveCatalogEntry>(
        catalog.entries.map((e) => [e.shapeHash, e])
      );
      _loaded = { entries: catalog.entries, byShapeHash };
      return _loaded;
    } catch (err) {
      console.error("[PrimitiveCatalogReader] Failed to load catalog:", err);
      // Return empty catalog so the picker shows an empty state rather than crashing.
      _loaded = { entries: [], byShapeHash: new Map() };
      return _loaded;
    } finally {
      _loading = null;
    }
  })();

  return _loading;
}

/** Synchronous peek — returns a cached entry or null. Call loadPrimitiveCatalog() first. */
export function getCatalogEntry(shapeHash: string): PrimitiveCatalogEntry | null {
  return _loaded?.byShapeHash.get(shapeHash) ?? null;
}

/** Reset the module-level cache. For testing only. */
export function _resetCatalogForTesting(): void {
  _loaded = null;
  _loading = null;
}
```

**TDD test spec:**

File: `tests/unit/sticker-lab/PrimitiveCatalogReader.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadPrimitiveCatalog,
  getCatalogEntry,
  _resetCatalogForTesting,
} from "$lib/features/sticker-lab/services/implementations/PrimitiveCatalogReader";

// Mock the JSON import.
vi.mock("../data/primitive-catalog.json", () => ({
  default: {
    version: 1,
    generatedAt: 0,
    totalEntries: 2,
    entries: [
      { shapeHash: "h1", ultraHash: "h1", displayName: "Shape 1", paths: null, sourceLoop: { sequenceId: "h1", word: "A", loopType: "rotated-loop" }, symmetryOrder: 1, ultraCount: 1 },
      { shapeHash: "h2", ultraHash: "h2", displayName: "Shape 2", paths: null, sourceLoop: { sequenceId: "h2", word: "B", loopType: "rotated-loop" }, symmetryOrder: 1, ultraCount: 1 },
    ],
  },
}));

describe("PrimitiveCatalogReader", () => {
  beforeEach(() => _resetCatalogForTesting());

  it("loads catalog and returns entries", async () => {
    const catalog = await loadPrimitiveCatalog();
    expect(catalog.entries).toHaveLength(2);
  });

  it("getCatalogEntry returns null before load", () => {
    expect(getCatalogEntry("h1")).toBeNull();
  });

  it("getCatalogEntry returns entry after load", async () => {
    await loadPrimitiveCatalog();
    expect(getCatalogEntry("h1")!.displayName).toBe("Shape 1");
  });

  it("concurrent calls share one in-flight promise", async () => {
    const [a, b] = await Promise.all([loadPrimitiveCatalog(), loadPrimitiveCatalog()]);
    expect(a).toBe(b); // same object reference
  });
});
```

**Verification:** `npm test -- PrimitiveCatalogReader` exits 0.

**Commit:** `feat(sticker-lab): add PrimitiveCatalogReader service with lazy JSON load`

---

## Phase C: Primitive Picker UI

### Task 7 — Rewrite `mandala-paths-cache.svelte.ts` to key on `shapeHash`

**Goal:** The cache is keyed by `shapeHash` and loads paths from the primitive catalog (falling back to the sequence repository for Stage A sequenceId-proxy hashes). Export names change to `getPrimitivePaths` / `loadPrimitivePaths`. Old exports are removed.

**Dependencies:** Task 6 complete.

**Files:**
- Rewrite: `src/lib/features/sticker-lab/state/mandala-paths-cache.svelte.ts`

**Implementation:**

```ts
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { MandalaGeometryCalculator } from "$lib/shared/mandala/services/implementations/MandalaGeometryCalculator";
import { getCatalogEntry, loadPrimitiveCatalog } from "../services/implementations/PrimitiveCatalogReader";
import { container } from "$lib/shared/di";

/**
 * Mandala paths cache keyed by shapeHash.
 *
 * Stage A loading strategy:
 * 1. If the catalog entry has pre-baked paths (Stage B), return them immediately.
 * 2. Otherwise, treat the shapeHash as a sequenceId proxy and fetch via the
 *    sequence repository + MandalaGeometryCalculator (Stage A fallback).
 *
 * Stage B: step 2 is replaced by fetching from MandalaPrimitiveRegistry.getPaths().
 */
const cache = $state<Record<string, MandalaPaths>>({});
const inFlight = new Map<string, Promise<MandalaPaths | null>>();
const calculator = new MandalaGeometryCalculator();

/** Synchronous peek — returns cached paths or null. */
export function getPrimitivePaths(shapeHash: string): MandalaPaths | null {
  return cache[shapeHash] ?? null;
}

/**
 * Async load — populates cache for the given shapeHash.
 * Safe to call repeatedly; concurrent calls for the same hash share a promise.
 */
export async function loadPrimitivePaths(shapeHash: string): Promise<MandalaPaths | null> {
  if (cache[shapeHash]) return cache[shapeHash]!;
  const existing = inFlight.get(shapeHash);
  if (existing) return existing;

  const promise = (async () => {
    try {
      // Ensure catalog is loaded so getCatalogEntry() can work.
      await loadPrimitiveCatalog();
      const entry = getCatalogEntry(shapeHash);

      // Stage B shortcut: if pre-baked paths exist, use them.
      if (entry?.paths) {
        cache[shapeHash] = entry.paths;
        return entry.paths;
      }

      // Stage A fallback: treat shapeHash as sequenceId.
      const sequenceId = entry?.sourceLoop?.sequenceId ?? shapeHash;
      const seq = await container.items.sequenceRepository.getSequence(sequenceId);
      if (!seq?.steps) return null;
      const paths = calculator.calculate(seq.steps);
      cache[shapeHash] = paths;
      return paths;
    } catch (err) {
      console.error(`[mandala-paths-cache] load failed for ${shapeHash}:`, err);
      return null;
    } finally {
      inFlight.delete(shapeHash);
    }
  })();

  inFlight.set(shapeHash, promise);
  return promise;
}

export function clearMandalaPathsCache(): void {
  for (const k of Object.keys(cache)) delete cache[k];
  inFlight.clear();
}
```

**Verification:** `npm run check` exits 0 (TypeScript sees new export names).

**Commit:** `feat(sticker-lab): rewrite mandala-paths-cache to key on shapeHash with Stage A fallback`

---

### Task 8 — Update components to use `primitiveRef` and new cache exports

**Goal:** `StickerSheetPreview.svelte` and `StickerExportPanel.svelte` use `getPrimitivePaths` / `loadPrimitivePaths`; `StickerListItem.svelte` uses `primitiveRef.displayName`; `IStickerSheetPdfExporter.ts` renames the lookup parameter; `StickerSheetPdfExporter.ts` uses `primitiveRef.shapeHash`.

**Dependencies:** Task 7 complete.

**Files:**
- Modify: `src/lib/features/sticker-lab/components/StickerSheetPreview.svelte`
- Modify: `src/lib/features/sticker-lab/components/StickerExportPanel.svelte`
- Modify: `src/lib/features/sticker-lab/components/StickerListItem.svelte`
- Modify: `src/lib/features/sticker-lab/services/contracts/IStickerSheetPdfExporter.ts`
- Modify: `src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts`

**Implementation — `IStickerSheetPdfExporter.ts`:**

```ts
import type { StickerSheet } from "../../domain/sticker-types";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";

export interface StickerMandalaLookup {
  /** Return pre-computed MandalaPaths for a given primitive key (shapeHash in v2, sequenceId in v1 compat). */
  getPaths(primitiveKey: string): MandalaPaths | null;
}

export interface IStickerSheetPdfExporter {
  export(sheet: StickerSheet, lookup: StickerMandalaLookup): Promise<Uint8Array>;
}
```

**Implementation — `StickerSheetPdfExporter.ts` change (line 44):**

```ts
// Before
const paths = placement.unit.sourceLoop
  ? lookup.getPaths(placement.unit.sourceLoop.sequenceId)
  : null;

// After
const paths = lookup.getPaths(placement.unit.primitiveRef.shapeHash);
```

**Implementation — `StickerSheetPreview.svelte` changes:**

Change import line:
```ts
// Before
import { getMandalaPaths, loadMandalaPaths } from "../state/mandala-paths-cache.svelte";
// After
import { getPrimitivePaths, loadPrimitivePaths } from "../state/mandala-paths-cache.svelte";
```

In the `$effect` block (line 44–50):
```ts
// Before
for (const sticker of stickerState.sheet.stickers) {
  if (sticker.sourceLoop) {
    void loadMandalaPaths(sticker.sourceLoop.sequenceId);
  }
}
// After
for (const sticker of stickerState.sheet.stickers) {
  void loadPrimitivePaths(sticker.primitiveRef.shapeHash);
}
```

In the `{#each pageStickers}` block (line 82):
```svelte
<!-- Before -->
{@const paths = sticker.sourceLoop ? getMandalaPaths(sticker.sourceLoop.sequenceId) : null}
<!-- After -->
{@const paths = getPrimitivePaths(sticker.primitiveRef.shapeHash)}
```

In the `.missing` div (line 88):
```svelte
<!-- Before -->
<div class="missing">No paths for {sticker.sourceLoop?.word}</div>
<!-- After -->
<div class="missing">No paths for {sticker.primitiveRef.displayName ?? sticker.primitiveRef.shapeHash}</div>
```

**Implementation — `StickerExportPanel.svelte` changes:**

Change import line:
```ts
// Before
import { getMandalaPaths, loadMandalaPaths } from "../state/mandala-paths-cache.svelte";
// After
import { getPrimitivePaths, loadPrimitivePaths } from "../state/mandala-paths-cache.svelte";
```

In `downloadPdf()` preload block (lines 28–34):
```ts
// Before
await Promise.all(
  stickerState.sheet.stickers.map((s) =>
    s.sourceLoop ? loadMandalaPaths(s.sourceLoop.sequenceId) : Promise.resolve(null)
  )
);
// After
await Promise.all(
  stickerState.sheet.stickers.map((s) =>
    loadPrimitivePaths(s.primitiveRef.shapeHash)
  )
);
```

In the `exporter.export(...)` call (line 43):
```ts
// Before
const bytes = await exporter.export(stickerState.sheet, { getPaths: getMandalaPaths });
// After
const bytes = await exporter.export(stickerState.sheet, { getPaths: getPrimitivePaths });
```

**Implementation — `StickerListItem.svelte` changes:**

In the `row-primary` div:
```svelte
<!-- Before -->
<span class="word">{sticker.sourceLoop?.word ?? "Custom"}</span>
<span class="loop-type">{sticker.sourceLoop?.loopType ?? ""}</span>
<!-- After -->
<span class="word">{sticker.primitiveRef.displayName ?? sticker.primitiveRef.shapeHash.slice(0, 8)}</span>
```

Remove the `<span class="loop-type">` line entirely.

In the style block, remove the `.loop-type` rule (it is no longer rendered):
```css
/* Remove this rule: */
.loop-type { opacity: 0.6; flex: 1; }
```

**Verification:** `npm run check` exits 0. No TypeScript errors.

**Commit:** `feat(sticker-lab): rewire components from sequenceId to shapeHash — StickerSheetPreview, StickerExportPanel, StickerListItem, StickerSheetPdfExporter`

---

### Task 9 — Build `PrimitivePicker.svelte`

**Goal:** An overlay panel component that loads the primitive catalog, displays shape tiles rendered via `MandalaRenderer`, and calls `state.addPrimitive(ref)` on selection.

**Dependencies:** Tasks 3, 6, 7 complete.

**Files:**
- Create: `src/lib/features/sticker-lab/components/PrimitivePicker.svelte`

**Design decisions:**

- **Overlay not full-modal:** Rendered as a fixed overlay above the left column so the sheet preview stays visible. The picker is opened/closed via a boolean prop `open` bound in the parent.
- **Filter facets (minimum viable set):** Symmetry (All / high / low — derived from `symmetryOrder`) and Coloration (All / Monochrome / Two-color) derived from catalog metadata. Filters are applied in-memory. At Stage A with `symmetryOrder: 1` for all entries, the Symmetry filter shows all results until Stage B populates real values — it degrades gracefully.
- **Tile rendering:** Each tile renders the canonical representative's paths via `MandalaRenderer.renderSVG()` at size 120. Paths are loaded via `loadPrimitivePaths()` (async). Tiles show a spinner until paths resolve.
- **Selection flow:** Single-tap tile → `state.addPrimitive(entryToRef(entry))` → picker stays open; a small badge on the tile shows how many copies of that shape are already on the sheet. The "Browse primitives" button label becomes "+ Add another" when the shape is already present.

**Implementation:**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { loadPrimitiveCatalog } from "../services/implementations/PrimitiveCatalogReader";
  import { loadPrimitivePaths, getPrimitivePaths } from "../state/mandala-paths-cache.svelte";
  import { MandalaRenderer } from "$lib/shared/mandala/services/implementations/MandalaRenderer";
  import { entryToRef } from "../domain/primitive-catalog-types";
  import type { PrimitiveCatalogEntry } from "../domain/primitive-catalog-types";
  import type { MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";

  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open, onclose }: Props = $props();

  const state = getStickerLabContext();
  const renderer = new MandalaRenderer();

  // Light-mode palette — same as StickerUnitRenderer so tiles match sticker output.
  const PICKER_PALETTE: MandalaPalette = {
    blueStroke: "#1e40af",
    blueFill: "rgba(37, 99, 235, 0.65)",
    redStroke: "#991b1b",
    redFill: "rgba(220, 38, 38, 0.65)",
    purpleStroke: "#6b21a8",
    purpleFill: "rgba(126, 34, 206, 0.75)",
  };

  let entries = $state<PrimitiveCatalogEntry[]>([]);
  let isLoading = $state(true);
  let filterSymmetry = $state<"all" | "high" | "low">("all");
  let filterColoration = $state<"all" | "monochrome" | "two-color">("all");

  onMount(async () => {
    const catalog = await loadPrimitiveCatalog();
    entries = catalog.entries;
    isLoading = false;
    // Fire-and-forget: pre-load paths for all entries so tiles render without delay.
    for (const entry of entries) {
      void loadPrimitivePaths(entry.shapeHash);
    }
  });

  const filteredEntries = $derived.by(() => {
    return entries.filter((e) => {
      if (filterSymmetry === "high" && e.symmetryOrder < 4) return false;
      if (filterSymmetry === "low" && e.symmetryOrder >= 4) return false;
      if (filterColoration === "monochrome" && e.ultraCount > 1) return false;
      if (filterColoration === "two-color" && e.ultraCount <= 1) return false;
      return true;
    });
  });

  function copiesOnSheet(shapeHash: string): number {
    const sticker = state.sheet.stickers.find(
      (s) => s.primitiveRef.shapeHash === shapeHash
    );
    return sticker ? sticker.copies : 0;
  }

  function handleAdd(entry: PrimitiveCatalogEntry) {
    state.addPrimitive(entryToRef(entry));
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay-backdrop" onclick={onclose}></div>
  <div class="picker" role="dialog" aria-label="Choose a mandala primitive" aria-modal="true">
    <header>
      <h3>Choose a mandala primitive</h3>
      <button class="close-btn" aria-label="Close picker" onclick={onclose}>×</button>
    </header>

    <div class="filters">
      <label>
        Symmetry:
        <select bind:value={filterSymmetry}>
          <option value="all">All</option>
          <option value="high">High symmetry</option>
          <option value="low">Low symmetry</option>
        </select>
      </label>
      <label>
        Coloration:
        <select bind:value={filterColoration}>
          <option value="all">All</option>
          <option value="monochrome">Monochrome</option>
          <option value="two-color">Two-color</option>
        </select>
      </label>
      <button
        class="clear-btn"
        onclick={() => { filterSymmetry = "all"; filterColoration = "all"; }}
        disabled={filterSymmetry === "all" && filterColoration === "all"}
      >
        Clear
      </button>
    </div>

    {#if isLoading}
      <div class="loading">Loading primitives…</div>
    {:else if filteredEntries.length === 0}
      <div class="empty">No primitives match these filters.</div>
    {:else}
      <div class="grid">
        {#each filteredEntries as entry (entry.shapeHash)}
          {@const paths = getPrimitivePaths(entry.shapeHash)}
          {@const copies = copiesOnSheet(entry.shapeHash)}
          <button
            class="tile"
            class:on-sheet={copies > 0}
            onclick={() => handleAdd(entry)}
            aria-label="{entry.displayName} — {copies > 0 ? `${copies} on sheet` : 'Add to sheet'}"
          >
            {#if paths}
              <!-- Render the mandala at 120px. -->
              {@html renderer.renderSVG(paths, {
                size: 120,
                style: "filled",
                showGridDots: false,
                show: "both",
                strokeWidth: 2,
                transparentBackground: true,
                palette: PICKER_PALETTE,
              })}
            {:else}
              <div class="tile-loading">…</div>
            {/if}
            <span class="tile-label">{entry.displayName}</span>
            {#if copies > 0}
              <span class="badge">{copies}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
  }

  .picker {
    position: fixed;
    left: 320px; /* aligns to the right edge of the sticker list column */
    top: 60px;
    width: 480px;
    max-height: calc(100vh - 80px);
    background: var(--theme-surface-elevated, #1e1e2e);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    z-index: 101;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  header h3 {
    margin: 0;
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, white);
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 0 4px;
  }
  .close-btn:hover { color: white; }

  .filters {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    flex-wrap: wrap;
  }
  .filters label { display: flex; align-items: center; gap: 6px; }
  .filters select {
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text, white);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 11px;
  }
  .clear-btn {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
    font-size: 11px;
  }
  .clear-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .loading, .empty {
    padding: 32px;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: 13px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 12px;
    overflow-y: auto;
    flex: 1;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .tile:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }
  .tile.on-sheet {
    border-color: var(--theme-accent, #8b5cf6);
    background: rgba(139, 92, 246, 0.08);
  }

  .tile :global(svg) {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: #f9f6ef;
  }

  .tile-label {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-loading {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.2);
    font-size: 18px;
  }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }
</style>
```

**Verification:** `npm run check` exits 0.

**Commit:** `feat(sticker-lab): add PrimitivePicker overlay component with filter facets`

---

## Phase D: Rewire `StickerList.svelte`

### Task 10 — Update `StickerList.svelte` to open the picker

**Goal:** Remove `openDeckBrowser` and the `navigationState` import; replace empty-state copy; add a `[+]` button in the column header that opens `PrimitivePicker`.

**Dependencies:** Task 9 complete.

**Files:**
- Modify: `src/lib/features/sticker-lab/components/StickerList.svelte`

**Implementation:**

```svelte
<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import StickerListItem from "./StickerListItem.svelte";
  import PrimitivePicker from "./PrimitivePicker.svelte";

  const state = getStickerLabContext();

  let pickerOpen = $state(false);
</script>

<PrimitivePicker open={pickerOpen} onclose={() => (pickerOpen = false)} />

<div class="list-header">
  <span class="count">
    {state.sheet.stickers.length} {state.sheet.stickers.length === 1 ? "sticker" : "stickers"}
  </span>
  <button class="add-btn" onclick={() => (pickerOpen = true)} aria-label="Browse primitives">
    + Add
  </button>
</div>

<div class="list">
  {#if state.sheet.stickers.length === 0}
    <div class="empty">
      <p>Add a primitive to start your sheet.</p>
      <button onclick={() => (pickerOpen = true)}>Browse primitives</button>
    </div>
  {:else}
    {#each state.sheet.stickers as sticker (sticker.id)}
      <StickerListItem {sticker} />
    {/each}
  {/if}
</div>

<style>
  .list-header {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
  }
  .count {
    flex: 1;
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
  .add-btn {
    padding: 4px 10px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
  }

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

**Verification:** `npm run check` exits 0. The `navigationState` import from `StickerList.svelte` is gone; grepping for `choreo_card` in sticker-lab files returns zero matches.

```bash
grep -r "choreo_card" src/lib/features/sticker-lab/
# expected: no output
```

**Commit:** `feat(sticker-lab): update StickerList — remove deck browser nav, add primitive picker trigger`

---

## Phase E: QA and Polish

### Task 11 — Update `index.ts` to export new types

**Goal:** The sticker-lab barrel export includes `MandalaPrimitiveRef` and catalog types so consumers don't need deep imports.

**Dependencies:** Tasks 1 and 4 complete.

**Files:**
- Modify: `src/lib/features/sticker-lab/index.ts`

**Implementation:**

```ts
export * from "./domain/sticker-types";
export * from "./domain/sticker-constants";
export * from "./domain/primitive-catalog-types";
```

**Verification:** `npm run check` exits 0.

**Commit:** `feat(sticker-lab): export MandalaPrimitiveRef and catalog types from index.ts`

---

### Task 12 — Full end-to-end flow test and final check

**Goal:** All tests pass, build is clean, and the complete flow (open lab → click Browse primitives → add a primitive → preview updates → download PDF) works.

**Dependencies:** Tasks 1–11 complete. Primitive catalog JSON must be seeded (Task 5 Stage A seeding workflow).

**Steps:**

- [ ] **Step 1:** Run `npm run check`. Fix any type errors introduced by the migration.

  Expected: 0 errors.

- [ ] **Step 2:** Run `npm run build`. Confirm the sticker-lab module is included in the bundle.

  ```bash
  npm run build 2>&1 | grep -i "sticker"
  # Expected: one or more lines mentioning sticker-lab files
  ```

- [ ] **Step 3:** Run `npm test -- --reporter=verbose 2>&1`. Confirm all sticker-lab tests pass.

  Expected test count: 7 (sticker-types) + 7 (LocalStickerSheetRepository) + 4 (sticker-lab-state) + 4 (PrimitiveCatalogReader) = at minimum 22 passing tests with no failures.

- [ ] **Step 4:** Confirm no file in sticker-lab references `addLoop`, `openDeckBrowser`, `sourceLoop.sequenceId` (outside the migration code), or `getMandalaPaths` / `loadMandalaPaths`.

  ```bash
  grep -rn "addLoop\|openDeckBrowser\|getMandalaPaths\|loadMandalaPaths" src/lib/features/sticker-lab/
  # Expected: 0 matches
  ```

  ```bash
  grep -rn "sourceLoop\.sequenceId" src/lib/features/sticker-lab/
  # Expected: 0 matches (only appears in migration code via `sourceLoop?.sequenceId ?? ...`)
  grep -rn "sourceLoop?\.sequenceId\|sourceLoop\.sequenceId" src/lib/features/sticker-lab/
  ```

- [ ] **Step 5:** Confirm `StickerSheetPdfExporter.ts` references `primitiveRef.shapeHash` not `sourceLoop.sequenceId`.

  ```bash
  grep "primitiveRef" src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts
  # Expected: one match on the lookup line
  ```

- [ ] **Step 6:** Seed the primitive catalog (see Task 5 seeding workflow) and verify the picker renders at least 20 tiles.

  Manual verification: Open `localhost:5174` → Lab → Stickers → "+ Add" button → picker opens → at least 20 shape tiles visible.

  > **AUDIT-FLAGGED PRE-CHECK (RED-4):** Before populating `SEED_ENTRIES`, verify that candidate sequenceIds actually resolve via the sequence repository. In the browser console on localhost:
  >
  > ```js
  > const cache = await import('/src/lib/features/sticker-lab/state/mandala-paths-cache.svelte.js');
  > const paths = await cache.loadPrimitivePaths('<candidate-sequenceId>');
  > console.log(paths); // must be non-null MandalaPaths
  > ```
  >
  > Any sequenceId that doesn't resolve will render a blank tile in the picker with no error. Run this for at least 5 sample IDs before seeding the full 20.

- [ ] **Step 6b (audit YELLOW-4 note):** v1 localStorage data is NOT overwritten by `load()` — it persists until the next `save()` (i.e. the first sheet mutation after load). This is correct behavior but worth knowing when debugging migration issues. Do not add a `save()` call inside `load()` to "fix" this; it's intentional.

- [ ] **Step 7:** Verify end-to-end PDF export.

  Manual verification: Add 2 primitives → Sheet preview shows stickers → click "Download PDF" → PDF downloads and contains sticker art.

  If PDF is blank (paths not loading), check the console for `[mandala-paths-cache] load failed` errors.

- [ ] **Step 8:** Verify v1 migration.

  In DevTools console, set a v1 payload and reload:

  ```js
  localStorage.setItem(
    "tka:sticker-lab:active-sheet",
    JSON.stringify({
      version: 1,
      sheet: {
        id: "s1", name: "Old", sheetSize: "8.5x11",
        stickers: [{
          id: "st1",
          sourceLoop: { sequenceId: "seq-test", word: "ALPHA", loopType: "rotated-loop" },
          variant: "full", size: "3in-round", background: "transparent",
          copies: 1, presentation: "pure"
        }],
        createdAt: 0, updatedAt: 0
      }
    })
  );
  location.reload();
  ```

  Expected: the Stickers tab opens and shows one list item labeled "ALPHA". No errors in console.

**Commit:** `test(sticker-lab): verify v2 migration, picker, preview, and PDF export end-to-end`

---

## Final Verification Checklist

| Check | Command | Expected |
|---|---|---|
| TypeScript | `npm run check` | 0 errors |
| Build | `npm run build` | exits 0 |
| Unit tests | `npm test -- --reporter=verbose` | All sticker-lab suites pass |
| No `addLoop` references | `grep -r "addLoop" src/lib/features/sticker-lab/` | 0 matches |
| No `openDeckBrowser` | `grep -r "openDeckBrowser" src/lib/features/sticker-lab/` | 0 matches |
| No old cache exports | `grep -r "getMandalaPaths\|loadMandalaPaths" src/lib/features/sticker-lab/` | 0 matches |
| No cross-tab nav | `grep -r "choreo_card" src/lib/features/sticker-lab/` | 0 matches |
| Schema version | `grep "STORAGE_SCHEMA_VERSION" src/lib/features/sticker-lab/domain/sticker-constants.ts` | `= 2` |
| Catalog JSON exists | `ls src/lib/features/sticker-lab/data/primitive-catalog.json` | file present |
| PDF exporter uses primitiveRef | `grep "primitiveRef" src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts` | 1 match |

---

## Rollback Plan

If the Stage A catalog build script fails or produces an empty catalog at deploy time:

1. **Feature flag:** Add `const PRIMITIVE_PICKER_ENABLED = import.meta.env.VITE_PRIMITIVE_PICKER === "true"` in `StickerList.svelte`. Gate the `PrimitivePicker` import and the `[+ Add]` button behind this flag. Default to `false` in `.env.production`. Set to `true` in `.env.development` for testing.

2. **Empty catalog fallback:** `PrimitiveCatalogReader.ts` already handles a failed import by returning `{ entries: [], byShapeHash: new Map() }`. The picker will show "No primitives match these filters." — not a crash.

3. **Preserving existing sticker data:** The v1→v2 migration runs on `load()`, not on `save()`. If the migration needs to be reverted, the v1 payload is gone from localStorage after the first load. Rollback requires re-deploying with `STORAGE_SCHEMA_VERSION = 1` and adding a v2→v1 downgrade path. Given the sticker lab is a lab experiment (not production data), discarding sticker sheets on rollback is acceptable. Document this decision in an in-code comment on `LocalStickerSheetRepository.load()`.

---

## Open Questions — Resolution Log

**Q1: Should the catalog live in `static/data/` or `src/lib/features/sticker-lab/data/`?**

Resolved: `src/lib/features/sticker-lab/data/`. The catalog is imported as a Vite static JSON import at bundle time, not fetched at runtime, so it does not need to be in `static/`. Placing it in `static/data/` would expose it as a public URL and require a `fetch()` call with its own caching strategy. The bundle-time import is simpler. Downside: the catalog is bundled into the app chunk rather than lazy-loaded. Mitigation: the picker panel is lazy-loaded by `LabModule.svelte`'s dynamic import map, so the catalog only enters the bundle when the sticker lab is first opened.

**Q2: Does `MandalaGeometryCalculator` import from `$lib/` aliases, making it unavailable in a plain Node.js build script?**

Resolved: Yes — it imports `AngleCalculator`, `LOCATION_ANGLES`, `Orientation`, `GridLocation`, `getTipPoints`, and `isBilateralProp` all via `$lib/...` aliases. Running `MandalaGeometryCalculator` directly in a `.cjs` script would require tsconfig-paths and a ts-node / tsx setup with alias resolution. The Stage A catalog script avoids this by using sequenceId proxies (no geometric computation required). Stage B's `enumerate-mandala-registry.cjs` script will need tsx with path aliases — modeled after the existing `scripts/backfill-daily-scans.ts` which uses tsx.

**Q3: Should `addPrimitive` increment copies or silently no-op when the shapeHash is already on the sheet?**

Resolved: Increment copies. The spec (primitive-first pivot §3, selection flow bullet 4) states "the badge updates and the '+ Add' becomes '+ Add another copy' (calls `setCopies` on existing sticker rather than appending a duplicate unit)." The state method encapsulates this behavior so the picker doesn't need to query existing stickers before calling `addPrimitive`. Simpler call site, correct behavior at the state layer.

**Q4: The `PrimitiveCatalogEntry.paths` field is typed as `MandalaPaths` in the TypeScript interface but is `null` in the Stage A JSON. TypeScript will fail on `entry.paths` being nullable.**

Resolved: Type `paths` as `MandalaPaths | null` in `PrimitiveCatalogEntry`. The `mandala-paths-cache` already handles the null case with a Stage A fallback to the sequence repository. The non-null assertion in the spec pseudocode (`if (entry?.paths)`) is the correct runtime guard. No TypeScript error.

**Q5: The `PrimitivePicker` uses `import { assert: { type: 'json' } }` syntax for the catalog import. Is this supported in the current Vite config?**

Resolved: Vite 4+ supports `import '...json'` natively without the `assert` clause via the `json()` plugin (included by default). The `assert` syntax is for TypeScript type narrowing, not a Vite requirement. Use `import catalog from '../data/primitive-catalog.json'` in the picker and `PrimitiveCatalogReader` — Vite resolves it correctly. The dynamic import with `assert` in `PrimitiveCatalogReader` is replaced with a regular `await import(...)` (Vite handles the JSON import regardless of the `assert` clause). Updated in the implementation above.

**Q6: `StickerLab.svelte` column layout shows `<header><h2>Stickers</h2></header>` for the left column. `StickerList.svelte` now adds its own `.list-header` with a count and "+ Add" button. Does this create a redundant header?**

Resolved: `StickerLab.svelte` keeps its column header (`<h2>Stickers</h2>`) for consistency across all three columns. `StickerList.svelte`'s `.list-header` is a sub-header below the column title showing the count and the "+ Add" button. This is the correct hierarchy — the column label and the list controls are distinct. No duplication.

**Q7: `PrimitivePicker` uses `position: fixed` with `left: 320px`. This hardcodes the left column width. What if the column is resizable in the future?**

Resolved: At Stage A, the column layout is fixed at `grid-template-columns: 320px 1fr 300px` in `StickerLab.svelte`. Hardcoding `left: 320px` is safe for now. When the layout becomes resizable, the picker should be positioned relative to a containing element instead. Leave a `// TODO(Stage B): derive left offset from column width CSS var` comment.

---

## Stage B Seams (Do Not Implement Now)

These are the exact code points where Stage B hooks in. Documented here so the executor of Stage B knows what to change without re-reading the full plan.

| Location | Stage A | Stage B change |
|---|---|---|
| `primitive-catalog-types.ts` `PrimitiveCatalogEntry.paths` | `MandalaPaths \| null` | Always populated from registry; null case removed |
| `PrimitiveCatalogReader.ts` `loadPrimitiveCatalog()` | Imports static JSON | Loads `MandalaPrimitiveRegistry` from `MandalaPrimitiveRegistryLoader` |
| `mandala-paths-cache.svelte.ts` Stage A fallback | `container.items.sequenceRepository.getSequence(sequenceId)` | `MandalaPrimitiveRegistry.getPaths(shapeHash)` |
| `sticker-types.ts` `MandalaPrimitiveRef.shapeHash` JSDoc | "Stage A: sequenceId proxy" | "Stage B: geometric SHA-256 from MandalaCanonicalizer" |
| `sticker-constants.ts` | `STORAGE_SCHEMA_VERSION = 2` | No change needed for Stage B (schema is stable) |
| `scripts/build-primitive-catalog.cjs` | Seed entries manual | Replaced by `scripts/enumerate-mandala-registry.cjs` |
| `PrimitivePicker.svelte` filter facets | `symmetryOrder: 1` for all (no filtering effect) | Real symmetry values from registry enable filter |
