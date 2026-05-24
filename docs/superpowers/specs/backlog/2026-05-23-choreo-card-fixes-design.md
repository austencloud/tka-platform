# Choreo Card Module Fixes

**Date:** 2026-05-23
**Scope:** Race conditions, silent failures, and dead code across the choreo-card module.

---

## Issue 1: DeckReleaserTab.handleDraw race condition (WR-04)

**File:** `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`
**Lines:** 62-66 (`handleDraw`), 68-71 (`handleRedraw`)

**Problem:** `handleDraw` and `handleRedraw` both call `composeDeck` (which mutates `cards`) then `await loadSelectedSequences()`. Rapid clicks launch concurrent `loadSelectedSequences` calls. The second call reads whatever `cards` is at that moment -- possibly the result of a third click's `composeDeck`. When the first `loadSelectedSequences` resolves it overwrites `sequences` with stale data that no longer aligns with `cards`.

**Evidence:** No guard variable, no debounce, no generation counter. The `isLoadingSequences` flag on line 74 is set but never checked before entry.

**Fix:**

```ts
// Add a generation counter at module scope
let drawGeneration = 0;

async function handleDraw() {
  const gen = ++drawGeneration;
  cards = composeDeck(pool, weights, totalCards);
  await loadSelectedSequences(gen);
  if (gen !== drawGeneration) return; // stale
  step = "review";
}

async function handleRedraw() {
  const gen = ++drawGeneration;
  cards = composeDeck(pool, weights, totalCards);
  await loadSelectedSequences(gen);
}

async function loadSelectedSequences(generation: number) {
  isLoadingSequences = true;
  try {
    // ... existing body ...
    if (generation !== drawGeneration) return; // discard stale
    sequences = cards
      .map((c) => seqMap.get(c.sequenceId))
      .filter((s): s is SequenceData => s != null);
  } catch (err) {
    console.warn("Failed to load sequences:", err);
  } finally {
    isLoadingSequences = false;
  }
}
```

Also disable the Draw/Redraw buttons while `isLoadingSequences` is true to prevent rapid clicks at the UI level.

---

## Issue 2: PrintPreviewPages cache cleared on every instantiation (WR-03)

**File:** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`
**Lines:** 68-69

**Problem:** These two lines run at component script top-level (outside `onMount`, outside `$effect`):

```ts
cardCache.clear();
deckCardBlobCache.clear().catch(() => {});
```

Every time Svelte creates a new `PrintPreviewPages` instance -- which happens when navigating between decks in `DeckBrowser` -- the entire in-memory and IndexedDB cache is flushed. This defeats the two-tier caching system that the rest of the file carefully maintains.

**Evidence:** `cardCache` is a module-level `Map` (`print-preview-cache.ts:14`). `deckCardBlobCache` is an IndexedDB-backed store. Both survive across component lifecycles by design. Clearing them on mount makes every deck switch re-render all cards from scratch.

**Fix:** Remove both lines entirely. The `renderAll` function already handles cache invalidation when `rerenderKey` changes (lines 190-195). That is the correct invalidation path.

```diff
-  cardCache.clear();
-  deckCardBlobCache.clear().catch(() => {});
   let lastSeenRerenderKey = rerenderKey;
