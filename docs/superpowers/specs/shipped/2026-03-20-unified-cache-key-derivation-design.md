# Unified Cache Key Derivation Design

## Problem

The codebase has two independent cache key systems for pictograph renders:

1. **PictographKeyHasher** — used by ImageComposer's blob cache. Enumerates all motion fields (motionType, locations, turns, orientations, rotationDirection, propType, gridMode) plus visibility settings (showTKA, darkMode, bluePropType, etc.).

2. **CellCacheKeyDeriver** — used by PreviewCellRenderer, CellPreWarmer, and ImageComposer's write-through cache. Independently enumerates the same motion fields, but has historically missed fields that PictographKeyHasher includes.

These two systems must produce compatible keys (same pictograph data + same rendering context = same identity). When they drift, cache collisions cause wrong-prop-type blobs to be served. The version history (7 revisions, lsp1 through lsp7) shows this class of bug recurring.

**Root cause:** CellCacheKeyDeriver duplicates the motion property enumeration instead of delegating to PictographKeyHasher.

**Additional silent bug:** CellCacheKeyDeriver is also missing `gridMode` entirely. PictographKeyHasher derives gridMode from locations (box vs diamond mode), but the current CellCacheKeyDeriver flat key has no gridMode discriminator. This means box-mode and diamond-mode pictographs at the same locations share a cache key. The composition refactor silently closes this bug.

## Solution: Composition Over Duplication

CellCacheKeyDeriver delegates the "pictograph identity" portion of its cache key to PictographKeyHasher, then appends cell-specific dimensions (size, stepNumber, browseViewMode) that PictographKeyHasher intentionally excludes.

### Architecture

```
CellCacheKeyDeriver.deriveCacheKey(data, stepNumber, isDark, options)
  |
  +-- Maps PreviewCellRenderOptions + isDark --> PictographVisibilityOptions
  |     (resolves catDogMode, hardcodes VTG/elemental/positions to false)
  |
  +-- Calls pictographKeyHasher.deriveKey(data, visibility) --> hash string
  |     (captures: letter, all motion fields incl. propType/gridMode,
  |      all visibility fields incl. handPathMode/handPointVisibility/darkMode)
  |
  +-- Appends cell-specific dimensions: size, stepNumber, widthMultiplier, browseViewMode
  |
  +-- Returns "lsp8-{pictographHash}:{cellParts}"
```

### Key Guarantee

Any new field added to PictographKeyHasher (motion property, visibility setting, etc.) automatically flows through to CellCacheKeyDeriver's cache keys. No second place to update.

## Detailed Changes

### 1. PictographKeyHasher (extend)

**File:** `src/lib/shared/render/services/implementations/PictographKeyHasher.ts`

PictographKeyHasher is currently missing three `PictographVisibilityOptions` fields that affect rendered pixel output:

| Field | Effect on render |
|---|---|
| `handPathMode` | Triggers HAND props, float arrows, suppresses TKA/reversals |
| `handPointVisibility` | Controls which hand dots are drawn ("all", "active", "none") |
| `printMode` | Pure white background instead of dark mode background |

**Change:** Add these three fields to `PictographKeyInput.visibility` and to the `buildKeyInput()` mapping. This makes PictographKeyHasher genuinely complete for all visibility dimensions.

```typescript
// PictographKeyInput.visibility gains:
handPathMode: boolean;
handPointVisibility: string;
printMode: boolean;

// buildKeyInput() gains:
handPathMode: visibility.handPathMode ?? false,
handPointVisibility: visibility.handPointVisibility ?? "all",
printMode: visibility.printMode ?? false,
```

**IPictographKeyHasher interface:** No change (it already accepts `PictographVisibilityOptions` which has these fields).

### 2. CellCacheKeyDeriver (refactor)

**File:** `src/lib/shared/sequence-viewer/services/implementations/CellCacheKeyDeriver.ts`

**Before:** Independently enumerates 14+ motion fields plus visibility options in a flat pipe-delimited string.

**After:**
- Constructor accepts `IPictographKeyHasher` dependency
- New private `mapToVisibility()` converts `PreviewCellRenderOptions` + `isDark` to `PictographVisibilityOptions`
- `deriveCacheKey()` calls `keyHasher.deriveKey()` for the pictograph hash, appends cell-specific parts
- Version bump: `lsp7` to `lsp8`

#### Mapping: PreviewCellRenderOptions --> PictographVisibilityOptions

All of these go INTO the pictograph hash (via `mapToVisibility()`):

| PreviewCellRenderOptions | PictographVisibilityOptions | Notes |
|---|---|---|
| `options.showTKA` | `showTKA` | Default true |
| (not present) | `showTND: false` | Preview cells never show VTG |
| (not present) | `showElemental: false` | Preview cells never show elemental |
| (not present) | `showPositions: false` | Preview cells never show positions |
| `options.showReversals` | `showReversals` | Default true |
| `options.showNonRadialPoints` | `showNonRadialPoints` | Default true |
| `isDark` parameter | `darkMode` | Passed separately in current API |
| `options.bluePropType` | `bluePropType` | Direct pass-through |
| resolved from catDogMode | `redPropType` | `catDogModeEnabled ? redPropType : bluePropType` |
| `options.handPointVisibility` | `handPointVisibility` | `PreviewCellRenderOptions` narrows to `"all" \| "active"`. The value `"none"` only exists in `PictographVisibilityOptions` and never appears here. |
| `options.handPathMode` | `handPathMode` | Direct pass-through |
| (not present) | `printMode: false` | Preview cells are never print mode |

