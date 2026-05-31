# Deck Recipe — Stamp & Reuse

**Date:** 2026-05-31
**Status:** Design approved (verbal). Ready for implementation plan.
**Module:** `src/lib/features/choreo-card/` (deck releaser).

## Problem

A released deck saves its **output** (the drawn cards) but never the **recipe** (the
dials that produced it). For TnD the recipe is near-deterministic, so recipe ≈ deck.
For **LOOP** one recipe spawns many possible decks — a draw grabs only a random
subset — so the recipe is genuinely distinct information that is lost the moment you
release. You cannot re-draw "another deck like this one," and you cannot see which
configuration produced a given deck.

The configuration today lives **only** in localStorage (`deck-releaser-state.svelte.ts`
`PersistedSession`) as the *current* session draft. It is never attached to a release.

## Decision

**Recipes live only stamped on decks. No separate saved-recipe collection.**

Rejected alternatives and why:
- *Recipes-only (tear out saved decks):* breaks dedup (`getAllReleasedSequenceIds`
  is the only record of which sequences already shipped → LOOP editions would repeat)
  and breaks permanent `deckNumber` keys that printed/scanned decks in the wild rely
  on for scan/shortcodes.
- *Two first-class entities (Recipes + Decks, Browse toggle):* premature pre-release;
  introduces a curation burden ("which recipes are worth keeping") the user explicitly
  wants to avoid. Recipes would balloon.

Stamping dissolves the curation problem: every released deck **already** carries its
recipe for free, so the existing deck list doubles as the recipe library. Reuse =
grab the recipe off any deck. Nothing new to store, prune, or decide-worth-saving.

Clean migration path: if recipes ever warrant first-class status, the stamped field is
exactly the data to promote into its own collection. No wasted work.

## Design

### 1. `DeckRecipe` type + manifest field

New interface in `domain/models/DeckRelease.ts`; one optional field on `DeckRelease`.
Only the **dials** — not per-deck instance metadata, not re-derivable counts.

```ts
export interface DeckRecipe {
  deckMode: "loop" | "tnd";
  // shared transform dials
  startOriModes: ("radial" | "nonradial" | "split")[];
  gridModes: ("diamond" | "box")[];
  reversalPattern?: ResolvedReversalPattern | null;
  // LOOP-only
  weights?: { stepCount: number; weight: number }[]; // `available` intentionally dropped — re-derived live
  totalCards?: number;
  sliceTypes?: ("halved" | "quartered")[];
  variationConfig?: VariationConfig;
  // TnD-only
  tndFamilyIds?: string[];
  tndTurnPatternIds?: string[];
}
```

```ts
export interface DeckRelease {
  // …existing fields unchanged…
  /** Frozen dial-set that produced this deck. Absent on legacy manifests. */
  recipe?: DeckRecipe;
}
```

**Excluded by design:** `name` / `notes` / `description` (per-deck instance, not recipe),
`weights[].available` (live pool count, re-derived on load — storing a stale snapshot
would mislead).

### 2. Stamp at both release paths

- **UI** — `deck-release-store.ts` `releaseDeck()` gains a `recipe: DeckRecipe` param,
  written into the manifest inside the existing transaction. `DeckReleaserTab.handleConfirmRelease`
  builds the recipe from `releaserState` (a `buildRecipe(rs): DeckRecipe` helper on the
  state module — single source of truth for the dial→recipe projection, mirrors the
  shape `persist()` already serializes).
- **Script** — `scripts/release-tnd-deck.cjs` writes a deterministic TnD recipe
  (`deckMode: "tnd"`, the patterns it filtered on, default ori/grid) onto its manifest,
  so script-released decks are reusable too.

### 3. Reuse affordance

`ReleaseHistoryPanel` row gains a **"Reuse recipe"** action (icon button beside the
existing trash affordance, same hover-reveal treatment). Visible only when
`release.recipe` is present (legacy decks: hidden).

Click → `onReuseRecipe(recipe)` → `DeckReleaserTab` calls a new
`releaserState.loadRecipe(recipe)` that:
1. sets `deckMode`,
2. restores the mode-appropriate dials (weights / totalCards / sliceTypes /
   variationConfig for LOOP; family + turn-pattern id sets for TnD; shared
   startOriModes / gridModes / reversalPattern),
3. clears any composed draft + viewing state (`reset()`-like, but keeping the loaded
   dials),
4. `step = "configure"`, `persist()`.

Result:
- **LOOP** — same recipe, press Draw → a *fresh random subset* = a new deck from the
  same recipe (the "one recipe → many decks" workflow).
- **TnD** — reproduces the deterministic enumeration. Acceptable (recipe ≈ deck).

`available` counts re-derive from the live pool on the Configure mount, exactly as a
restored localStorage session does today — so a reused recipe self-heals against pool
changes.

## Out of scope (deferred, explicitly)

- **Deck lifecycle phases** (composed → printed → handed-out). Useless pre-release —
  no audience to hand decks to yet. Not built.
- **Separate recipe collection / Browse Recipes toggle.** The whole point of stamping
  is to avoid this. Only revisit if a curation use-case actually appears.
- **Scan/provenance expansion.** Scan-activity already exists; this spec doesn't touch
  it.

## Files touched

| File | Change |
|---|---|
| `domain/models/DeckRelease.ts` | + `DeckRecipe` interface, + `recipe?` on `DeckRelease` |
| `services/deck-release-store.ts` | `releaseDeck()` + `recipe` param → manifest |
| `components/deck-releaser/deck-releaser-state.svelte.ts` | + `buildRecipe()` + `loadRecipe()` |
| `components/deck-releaser/DeckReleaserTab.svelte` | build recipe on release; `onReuseRecipe` wiring |
| `components/deck-releaser/ReleaseHistoryPanel.svelte` | "Reuse recipe" row action (recipe-present only) |
| `scripts/release-tnd-deck.cjs` | stamp deterministic TnD recipe |

## Verification

- `npm run check` clean.
- Unit: extend `deck-release-store.test.ts` — `releaseDeck` round-trips `recipe`; legacy
  manifest (no recipe) loads + reuse button hidden.
- Runtime: release a LOOP deck → reuse recipe → Configure shows the same dials →
  Draw yields a different subset (proves LOOP many-from-one). Release a TnD deck →
  reuse → identical enumeration.
