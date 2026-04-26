# Browse Gallery Loading Performance

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Browse gallery initial load — reduce time from navigation to visible cards

---

## Problem

When a user navigates to the browse gallery, they see skeleton loaders for an unnecessarily long time before real sequence cards appear. The bottleneck is a serialized loading chain where nothing renders until every processing step completes.

### Current Critical Path

```
T=0ms      User navigates → BrowseModule mounts
T=0ms      setSource("community") → loadAllSequences()
T=0-5ms    Firestore query issued
T=50-2000ms Firestore returns all public sequences (network-bound)
T+1ms      deduplicateById() — sync, ~1ms
T+2ms      generateNavigationSections() — sync, ~1ms
T+3ms      applyFilterAndSort() — sync, ~2ms
T+4ms      await generateSequenceSections() — sync work wrapped in async, adds microtask
T+5ms      sectionsReady = true — skeleton CAN now fade
T+305ms    Skeleton fade completes (300ms CSS transition)
```

**Result:** User sees skeleton for (Firestore latency + processing chain) before any cards appear. On slow connections, 2+ seconds of skeleton.

**Note:** The skeleton/grid crossfade (Optimization 2 in earlier drafts) is already implemented — `SequenceDisplayPanel.svelte` already mounts `BrowseGrid` when `hasSequences` is true, independent of skeleton state, with the skeleton overlaid via `position: absolute`. So the 300ms fade does NOT block card mounting. The real bottleneck is the serialized processing chain gating `sectionsReady`.

---

## Root Causes

1. **Unnecessary async wrapper.** `generateSequenceSections()` is `async` but calls `BrowseSectionManager.organizeSections()` which is synchronous. The `ISectionManager` interface incorrectly declares `Promise` return types for sync methods.

2. **Single boolean gate.** `sectionsReady` is the only signal. Nothing renders until ALL processing (dedupe + nav sections + filter/sort + section organization) completes sequentially. There's no intermediate "data arrived, show something" state.

3. **`setSource` returns a Promise** that callers `.then()` on (BrowseModule.svelte line 419-440 uses it for pending sequence view). Changing loading to fire-and-forget requires migrating this caller.

---

## Optimizations

### Optimization 1: Remove Async Wrapper and Fix Interface

**Files:**
- `browse-state-factory.svelte.ts`
- `ISectionManager.ts`

`generateSequenceSections()` (line 424) is declared `async` but calls `BrowseSectionManager.organizeSections()` which returns `SequenceSection[]` synchronously. The `ISectionManager` interface incorrectly declares these methods as returning `Promise<...>`.

**Changes:**

1. Update `ISectionManager` interface — remove `Promise` wrapper from `organizeSections`, `organizeIntoSections`, and `getSectionConfig` return types
2. Make `generateSequenceSections()` synchronous (remove `async` keyword, change return type to `void`)
3. Remove `await` from ALL 8 call sites: lines 228, 249, 280, 488, 515, 531, 544, 612
4. Lines 679 and 694 already call without `await` — no change needed there

**Value:** Primarily clarity — removes false async that confuses the code. The microtask delay is sub-millisecond.

### Optimization 2: Progressive Rendering

**File:** `browse-state-factory.svelte.ts`

Currently `loadAllSequences()` sets `sectionsReady = true` only after ALL processing completes (line 229). The user sees nothing until dedupe + nav + filter + sort + section organization all finish.

**Changes:**

Split loading into two phases:

1. **Phase 1 (immediate):** After Firestore returns, dedupe, filter/sort, then set `sectionsReady = true` and `isLoading = false`. The grid can now render cards.
2. **Phase 2 (immediate follow-up):** Run `generateSequenceSections()` synchronously. Updates `sequenceSections` reactively. Since this is now sync (from Optimization 1), it runs in the same tick — no visual flash.