**catDog resolution happens in `mapToVisibility()`**, not in the hasher. The hasher receives an already-resolved `redPropType`.

#### Cell-specific dimensions (appended after pictograph hash)

These are NOT part of the pictograph identity. They control how the cell is presented:

| Dimension | Format |
|---|---|
| `showStepNumbers` + `stepNumber` | `stepNumber` or `"none"` or `"nonum"` |
| `size` | integer pixels |
| `widthMultiplier` | `"wm{N}"` or `""` |
| `browseViewMode` | `"vm-{subject}-{granularity}-{color}"` or `""` |

### 3. Singleton Export Update

```typescript
import { pictographKeyHasher } from "../../render/services/implementations/PictographKeyHasher";
export const cellCacheKeyDeriver = new CellCacheKeyDeriver(pictographKeyHasher);
```

### 4. ICellCacheKeyDeriver Interface (no change)

The interface signature is unchanged. All consumers call the same method with the same arguments.

### 5. ICellCacheKeyDeriver doc comment update

The interface doc comment still says "Uses djb2 hash for compact keys" (wrong since lsp4). Update to reflect the composition approach.

## Files Changed

| File | Change |
|---|---|
| `PictographKeyHasher.ts` | Add handPathMode, handPointVisibility, printMode to key input |
| `CellCacheKeyDeriver.ts` | Refactor to compose PictographKeyHasher; add constructor dep |
| `ICellCacheKeyDeriver.ts` | Update doc comment only |

## Files NOT Changed

| File | Why |
|---|---|
| `IPictographKeyHasher.ts` | Interface already accepts PictographVisibilityOptions |
| `PreviewCellRenderer.ts` | Calls cellCacheKeyDeriver.deriveCacheKey() unchanged |
| `CellPreWarmer.ts` | Calls cellCacheKeyDeriver.deriveCacheKey() unchanged |
| `ImageComposer.writeThroughToPreviewCache` | Calls cellCacheKeyDeriver.deriveCacheKey() unchanged |
| `PictographBlobCache.ts` | Stores string keys, format-agnostic |

**No collision between ImageComposer's blob cache and CellCacheKeyDeriver's preview cache:** ImageComposer's primary cache key format is `{hash}:{stepSize}` (used for its L1/L2 blob/memory cache). CellCacheKeyDeriver's format is `lsp8-{hash}:{cellParts}`. These are different key formats writing to different IndexedDB stores (`PictographBlobCache` vs the preview cell store). Even though both now use `pictographKeyHasher.deriveKey()` internally, the final key strings and storage locations are distinct. No collision risk.

## Known Pre-existing Issues (not addressed by this refactor)

These are called out so they are not attributed to this change:

1. **ImageComposer.writeThroughToPreviewCache omits browseViewMode** from the `PreviewCellRenderOptions` it builds. Write-through blobs are stored without a view mode discriminator, so browse view mode changes always miss the write-through cache. Pre-existing; preserved by this refactor.

2. **CellPreWarmer.buildRenderOptions omits browseViewMode**. Same consequence: pre-warmed cells miss for non-default view modes. Pre-existing; preserved.

## djb2 Hash Collision Risk

PictographKeyHasher uses a 32-bit djb2 hash. The lsp3 era abandoned djb2 for CellCacheKeyDeriver because collisions occurred after ~46K entries. This refactor reintroduces the djb2 hash as the pictograph-identity portion of the composite key.

**Why this is acceptable now:** The composite key is `lsp8-{hash}:{cellParts}`. Two pictographs that collide in the 32-bit hash would also need identical cell-specific dimensions (same size, same step number, same browseViewMode) to produce a full key collision. The cell-specific suffix reduces the effective collision domain by orders of magnitude. At typical library sizes (hundreds of sequences, not tens of thousands), the probability is negligible. If scale ever demands it, upgrading the hash function inside PictographKeyHasher would automatically flow through to CellCacheKeyDeriver.

## Cache Invalidation

Version bump from `lsp7` to `lsp8` makes all existing IndexedDB entries unreachable. They will never match a lookup and are evicted naturally by LRU policy or manual cache clear. No migration code needed.

## Risk Assessment

**Low risk.** The change is purely in cache key format. If a key is wrong, the only consequence is a cache miss (re-render), not incorrect rendering. The actual render pipeline (PictographPreparer, Canvas2DDirectRenderer) is untouched.

## Verification

1. TypeScript compilation passes (`npm run check`)
2. Existing unit tests pass (`npm test`)
3. Visual verification: open a deck with multiple sequences in normal mode and hand path mode. Confirm:
   - Start positions show correct prop types (staff in normal, HAND in hand path)
   - Switching between normal and hand path mode does not serve stale cached blobs
   - Different start positions (alpha vs beta vs gamma) render distinctly
4. Check no direct instantiation of `new CellCacheKeyDeriver()` in test files that would break from the new constructor parameter
5. Write-through verification: render a thumbnail (triggering ImageComposer write-through), then open the sequence viewer. Confirm the viewer renders instantly (cache hits from write-through) rather than re-rendering all cells
