# Sticker Lab — Primitive-First Pivot

**Date:** 2026-04-21
**Status:** Approved, supersedes Phase 1 of `2026-04-20-sticker-lab-mvp-design.md`
**Companion spec:** `2026-04-21-mandala-three-tier-equivalence.md` (MandalaPrimitiveRegistry)
**Predecessor:** `2026-04-20-sticker-lab-mvp-design.md` (read first for context)

---

## What Changed and Why

The original Phase 1 spec assumed a cross-tab entry point: every LOOP card in the deck browser gets a "Send to sticker sheet" button, and that action is the only way to add content to the Sticker Lab. Austen rejected this after reflection:

> "that's just way over engineered when we unify the mandalas and get them down to mandala primitives then you'll see that that will not be a helpful thing in the future"

The root insight is that the unit of interest for sticker production is not a LOOP sequence — it is a **mandala shape**. Many sequences produce the same mandala geometry. Organizing the Sticker Lab around sequences forces the user to think about sequences when they only care about shapes. Reducing mandalas to primitives (via the three-tier equivalence system) makes the collection finite and browseable inside the tab itself.

---

## 1. Delta From the Original Phase 1 Spec

Every decision that changed:

| Decision | Original spec | Primitive-first pivot |
|---|---|---|
| Entry point | "Send to sticker sheet" button on every LOOP deck card | In-tab primitive picker; no cross-tab action |
| Content model | `StickerUnit.sourceLoop: LoopRef` (sequenceId + word + loopType) | `StickerUnit.primitiveRef: MandalaPrimitiveRef` (shapeHash + ultraHash + optional sourceLoop) |
| Data schema version | `STORAGE_SCHEMA_VERSION = 1` | Bump to `2`; migration reads v1 and up-converts |
| Left-column empty state | "Open the deck browser and send LOOPs here" + "Open deck browser" button | "Add a primitive to start your sheet" + "Browse primitives" button that opens the in-tab picker |
| Left-column item label | LOOP word + loopType | Mandala shape label derived from shapeHash (e.g. "Shape 42 — rotated") |
| `addLoop(ref: LoopRef)` on state | Deduplicated by `sequenceId` | Replaced by `addPrimitive(ref: MandalaPrimitiveRef)`; deduplicated by `shapeHash` |
| Deck browser integration | Planned, cross-tab | Removed entirely — the pivot explicitly rejects this |
| Phase 2 "canonical-mandala directory as second source" | Directory is second source, deck browser is first | Primitive picker (backed by registry) is the only source |
| `StickerSheetPdfExporter` path lookup | `lookup.getPaths(unit.sourceLoop.sequenceId)` | `lookup.getPaths(unit.primitiveRef.shapeHash)` — resolved via primitive catalog |

No decisions about sheet sizes, PDF export format, rendering pipeline, or the three-column layout changed. Those are stable and carry forward unchanged.

---

## 2. Primitive-First User Flow

### 2a. Empty state (no stickers on sheet)

```
┌────────────────────────────────────────────────────────────────────┐
│  Stickers                 │  Sheet preview          │  Export      │
│  ─────────────────────    │  ─────────────────────  │  ─────────── │
│                           │                         │  Sheet size  │
│  ┌──────────────────┐     │   ┌───────────────────┐ │  ○ Letter    │
│  │                  │     │   │                   │ │  ○ Tabloid   │
│  │  No stickers yet │     │   │   (blank sheet)   │ │              │
│  │                  │     │   │                   │ │  ─────────── │
│  │  Add a primitive │     │   │                   │ │  0 stickers  │
│  │  to start your   │     │   └───────────────────┘ │              │
│  │  sheet.          │     │                         │  [Download   │
│  │                  │     │   0 stickers             │   PDF]      │
│  │  [Browse         │     │   across 1 sheet         │  (disabled) │
│  │   primitives]    │     │                         │              │
│  └──────────────────┘     │                         │  ▸ How to   │
│                           │                         │    print     │
└────────────────────────────────────────────────────────────────────┘
```

### 2b. Primitive picker modal / panel

Opens when the user clicks "Browse primitives" or the "+" button at the top of the left column. Rendered as an overlay panel (not a full modal) so the sheet preview stays visible.

