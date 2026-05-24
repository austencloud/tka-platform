---
phase: choreo-card-module-review
reviewed: 2026-05-23T20:45:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/lib/features/choreo-card/components/CardDesigner.svelte
  - src/lib/features/choreo-card/components/CardInspectModal.svelte
  - src/lib/features/choreo-card/components/ChoreoCard.svelte
  - src/lib/features/choreo-card/components/ChoreoCardTab.svelte
  - src/lib/features/choreo-card/components/DeckBrowser.svelte
  - src/lib/features/choreo-card/components/card-back/CardBack.svelte
  - src/lib/features/choreo-card/components/card-back/InfoCardBack.svelte
  - src/lib/features/choreo-card/components/card-back/InfoCardFront.svelte
  - src/lib/features/choreo-card/components/designer/CardPreviewStack.svelte
  - src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
  - src/lib/features/choreo-card/domain/deck-layout-policy.ts
  - src/lib/features/choreo-card/services/DeckCardBlobCache.ts
  - src/lib/features/choreo-card/services/PrintCardRenderer.ts
  - src/lib/features/choreo-card/services/card-back-dom-renderer.ts
  - src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
  - src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte
  - src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte
  - src/lib/features/choreo-card/domain/models/DeckRelease.ts
  - src/lib/features/choreo-card/services/deck-composer.ts
  - src/lib/features/choreo-card/services/deck-release-store.ts
findings:
  critical: 2
  warning: 8
  info: 5
  total: 15
status: issues_found
---

# Choreo Card Module: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed all modified and new files in the choreo-card module. The existing modified files are generally solid Svelte 5 code with correct rune usage and good patterns for observer cleanup and effect dependencies. The new deck-releaser subsystem (DeckReleaserTab, ConfigureStep, ReviewStep, deck-composer, deck-release-store) introduces a Firestore-backed deck composition and release workflow.

Key concerns:
1. A missing authentication check in the deck release flow could cause silent runtime failures since the Firestore rules require admin access.
2. A promise that never rejects in PrintPreviewPages will hang indefinitely if an image fails to load.
3. Several race condition windows in async handlers that mutate `$state` arrays without generation guards.

## Critical Issues

### CR-01: `dataUrlToCanvas` promise never rejects -- hangs on broken images

**File:** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte:339-350`
**Issue:** The `dataUrlToCanvas` function creates a Promise that resolves in `img.onload` but never sets `img.onerror`. If the data URL is corrupt or the image fails to decode (e.g., due to memory pressure on a large deck), the promise hangs forever. Every caller (`reconstructPair`, `rebuildPairs`) awaits this promise, so a single bad image blocks the entire render pipeline with no timeout or error feedback.
**Fix:**
```typescript
function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error(`Failed to decode image from data URL (${dataUrl.slice(0, 50)}...)`));
    img.src = dataUrl;
  });
}
```

### CR-02: Deck release silently fails for non-admin users

**File:** `src/lib/features/choreo-card/services/deck-release-store.ts:21-58`
**Issue:** The `releaseDeck` function writes to `deckReleases/counter` and `deckReleases/counter/manifests/{id}`, which per `firestore.rules:1218-1226` require `isAdmin()` access. The function has no auth check and the caller in `DeckReleaserTab.svelte:104-116` only catches the error with `console.warn`. A non-admin user clicking "Release" sees `isReleasing` toggle to true, the Firestore write fails with a permission error, the catch logs a warning, and the UI resets -- no user-facing error message, no toast, no indication of what happened.
**Fix:** Either (a) add a pre-flight auth/role check and show a clear error before attempting the write, or (b) at minimum surface the error to the user via toast in the catch block:
```typescript
// In DeckReleaserTab.svelte handleRelease():
} catch (err) {
  console.warn("Failed to release deck:", err);
  // Surface the error so the user knows what happened
  const msg = err instanceof Error && err.message.includes("permission")
    ? "You need admin access to release decks."
    : "Failed to release deck. Try again.";
  // import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  toast.error(msg);
}
```

## Warnings

### WR-01: Observer registered at module top-level (outside lifecycle) in CardDesigner

**File:** `src/lib/features/choreo-card/components/CardDesigner.svelte:131-132`
**Issue:** `visibilityManager.registerObserver` and `imageComposition.registerObserver` are called at the top-level script scope, not inside `onMount`. In Svelte 5, `<script>` runs when the component is created (before DOM mount), which is typically fine for registrations that don't need DOM. However, if the component is constructed but never mounted (e.g., conditional rendering destroys it before `onMount` fires), the `onDestroy` cleanup still runs, but the observer callbacks could fire against a partially initialized component state. This is a latent bug -- unlikely to trigger in current usage but fragile.
**Fix:** Move observer registrations inside `onMount` to pair with the `onDestroy` cleanup:
```typescript
onMount(async () => {
  hapticService = getHapticFeedback();
  visibilityManager.registerObserver(onVisibilityChanged, ["all"]);
  imageComposition.registerObserver(onCompositionChanged);
  await pickerEngine.initialize();
});
```

### WR-02: Observer registered at module top-level in CardInspectModal

**File:** `src/lib/features/choreo-card/components/CardInspectModal.svelte:63`
**Issue:** Same pattern as WR-01. `imageComposition.registerObserver(onCompositionChanged)` is called at script top-level. The `onDestroy` cleanup at line 64 will unregister it, but the observer fires while the component may not be fully mounted.
**Fix:** Move registration to `onMount`.

### WR-03: `cardCache.clear()` runs on every component creation in PrintPreviewPages

**File:** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte:68-69`
**Issue:** Lines 68-69 run `cardCache.clear()` and `deckCardBlobCache.clear()` at the top-level script scope. Every time PrintPreviewPages is instantiated (e.g., switching between grid and print view, or navigating between decks that both use this component), the entire in-memory and IndexedDB cache is flushed. This defeats the purpose of the caching system and forces full re-renders unnecessarily.
**Fix:** These should only run when `rerenderKey` changes (which already happens at line 193-195), not on every component mount. Remove the top-level clears:
```diff
- cardCache.clear();
- deckCardBlobCache.clear().catch(() => {});
```

