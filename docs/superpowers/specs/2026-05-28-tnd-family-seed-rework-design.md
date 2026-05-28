# TnD By-Family Seed Rework

**Date:** 2026-05-28
**Status:** Design — approved, awaiting spec review

## Problem

The TnD "By Family" reversal strip shipped, but the seed UX is broken in three ways:

1. **Existing named-pattern variants have broken family data.** Live Firestore audit: base continuous decks (`l1-vtg-motions`, `vtg-2to1-motions`) carry the proper six families (`split-same`, `tog-same`, `quarter-same`, `split-opp`, `tog-opp`, `quarter-opp`). The seeded reversal variants (`-book`, `-red-book`, `-blue-book`, `-long-book`, `-alternating`) collapse all 19 sequence ids under a single `{id:"unknown"}` family. The By-Family grid matches `theme.familyId` against `family.id`, so "unknown" never matches → every family card reads **0 sequences** for those patterns. The old CJS seed script (`scripts/seed-reversal-decks.cjs`) flattened the families during its `handPathFamily` re-derivation.

2. **Seed can never trigger for named patterns.** `needsSeed` keys on `filteredCatalogs.length === 0`. The broken named variants exist (length > 0), so seeding is never offered, yet cards show 0 — a dead end.

3. **The seed flow doesn't match the user's mental model.** The shipped design used a separate "Seed it" panel below the strip. The user wants: pick a reversal pattern in the strip, then click an element (family card), and have it seed that pattern's decks if they don't exist — driven by the element click, with visible progress.

The page also hugs the top of the viewport instead of centering.

## Key Insight

The broken variants are **not** missing sequences — they list all 19 seq ids, just grouped under one `unknown` family. Reversal preserves which sequence belongs to which hand-path family (reversal flips prop spin, not hand path). So the data fix is purely **rebuilding the `families` array** by copying it from each variant's base continuous catalog. No sequence re-transform needed.

## Scope

**In scope:**
- One-time migration: rebuild `families` on the 10 broken variant catalogs from their base continuous catalogs.
- Existence detection keyed on six-family data, not catalog presence.
- Family-card click drives seed-if-needed, then drills in.
- Live seed progress on the clicked card; other cards disabled during the write.
- Center the family stage vertically.
- Remove the separate seed-panel snippet.

**Out of scope:**
- Changing the strip component itself (works correctly).
- The transform/letter/orientation seed pipeline (Task 3 client service is correct — it preserves the six families verbatim).
- Bulk-seeding all 58 unseeded custom patterns (still on-demand, one pattern per click).

## Architecture

### Component 1 — One-time migration (`scripts/reseed-tnd-family-variants.cjs`)

A Node script using firebase-admin (same pattern as `scripts/seed-reversal-decks.cjs`):

1. Query `decks` where `collection == "TnD"`.
2. Build a map: base continuous catalog id → its `families` array (only catalogs with `asymmetric !== true` and a real six-family structure, i.e. family ids in the known six, qualify as a source).
3. For each variant catalog whose `families` is a single `{id:"unknown"}` (or otherwise lacks the six family ids), find its base via `sourceDeck` (falling back to stripping the `-{patternId}` suffix from its id), and overwrite `families` with the base's six-family array.
4. Firestore `update({ families })` per doc. Idempotent — re-running is a no-op once fixed.
5. Log each rewrite (`{id}: unknown → 6 families`) and a final count.

Expected: 10 catalogs rewritten (`l1-vtg-motions-{5 patterns}` + `vtg-2to1-motions-{5 patterns}`).

The script does NOT touch sequence docs (they are correct) and does NOT touch base or asymmetric catalogs.

### Component 2 — Existence detection (`CatalogBrowser.svelte`)

Replace the `needsSeed` derivation. A pattern needs seeding when it is a clean, non-continuous pattern whose active filter yields **zero matching family data across all six themes** — not merely zero catalogs.

```ts
// familyStats-equivalent total for the active filtered catalogs
const activeFamilySequenceTotal = $derived(
  browseState.filteredCatalogs
    .filter((c) => c.asymmetric !== true)
    .reduce((sum, c) => sum + TND_FAMILY_KEYS.reduce(
      (s, key) => s + ((c.families ?? []).find((f) => f.id === key)?.sequenceIds.length ?? 0), 0), 0),
);

const needsSeed = $derived(
  activeReversal?.isCleanLoop === true &&
    activeReversal.id !== "continuous" &&
    activeFamilySequenceTotal === 0,
);
```

This is true for custom unseeded patterns (no catalogs at all) and would also be true for any still-broken named pattern (its only family is `unknown`, which is not one of the six keys) — so detection is correct even before migration runs, and the migration just makes it stop firing for named patterns.

### Component 3 — Family-card click drives seed (`CatalogBrowser.svelte` + `TnDFamilyGrid.svelte` + `TnDFamilyCard.svelte`)

The family-card click handler becomes seed-aware. Flow on click of family `id`:

```ts
async function handleSelectFamily(familyId: string) {
  if (needsSeed && activeReversal && !isSeeding) {
    isSeeding = true;
    seedingFamilyId = familyId;
    seedError = "";
    try {
      await seedReversalPattern(tndMaterializedCatalogs, activeReversal, (p) => { seedProgress = p; });
      const { loadCatalogs } = await import("../services/catalog-loader");
      await loadCatalogs();           // refresh cache → parent reloads `catalogs` prop
      toast.success("Pattern seeded.");
    } catch (err) {
      seedError = `Seed failed: ${err instanceof Error ? err.message : err}`;
      toast.error("Seeding failed.");
      return;                          // stay on grid; surface error
    } finally {
      isSeeding = false;
      seedingFamilyId = null;
      seedProgress = { written: 0, total: 0 };
    }
  }
  activeTnDFamilyId = familyId;        // drill in (after seed, data now exists)
}
```

Notes:
- Seeding one family seeds the **whole pattern** (all base turn-ratio catalogs, all six families) because `seedReversalPattern` writes every base variant at once. Clicking any card therefore makes "everything exist," then opens the clicked family.
- `tndMaterializedCatalogs` = `tndCatalogs.filter((c) => c.asymmetric !== true)` (the base continuous catalogs are the seed source).
- The separate `{#snippet seedPanel()}` and its props are removed; `seedPanel` is dropped from `TnDFamilyGrid` and `CatalogBrowseGrid`.

### Component 4 — Live progress + disabled state (`TnDFamilyGrid.svelte`, `TnDFamilyCard.svelte`)

`TnDFamilyGrid` receives `isSeeding`, `seedingFamilyId`, `seedProgress`, and `needsSeed`, forwarding per-card flags:

- The card matching `seedingFamilyId` shows an inline spinner + `Seeding {written}/{total}` text over its footer.
- While `isSeeding`, all cards get `disabled` + `aria-busy` so the UI reads active, not frozen. The `seedReversalPattern` progress callback fires per catalog write (≈10 increments), so the count visibly advances.
- When `needsSeed` and not seeding, cards carry a subtle "Tap to seed" hint in place of the `0 sequences` stat, signaling the click will create data.

`TnDFamilyCard` gains optional props: `seeding?: boolean`, `seedProgress?: {written:number; total:number}`, `disabled?: boolean`, `needsSeed?: boolean`. Pure presentational; no new state.

### Component 5 — Centered layout (`TnDFamilyGrid.svelte`)

`.family-stage`: `min-height: calc(100vh - 160px)`, `justify-content: center` (restored from the top-aligned `min-height:auto`). Keep `flex-direction: column`, `align-items: center`, `gap: 28px`. The mobile breakpoints keep the relaxed `min-height: 0` to avoid forcing tall empty space on short screens.

## Data Flow

```
strip → onPatternChange → handlePatternChange
   → setReversalPattern(id|null)
   → filteredCatalogs recompute → familyStats counts + needsSeed
click family card → handleSelectFamily(id)
   → if needsSeed: seedReversalPattern (progress → seedProgress, cards disabled)
                   → loadCatalogs() refresh → counts repopulate
   → activeTnDFamilyId = id → drilldown
```

## Files

**New:**
- `scripts/reseed-tnd-family-variants.cjs` — one-time migration

**Edited:**
- `src/lib/features/choreo-card/components/CatalogBrowser.svelte` — seed-aware family select, new `needsSeed`, progress state, remove seedPanel snippet
- `src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte` — drop `seedPanel`, forward seed-progress props
- `src/lib/features/choreo-card/components/TnDFamilyGrid.svelte` — center stage, forward per-card seed flags, drop seedPanel
- `src/lib/features/choreo-card/components/TnDFamilyCard.svelte` — seeding/disabled/needsSeed presentational props

**Reused (not modified):**
- `services/reversal-seed-service.ts` (`seedReversalPattern`, `SeedProgress`) — already preserves six families
- `domain/reversal-transform.ts`, `services/pictograph-letter-lookup.ts`
- `state/catalog-browse-state.svelte.ts` (`setReversalPattern`, `filteredCatalogs`)

## Testing

- **Migration:** run the script against the live project; assert it reports 10 rewrites; re-run and assert 0 (idempotent). Verify via Firebase MCP that `l1-vtg-motions-book.families` has the six ids.
- **Manual (browser):** After migration, By Family → select Book → six cards show counts > 0 (matching the base's per-family counts). Select a custom even-count pattern with no data → cards show "Tap to seed" → click Water → progress advances 1→10 → cards repopulate → drilldown opens Water. Odd-count pattern → strip badge flags discontinuity, cards unchanged, no seed. Continuous → base counts. Page is vertically centered.

## Risks

1. **Migration source mapping.** A variant's base must be resolvable. Primary key is `sourceDeck`; the broken `l1-vtg-motions-*` docs may lack `sourceDeck`, so fall back to stripping the trailing `-{patternId}` from the doc id and matching a base whose id is the remainder. Validate both resolve before writing; skip + warn on any unresolved doc rather than writing bad data.
2. **Client seed Firestore rules.** The on-click seed writes catalog + sequence docs from the browser, same path the deck-releaser uses. If rules reject the write, `seedError` surfaces it and the grid stays put. Confirm during manual verification.
3. **Seed latency.** A full pattern seed writes ~10 catalogs + their sequence docs. The per-catalog progress callback keeps the UI live; cards are disabled (not frozen) for the duration.