```
┌─────────────────────────────────────────────────────────┐
│  Choose a mandala primitive             [×] Close        │
│  ─────────────────────────────────────────────────────  │
│  Filters:                                                │
│  Symmetry: [All ▾]   Coloration: [All ▾]   [Clear]      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │          │  │          │  │          │              │
│  │ [shape]  │  │ [shape]  │  │ [shape]  │   ...        │
│  │          │  │          │  │          │              │
│  │ 3 ultra  │  │ 1 ultra  │  │ 7 ultra  │              │
│  │ variants │  │ variant  │  │ variants │              │
│  │ [+ Add]  │  │ [+ Add]  │  │ [+ Add]  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  [Load more]                                             │
└─────────────────────────────────────────────────────────┘
```

Each tile renders the primitive's canonical MandalaPaths via the existing `MandalaRenderer` (confirmed at `src/lib/shared/mandala/services/implementations/MandalaRenderer.ts:55`). Clicking a tile shows a detail row with the three ultra-equivalent variants as smaller previews before adding.

### 2c. Active sheet with primitives added

```
┌────────────────────────────────────────────────────────────────────┐
│  Stickers              [+]│  Sheet preview          │  Export      │
│  ─────────────────────    │  ─────────────────────  │  ─────────── │
│  ┌────────────────────┐   │   ┌───────────────────┐ │  Sheet size  │
│  │ [svg] Shape 42     │   │   │  ●   ●   ●        │ │  ● Letter    │
│  │       rotated      │   │   │  ●   ●   ●        │ │  ○ Tabloid   │
│  │  Blue  Red  Full   │   │   └───────────────────┘ │              │
│  │  Clear White Soft  │   │                         │  6 stickers  │
│  │  [−] 2 [+]    [×]  │   │  ☑ Cut lines  □ Bleed   │  across 1    │
│  └────────────────────┘   │  6 stickers / 1 sheet   │  sheet       │
│  ┌────────────────────┐   │                         │              │
│  │ [svg] Shape 7      │   │                         │  [Download   │
│  │       mirrored     │   │                         │   PDF]       │
│  │  Blue  Red  Full   │   │                         │              │
│  │  ...               │   │                         │  ▸ How to   │
│  └────────────────────┘   │                         │    print     │
└────────────────────────────────────────────────────────────────────┘
```

### 2d. Export / print path flow

1. User clicks "Download PDF" — no change from current implementation.
2. `StickerExportPanel` calls `loadPrimitivePaths()` for each primitive on the sheet (same pattern as existing `loadMandalaPaths`, keyed by `shapeHash` instead of `sequenceId`).
3. `StickerSheetPdfExporter.export()` is called with the hydrated lookup.
4. Browser downloads the PDF.

No server round-trip. The export panel's "How to print" accordion is unchanged.

---

## 3. How the In-Tab Primitive Picker Works

### Hierarchy: shape tier primary, ultra tier secondary

The picker shows **shape-equivalent** primitives as top-level grid tiles. Each tile represents one distinct mandala shape (DISTINCT or SHAPE-EQUIVALENT in the three-tier model). Within a tile, ultra-equivalent variants (color swaps, reflection pairs) are shown as a secondary row of mini-previews.

**Reasoning:** Ultra-equivalent variants (same geometry, different coloration) are the most common substitution and are selected at the `StickerUnit` level via the existing blue/red/full toggle. Surfacing ultra variants in the picker would create redundant decision points — the user would pick a color scheme in the picker, then be offered the same three variants again in the left column. Shape-first, ultra-secondary keeps the picker lean and pushes coloration to the list item, where it already lives.

### Filters / facets

| Filter | Options | Implementation |
|---|---|---|
| Symmetry | All / 2-fold / 3-fold / 4-fold / 5-fold / 6-fold | Derived from `shapeHash` geometric metadata |
| Coloration count | All / Monochrome / Two-color / Three-color (blue+red+purple overlap) | Derived from MandalaPaths presence of purple paths |
| Dominant color | All / Blue-dominant / Red-dominant / Balanced | Computed from relative path counts |

Filters operate on the in-memory primitive catalog — no network request on filter change.

### Preview rendering

Confirmed: `MandalaRenderer` exists at `src/lib/shared/mandala/services/implementations/MandalaRenderer.ts` (line 55, `export class MandalaRenderer implements IMandalaRenderer`). The picker renders each primitive tile using:

