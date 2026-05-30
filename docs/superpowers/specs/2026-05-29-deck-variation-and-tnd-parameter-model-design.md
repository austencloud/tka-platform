# Deck Variation + TnD Parameter Model — Unified Design

Date: 2026-05-29
Status: Approved shape, pending plan
Scope: Released-deck card variation for BOTH deck modes (LOOP + TnD), on one shared render seam.

## Why these are one project

Two efforts independently reached the same conclusion: **a turn (or reversal) is a transform applied at render time, never a materialized stored sequence.**

- **LOOP variation** (random per-card recipes: book reversals + turn patterns) needs to freeze a recipe per card and re-cook it at view time, because the transformed sequence exists in no catalog.
- **TnD enumeration** currently materializes 49 separate Firestore decks (1 base + 48 duplicates with renamed sequence ids) to represent the 7×7 turn grid. That duplication is the source of a live count/render bug (asymmetric decks' `families[].sequenceIds` point at base ids absent from their own subcollection; `getTnDFamilyOptions` dedups them away). The fix is the same mechanism: stop materializing, apply the turn at render.

Both funnel through the same code (`applyPattern`, `loadDiamondEdges`) and the same seam (`DeckReleaserTab.loadSelectedSequences`). Building them separately would clobber that seam and the card model. Building them together yields one descriptor type, one seam, one cache rule.

## Existing code this reuses (do not rebuild)

- `applyPattern(pattern, seq, "both")` — `$lib/shared/create/services/turn-pattern-manager`. Applies per-beat turns + propagates forward orientation. Already run live for LOOP draws at `deck-variation.ts:232`.
- `transformSequence(seq, resolvedReversal, edges)` — `reversal-seed-service.ts:79`. Flip motionType/rotationDirection on reversed hands, re-derive letters, recompute orientation chain.
- `applyVariation(seq, config, edges, rng)` — `deck-variation.ts:186`. Current one-shot roll+apply (test page uses it).
- `loadDiamondEdges()`, `lookupLetter(edges, …)` — `pictograph-letter-lookup`. Cached; cheap at view time.
- `loopCloses(seq)` — `deck-variation.ts:170`. Per-hand closure check for the broken-loop badge.
- `parseTurnPattern("B|R")` — `turn-pattern-parser.ts:8`. `TURN_VALUES = [0,0.5,1,1.5,2,2.5,3]` → 7×7 = 49 cells.
- `TnDTurnMatrix.svelte` — already generalized to select mode (presets: Select All / Whole Turns / Matched / Clear).

## Architecture

### 1. Shared descriptor (`domain/models/DeckRelease.ts`)

One optional field on `DeckReleaseCard`, backward compatible (absent → renders base, exactly as today):

```ts
interface CardVariation {
  reversalPatternId?: string;   // "long-book"        (LOOP only)
  reversalSequence?: string;    // "RRRR" raw pattern  (LOOP only, re-resolved at apply)
  turnPattern?: string;         // "1|1-0|0" tiled, OR "1|2" single uniform unit
  turnLabel?: string;           // "Pulse 1" / "3|3"
}
// DeckReleaseCard gains:  variation?: CardVariation
```

`turnPattern` format unifies both producers: LOOP emits tiled per-beat strings (`"1|1-0|0"`); TnD emits a single uniform unit (`"1|2"`) which `parseTurnUnit` tiles to every beat. Same field, both valid. **No parallel `card.turnPattern` field.**

### 2. Engine split (`deck-variation.ts`)

Split the current one-shot into roll (compose time, sequences not loaded yet) + deterministic cook (load seam):

- `rollVariation(stepCount, config, rng): CardVariation | null` — pure pick. `pickReversal`/`pickTurnPattern` already need only `stepCount`. Returns the frozen recipe. **LOOP only.**
- `applyVariationDescriptor(seq, variation, edges): { sequence, turnLoopClosed }` — deterministic cook from a stored descriptor. Reversal (if present) via `transformSequence`, then turns via `applyPattern`. Runs at the seam for BOTH modes. **Must work turn-only** (no reversal) — that is the TnD path.
- Keep `applyVariation` as a thin `roll → apply` wrapper so the test page is untouched.

### 3. The one render seam (`DeckReleaserTab.loadSelectedSequences`, :192)

This is the single function every render path funnels through (live preview, redraw, released-deck re-view, reprint). Rewrite to:

1. Collect **distinct base seq ids** across cards; `loadSequencesByIds` once (TnD loads 3 base seqs, not 147 — dedup mandatory).
2. `edges = await loadDiamondEdges()` (cached) only if any card has a variation.
3. Per card: if `card.variation`, `applyVariationDescriptor(baseSeq, card.variation, edges)` → use the variant; else use base.
4. **Build `rs.sequences` POSITIONALLY (by card index), not via `seqMap.get(c.sequenceId)`.** The current id-map (:210-211) silently collapses cards that share a base id — fine for LOOP (unique base per card), broken for TnD (147 cards over 3 base ids). Positional serves both.

`handleSwapCard` (:220) and released-deck rehydrate (:296) follow the same per-card apply rule.

### 4. Cache key folds in the descriptor

The rasterizer content-hash cache key MUST include the variation descriptor (reversal id + turnPattern). Two cards sharing a base id but differing in turns/reversal must not collide in cache. Required by both modes.

### 5. Compose — split by mode (`composeFullDeck`, :170)

Already branches on `rs.deckMode`:

- **LOOP branch:** after `composeDeck()`, map cards → attach `rollVariation(card.stepCount, rs.variationConfig, Math.random)`. `deck-composer.composeDeck` stays variation-free (pure). Redraw re-rolls; swap rolls fresh.
- **TnD branch:** `buildTnDCards` returns the cartesian product (below). Each card carries `variation.turnPattern` deterministically. No roll.

### 6. TnD composer — cartesian product (`deck-composer.ts`)

- `getTnDFamilyOptions(catalogs)`: read **only the zero-turn base catalog(s)** (`l1-tnd-motions`). Drop the cross-deck merge + dedup hack (:236-258). Each family = its base seq ids; `sequenceCount` = base count (e.g. 3 for tog-same).
- `getTnDTurnPatternOptions`: derive the 49-cell grid from `TURN_VALUES²` directly, not from counting deck `totalSequences`. Every cell always offerable.
- `buildTnDCards(families, selectedFamilies, selectedTurnPatterns)`: cartesian —
  ```
  for fam in selectedFamilies:
    for pattern in selectedTurnPatterns:
      for baseSeq in fam.entries:
        emit {
          sequenceId: baseSeq.id,            // base id
          sourceCatalogId: baseCatalogId,    // base catalog
          variation: { turnPattern: pattern, turnLabel: label },
          word: baseSeq.word, stepCount, position: 0,
          footer: tndFooter(fam.familyId, …),
        }
  ```
  Count = `selectedFamilyBaseSeqs × selectedPatterns`. Exact, dynamic, free. Bug gone by construction.

### 7. Counts on buttons

- Draw button: `tndCardCount` already = `buildTnDCards(...).length` → correct automatically.
- Family button: show `famBaseSeqs × selectedPatterns.size` (dynamic, reflects selection), not a static total.

### 8. Browser surface (couples to teardown)

`tnd-family-aggregator.ts` loads symmetric materialized decks and groups by ratio (`:11` filters `!asymmetric`). Deleting those decks breaks it. Same change: aggregator sources the base catalog and applies each selected ratio's pattern via `applyVariationDescriptor` at load — ratio groups become `{ ratio, applyPattern(base) }`. Unifies both surfaces on one source.

### 9. LOOP variation UI (`ConfigureStep` LOOP branch)

New "Variation" control group below Step Count Mix, mirroring the weight-slider UX:
- **Reversal** — frequency slider (0–100%) + enabled toggles: Book / Long Book / Alternating (button + selected-state, NO checkboxes).
- **Turns** — frequency slider + enabled toggles: Hold 1, Pulse 1, Trade 1, ½/1 Trade, Wave 2·1 (button title = pattern string).
- **Intensity presets** — Clean / Sprinkle / Spicy (preset-btn row).
Backed by `rs.variationConfig` (new `$state`, persisted in session). Reuse existing ConfigureStep button/slider styles.

### 10. Closure flag (free, both modes)

`applyVariationDescriptor` returns `turnLoopClosed`. Surface a per-card "loop breaks" badge in Review; do not block. Redraw (LOOP) or deselect pattern (TnD) to clear.

## Sequencing (phases)

1. **Shared foundation:** `CardVariation` descriptor + model field; engine split (`rollVariation` / `applyVariationDescriptor` / wrapper); rewrite the seam (positional + descriptor apply); cache key includes descriptor.
2. **LOOP variation:** `rollVariation` wiring in `composeFullDeck` LOOP branch; `ConfigureStep` variation UI + `rs.variationConfig`; Review badge.
3. **TnD parameter model:** `getTnDFamilyOptions` base-only; `getTnDTurnPatternOptions` from `TURN_VALUES²`; `buildTnDCards` cartesian emitting `variation.turnPattern`; family-button dynamic count.
4. **Browser unify:** `tnd-family-aggregator` sources base + applies ratio patterns.
5. **Teardown (destructive, explicit confirm at this point only):** delete the 48 materialized + asymmetric Firestore decks; delete `scripts/seed-tnd-asymmetric-decks.cjs` and `scripts/seed-tnd-turn-decks.cjs`. Phases 1–4 leave them orphaned-but-harmless until then.

## Other render paths

If a public gallery / QR-scan view loads released decks outside `DeckReleaserTab`, it needs the same re-apply. Grep `DeckRelease` consumers during implementation and route them through the shared `applyVariationDescriptor` helper.

## Out of scope

- QR efficient round-trip encoding of variant sequences (descriptor stays tiny; this is moot under Option A).
- Non-uniform per-beat TnD turns (TnD uses uniform units only; the descriptor field supports tiled if ever needed).