```

---

## Issue 3: Deck release silently fails for non-admin users (CR-02)

**Files:**
- `src/lib/features/choreo-card/services/deck-release-store.ts` (lines 21-58)
- `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte` (lines 104-116)
- `firestore.rules` (lines 1218-1226)

**Problem:** Firestore rules require `isAdmin()` for writes to `deckReleases/**`. The `releaseDeck` function performs no pre-flight auth check. When a non-admin clicks Release, the Firestore transaction throws a permission-denied error. The `catch` on line 112 only does `console.warn("Failed to release deck:", err)` -- no toast, no user-facing message. The UI returns to its idle state with no indication that the release failed.

**Fix (two layers):**

1. **Pre-flight check** in `releaseDeck`:

```ts
import { getAuth } from "firebase/auth";

export async function releaseDeck(
  cards: DeckReleaseCard[],
  theme: string,
  notes: string,
): Promise<DeckRelease> {
  const auth = getAuth();
  if (!auth.currentUser) {
    throw new Error("Authentication required to release a deck.");
  }
  // ... existing transaction ...
}
```

2. **User-facing error** in `DeckReleaserTab.handleRelease`:

```ts
import { toast } from "$lib/shared/toast/state/toast-state.svelte";

async function handleRelease() {
  isReleasing = true;
  try {
    const release = await releaseDeck(cards, theme, notes);
    releasedNumber = release.deckNumber;
    nextDeckNumber = release.deckNumber + 1;
    step = "released";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Release failed";
    const isPermission = msg.includes("permission") || msg.includes("PERMISSION_DENIED");
    toast.error(isPermission ? "Admin access required to release decks." : `Release failed: ${msg}`);
  } finally {
    isReleasing = false;
  }
}
```

---

## Issue 4: composeDeck silently produces fewer cards than requested (WR-05)

**File:** `src/lib/features/choreo-card/services/deck-composer.ts`
**Lines:** 52-92

**Problem:** The allocation loop (lines 63-72) clamps each bucket's target to `pool.get(w.stepCount)?.length ?? 0`. When a bucket is undersized, the surplus is lost -- not redistributed to other buckets. Example: user requests 52 cards, 16-step bucket has 40% weight (target 21) but only 15 sequences available. 6 cards vanish silently. `allocated` sums clamped values, so the final bucket absorbs the remainder only from its own target, not from prior shortfalls.

**Evidence:** Line 69: `const clamped = Math.min(target, pool.get(w.stepCount)?.length ?? 0)`. The difference `target - clamped` is never redistributed.

**Fix:** Two-pass allocation with redistribution:

```ts
export function composeDeck(
  pool: Map<number, PoolEntry[]>,
  weights: StepCountWeight[],
  totalCards: number,
): DeckReleaseCard[] {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight === 0) return [];

  // Pass 1: Initial allocation clamped to available
  const targets = new Map<number, number>();
  let remaining = totalCards;
  const saturated = new Set<number>();

  for (const w of weights) {
    const ideal = Math.round((totalCards * w.weight) / totalWeight);
    const available = pool.get(w.stepCount)?.length ?? 0;
    const clamped = Math.min(ideal, available);
    targets.set(w.stepCount, clamped);
    remaining -= clamped;
    if (clamped === available) saturated.add(w.stepCount);
  }

  // Pass 2: Redistribute shortfall to non-saturated buckets
  while (remaining > 0) {
    const unsaturated = weights.filter(
      (w) => !saturated.has(w.stepCount) && (targets.get(w.stepCount) ?? 0) < (pool.get(w.stepCount)?.length ?? 0)
    );
    if (unsaturated.length === 0) break; // all buckets maxed out

    const subWeight = unsaturated.reduce((s, w) => s + w.weight, 0);
    let distributed = 0;
    for (const w of unsaturated) {
      const current = targets.get(w.stepCount) ?? 0;
      const available = pool.get(w.stepCount)?.length ?? 0;
      const extra = Math.min(
        Math.round((remaining * w.weight) / subWeight),
        available - current,
      );
      targets.set(w.stepCount, current + extra);
      distributed += extra;
      if (current + extra === available) saturated.add(w.stepCount);
    }
    remaining -= distributed;
    if (distributed === 0) break; // no progress
  }

  // Sample and shuffle (unchanged)
  const selected: PoolEntry[] = [];
  for (const [stepCount, count] of targets) {
    const bucket = pool.get(stepCount);
    if (!bucket || count === 0) continue;
    selected.push(...fisherYatesSample(bucket, count));
  }
  shuffle(selected);

  return selected.map((entry, i) => ({
    sequenceId: entry.sequenceId,
    sourceDeckId: entry.sourceDeckId,
    stepCount: entry.stepCount,
    word: entry.word,
    position: i + 1,
  }));
}
```

---

## Issue 5: Missing error handling in DeckBrowser export functions

**File:** `src/lib/features/choreo-card/components/DeckBrowser.svelte`
**Lines:** 143-163 (`handleExportPDF`), 165-179 (`handleExportZIP`)

**Problem:** Both functions use `try/finally` with no `catch`. If the export throws (pdf-lib parse error, JSZip failure, canvas taint), the error propagates unhandled. No toast, no user feedback.

**Fix:** Add `catch` blocks with toast feedback:

```ts
async function handleExportPDF() {
  if (renderedPairs.length === 0) return;
  isExporting = true;
  try {
    // ... existing ...
  } catch (err) {
    console.warn("[DeckBrowser] PDF export failed:", err);
    toast.error("PDF export failed. Try re-rendering cards first.");
  } finally {
    isExporting = false;
  }
}

async function handleExportZIP() {
  if (renderedPairs.length === 0) return;
  isExporting = true;
  try {
    // ... existing ...
  } catch (err) {
    console.warn("[DeckBrowser] ZIP export failed:", err);
    toast.error("ZIP export failed. Try re-rendering cards first.");
  } finally {
    isExporting = false;
  }
}
```

Requires adding `import { toast } from "$lib/shared/toast/state/toast-state.svelte"` to `DeckBrowser.svelte`.

---

## Issue 6: Observer registrations outside onMount (WR-01 / WR-02)

**Files:**
- `src/lib/features/choreo-card/components/CardDesigner.svelte` (lines 131-132)
- `src/lib/features/choreo-card/components/CardInspectModal.svelte` (line 63)

**Problem:** Observer registrations (`registerObserver`) run at script top-level, outside `onMount`. In Svelte 5, the `<script>` block executes during component creation (similar to a constructor), so this works in browser contexts. However:
- In SSR, `onDestroy` does not run, so observers registered at top-level leak.
- The pattern violates the Svelte convention of performing side effects in lifecycle hooks.

**Fix:** Move registrations into `onMount` and cleanup into the `onMount` return (or keep `onDestroy`).

**CardDesigner.svelte:**
```diff
-  visibilityManager.registerObserver(onVisibilityChanged, ["all"]);
-  imageComposition.registerObserver(onCompositionChanged);
-
-  onDestroy(() => {
-    visibilityManager.unregisterObserver(onVisibilityChanged);
-    imageComposition.unregisterObserver(onCompositionChanged);
-    pickerEngine.destroy();
-  });

+  onMount(() => {
+    visibilityManager.registerObserver(onVisibilityChanged, ["all"]);
+    imageComposition.registerObserver(onCompositionChanged);
+  });
+
+  onDestroy(() => {
+    visibilityManager.unregisterObserver(onVisibilityChanged);
+    imageComposition.unregisterObserver(onCompositionChanged);
+    pickerEngine.destroy();
+  });
```

**CardInspectModal.svelte:**
```diff
-  imageComposition.registerObserver(onCompositionChanged);
-  onDestroy(() => imageComposition.unregisterObserver(onCompositionChanged));

+  onMount(() => {
+    imageComposition.registerObserver(onCompositionChanged);
+  });
+  onDestroy(() => imageComposition.unregisterObserver(onCompositionChanged));
```

Note: `CardDesigner.svelte` already imports `onMount` (line 15). `CardInspectModal.svelte` imports `onDestroy` but not `onMount` -- add it.

---

## Issue 7: Non-null assertions without bounds checks in PrintPreviewPages (WR-07)

**File:** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`
**Lines:** 429, 435, 463, 470, 397, 499, 506

**Problem:** Multiple event handlers use `sequences[idx]!` where `idx` is computed from `sheetIndex * layout.cardsPerPage + cardIndex`. If `renderedCards` and `sequences` have different lengths (which can happen during progressive rendering or after cache invalidation), this assertion crashes.

**Affected patterns:**
```ts
onCardClick?.(sequences[idx]!, ...)
handleCardContextMenu(e, sheetIndex * layout.cardsPerPage + cardIndex)
  // which does: sequences[cardIndex]! on line 397
```

**Fix:** Add bounds check before access:

```ts
function handleCardContextMenu(event: MouseEvent, cardIndex: number) {
  if (!onCardContextMenu) return;
  const seq = sequences[cardIndex];
  if (!seq) return;
  event.preventDefault();
  onCardContextMenu(event.clientX, event.clientY, () => rerenderCard(cardIndex), seq);
}
```

For inline `onclick` handlers, extract to a helper or add an early return:

```ts
onclick={() => {
  const idx = sheetIndex * layout.cardsPerPage + cardIndex;
  const seq = sequences[idx];
  if (seq) onCardClick?.(seq, card.frontUrl, () => rerenderCard(idx));
}}
```

Apply this pattern to all 6 occurrences (grid mode lines 429/435, fronts page lines 463/470, backs page lines 499/506).

---

## Issue 8: Unused _CONTENT_HEIGHT constant

**File:** `src/lib/features/choreo-card/services/PrintCardRenderer.ts`
**Line:** 24

**Problem:** `const _CONTENT_HEIGHT = MPC_HEIGHT - MPC_BLEED * 2` is declared with an underscore prefix (signaling intentional disuse) but is never referenced. Its sibling `CONTENT_WIDTH` is used on line 99 via `contentW`. `_CONTENT_HEIGHT` is dead code.

**Fix:** Delete line 24.

---

## Issue 9: Unused isDesktop computed in DeckBrowser.svelte

**File:** `src/lib/features/choreo-card/components/DeckBrowser.svelte`
**Lines:** 73-81

**Problem:** `isDesktop` is computed via a media query listener but never referenced in the template, derived values, or any function in the component. The `$effect` registers a `change` listener that updates a value nothing reads.

**Fix:** Delete lines 73-81 (the `isDesktop` declaration and its `$effect`) and remove the `BREAKPOINTS` import if no longer needed.

```diff
-  import { BREAKPOINTS } from "$lib/shared/device/domain/constants/device-constants";

-  let isDesktop = $state(false);
-
-  $effect(() => {
-    if (typeof window === 'undefined') return;
-    const mq = window.matchMedia(`(min-width: ${BREAKPOINTS.DESKTOP}px)`);
-    isDesktop = mq.matches;
-    const handler = (e: MediaQueryListEvent) => { isDesktop = e.matches; };
-    mq.addEventListener('change', handler);
-    return () => mq.removeEventListener('change', handler);
-  });
```

Verify `BREAKPOINTS` is not used elsewhere in the file before removing the import.

---

## Issue 10: Exported but unused getDeckRelease function

**File:** `src/lib/features/choreo-card/services/deck-release-store.ts`
**Lines:** 60-65

**Problem:** `getDeckRelease` is exported but never imported anywhere in the codebase. Grep across `src/` for `getDeckRelease` shows only the declaration and the Firestore path helper functions (which are used by other functions in the same file).

**Fix:** Keep the function but mark it with a TODO comment noting it is reserved for the deck browser's future "view past releases" feature. If that feature is not planned, delete it.

```ts
/** @todo Used by planned "view past releases" feature. Remove if not needed by 2026-07. */
export async function getDeckRelease(deckNumber: number): Promise<DeckRelease | null> {
```

---

## Implementation Order

1. **Issue 2** (cache clear) -- highest impact, one-line fix, immediately improves performance
2. **Issue 1** (race condition) -- data integrity fix for deck releaser workflow
3. **Issue 4** (redistribution) -- correctness fix for card count
4. **Issue 3** (silent auth failure) -- user-facing error for admin-gated feature
5. **Issue 5** (export error handling) -- catch blocks for export functions
6. **Issue 7** (non-null assertions) -- defensive bounds checks
7. **Issues 6, 8, 9, 10** (cleanup) -- minor, batch together

## Verification Plan

- **Issue 1:** Click Draw rapidly 5 times. After settling, confirm `cards.length === sequences.length`.
- **Issue 2:** Navigate Deck A -> Deck B -> Deck A. Confirm console shows "All N cards cached" on return.
- **Issue 3:** Sign in as non-admin, click Release. Confirm toast shows "Admin access required."
- **Issue 4:** Set 16-step weight to 100% with only 15 sequences available. Confirm remaining cards filled from other buckets. Total should equal `totalCards`.
- **Issue 5:** Corrupt a rendered pair (null canvas), click Export PDF. Confirm toast instead of unhandled error.
- **Issue 7:** Trigger a click during progressive rendering (when `renderedCards.length < sequences.length`). Confirm no crash.
- **Issues 8-10:** `npm run check` passes with no unused-variable warnings for removed code.