```ts
mandalaRenderer.renderSVG(primitive.paths, {
  size: 120,                    // tile preview size
  style: "filled",
  showGridDots: false,
  show: "both",
  strokeWidth: 2,
  transparentBackground: true,
  palette: LIGHT_MODE_PALETTE,  // already defined in StickerUnitRenderer.ts:17
});
```

The light-mode palette is already extracted as a constant in `src/lib/features/sticker-lab/services/implementations/StickerUnitRenderer.ts:17`. The picker imports it directly rather than duplicating it.

### Selection / addition flow

1. User clicks a shape tile → tile expands to show ultra variants (thumbnails, ~60px).
2. User optionally selects a specific ultra variant; defaults to "full" (both hands).
3. User clicks "+ Add" → `state.addPrimitive(ref)` appended to sheet.
4. Picker remains open for more additions. A small badge on the tile shows how many copies are already on the sheet.
5. Deduplication: if `shapeHash` already exists on the sheet, the badge updates and the "+ Add" becomes "+ Add another copy" (calls `setCopies` on existing sticker rather than appending a duplicate unit). This is a behavior change from `addLoop` which silently ignored duplicates — the picker makes the collision visible.

---

## 4. What Stays the Same From the Existing Implementation

The following are confirmed-implemented and carry forward without modification:

| Component / constant | File | Status |
|---|---|---|
| `StickerSheetPreview.svelte` | `src/lib/features/sticker-lab/components/StickerSheetPreview.svelte` | Keep as-is; paths lookup changes from `sequenceId` to `shapeHash` |
| `StickerExportPanel.svelte` | `src/lib/features/sticker-lab/components/StickerExportPanel.svelte` | Keep as-is; same export logic |
| `SheetSizePicker.svelte` | `src/lib/features/sticker-lab/components/SheetSizePicker.svelte` | Keep unchanged |
| `StickerSheetPdfExporter.ts` | `src/lib/features/sticker-lab/services/implementations/StickerSheetPdfExporter.ts` | Minor: swap `sequenceId` for `shapeHash` in lookup |
| `StickerUnitRenderer.ts` | `src/lib/features/sticker-lab/services/implementations/StickerUnitRenderer.ts` | Keep unchanged; renders MandalaPaths regardless of source |
| `rasterizeSvg.ts` | `src/lib/features/sticker-lab/services/implementations/rasterizeSvg.ts` | Keep unchanged |
| `IStickerSheetRepository.ts` | `src/lib/features/sticker-lab/services/contracts/IStickerSheetRepository.ts` | Keep unchanged |
| `IStickerUnitRenderer.ts` | `src/lib/features/sticker-lab/services/contracts/IStickerUnitRenderer.ts` | Keep unchanged |
| `sticker-lab-context.ts` | `src/lib/features/sticker-lab/context/sticker-lab-context.ts` | Keep unchanged |
| `StickerLab.svelte` shell | `src/lib/features/sticker-lab/StickerLab.svelte` | Keep unchanged; column layout unchanged |
| `LabModule.svelte` registration | `src/lib/features/lab/LabModule.svelte:42` | Keep unchanged |
| Sheet sizes: 8.5×11 and 13×19 | `sticker-constants.ts` | Unchanged |
| Background options: transparent / white / radial-gradient | `sticker-types.ts` | Unchanged |
| Variants: blue / red / full | `sticker-types.ts` | Unchanged |
| PDF export (pdf-lib, OCG layers, registration marks) | `StickerSheetPdfExporter.ts` | Unchanged |
| localStorage persistence at `tka:sticker-lab:active-sheet` | `sticker-constants.ts` | Key unchanged; schema version bumps from 1 to 2 |
| Cut-line and bleed overlays in preview | `StickerSheetPreview.svelte:166–179` | Unchanged |
| Pagination in preview | `StickerSheetPreview.svelte:26–38` | Unchanged |

---

## 5. What Gets Removed or Rewritten

### Removed: "Open deck browser" cross-tab action

`StickerList.svelte:8-11` contains:

```ts
function openDeckBrowser() {
  navigationState.setCurrentModule("choreo_card");
}
```

This is removed. The button navigates away from the Lab; it was a workaround for the absence of an in-tab picker. The in-tab picker replaces it.