**Implementation in `loadAllSequences()`:**
```typescript
async function loadAllSequences(): Promise<void> {
  try {
    isLoading = true;
    sectionsReady = false;
    sequenceSections = [];
    error = null;
    const sequences = await loaderService.loadSequenceMetadata();
    const dedupedSequences = deduplicateById(sequences);
    allSequences = dedupedSequences;
    displayedSequences = dedupedSequences;
    const sections = Navigator.generateNavigationSections(sequences, []);
    navigationSections = sections;
    applyFilterAndSort();

    // Data is ready — let the grid render immediately
    sectionsReady = true;

    // Section organization is sync and fast — runs in same tick
    generateSequenceSections();
  } catch (err) {
    console.error("Failed to load sequences:", err);
    error = err instanceof Error ? err.message : "Failed to load sequences";
  } finally {
    isLoading = false;
  }
}
```

**Key decision:** Keep `loadAllSequences` as `async` returning `Promise<void>` so `setSource` callers still work. The BrowseModule `.then()` handler (line 419-440) for pending sequence view continues to work because the Promise still resolves after data is loaded. No migration needed.

Apply same pattern to `loadLibrarySequences()` — both the cache-hit path (lines 245-252) and the cache-miss path (lines 264-289). The cache-hit path is already fast but should follow the same order for consistency.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/lib/features/browse/shared/state/browse-state-factory.svelte.ts` | Remove async from `generateSequenceSections`, remove `await` at 8 call sites, set `sectionsReady = true` before section organization in `loadAllSequences` and `loadLibrarySequences` |
| `src/lib/features/browse/shared/services/contracts/ISectionManager.ts` | Remove `Promise` wrapper from `organizeSections`, `organizeIntoSections`, `getSectionConfig` return types |

## Files NOT Changed

- `SequenceDisplayPanel.svelte` — Crossfade already implemented correctly
- `PublicSequencesLoader.ts` — Firestore query strategy stays the same (already cached on repeat visits)
- `BrowseSectionManager.ts` — Section logic untouched (already returns sync)
- `BrowseModule.svelte` — `.then()` on `setSource` still works because `loadAllSequences` remains async
- `BrowseFilter.ts`, `BrowseSortService.ts` — Filter/sort logic untouched

---

## All `generateSequenceSections` Call Sites

| Line | Context | Current | After |
|------|---------|---------|-------|
| 228 | `loadAllSequences()` | `await generateSequenceSections()` | `generateSequenceSections()` |
| 249 | `loadLibrarySequences()` cache-hit | `await generateSequenceSections()` | `generateSequenceSections()` |
| 280 | `loadLibrarySequences()` cache-miss | `await generateSequenceSections()` | `generateSequenceSections()` |
| 488 | `applySortMethod()` | `await generateSequenceSections()` | `generateSequenceSections()` |
| 515 | `toggleSortDirection()` | `await generateSequenceSections()` | `generateSequenceSections()` |
| 531 | `applyFilter()` | `await generateSequenceSections()` | `generateSequenceSections()` |
| 544 | `applyMultiFilter()` | `await generateSequenceSections()` | `generateSequenceSections()` |
| 612 | `resetFilters()` | `await generateSequenceSections()` | `generateSequenceSections()` |
| 679 | `onLibraryMutated` | `generateSequenceSections()` (already no await) | No change |
| 694 | `onLibrarySequenceAdded` | `generateSequenceSections()` (already no await) | No change |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| `setSource` callers expecting Promise | Kept `loadAllSequences` as async — Promise still resolves correctly after data loads |
| BrowseModule pending sequence view | `.then()` still works because Promise resolves after `sectionsReady = true` and `displayedSequences` is populated |
| `ISectionManager` contract change | `BrowseSectionManager` already returns sync — interface was lying. No behavioral change. |
| Library tab cache-hit path | Already instant — just reorder to set `sectionsReady` before section generation for consistency |

---

## Success Criteria

- `sectionsReady` becomes `true` before section organization (cards render ~1 tick earlier)
- No false async in the loading chain
- `ISectionManager` interface matches actual sync behavior
- TypeScript compilation passes (`npm run check`)
- Build succeeds (`npm run build`)
- BrowseModule pending sequence view still works (`.then()` handler)
