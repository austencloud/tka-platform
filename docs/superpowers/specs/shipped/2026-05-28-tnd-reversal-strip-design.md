# TnD By-Family Reversal Strip + Live Seed

**Date:** 2026-05-28
**Status:** Design — awaiting review

## Problem

The TnD "By Family" browse view shows six elemental family hero cards (Split-Same/Water, Tog-Same/Earth, Quarter-Same/Sun, Split-Opp/Fire, Tog-Opp/Air, Quarter-Opp/Moon). Above them, in `CatalogBrowseFilterBar`, sits a flat row of reversal-pattern filter chips (Continuous, Book, Red Book, Blue Book, Long Book, Alternating). Two issues:

1. The chip row is a coarse, multi-select filter detached from the family cards. It can't express a *custom* reversal pattern — only the six named presets that happen to be seeded.
2. There's no way to tune a reversal pattern per-step the way the `reversal-pattern-playground.html` prototype demonstrated. That interactive per-step timeline never made it into the app.

In By-Family mode every sequence is exactly **4 steps long**, so a full per-step reversal selector is compact (two rows × four cells) and belongs directly under the family cards as the scene's secondary control.

## Key Insight

A reversal pattern is orthogonal to the TnD family and turn ratio (established in `2026-03-26-reversal-pattern-deck-expansion-design.md`). The six named presets are already seeded for the 4-step symmetric base catalogs, so they filter to real data instantly. The interesting new capability is **arbitrary 4-step patterns**: there are 64 clean-loop 4-step patterns (8 even-count blue masks × 8 even-count red masks), of which only 6 are named/seeded. Selecting an unseeded clean pattern is the trigger to **seed it live** — generate the variant catalogs by transforming the already-enumerated base sequences, no DFS re-enumeration required.

## Scope

**In scope:**
- Interactive per-step reversal strip under the six family cards (4-step, blue/red).
- Removing the old reversal-pattern chip row from `CatalogBrowseFilterBar`.
- Single-active-pattern filter wiring driving `filters.reversalPatterns`.
- Live client-side seeding of an unseeded clean pattern: transform base sequences, recompute letters + orientations, validate loop boundary, write materialized variant catalogs to Firestore.
- Empty-state → "Seed it" CTA with progress, repopulating cards on completion.

**Out of scope:**
- Solo/Weave families (period 8/16/32) — incompatible with 4 steps; never appear here.
- LOOP-collection reversal browsing (separate, already shipped pipeline).
- Bulk/offline seeding of all 58 unseeded patterns — this design seeds on demand, one pattern per click.

## Architecture

### Component 1 — `TnDReversalStrip.svelte`

A faithful 4-step port of `reversal-pattern-playground.html`, trimmed for in-app use.