The empty-state copy ("Open the deck browser and send LOOPs here to build your sheet.") is replaced with content described in Section 2a.

### Removed: `addLoop(ref: LoopRef)` on the state interface

`src/lib/features/sticker-lab/state/sticker-lab-state.svelte.ts:18` defines `addLoop(ref: LoopRef)`. This is replaced by `addPrimitive(ref: MandalaPrimitiveRef)` with the same contract shape but a different deduplication key (`shapeHash` instead of `sequenceId`).

### Removed: `sourceLoop` as primary identity on StickerUnit

The `sourceLoop: LoopRef | null` field on `StickerUnit` is demoted to an optional annotation (see data model below). The primary identity becomes `primitiveRef`.

### Removed: planned cross-tab integration

Grep confirms no "Send to sticker sheet" action or `addLoop` call exists outside the sticker-lab directory:

```
src/lib/features/sticker-lab/* (all 9 matches)
```

Zero deck-browser files reference sticker-lab. The cross-tab integration was only described in the original spec; it was never started. There is nothing to revert in the deck browser.

### Removed: `StickerListItem.svelte` `sticker.sourceLoop?.word` display

`src/lib/features/sticker-lab/components/StickerListItem.svelte:28`:

```svelte
<span class="word">{sticker.sourceLoop?.word ?? "Custom"}</span>
<span class="loop-type">{sticker.sourceLoop?.loopType ?? ""}</span>
```

Replaced with a label derived from the primitive's shape descriptor (e.g. "Shape 42" or a human-readable name if the registry provides one). The `loopType` sub-label is removed.

### Rewritten: `mandala-paths-cache.svelte.ts`

Currently keyed by `sequenceId` (string). Rewritten to be keyed by `shapeHash` (string). The loading mechanism changes: instead of fetching a sequence via `sequenceRepository.getSequence()` and computing paths, it fetches pre-baked paths from the primitive catalog. The interface stays synchronous for reads (`getPrimitivePaths`) and async for loads (`loadPrimitivePaths`), preserving the existing pattern.

---

## 6. Interim MVP Strategy

The `MandalaPrimitiveRegistry` from the three-tier equivalence spec will not be battle-tested at first ship. Three-stage approach:

### Stage A — Bootstrap catalog (ship this)

At build time, a script processes a representative set of LOOP sequences, computes `MandalaGeometryCalculator.calculate()` for each, derives `shapeHash` and `ultraHash`, deduplicates, and writes a static JSON file at `src/lib/features/sticker-lab/data/primitive-catalog.json`.

The static catalog becomes the data source for the primitive picker at Stage A. The picker loads it once on mount; no runtime enumeration occurs.

**Minimum viable catalog content per entry:**

```json
{
  "shapeHash": "abc123",
  "ultraHash": "def456",
  "displayName": "Rotated petal ring",
  "paths": { "blue": [...], "red": [...], "purple": [...] },
  "sourceLoop": {
    "sequenceId": "...",
    "word": "ALPHA",
    "loopType": "rotated-loop"
  },
  "symmetryOrder": 4,
  "colorationCount": 3
}
```

`paths` is the pre-computed MandalaPaths JSON, eliminating the sequence-fetch-and-compute round trip at render time.

**Cut line for Stage A:** ship if the catalog contains at least 20 distinct shape-tier entries representing a visually diverse set. The build script runs against the enumerated LOOP deck catalog (53k+ sequences across 13 LOOP decks from the deck enumerator project).

### Stage B — Live registry

The `MandalaPrimitiveRegistry` from the three-tier spec becomes the runtime source. The primitive picker switches from loading `primitive-catalog.json` to querying `MandalaPrimitiveRegistry.listByShapeTier()`. The user's saved sequences contribute to the registry. The static catalog is retained as a seed / fallback.

**Cut line for Stage B:** when the three-tier hashing algorithm is considered stable (no hash format changes in 4+ weeks of use).

### Stage C — Cross-user catalog

If the platform ever persists primitives to Firestore, Stage C enables users to discover each other's novel shapes. This is a social feature and requires a spec of its own. Not planned currently.

---

## 7. Data Model Migration

### New TypeScript types

