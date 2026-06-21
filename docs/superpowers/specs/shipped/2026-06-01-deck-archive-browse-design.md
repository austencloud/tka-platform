# Deck Archive + Two-Section Browse — Design

**Date:** 2026-06-01
**Status:** Approved (brainstorm) → ready for implementation plan
**Module:** `src/lib/features/choreo-card` (deck releaser)

## Problem

Generating a LOOP deck does not persist its contents. `deck-releaser-state`
keeps only the *current* draft in `localStorage` (light card recipes; sequences
re-derived on load), and the next Generate/Redraw overwrites it. Only **released**
decks are durable (Firestore, `deck-release-store`). The per-generation
**reference number** is just a label — no contents are stored against it. And
LOOP generation is **unseeded** (`Math.random` in the engine), so the saved
recipe cannot reproduce a deck's exact cards.

Consequence: if you generate a deck, don't release it, then generate again, the
first deck — and its specific backs — is gone forever.

## Goal

A durable, local archive of **every** generated deck, and a Browse surface with
**two sections — Generated · Released** — so any past deck can be re-opened and
its exact cards/backs recovered (re-rendered, printed, exported, or released).

## Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| What/when to archive | **Auto-save every generation, no cap.** Manual Delete per entry. |
| Where | **Local IndexedDB** (this browser). Not cloud — no-cap auto-save would cost per Firestore write and a 300-card deck exceeds Firestore's 1MB/doc limit. |
| Fidelity | **Full `SequenceData`** stored (gen is unseeded → recipe can't reproduce). |
| Browse shape | **Two sections in the existing panel** (extend `ReleaseHistoryPanel`'s surface), not a new tab or modal. |

**Out of scope (explicitly):** cross-device sync, list thumbnails (text rows
only; Open re-renders), in-place editing of an archived deck, auto-pruning.

## Architecture

### Storage — `deck-archive-store.ts` (new service)

Raw IndexedDB, mirroring `DeckCardBlobCache.ts` (`indexedDB.open`, keyPath
object stores, `browser` guard, promise wrappers). One database, **two object
stores**, so the browse list stays fast and never deserializes hundreds of
heavy decks:

- **`archiveMeta`** — light list rows. `keyPath: "refNumber"`. Record:
  ```ts
  interface ArchivedDeckMeta {
    refNumber: number;        // primary key
    createdAt: string;        // ISO; sort key (desc) for the list
    deckMode: "loop" | "tnd";
    loopType?: string;
    length?: number;
    level?: number;
    period?: string;          // "quartered" | "halved"
    prop?: string;            // effective prop type
    cardCount: number;
    words: string[];          // unique simplified words (for search/identify)
  }
  ```
- **`archiveDecks`** — heavy payload, loaded only on Open. `keyPath: "refNumber"`.
  ```ts
  interface ArchivedDeckPayload {
    refNumber: number;        // primary key
    cards: DeckReleaseCard[];
    sequences: SequenceData[];
  }
  ```

Service API:
```ts
archiveDeck(meta: ArchivedDeckMeta, payload: ArchivedDeckPayload): Promise<void>;
listArchivedDecks(): Promise<ArchivedDeckMeta[]>;      // sorted createdAt desc
getArchivedDeck(refNumber: number): Promise<ArchivedDeckPayload | null>;
deleteArchivedDeck(refNumber: number): Promise<void>;  // both stores
```

All methods are no-ops / return empty under SSR (`if (!browser) ...`) and
swallow IndexedDB errors with a `console.warn` — the archive is best-effort and
must never block or break a draw/render.

### Save hook — `DeckReleaserTab.svelte`

After a successful draw populates `rs.sequences` + `rs.cards` (LOOP:
`generateLiveDeck` just before it returns `true`; TnD: after `composeFullDeck` +
`loadSelectedSequences`), fire-and-forget:
```ts
void archiveDeck(buildArchiveMeta(), { refNumber: rs.referenceNumber, cards: rs.cards, sequences: rs.sequences });
```
`buildArchiveMeta()` reuses the same dial reads as `buildDeckMeta()` (loopType,
length, level, period, prop, cardCount, unique words). Keyed by
`rs.referenceNumber` (already bumped per generation). No await, no UI gating.

### Browse UI — two sections

Extend the existing browse surface (where `ReleaseHistoryPanel` renders) to show
two labeled sections:

- **Generated** — from `listArchivedDecks()`. Each row:
  `Deck NNN · {date} · "LOOP rotated · 8-step · L1 · Quartered" · 165 cards`.
  Actions: **Open · Release · Delete**.
- **Released** — existing `ReleaseHistoryPanel` content (Firestore), unchanged.

Implementation: a new `GeneratedArchivePanel.svelte` rendered above/beside the
released panel (sharing its row/button CSS), OR a section split inside the
existing panel. Either keeps the two lists visually distinct under one "Browse"
heading. Loads its list on mount and after each archive write (refresh signal).

### Open flow — recover the backs

`openArchivedDeck(refNumber)` in `DeckReleaserTab`:
1. `getArchivedDeck(refNumber)` → payload.
2. Set `rs.referenceNumber = refNumber`, `rs.sequences = payload.sequences`,
   `rs.cards = payload.cards`, clear `rs.viewingRelease`.
3. Restore the recipe dials from `archiveMeta` (loopType/length/level/period/prop)
   so the Configure screen reflects the opened deck.
4. `rs.step = "review"; rs.persist();` → `PrintPreviewPages` re-renders the exact
   cards (cached card blobs hit by content key where available), and the user can
   print / export / Fronts+Backs / release.

## Data flow

```
Generate ─▶ generateLiveDeck sets rs.sequences/rs.cards
                         │ (success)
                         ▼
              archiveDeck(meta, payload)  ──▶  IndexedDB: archiveMeta + archiveDecks
                                                            │
Browse (Generated section) ◀── listArchivedDecks() ────────┘
        │ Open
        ▼
   getArchivedDeck(ref) ─▶ load rs.sequences/cards ─▶ step=review ─▶ re-render
```

## Error handling

- IndexedDB unavailable / quota exceeded → `console.warn`, archive write is
  skipped; the draw and render proceed normally.
- Open on a missing/corrupt payload → toast "Couldn't load archived deck", stay
  on the current screen.
- SSR (`!browser`) → all archive calls no-op.

## Testing

- Unit (`deck-archive-store`): archive → list returns the meta sorted desc;
  get returns the exact payload; delete removes from both stores; SSR no-op.
  Use a fake-indexeddb shim (or the project's existing IDB test util) under the
  `tests/config/vitest.config.ts` config (Firestore mock present).
- Round-trip: archive a SequenceData[] and assert `getArchivedDeck` returns
  sequences whose `hashSequenceContent` matches the originals (exact-backs
  guarantee).
- Manual/runtime: generate two decks, confirm both appear in Generated; Open the
  first; confirm Review shows its exact cards; Delete removes the row.

## Files

- **Create:** `src/lib/features/choreo-card/services/deck-archive-store.ts`
- **Create:** `src/lib/features/choreo-card/components/deck-releaser/GeneratedArchivePanel.svelte`
- **Create:** `src/lib/features/choreo-card/services/__tests__/deck-archive-store.test.ts`
- **Modify:** `DeckReleaserTab.svelte` — save hook, `openArchivedDeck`, render the
  two-section browse.
- **Reference:** `DeckCardBlobCache.ts` (IDB pattern), `ReleaseHistoryPanel.svelte`
  (row/button CSS), `deck-recipe.ts` / `buildDeckMeta` (dial reads).