**Renders:**
- A **preset quick-row**: six chips (Continuous / Book / Red Book / Blue Book / Long Book / Alternating) sourced from `SIMPLE_PATTERNS` in `domain/reversal-patterns.ts`. Clicking one seeds the grid state. The active chip highlights; editing a cell switches the active label to "Custom".
- A **timeline grid**: two labeled rows (Blue / Red) × four step cells. Each cell is a toggle button (`role="switch"`, `aria-pressed`) — no checkboxes. Active = reversal at that step. Each cell shows a spin-direction arrow (↻/↺) reflecting the *cumulative* reversal parity up to that step (per the playground's `getSpinDirection`) and a "REV" marker when active.
- A **pattern string**: the four-character `P/B/R/—` encoding, color-coded (pair / blue-only / red-only / none).
- A **boundary validity badge**: even reversal count per hand → "Clean loop boundary"; odd count on either hand → "Boundary discontinuity (blue/red)". Odd patterns are flagged and cannot be applied (see filter wiring).

**Drops from the playground:** the Stats grid, the Prompt box, and the step-count selector (fixed at 4) — those were prototype/dev tooling.

**State:** `blue: boolean[4]`, `red: boolean[4]`. Pure local `$state`; emits the resolved pattern via callback `onPatternChange(resolved: ResolvedReversalPattern)`.

**Props:**
```ts
interface Props {
  familyCounts: Record<string, number>;   // live per-family count for the active pattern, for dimming
  activePatternId: string | null;
  onPatternChange: (resolved: ResolvedReversalPattern) => void;
}
```

### Component 2 — Pattern resolution (`domain/reversal-transform.ts`)

A shared TS module (covered by unit test) that ports the proven logic in `scripts/apply-reversal-pattern.cjs`:

```ts
type ReversalMotion = "pro" | "anti" | "static" | "dash";

function applyReversalToMotion(motion: ReversalMotion, reversed: boolean): ReversalMotion;
// pro↔anti flip when reversed; static & dash unchanged (no rotation to reverse at L1)

function getReversalFlagsForBeat(sequence: string, beat: number): { blueReversal: boolean; redReversal: boolean };
// reads sequence[beat % sequence.length], maps P/R/B/-

interface ResolvedReversalPattern {
  id: string;            // named preset id ("book") OR the 4-char string for customs ("PR-B")
  label: string;         // "Book" | "Custom"
  sequence: string;      // 4-char P/B/R/- string
  isNamed: boolean;
  isCleanLoop: boolean;  // even reversal count per hand
}

function resolvePattern(blue: boolean[], red: boolean[]): ResolvedReversalPattern;
// builds the 4-char string, detects whether it tiles a named SIMPLE_PATTERNS entry, computes clean-loop validity
```

Custom pattern id = the raw 4-char string (`"PR-B"`). This is the value stored in the catalog's `reversalPattern` field and matched by the filter. Named presets keep their existing ids.

### Component 3 — Filter wiring

The strip holds **one** active pattern, replacing the multi-select chip behavior for reversal. On `onPatternChange`:
- If `isCleanLoop` is false → flag in the badge, do **not** apply (leave filter as-is). A broken-loop pattern can't produce valid sequences.
- Else set `filters.reversalPatterns = [resolved.id]` (single element). Continuous (`----`) maps to `"continuous"`.

`applyFilters` already filters catalogs by `reversalPattern`, and `filteredCatalogs` feeds both the family grid counts and the drilldown — so counts and drilldown restrict automatically with no further wiring. `catalog-browse-state` gains a `setReversalPattern(id: string)` helper that assigns the single-element array (clearer intent than `toggleFilter`).

`familyCounts` for the strip's dimming come from the same `filteredCatalogs`, grouped by family (reusing the `materializedCatalogs` logic already in `TnDFamilyGrid`).

### Component 4 — Live seed (`services/reversal-seed-service.ts`)

When `filteredCatalogs` is empty for a clean active pattern, the empty state offers "Seed it". Seeding mirrors `scripts/seed-reversal-decks.cjs` but runs client-side, reusing the browser's existing capabilities:

1. **Load base sequences** — the symmetric materialized turn-ratio base catalogs (those with `asymmetric !== true`), via `catalog-loader`'s `loadCatalogSequences`. One base catalog per turn value.
2. **Transform** — for each sequence, for each of the 4 steps, read `getReversalFlagsForBeat(pattern, step)` and apply `applyReversalToMotion` to each hand's motion type; set `blueReversal`/`redReversal` flags on the step.
3. **Recompute letters** — via the existing client CSV pictograph query (`MotionQueryHandler` / `LetterQueryHandler`, backed by `CsvLoader`), look up the letter for each transformed step's `(blueMotion, redMotion, locations, gridMode)`. (The 3-entry `tka-glyph/letter-deriver.ts` is a start-position stub and is **not** used here.)
4. **Recompute orientations** — run the orientation propagator over the transformed steps (post-transform, per the shipped spec's known-issue note that orientations must be recomputed after reversal).
5. **Validate loop boundary** — drop any sequence whose recomputed end state doesn't reconnect to its start. For uniform-turn 4-step the even-count rule guarantees this is a no-op, but the filter stays for safety.
6. **Write catalogs** — for each base turn-ratio catalog, write a materialized variant `{baseId}-{patternId}` with `reversalPattern: patternId`, the six families, and the transformed sequence docs. Uses the same Firestore client-write path the deck-releaser already uses.
7. **Refresh** — invalidate the catalog cache, reload catalogs, clear the empty state. Cards repopulate.

Variant catalogs **materialize** their own sequence docs (letters change G→H under reversal, so they are not references to base seqIds).

One seed click writes up to N catalogs (N = number of seeded turn-ratio base catalogs, currently the 7 symmetric ratios), each with its families' transformed sequences.

### Component 5 — Empty state + layout

- **`TnDFamilyGrid.svelte`**: host the strip beneath the cards inside the centered stage. Relax `.family-stage` `min-height` from `calc(100vh - 200px)` to `auto` with comfortable top padding, so the six cards plus the strip read as the scene together rather than the cards alone filling the viewport.
- **Empty state**: when the active clean pattern has zero catalogs, family cards dim to "0 sequences" and an inline panel under the strip shows the resolved pattern + a "Seed it" button. During seeding the button shows progress (catalogs written / total). On completion the panel clears and counts refresh.

## Data Flow

```
TnDReversalStrip (blue[], red[])
  → resolvePattern() → ResolvedReversalPattern
  → onPatternChange
      → if !isCleanLoop: badge flag, stop
      → else catalog-browse-state.setReversalPattern(id)
          → filters.reversalPatterns = [id]
          → filteredCatalogs (existing derived)
              → TnDFamilyGrid counts + familyCounts dimming
              → TnDFamilyDrillDown sequences
          → if filteredCatalogs empty → empty-state "Seed it"
              → reversal-seed-service.seed(pattern)
                  → load base seqs → transform → letters → orientations
                  → validate → write variant catalogs → refresh
```

## Files

**New:**
- `src/lib/features/choreo-card/components/TnDReversalStrip.svelte`
- `src/lib/features/choreo-card/domain/reversal-transform.ts`
- `src/lib/features/choreo-card/services/reversal-seed-service.ts`
- `tests/unit/reversal-transform.test.ts` (mirrors `reversal-pattern-transform.test.ts`, asserting the TS port matches the CJS behavior)

**Edited:**
- `src/lib/features/choreo-card/components/TnDFamilyGrid.svelte` — host strip, relax hero min-height, pass `familyCounts`
- `src/lib/features/choreo-card/components/CatalogBrowser.svelte` — own the active-pattern state, render the seed empty state, wire `setReversalPattern`
- `src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte` — remove the reversal-pattern chip row
- `src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts` — add `setReversalPattern(id)` helper

**Reused (not modified):**
- `domain/reversal-patterns.ts` (`SIMPLE_PATTERNS`, pattern defs)
- `services/catalog-loader.ts` (`loadCatalogSequences`, cache invalidation)
- `MotionQueryHandler` / `LetterQueryHandler` / `CsvLoader` (letter recompute)
- orientation propagator
- deck-releaser's Firestore client-write path

## Testing

- **Unit (`reversal-transform.test.ts`):** the TS port of `applyReversalToMotion`, `getReversalFlagsForBeat`, `resolvePattern` matches the CJS reference for all 6 simple patterns + representative customs; clean-loop detection correct for even/odd counts; named-preset detection (`PPPP`→book, `RBRB`→alternating, etc.).
- **Manual (browser):** select each of the 6 presets → family counts match the prior chip-filter counts. Tune a custom even-count pattern with no data → empty state appears → "Seed it" writes catalogs → cards repopulate with correct counts and the drilldown renders the transformed sequences. Tune an odd-count pattern → validity badge flags, filter not applied.

## Risks

1. **Firestore security rules** — the client seed writes catalog + sequence docs. Before claiming seed works, confirm the rules permit the authenticated client write the seed performs, matching the deck-releaser's existing allowed path. If rules block client catalog writes, fall back to gating seed behind the same auth/role the deck-releaser requires.
2. **Letter recompute fidelity** — the client CSV query must produce the same letters the CJS enumerator's CSV produces. The unit test pins the transform; an in-browser spot-check against a known seeded pattern (e.g. re-deriving `book` and comparing to the already-seeded book catalog) verifies parity before trusting custom seeds.
3. **Orientation recompute** — the shipped spec flagged that orientations were computed pre-reversal in the `--out` JSON path. The client seed must recompute orientations *after* the transform; the boundary-validation step is the guard.