```ts
/** A stable content-addressed reference to a mandala primitive shape. */
export interface MandalaPrimitiveRef {
  /** Hash identifying the shape tier (geometry only, color-invariant). */
  shapeHash: string;
  /** Hash identifying the ultra-equivalent class (geometry + coloration). */
  ultraHash: string;
  /**
   * Optional back-link to the canonical source LOOP that seeded this primitive.
   * Present in Stage A catalog; may be null for chimera or synthetic primitives.
   */
  sourceLoop?: LoopRef | null;
  /** Human-readable label for display in picker and list items. */
  displayName?: string;
}
```

`StickerUnit` changes:

```ts
export interface StickerUnit {
  readonly id: string;
  /** Primary identity in v2. References a primitive, not a specific sequence. */
  readonly primitiveRef: MandalaPrimitiveRef;
  /**
   * @deprecated v1 compat field retained for read-time migration.
   * Always null after migration; callers must not rely on it being populated.
   */
  readonly sourceLoop?: LoopRef | null;
  readonly variant: StickerVariant;
  readonly size: StickerSize;
  readonly background: StickerBackground;
  readonly copies: number;
  readonly presentation: StickerPresentation;
}
```

### Versioned migration in `LocalStickerSheetRepository`

`src/lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository.ts:16` (`load()`) currently rejects anything where `parsed.version !== STORAGE_SCHEMA_VERSION`. With `STORAGE_SCHEMA_VERSION` bumped to `2`, a v1 sheet would be silently discarded.

Instead, replace the version guard with a migration chain:

```ts
load(): StickerSheet | null {
  const raw = this.storage.getItem(STORAGE_KEY_ACTIVE_SHEET);
  if (!raw) return null;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }

  if (!isStoredPayload(parsed)) return null;

  // Migration chain: run each step in sequence.
  if (parsed.version === 1) {
    parsed = migrateV1toV2(parsed);
  }

  if (parsed.version !== STORAGE_SCHEMA_VERSION) return null; // unknown future version
  return parsed.sheet;
}
```

`migrateV1toV2` converts each `StickerUnit` that has a `sourceLoop` but no `primitiveRef`:

```ts
function migrateV1toV2(payload: StoredPayloadV1): StoredPayload {
  const sheet = payload.sheet;
  const migrated: StickerSheet = {
    ...sheet,
    stickers: sheet.stickers.map((unit) => {
      if ((unit as any).primitiveRef) return unit; // already v2
      const sourceLoop = (unit as any).sourceLoop as LoopRef | null;
      // v1 had no shapeHash. Use sequenceId as a placeholder shapeHash so the
      // sticker remains identifiable. The sticker will render correctly as long
      // as the primitive catalog has been seeded from that sequenceId.
      // If the sequenceId is not in the catalog, the sticker shows the
      // "missing paths" placeholder — same behavior as today for missing
      // sequence data.
      return {
        ...unit,
        primitiveRef: {
          shapeHash: sourceLoop?.sequenceId ?? `legacy-${unit.id}`,
          ultraHash: sourceLoop?.sequenceId ?? `legacy-${unit.id}`,
          sourceLoop,
          displayName: sourceLoop?.word ?? "Imported sticker",
        },
      };
    }),
  };
  return { version: 2, sheet: migrated };
}
```

After migration, `save()` writes the v2 payload. The v1 data is gone from localStorage after the first load. Users with saved sticker sheets from Phase 1 will see their stickers retained with best-effort shapeHashes that map to sequenceIds — rendering works as long as those primitives are in the catalog.

### `STORAGE_SCHEMA_VERSION` constant

`src/lib/features/sticker-lab/domain/sticker-constants.ts:34`:

```ts
export const STORAGE_SCHEMA_VERSION = 1;
```

Change to `2`.

---

## 8. File-by-File Change List