### WR-04: Race condition in `handleDraw` -- async `loadSelectedSequences` runs without guard

**File:** `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte:62-66`
**Issue:** `handleDraw` calls `composeDeck` (synchronous), then `loadSelectedSequences` (async). If the user clicks "Draw" rapidly, multiple `loadSelectedSequences` calls run concurrently. Each sets `sequences` upon completion, but the intermediate state can show sequences from a previous draw while `cards` already reflects the latest draw. Same issue with `handleRedraw` at line 68-71. The `loadSelectedSequences` function has no generation/cancellation guard.
**Fix:** Add a generation counter:
```typescript
let loadGeneration = 0;

async function loadSelectedSequences() {
  const gen = ++loadGeneration;
  isLoadingSequences = true;
  try {
    // ... existing loading code ...
    if (gen !== loadGeneration) return; // stale
    sequences = cards
      .map((c) => seqMap.get(c.sequenceId))
      .filter((s): s is SequenceData => s != null);
  } catch (err) {
    if (gen !== loadGeneration) return;
    console.warn("Failed to load sequences:", err);
  } finally {
    if (gen === loadGeneration) isLoadingSequences = false;
  }
}
```

### WR-05: `composeDeck` allocation can produce fewer cards than `totalCards`

**File:** `src/lib/features/choreo-card/services/deck-composer.ts:52-92`
**Issue:** The function clamps each bucket's allocation to `pool.get(w.stepCount)?.length ?? 0` (line 69). If available sequences are fewer than the target allocation, the remainder is lost -- no redistribution to other buckets. For example, if the user requests 52 cards but one step-count bucket only has 3 sequences, the shortfall is silently dropped. The total might be 45 instead of 52 with no UI indication.
**Fix:** After the initial allocation pass, add a redistribution loop that assigns remaining slots to buckets with available capacity:
```typescript
// After initial allocation, check if we're short
let remaining = totalCards - allocated;
if (remaining > 0) {
  for (const [stepCount, entries] of pool) {
    const current = targets.get(stepCount) ?? 0;
    const available = entries.length - current;
    if (available > 0) {
      const extra = Math.min(remaining, available);
      targets.set(stepCount, current + extra);
      remaining -= extra;
      if (remaining <= 0) break;
    }
  }
}
```

### WR-06: `swapCard` uses `Math.random()` for card selection

