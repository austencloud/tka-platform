# Deck Releaser — Draft Persistence + Release Dedup + Config Persistence

Date: 2026-05-30
Status: Implemented

## Problem

1. **HMR/refresh wipes a composed deck.** `releaserState` is a module singleton.
   A Vite HMR re-eval (or a full refresh / tab reopen) re-runs the constructor →
   `cards = []`. `persist()` saved `step` but never `cards`, so the reload landed
   on `step:"review"` with an empty deck — the generated deck vanished instantly.

2. **No release dedup.** Re-composing a deck that already exists as a release
   gave no signal. The user could unknowingly recreate a twin of an existing
   release and never built the association between a fresh draw and its
   already-released equivalent.

3. **Configure-step dials not persisted.** Only `deckMode`, `totalCards`,
   `notes`, `variationConfig`, start-orientation, grid, and reversal were
   persisted. The TnD family selection, turn-pattern selection, slice-type
   filter, and step-count weights were not — so going Back to the catalog (or
   refreshing) reset those dials to defaults. Several config handlers also never
   called `persist()` at all.

## Decisions

- **Persistence durability:** `localStorage` (survives full tab/browser close),
  replacing the prior `sessionStorage`. A composed draft and the catalog config
  are never lost until released or a new deck is started.
- **Match scope:** order-independent. Two decks with the same set of
  `(sourceCatalogId, sequenceId, variation)` cards hash equal regardless of
  shuffle/position.
- **Bounce UX:** auto-navigate into the matched release (read-only) plus an
  info toast `This deck already exists as Deck #NNN`.
- **Config persistence trigger:** a single component `$effect` that calls
  `rs.persist()`. Because `persist()` runs inside the effect, it reactively
  tracks every field it serializes — any catalog change is saved without each
  handler having to remember to persist.

## Design

### Part A — Draft persists

- Storage switched to `localStorage` in `deck-releaser-state.svelte.ts`.
- `PersistedSession` gains `cards?: DeckReleaseCard[]`.
- `persist()` writes `cards` only while composing fresh
  (`this.viewingRelease ? undefined : this.cards`).
- Constructor restores `this.cards` when `saved.cards?.length` and
  `saved.viewingDeckNumber == null`.
- `DeckReleaserTab.onMount` calls a new `restoreDraftDeck()` after
  `restoreViewedRelease()` (both load paths). It re-derives `sequences` (heavy
  `SequenceData`, never stored) from the light card recipes via the existing
  `loadSelectedSequences()`. No-op when viewing a release or when a draw already
  populated sequences this session.
- `handleSwapCard` calls `rs.persist()` so a manual swap survives reload.

### Part B — Release dedup

- `hashDeckContent(cards)` added to
  `src/lib/shared/foundation/services/content-hasher.ts`, reusing the existing
  FNV-1a 128-bit `hash128`. Each card → `sourceCatalogId|sequenceId|<variation>`
  with variation keys sorted; identity strings sorted before joining → fully
  order-independent. A structural `DeckCardIdentity` keeps `shared/` free of a
  dependency on the choreo-card feature type.
- `DeckReleaserTab` holds `releaseHashes = $derived.by(...)` mapping each
  release's content hash → release; rebuilds as releases load / one is added.
- `bounceIfDuplicate()`: hashes `rs.cards`, and on a hit toasts + calls
  `handleSelectRelease(match)` and returns `true`. Called in both `handleDraw`
  and `handleRedraw` right after `composeFullDeck()`, before the fresh-review
  path.

### Part C — Configure-step persistence

- `PersistedSession` gains `sliceTypes`, `tndFamilyIds`, `tndTurnPatternIds`,
  `weights`.
- `persist()` serializes all four (Sets spread to arrays). Constructor restores
  them.
- `weights` carry a subtlety: `rebuildPool()` re-derives `available` counts from
  the live pool. It now overlays the user's restored/edited weight *values* onto
  the fresh list (keyed by `stepCount`) so a rebuild never resets the dials.
- `DeckReleaserTab` adds a single top-level `$effect(() => { rs.persist(); })`.
  It tracks every field `persist()` reads, so all catalog modifications persist
  automatically — replacing the need to add `persist()` to each handler.

## Files

- `src/lib/shared/foundation/services/content-hasher.ts` — `+hashDeckContent`
- `src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts`
  — localStorage, `cards` + config fields, restore + persist
- `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`
  — `releaseHashes`, `bounceIfDuplicate`, `restoreDraftDeck`, weight-preserving
  `rebuildPool`, auto-persist `$effect`, swap persist

## Reuse

- Hash: reused `hash128` in `content-hasher.ts` (no new hasher).
- Persistence: extended the existing `PersistedSession` mechanism (no new store).
- No new components.

## Verification

- `npm run check`: zero type/svelte errors in the three touched files.
- Runtime (draw → refresh → Back-to-configure shows restored dials; duplicate
  draw bounces into existing release) requires a browser pass.