| File | Action | Summary |
|---|---|---|
| `domain/sticker-types.ts` | Modify | Add `MandalaPrimitiveRef`; update `StickerUnit` to replace `sourceLoop` with `primitiveRef`; update `CreateStickerUnitInput`; update `createDefaultStickerUnit` |
| `domain/sticker-constants.ts` | Modify | Bump `STORAGE_SCHEMA_VERSION` from `1` to `2` |
| `state/sticker-lab-state.svelte.ts` | Modify | Replace `addLoop(ref: LoopRef)` with `addPrimitive(ref: MandalaPrimitiveRef)`; update deduplication to use `shapeHash`; update `StickerLabState` interface |
| `state/mandala-paths-cache.svelte.ts` | Rewrite | Change key from `sequenceId` to `shapeHash`; change load source from `sequenceRepository.getSequence()` + `MandalaGeometryCalculator` to primitive catalog lookup; rename exports to `getPrimitivePaths` / `loadPrimitivePaths` |
| `services/implementations/LocalStickerSheetRepository.ts` | Modify | Replace hard version check with migration chain; add `migrateV1toV2`; add `StoredPayloadV1` type |
| `services/implementations/StickerSheetPdfExporter.ts` | Modify | Swap `unit.sourceLoop.sequenceId` to `unit.primitiveRef.shapeHash` in the paths lookup call (2 lines) |
| `services/implementations/StickerUnitRenderer.ts` | Keep | No change; renders `MandalaPaths` regardless of how they were sourced |
| `services/implementations/rasterizeSvg.ts` | Keep | No change |
| `services/contracts/IStickerSheetRepository.ts` | Keep | No change |
| `services/contracts/IStickerSheetPdfExporter.ts` | Modify | `StickerMandalaLookup.getPaths` signature: rename parameter from `sequenceId` to `primitiveKey` (type remains `string`); doc comment update |
| `services/contracts/IStickerUnitRenderer.ts` | Keep | No change |
| `components/StickerList.svelte` | Modify | Remove `openDeckBrowser()`; remove `navigationState` import; rewrite empty state copy; add `[+]` button in header that opens picker |
| `components/StickerListItem.svelte` | Modify | Replace `sticker.sourceLoop?.word` with `sticker.primitiveRef.displayName`; remove `loopType` sub-label |
| `components/StickerSheetPreview.svelte` | Modify | Swap `loadMandalaPaths(sticker.sourceLoop.sequenceId)` to `loadPrimitivePaths(sticker.primitiveRef.shapeHash)`; swap `getMandalaPaths` to `getPrimitivePaths`; update slot's null-check for missing paths |
| `components/StickerExportPanel.svelte` | Modify | Swap `loadMandalaPaths` / `getMandalaPaths` to primitive equivalents |
| `components/SheetSizePicker.svelte` | Keep | No change |
| `StickerLab.svelte` | Keep | Column layout unchanged |
| `context/sticker-lab-context.ts` | Keep | No change |
| `index.ts` | Keep | Re-export list may need `MandalaPrimitiveRef` added |
| `components/PrimitivePicker.svelte` | New | The in-tab picker panel described in Section 3 |
| `data/primitive-catalog.json` | New | Stage A static catalog (generated by build script, not hand-authored) |

---

## 9. Tests Needed

### Data model migration

- `LocalStickerSheetRepository.load()` with a v1 payload returns a v2 `StickerSheet` with valid `primitiveRef` on each unit.
- `LocalStickerSheetRepository.load()` with a v1 payload writes v2 back to storage on next `save()`.
- `LocalStickerSheetRepository.load()` with a v2 payload passes through unchanged.
- `LocalStickerSheetRepository.load()` with an unknown version (v99) returns null.
- `LocalStickerSheetRepository.load()` with a corrupt payload returns null.

### Primitive picker interaction

- Clicking a shape tile expands ultra variants; clicking again collapses.
- Clicking "+ Add" calls `state.addPrimitive` with the correct `shapeHash`.
- If a primitive is already on the sheet, the badge updates and the add button reads "+ Add another copy" (increments `copies` on the existing sticker).
- Filter by symmetry reduces the visible tile count correctly.
- Filters stack: symmetry AND coloration filters are applied conjunctively.

### Mandala render invariance

- Given the same `MandalaPaths`, `StickerUnitRenderer.renderSVG()` produces identical SVG output for the same `StickerUnit` (pure function — no random IDs in the stable path). Exception: the radial-gradient id uses `Math.random()` and is known non-deterministic; that branch is excluded or mocked in the test.
- `getPrimitivePaths(shapeHash)` returns null before `loadPrimitivePaths(shapeHash)` is called, and returns `MandalaPaths` after.
- Concurrent calls to `loadPrimitivePaths(shapeHash)` for the same hash produce exactly one catalog lookup.

---

## 10. Phase Boundary: What the MVP Redirect Must Contain

### Must ship in Stage A