**File:** `src/lib/features/choreo-card/services/deck-composer.ts:109`
**Issue:** `Math.random()` is not cryptographically secure. For a deck composition tool that produces physical card products, this is acceptable functionally, but the `fisherYatesSample` at line 125 and `shuffle` at line 131 also use `Math.random()`. If deck randomness ever needs to be reproducible (e.g., for re-printing the same deck), this would need a seeded PRNG. Not a bug today, but worth noting for the deck release workflow where reproducibility matters.
**Fix:** Consider accepting an optional seed parameter in `composeDeck` and using a seeded PRNG (e.g., `mulberry32`) for reproducible deck compositions.

### WR-07: `sequences[idx]!` non-null assertions in PrintPreviewPages without bounds check

**File:** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte:429,436,462,469,499,505`
**Issue:** Multiple event handlers use `sequences[idx]!` with non-null assertions. If `renderedCards` and `sequences` arrays are out of sync (e.g., during a re-render triggered by the `$effect`, where `renderedCards` is being rebuilt progressively), `idx` could exceed `sequences.length`, producing `undefined` passed to callbacks. The `!` assertion suppresses the TypeScript warning but the runtime bug remains.
**Fix:** Add bounds checking before accessing:
```typescript
onclick={() => {
  const seq = sequences[idx];
  if (!seq) return;
  onCardClick?.(seq, card.frontUrl, () => rerenderCard(idx));
}}
```

### WR-08: `ChoreoCardTab` `migrateStorageKeys` runs at module top-level (SSR risk)

**File:** `src/lib/features/choreo-card/components/ChoreoCardTab.svelte:116`
**Issue:** `migrateStorageKeys()` is called at the top-level script scope (line 116). The function itself has a `typeof window === "undefined"` guard (line 72), so it won't crash during SSR. However, all the `getPersistedNumber/Boolean/String` calls at lines 121-137 also run at top-level and also have SSR guards. The pattern works but is fragile -- if any of these guards is accidentally removed, SSR breaks. Moving all of this into `onMount` would be more robust.
**Fix:** Move `migrateStorageKeys()` and state initialization from localStorage into `onMount`, using initial defaults until hydration.

## Info

### IN-01: Unused variable `_CONTENT_HEIGHT` in PrintCardRenderer

**File:** `src/lib/features/choreo-card/services/PrintCardRenderer.ts:24`
**Issue:** `const _CONTENT_HEIGHT = MPC_HEIGHT - MPC_BLEED * 2;` is declared with an underscore prefix (acknowledging it's unused) but never referenced. Dead code.
**Fix:** Remove the line, or use it in `renderFront` if it was intended to validate content height.

### IN-02: `console.log` statements in PrintPreviewPages render pipeline

**File:** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte:191,209,212,222,233`
**Issue:** Multiple `console.log` calls with `[CardCache]` prefix are left in the render pipeline. These fire on every deck render/re-render and will produce verbose output in production.
**Fix:** Remove or gate behind a `DEV` check:
```typescript
if (import.meta.env.DEV) console.log(`[CardCache] ...`);
```

### IN-03: `handleExportPDF` in DeckBrowser has no error handling in catch

**File:** `src/lib/features/choreo-card/components/DeckBrowser.svelte:143-163`
**Issue:** `handleExportPDF` and `handleExportZIP` use `try/finally` with no `catch`. If the PDF/ZIP export throws (e.g., `pdf-lib` CSP violation noted in the comment), the error propagates as an unhandled rejection and the user sees no feedback. The `isExporting` flag resets correctly via `finally`, but no toast or error message is shown.
**Fix:** Add a catch block with `toast.error("Export failed")`.

### IN-04: `getDeckRelease` function is exported but unused

**File:** `src/lib/features/choreo-card/services/deck-release-store.ts:60-65`
**Issue:** `getDeckRelease` is exported but has no callers in the codebase. It may be intended for future use (viewing past releases).
**Fix:** No action needed if planned. Consider adding a `// TODO: used by upcoming deck release history view` comment.

### IN-05: `isDesktop` computed but unused in DeckBrowser

**File:** `src/lib/features/choreo-card/components/DeckBrowser.svelte:73-81`
**Issue:** `isDesktop` is computed via a media query listener but never referenced in the template or any derived state. The effect registers a listener, updates the state, and cleans up -- all for a value that's never read.
**Fix:** Remove the `isDesktop` state and the `$effect` that maintains it, or use it for the responsive layout differences it was presumably intended for.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