1. `sticker-types.ts` updated with `MandalaPrimitiveRef` and the updated `StickerUnit`.
2. `STORAGE_SCHEMA_VERSION = 2` + v1→v2 migration in `LocalStickerSheetRepository`.
3. `PrimitivePicker.svelte` with the static catalog as its data source.
4. `StickerList.svelte` updated empty state (no more "Open deck browser").
5. `StickerListItem.svelte` using `primitiveRef.displayName`.
6. `mandala-paths-cache` rewritten to key on `shapeHash` and load from catalog.
7. The static `primitive-catalog.json` built from the existing enumerated LOOP catalog.

### Can ship in Stage B (after three-tier hashing is stable)

- Live `MandalaPrimitiveRegistry` as the picker data source.
- `shapeHash` values derived from canonical geometry rather than sequenceId proxies.
- Filters backed by registry metadata queries rather than static catalog fields.

**Can Stage A ship without battle-tested three-tier hashing?** Yes. Stage A uses sequenceId as the shapeHash proxy. The picker shows primitives sourced from the static catalog without computing any hashes at runtime. The three-tier algorithm only becomes load-bearing at Stage B when hashes must be content-addressable across sequences.

### Minimum viable `MandalaPrimitiveRegistry` surface for Stage B

```ts
interface MandalaPrimitiveRegistry {
  listByShapeTier(): MandalaPrimitive[];
  getByShapeHash(shapeHash: string): MandalaPrimitive | null;
  getPaths(shapeHash: string): MandalaPaths | null;
}
```

Nothing else is needed at Stage B. The picker does not require write access to the registry; it reads and the user's saved sequences are enumerated separately.

---

## 11. Open Questions — Resolved

**Q1: What label does a primitive tile show in the picker when no human name is available?**

Resolved: use the `displayName` field from the catalog entry, seeded by the source LOOP word (e.g. "ALPHA"). When there is no named word (length-based or synthetic), fall back to "Shape {n}" where n is the tile's 1-based position in the filtered list. Do not expose hash strings to users. Alternative considered: expose loopType ("rotated-loop") — rejected because "rotated" describes the sequence mechanism, not the mandala shape, and users browsing the picker are thinking about shapes.

**Q2: Does `StickerSheetPreview.svelte` need a full rewrite to handle the shapeHash key swap?**

Resolved: two line changes. `loadMandalaPaths(sticker.sourceLoop.sequenceId)` → `loadPrimitivePaths(sticker.primitiveRef.shapeHash)` and `getMandalaPaths(sticker.sourceLoop.sequenceId)` → `getPrimitivePaths(sticker.primitiveRef.shapeHash)`. The rendering pipeline, pagination, cut-line CSS, and bleed overlay are unchanged.

**Q3: Should the primitive picker be a full-screen modal or a panel overlay?**

Resolved: overlay panel (not full-screen modal), because the sheet preview should stay visible as the user adds primitives. Users need to see the sheet filling up to judge when they have enough variety. Full-screen modal hides that feedback loop. Alternative considered: slide-in drawer from the left column — rejected because it competes with the list column's content. Overlay anchored above or alongside the left column is preferred.

**Q4: Is `StickerUnit.sourceLoop` retained as a deprecated field or fully removed?**

Resolved: retained as optional deprecated field (`readonly sourceLoop?: LoopRef | null`) for two reasons. First, the v1 migration writes it into `primitiveRef.sourceLoop`, so the data exists anyway. Second, future debugging or export features may want to trace "what sequence did this primitive come from." Marking it `@deprecated` prevents new code from relying on it while preserving the historical link.

**Q5: Does the `StickerLabState` interface need a `removePrimitive` method or does `removeSticker(id)` suffice?**

Resolved: `removeSticker(stickerId: string)` is sufficient. The sticker's identity in the sheet is its UUID, not the primitiveRef. No rename needed.

**Q6: How does the picker handle primitives with identical `shapeHash` but different `ultraHash` in the same catalog?**

Resolved: ultra variants collapse under the same tile. The tile renders the "full" (both-hand) variant by default. On expand, each ultra variant renders in its distinct coloration. Only one `StickerUnit` is created per `shapeHash` on the sheet — coloration is controlled by the `variant` toggle (blue/red/full), not by ultra-hash selection. Alternative considered: create separate sticker units per ultra variant — rejected because it overcomplicates the list when the three toggles already handle it.
